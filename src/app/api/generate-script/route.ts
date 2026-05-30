import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { createBotMessage, getChannelById, getChannelScans } from '@/db/queries';
import { auth } from '@/auth';
import { getUserByEmail, getChannelsByUserId, deductUserCredits } from '@/db/queries';
import type { GapItem, ScanAnalytics } from '@/db/schema';

// Allow streaming responses up to 60 seconds
export const maxDuration = 60; // Vercel Hobby plan max for streaming/Next.js config


// ─── Build Channel-Aware System Prompt ───────────────────────────────────────

async function buildChannelAwarePrompt(channelId?: string, userId?: string): Promise<string> {
    const basePrompt = `You are GapTuber AI — an expert YouTube scriptwriter, growth strategist, and content analyst. You specialize in crafting highly engaging, fast-paced, and retention-optimized scripts for creators. Do not include introductory fluff; get straight into the answer or script.`;

    if (!channelId && !userId) return basePrompt;

    try {
        // Try to get channel data
        let channel = channelId ? await getChannelById(channelId) : null;

        // If no specific channel, try to get user's primary channel
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

        if (!channel) return basePrompt;

        // Build rich context from channel data
        let context = `${basePrompt}

CHANNEL CONTEXT — You are assisting the creator of this specific channel:
- Channel Name: "${channel.name}"
- Niche: ${channel.category || "General"}
- Topic Focus: ${channel.topic || "Various"}
- Channel Type: ${channel.role === "new_tuber" ? "New Channel (just starting)" : "Existing Channel"}`;

        // Add scan data if available (recent gap analysis, trending keywords, pain points)
        try {
            const scans = await getChannelScans(channel.id);
            if (scans.length > 0) {
                const recentScans = scans.slice(-3); // Last 3 scans
                const allGaps = recentScans.flatMap(s => {
                    const result = s.result as { gaps: GapItem[] } | null;
                    return result?.gaps ?? [];
                });
                const allAnalytics = recentScans
                    .map(s => s.analytics as ScanAnalytics | null)
                    .filter(Boolean) as ScanAnalytics[];

                if (allGaps.length > 0) {
                    const topGaps = allGaps
                        .sort((a, b) => b.gapScore - a.gapScore)
                        .slice(0, 5);
                    context += `\n\nRECENT GAP ANALYSIS (from YouTube data — use as context for recommendations):`;
                    for (const gap of topGaps) {
                        context += `\n- "${gap.title}" (Score: ${gap.gapScore}/10) — ${gap.reasoning.slice(0, 100)}`;
                    }
                }

                if (allAnalytics.length > 0) {
                    const latest = allAnalytics[allAnalytics.length - 1]!;
                    context += `\n\nMARKET SIGNALS:`;
                    if (latest.velocity) context += `\n- Velocity: ${latest.velocity.insight}`;
                    if (latest.frustration?.painPoints?.length) {
                        context += `\n- Audience Pain Points: ${latest.frustration.painPoints.join(", ")}`;
                    }
                    if (latest.suggestedTags?.length) {
                        context += `\n- Trending Tags: ${latest.suggestedTags.slice(0, 8).join(", ")}`;
                    }
                    if (latest.uploadSchedule) {
                        context += `\n- Best Upload Time: ${latest.uploadSchedule.bestDay} at ${latest.uploadSchedule.bestHour}:00 UTC`;
                    }
                }

                const recentKeywords = recentScans.map(s => s.keyword).filter(Boolean);
                if (recentKeywords.length > 0) {
                    context += `\n\nRECENT KEYWORDS ANALYZED: ${recentKeywords.join(", ")}`;
                }
            }
        } catch {
            // Scan data is optional enrichment
        }

        context += `\n\nIMPORTANT INSTRUCTIONS:
- All scripts, ideas, and suggestions MUST be specifically relevant to the "${channel.topic || channel.category || "General"}" niche
- Reference the channel's actual data and gaps when giving advice
- When asked for video ideas, align them with the channel's topic and audience
- When writing scripts, match the tone and format typical for this niche
- If the user asks about topics outside this niche, explain how to connect it back to their channel's focus`;

        return context;

    } catch {
        return basePrompt;
    }
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        // Auth guard — prevents unauthenticated Groq quota drain
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const user = await getUserByEmail(session.user.email);
        if (!user) {
            return new Response('User not found', { status: 404 });
        }

        if (user.credits < 2) {
            return new Response('Insufficient credits. Please upgrade your plan.', { status: 403 });
        }

        const { prompt, chatId, channelId } = await req.json();

        if (!prompt) {
            return new Response('Prompt is required', { status: 400 });
        }

        // Save user message to Postgres if a chatId is provided
        if (chatId) {
            await createBotMessage({
                chatId,
                sender: "user",
                content: prompt,
            });
        }

        // Build channel-aware system prompt
        const systemPrompt = await buildChannelAwarePrompt(channelId);

        const keys = [
            process.env.GROQ_API_KEY,
            process.env.GROQ_API_KEY_2,
            process.env.GROQ_API_KEY_3
        ].filter(Boolean) as string[];

        if (keys.length === 0) {
            return new Response('Groq API keys not configured', { status: 503 });
        }
        const activeKey = keys[Math.floor(Math.random() * keys.length)];
        const groq = createGroq({ apiKey: activeKey });

        const result = streamText({
            model: groq('llama-3.3-70b-versatile'),
            system: systemPrompt,
            prompt: prompt,
            onFinish: async ({ text }) => {
                // Save AI message to Postgres when streaming finishes
                if (chatId && text) {
                    try {
                        await createBotMessage({
                            chatId,
                            sender: "ai",
                            content: text,
                        });
                    } catch (err) {
                        console.error("Failed to save AI message to DB:", err);
                    }
                }
                
                // Deduct 2 credits for script generation
                await deductUserCredits(user.id, 2, "Script Generation");
            }
        });

        return result.toTextStreamResponse();
    } catch (error) {
        console.error('Script generation error:', error);
        return new Response('Error generating script', { status: 500 });
    }
}
