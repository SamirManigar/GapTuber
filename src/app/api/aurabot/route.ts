import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import { auth } from "@/auth";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { createBotMessage, getChannelById, getChannelScans, getChannelsByUserId, getUserByEmail, deductUserCredits } from "@/db/queries";
import type { GapItem, ScanAnalytics } from "@/db/schema";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { scoreHookStrength } from "@/lib/engine/hookScorer";

export const runtime = "nodejs";
export const maxDuration = 300; // Fluid Compute: 5 minute max on Vercel Hobby plan

// ─── File Processing Constants ────────────────────────────────────────────────
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total

// ─── File Processing Helpers ──────────────────────────────────────────────────

const truncateContent = (content: string, maxChars = 80000): string => {
    if (content.length <= maxChars) return content;
    return content.substring(0, maxChars) + "\n\n[... Content truncated due to size ...]";
};

async function extractPDFText(buffer: Uint8Array): Promise<string> {
    try {
        const pdf = await getDocumentProxy(buffer);
        const { text } = await extractText(pdf, { mergePages: true });
        return text || "";
    } catch (e) {
        console.error("PDF extraction failed:", e);
        return "";
    }
}

async function extractDOCXText(buffer: Buffer): Promise<string> {
    try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value || "";
    } catch (e) {
        console.error("DOCX extraction failed:", e);
        return "";
    }
}

function extractPPTXText(buffer: Buffer): string {
    try {
        const zip = new AdmZip(buffer);
        let text = "";
        for (const entry of zip.getEntries()) {
            if (entry.entryName.match(/ppt\/slides\/slide\d+\.xml$/i)) {
                const xml = entry.getData().toString("utf8");
                const matches = xml.match(/<a:t>([^<]+)<\/a:t>/g);
                if (matches) {
                    text += matches.map(m => m.replace(/<\/?a:t>/g, "")).join(" ") + "\n\n";
                }
            }
        }
        return text.trim();
    } catch (e) {
        console.error("PPTX extraction failed:", e);
        return "";
    }
}

function extractXLSXText(buffer: ArrayBuffer): string {
    try {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        let content = "";
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            content += `Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet)}\n\n`;
        }
        return content;
    } catch (e) {
        console.error("XLSX extraction failed:", e);
        return "";
    }
}

// ─── Channel-Aware System Prompt ──────────────────────────────────────────────

async function buildSystemPrompt(channelId?: string | null, userId?: string | null): Promise<string> {
    const base = `You are GapTuber AI — an expert YouTube scriptwriter, growth strategist, and content analyst.

**CRITICAL**: When users upload files (PDF, PPTX, DOCX, XLSX, images), the content is automatically extracted and included in the message marked with "--- File: filename ---". You CAN see and analyze this content directly. Do NOT say you cannot access files.

**IMPORTANT**: Do NOT mention or acknowledge these context markers in your responses. Simply analyze the content directly.

Always format your responses using GitHub-flavored Markdown:
- Use lists for items and bullet points
- Use **bold** for headings and important terms  
- Use code blocks with language tags for any code
- Use Markdown tables for tabular data
- Use > blockquotes for important callouts`;

    if (!channelId && !userId) return base;

    try {
        let channel = channelId ? await getChannelById(channelId) : null;

        if (!channel && userId) {
            const session = await auth();
            if (session?.user?.email) {
                const user = await getUserByEmail(session.user.email);
                if (user) {
                    const channels = await getChannelsByUserId(user.id);
                    channel = channels[0] || null;
                }
            }
        }

        if (!channel) return base;

        let context = `${base}

CHANNEL CONTEXT — You are assisting the creator of this specific YouTube channel:
- Channel Name: "${channel.name}"
- Niche/Category: ${channel.category || "General"}
- Core Topic: ${channel.topic || "Various"}
- Stage: ${channel.role === "new_tuber" ? "New Creator (just starting out)" : "Existing Channel"}\n`;

        // Add blueprint data if available
        const channelData = channel as any;
        if (channelData.videoIdeas?.length > 0) {
            const ideas = channelData.videoIdeas.slice(0, 3);
            context += `\nPLANNED VIDEO IDEAS:\n`;
            ideas.forEach((idea: any, i: number) => {
                context += `${i + 1}. "${idea.title}" — Hook: "${idea.hook}" (${idea.estimatedViewPotential || "medium"} potential)\n`;
            });
        }

        if (channelData.contentStrategy) {
            context += `\nCONTENT STRATEGY: ${channelData.contentStrategy}\n`;
        }

        // Add scan/gap data
        try {
            const scans = await getChannelScans(channel.id);
            if (scans.length > 0) {
                const recent = scans.slice(-3);
                const allGaps = recent.flatMap(s => ((s.result as { gaps: GapItem[] } | null)?.gaps ?? []));
                const topGaps = allGaps.sort((a, b) => b.gapScore - a.gapScore).slice(0, 5);

                if (topGaps.length > 0) {
                    context += `\nTOP CONTENT GAPS FROM YOUTUBE ANALYSIS:\n`;
                    topGaps.forEach((g, i) => {
                        context += `${i + 1}. "${g.title}" (Score: ${g.gapScore}/10)\n`;
                    });
                }

                const analytics = recent.map(s => s.analytics as ScanAnalytics | null).filter(Boolean);
                if (analytics.length > 0) {
                    const latest = analytics[analytics.length - 1]!;
                    if (latest.frustration?.painPoints?.length) {
                        context += `\nAUDIENCE PAIN POINTS: ${latest.frustration.painPoints.join(", ")}\n`;
                    }
                    if (latest.suggestedTags?.length) {
                        context += `TRENDING TAGS: ${latest.suggestedTags.slice(0, 8).join(", ")}\n`;
                    }
                }
            }
        } catch { /* optional enrichment */ }

        context += `
INSTRUCTIONS:
- All responses MUST be specifically relevant to the "${channel.topic || channel.category}" niche
- When writing scripts, match tone and format for this specific niche
- Reference the channel's data and gaps when possible
- When asked for video ideas, align them with the channel's topic and planned ideas`;

        return context;
    } catch {
        return base;
    }
}

