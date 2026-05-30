import { NextRequest, NextResponse } from "next/server";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import { decode } from "next-auth/jwt";
import { db } from "@/db";
import { scans } from "@/db/schema";
import { getUserByEmail, deductUserCredits } from "@/db/queries";
import { resolveUserFromRequest } from "@/lib/resolve-user";
import { getCorsHeaders } from "@/lib/cors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { env } from "@/env";

// nodejs runtime required: in-memory rate limiting needs persistent state across requests
export const runtime = "nodejs";
export const maxDuration = 300; // Fluid Compute: 5 minute max on Vercel Hobby plan


export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}

// ─── Zod Schemas ───────────────────────────────────────────────────────────────

const GapItemSchema = z.object({
    title: z.string().describe("Specific, clickable YouTube video title addressing the gap"),
    gapScore: z.number().min(1).max(10).describe("How strong this content gap is (1–10)"),
    reasoning: z.string().describe("Why this gap exists based on comment evidence"),
    hook: z.string().describe("Opening hook sentence for the video script"),
    format: z.string().describe("Recommended format e.g. 'Tutorial', 'Deep Dive', 'Comparison'"),
    monetizationAngle: z.string().describe("How to monetize this video concept"),
    targetAudience: z.string().optional().describe("Who specifically this video is for"),
    competitorWeakness: z.string().optional().describe("What the original video got wrong that you will fix"),
    contentOutline: z.array(z.string()).optional().describe("3–5 bullet points for the video structure"),
    seoTips: z.array(z.string()).optional().describe("2–3 SEO optimisation tips for this topic"),
});

const ResponseSchema = z.object({
    success: z.boolean(),
    keyword: z.string(),
    gaps: z.array(GapItemSchema),
    overallOpportunity: z.string().describe("1-sentence summary of the overall opportunity found"),
    commentInsights: z.object({
        totalAnalyzed: z.number(),
        frustrationRate: z.number().min(0).max(100),
        topPainPoints: z.array(z.string()).max(5),
        topQuestions: z.array(z.string()).max(5),
    }),
});

// ─── Auth helper: session cookie or X-Session-Token header ────────────────────

async function resolveUserEmail(req: NextRequest): Promise<string | null> {
    try {
        const session = await auth();
        if (session?.user?.email) return session.user.email;
    } catch { /* ignore */ }

    const headerToken = req.headers.get("X-Session-Token");
    if (!headerToken) return null;

    const salts = [
        "__Secure-authjs.session-token",
        "authjs.session-token",
        "__Secure-next-auth.session-token",
        "next-auth.session-token",
    ];
    for (const salt of salts) {
        try {
            const decoded = await decode({ token: headerToken, secret: env.AUTH_SECRET!, salt });
            if (decoded?.email) return decoded.email as string;
        } catch { /* try next salt */ }
    }
    return null;
}

// ─── Request Body Schema ───────────────────────────────────────────────────────

const RequestBodySchema = z.object({
    keyword: z.string().min(1).max(200).default("youtube"),
    videoTitle: z.string().max(500).default("Unknown Video"),
    comments: z
        .array(
            z.object({
                text: z.string().max(1000),
                likeCount: z.number().int().min(0).optional(),
            })
        )
        .min(1)
        .max(500),
    channelId: z.string().uuid().optional().or(z.literal("")).transform(v => v || undefined),
});

// ─── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const corsHeaders = getCorsHeaders(req);

    try {
        let rawBody: unknown;
        try {
            rawBody = await req.json();
        } catch {
            return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400, headers: corsHeaders });
        }

        const parsed = RequestBodySchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Invalid request", details: parsed.error.flatten() },
                { status: 400, headers: corsHeaders }
            );
        }

        const { keyword, videoTitle, comments, channelId = "" } = parsed.data;

        // ── Auth & Credit Check ──
        const dbUser = await resolveUserFromRequest(req);
        if (!dbUser) {
            return NextResponse.json({ success: false, error: "Unauthorized", message: "Please log in to the extension." }, { status: 401, headers: corsHeaders });
        }
        if (dbUser.credits < 1) {
            return NextResponse.json({ success: false, error: "Insufficient credits", message: "You need at least 1 credit to analyze." }, { status: 402, headers: corsHeaders });
        }

        // Rate limit by user email (if authenticated) or by IP
        const userEmail = dbUser.email;
        const rateLimitKey = userEmail
            ? `gap-scanner:${userEmail}`
            : `gap-scanner:ip:${req.headers.get("x-forwarded-for") ?? "unknown"}`;
        const { max, windowMs } = RATE_LIMITS.gapScanner;
        const rl = await rateLimit(rateLimitKey, max, windowMs);
        if (!rl.allowed) {
            return NextResponse.json(
                { success: false, error: `Rate limit: max ${max} scans/hour. Retry in ${Math.ceil(rl.resetMs / 60000)} min.` },
                { status: 429, headers: corsHeaders }
            );
        }

        if (!comments.length) {
            return NextResponse.json(
                { success: false, error: "No comments provided for analysis." },
                { status: 400, headers: corsHeaders }
            );
        }

        const keys = [
            env.GROQ_API_KEY,
            env.GROQ_API_KEY_2,
            env.GROQ_API_KEY_3
        ].filter(Boolean) as string[];

        // Deduct 1 credit for analysis
        await deductUserCredits(dbUser.id, 1, "Extension Search Scanner");

        if (keys.length === 0) {
            return NextResponse.json(
                { success: false, error: "Groq API keys not configured." },
                { status: 500, headers: corsHeaders }
            );
        }


        // Sort by likes DESC, take top 35
        const sorted = [...comments]
            .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
            .slice(0, 35);

        // ── Deterministic frustration pre-scoring ─────────────────────────────
        // Count comments containing frustration/question signals — no AI guessing
        const frustrationPatterns = [
            /\b(why|how|what|when|does|can|could|should|would|is there|isn't|doesn't|won't|can't|didn't|not working|broken|wrong|problem|issue|error|bug|help|confused|lost|unclear|missing|where|still|nobody|anyone)\b/i,
            /\?/,
            /\b(please|fix|need|want|wish|hope|would love|any way|alternative|instead)\b/i,
        ];
        const frustratedCount = sorted.filter(c =>
            frustrationPatterns.some(p => p.test(c.text))
        ).length;
        const deterministicFrustrationRate = sorted.length > 0
            ? Math.round((frustratedCount / sorted.length) * 100)
            : 0;

        const commentText = sorted
            .map((c, i) => `${i + 1}. [${c.likeCount ?? 0} likes] "${c.text}"`)
            .join("\n");

        const prompt = `You are an elite YouTube Strategy Analyst with deep expertise in content gap detection.

Analyze the following viewer comments from a YouTube video to find HIGH-VALUE content gaps.

TARGET KEYWORD: "${keyword}"
VIDEO ANALYZED: "${videoTitle}"
DETERMINISTIC FRUSTRATION SCORE: ${deterministicFrustrationRate}% (pre-computed from ${sorted.length} comments — use this exact number for frustrationRate, do NOT estimate your own)

TOP VIEWER COMMENTS (sorted by likes — higher likes = more viewers agree):
${commentText}

YOUR MISSION:
1. Find UNANSWERED QUESTIONS — things viewers asked but weren't addressed
2. Find COMPLAINTS — what viewers say the video missed, got wrong, or glossed over
3. Find REQUESTS — specific use-cases, scenarios, or depths viewers wanted
4. Find FRUSTRATIONS — pain points mentioned repeatedly by high-liked comments

Based on these real viewer frustrations, generate exactly 4 specific, high-converting YouTube video concepts that:
- Directly answer the top frustrations/questions found
- Are specific (not generic) — backed by actual comment evidence
- Have clear monetization potential
- Would make someone say "FINALLY a video about this!"

For overallOpportunity, write a single compelling sentence summarizing what huge opportunity exists in this comment section.

For commentInsights:
- totalAnalyzed: ${sorted.length} (exact — do not change)
- frustrationRate: ${deterministicFrustrationRate} (exact — do not change, already computed)
- topPainPoints: top 5 pain points from comments (short phrases, directly quoted or closely paraphrased)
- topQuestions: top 5 questions viewers asked that weren't answered`;


        let object: any = null;
        let success = false;
        let lastError: any = null;

        const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

        for (const activeKey of shuffledKeys) {
            try {
                const groq = createGroq({ apiKey: activeKey });
                const result = await generateText({
                    model: groq("llama-3.3-70b-versatile"),
                    messages: [
                        { role: "system", content: "You must output ONLY valid JSON that strictly matches the required schema. No markdown fences, no explanatory text." },
                        { role: "user", content: prompt + `\n\nREQUIRED JSON SCHEMA:\n${JSON.stringify({ success: true, keyword: "string", gaps: [{ title: "string", gapScore: "number", reasoning: "string", hook: "string", format: "string", monetizationAngle: "string", targetAudience: "string", competitorWeakness: "string", contentOutline: ["string"], seoTips: ["string"] }], overallOpportunity: "string", commentInsights: { totalAnalyzed: "number", frustrationRate: "number", topPainPoints: ["string"], topQuestions: ["string"] } }, null, 2)}` }
                    ],
                    temperature: 0.4,
                });
                
                let rawText = result.text.trim();
                const start = rawText.indexOf("{");
                const end = rawText.lastIndexOf("}");
                if (start !== -1 && end !== -1) {
                    rawText = rawText.slice(start, end + 1);
                } else {
                    rawText = rawText.replace(/```json|```/g, "").trim();
                }
                
                object = JSON.parse(rawText);
                success = true;
                break;
            } catch (aiErr: any) {
                lastError = aiErr;
                logger.warn("[Key Rotation GapScanner] Key failed, trying next...");
            }
        }

        if (!success || !object) {
            logger.error("[Gap Scanner AI Error] All keys exhausted.", lastError);
            return NextResponse.json({ success: false, error: "AI service temporarily unavailable (Rate limit)." }, { status: 503, headers: corsHeaders });
        }

        // ── Persist to DB (non-blocking, fire-and-forget) ───────────────────────
        try {
            // Issue #3: reuse already-resolved userEmail, no second resolveUserEmail() call
            if (userEmail) {
                const user = await getUserByEmail(userEmail);
                if (user) {
                    let targetChannelId = channelId;
                    if (!targetChannelId) {
                        const { getChannelsByUserId } = await import("@/db/queries");
                        const userChannels = await getChannelsByUserId(user.id);
                        if (userChannels.length > 0) {
                            targetChannelId = userChannels[0].id;
                        }
                    }

                    if (targetChannelId) {
                        await db.insert(scans).values({
                            userId: user.id,
                            channelId: targetChannelId,
                            keyword,
                            competitors: [],       // comment mining has no competitor URLs
                            rawData: {
                                source: "comment-mine",
                                videoTitle,
                                commentCount: comments.length,
                                commentInsights: object.commentInsights,
                            },
                            result: {
                                gaps: object.gaps,
                                overallOpportunity: object.overallOpportunity,
                            },
                            analytics: null,       // no channel analytics for comment mining
                        });
                        logger.info(`[GapScanner] Saved ${object.gaps.length} gaps for ${userEmail} — "${keyword}" on channel ${targetChannelId}`);
                    }
                }
            }
        } catch (dbErr) {
            // Non-blocking — user still sees results even if DB save fails
            logger.error("[GapScanner DB Error]", dbErr);
        }

        return NextResponse.json(
            { ...object, success: true, keyword },
            { headers: corsHeaders }
        );

    } catch (err) {
        logger.error("[GAP_SCANNER_ERROR]", err);
        return NextResponse.json(
            { success: false, error: "Failed to analyze comments." },
            { status: 500, headers: corsHeaders }
        );
    }
}