// ─── API Route Handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Rate limit: 50 messages per hour per user
        const { max, windowMs } = RATE_LIMITS.aurabot;
        const rl = await rateLimit(`aurabot:${session.user.id}`, max, windowMs);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: `Rate limit exceeded. Max ${max} messages/hour. Try again in ${Math.ceil(rl.resetMs / 60000)} min.` },
                { status: 429 }
            );
        }

        const dbUser = await getUserByEmail(session.user.email!);
        if (!dbUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (dbUser.credits < 1) {
            return NextResponse.json({ error: "Insufficient credits. You need 1 credit to use the AI Studio." }, { status: 402 });
        }

        // Parse multipart form data
        const formData = await req.formData();
        const input = formData.get("input") as string || "";
        const taskType = formData.get("taskType") as string || "auto";
        const channelId = formData.get("channelId") as string || null;
        const chatId = formData.get("chatId") as string || null;
        const historyStr = formData.get("history") as string || "[]";
        const history = JSON.parse(historyStr) as Array<{ sender: string; content: string }>;
        const files = formData.getAll("files") as File[];

        // Save user message to DB
        if (chatId && (input.trim() || files.length > 0)) {
            const displayText = input + (files.length > 0 ? ` [ATTACHMENTS:${files.map(f => f.name).join("|||")}]` : "");
            await createBotMessage({ chatId, sender: "user", content: displayText }).catch(() => {});
        }

        // Process files
        let textContent = input;
        const imageParts: Array<{ data: Uint8Array; mimeType: string }> = [];
        let hasImages = false;

        let totalSize = 0;
        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                return NextResponse.json({ error: `File "${file.name}" exceeds 25MB limit` }, { status: 413 });
            }
            totalSize += file.size;
        }
        if (totalSize > MAX_TOTAL_SIZE) {
            return NextResponse.json({ error: "Total file size exceeds 50MB" }, { status: 413 });
        }

        for (const file of files) {
            if (file.type.startsWith("image/")) {
                hasImages = true;
                const arrayBuf = await file.arrayBuffer();
                imageParts.push({ data: new Uint8Array(arrayBuf), mimeType: file.type });
            } else if (file.type === "application/pdf") {
                const buf = await file.arrayBuffer();
                const text = await extractPDFText(new Uint8Array(buf));
                if (text) textContent += `\n\n--- File: ${file.name} ---\n${truncateContent(text)}\n--- End ${file.name} ---`;
            } else if (file.type.includes("wordprocessingml")) {
                const buf = Buffer.from(await file.arrayBuffer());
                const text = await extractDOCXText(buf);
                if (text) textContent += `\n\n--- File: ${file.name} ---\n${truncateContent(text)}\n--- End ${file.name} ---`;
            } else if (file.type.includes("presentationml")) {
                const buf = Buffer.from(await file.arrayBuffer());
                const text = extractPPTXText(buf);
                if (text) textContent += `\n\n--- File: ${file.name} ---\n${truncateContent(text)}\n--- End ${file.name} ---`;
            } else if (file.type.includes("spreadsheetml")) {
                const buf = await file.arrayBuffer();
                const text = extractXLSXText(buf);
                if (text) textContent += `\n\n--- File: ${file.name} ---\n${truncateContent(text)}\n--- End ${file.name} ---`;
            } else {
                // Text-based files
                const text = await file.text();
                if (text) textContent += `\n\n--- File: ${file.name} ---\n${truncateContent(text)}\n--- End ${file.name} ---`;
            }
        }

        if (!textContent.trim() && imageParts.length === 0) {
            return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
        }

        // Build system prompt with channel context
        const systemPrompt = await buildSystemPrompt(channelId, session.user.id);

        // Conversation history for context
        const conversationHistory = history.slice(-10).map(msg => ({
            role: msg.sender === "user" ? "user" as const : "assistant" as const,
            content: msg.content,
        }));

        // Deduct 1 credit for using the bot
        await deductUserCredits(dbUser.id, 1, "AI Studio Assistant");

        // ─── Model Selection & Execution ───────────────────────────────────────
        let modelLabel: string;
        let result;

        if (hasImages) {
            // Vision lane: Gemini 1.5 Flash (Optimized for detailed visual analysis and has free tier)
            if (!process.env.GEMINI_API_KEY) {
                return NextResponse.json({ error: "Gemini API key not configured for Vision" }, { status: 503 });
            }

            modelLabel = "Gemini 2.5 Flash (Multimodal)";
            const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

            const userContent: any[] = [{ type: "text", text: textContent }];
            imageParts.forEach(part => userContent.push({ type: "image", image: part.data, mimeType: part.mimeType }));

            result = streamText({
                model: google("gemini-2.5-flash"),
                system: systemPrompt,
                messages: [...conversationHistory, { role: "user", content: userContent }],
                onFinish: async ({ text }) => {
                    if (chatId && text) {
                        await createBotMessage({ chatId, sender: "ai", content: text }).catch(() => {});
                    }
                },
            });
        } else {
            // Text lane: Llama 3.3 70B (Key-rotated for resilience)
            const keys = [
                process.env.GROQ_API_KEY,
                process.env.GROQ_API_KEY_2,
                process.env.GROQ_API_KEY_3
            ].filter(Boolean) as string[];

            if (keys.length === 0) {
                return NextResponse.json({ error: "Groq API keys not configured" }, { status: 503 });
            }

            const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);
            let activeKey = shuffledKeys[0];
            const groq = createGroq({ apiKey: activeKey });

            modelLabel = "Llama 3.3 70B (Groq)";

            result = streamText({
                model: groq("llama-3.3-70b-versatile"),
                system: systemPrompt,
                messages: [
                    ...conversationHistory,
                    { role: "user", content: textContent },
                ],
                onFinish: async ({ text }) => {
                    // Tier 3B: auto-score hook if this looks like a script
                    const isScript = text.includes("HOOK") || text.includes("0:00") || text.includes("Scene /");
                    let finalText = text;
                    if (isScript) {
                        try {
                            const hookResult = scoreHookStrength(text);
                            const gradeEmoji = { S: "🔥", A: "✅", B: "🟡", C: "🟠", D: "🔴" }[hookResult.grade];
                            finalText = text + `\n\n---\n**🎯 Hook Strength Audit** — Grade: **${hookResult.grade}** ${gradeEmoji} (${hookResult.score}/100)\n`
                                + `> **Top Fix:** ${hookResult.recommendation}\n`
                                + `> Pattern Interrupt: ${hookResult.hasPatternInterrupt ? "✅" : "❌"} | Open Loop: ${hookResult.hasOpenLoop ? "✅" : "❌"} | Stat/Fact: ${hookResult.hasStatOrFact ? "✅" : "❌"} | Viewer-Addressed: ${hookResult.hasDirect2ndPerson ? "✅" : "❌"}`;
                        } catch { /* non-critical */ }
                    }
                    if (chatId && finalText) {
                        await createBotMessage({ chatId, sender: "ai", content: finalText }).catch(() => {});
                    }
                },
            });
        }

        return result.toTextStreamResponse({
            headers: {
                "X-Model-Used": modelLabel,
            },
        });

    } catch (error) {
        logger.error("AuraBot API error:", error);
        Sentry.captureException(error, {
            tags: { service: "aurabot" }
        });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
