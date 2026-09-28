import { NextRequest, NextResponse } from "next/server";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { scans } from "@/db/schema";
import { deductUserCredits, getChannelById, getChannelsByUserId } from "@/db/queries";
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
    gapScore: z.number().min(1).max(10).describe("Placeholder score; replaced by the server"),
    confidence: z.number().min(0).max(1).optional().default(0),
    reasoning: z.string().describe("Why this gap exists based on comment evidence"),
    whyNow: z.string().describe("Why you should make this video now instead of next month"),
    evidenceComments: z.array(z.object({
        commentId: z.string(),
    })).max(3).describe("IDs selected verbatim from the supplied comment list"),
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
    gaps: z.array(GapItemSchema).min(1).max(4),
    overallOpportunity: z.string().describe("1-sentence summary of the overall opportunity found"),
    commentInsights: z.object({
        totalAnalyzed: z.number(),
        frustrationRate: z.number().min(0).max(100),
        topPainPoints: z.array(z.string()).max(5),
        topQuestions: z.array(z.string()).max(5),
    }),
});

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

        if (channelId) {
            const targetChannel = await getChannelById(channelId);
            if (!targetChannel || targetChannel.userId !== dbUser.id) {
                return NextResponse.json({ success: false, error: "Channel not found." }, { status: 404, headers: corsHeaders });
            }
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

        if (keys.length === 0) {
            return NextResponse.json(
                { success: false, error: "Groq API keys not configured." },
                { status: 500, headers: corsHeaders }
            );
        }


        // Sort by likes DESC, take top 35, ensure IDs exist
        const sorted = comments
            .map(c => ({ ...c, id: crypto.randomUUID() }))
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
            .map((c) => `[ID: ${c.id}] [${c.likeCount ?? 0} likes] "${c.text}"`)
            .join("\n");

        const prompt = `You are a YouTube comment-analysis assistant. The supplied comments are the complete factual record. Never invent comments, viewer intent, demand, competition, trends, revenue, or performance forecasts.

Analyze the following viewer comments from one YouTube video to propose testable content hypotheses.

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

Based on these comments, generate 1-4 specific YouTube video concepts that:
- Directly answer the top frustrations/questions found
- Are specific (not generic) — backed by actual comment evidence
- Clearly separate observed comment evidence from your creative recommendation
- Do not claim market demand or likely performance

For overallOpportunity, write one bounded sentence summarizing the strongest testable hypothesis in this sample.

For commentInsights:
- totalAnalyzed: ${sorted.length} (exact — do not change)
- frustrationRate: ${deterministicFrustrationRate} (exact — do not change, already computed)
- topPainPoints: top 5 pain points from comments (short phrases, directly quoted or closely paraphrased)
- topQuestions: top 5 questions viewers asked that weren't answered`;


        let object: z.infer<typeof ResponseSchema> | null = null;
        let success = false;
        let lastError: unknown = null;

        const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

        for (const activeKey of shuffledKeys) {
            try {
                const groq = createGroq({ apiKey: activeKey });
                const result = await generateText({
                    model: groq("openai/gpt-oss-120b"),
                    messages: [
                        { role: "system", content: "You must output ONLY valid JSON that strictly matches the required schema. No markdown fences, no explanatory text. For evidenceComments, return ONLY the commentId of the exact comment used as evidence." },
                        { role: "user", content: prompt + `\n\nREQUIRED JSON SCHEMA:\n${JSON.stringify({ success: true, keyword: "string", gaps: [{ title: "string", gapScore: "number", confidence: "number", reasoning: "string", whyNow: "string", evidenceComments: [{ commentId: "string" }], hook: "string", format: "string", monetizationAngle: "string", targetAudience: "string", competitorWeakness: "string", contentOutline: ["string"], seoTips: ["string"] }], overallOpportunity: "string", commentInsights: { totalAnalyzed: "number", frustrationRate: "number", topPainPoints: ["string"], topQuestions: ["string"] } }, null, 2)}` }
                    ],
                    temperature: 0.2,
                });
                
                let rawText = result.text.trim();
                const start = rawText.indexOf("{");
                const end = rawText.lastIndexOf("}");
                if (start !== -1 && end !== -1) {
                    rawText = rawText.slice(start, end + 1);
                } else {
                    rawText = rawText.replace(/```json|```/g, "").trim();
                }
                
                const validation = ResponseSchema.safeParse(JSON.parse(rawText));
                if (!validation.success) throw new Error("AI output failed schema validation");
                object = validation.data;

                // Validate evidenceComments and structure
                if (object.gaps && Array.isArray(object.gaps)) {
                    object.gaps = object.gaps.map((gap) => {
                        const evidenceComments = gap.evidenceComments.map((ec) => {
                            const real = sorted.find(c => c.id === ec.commentId);
                            if (!real) return null;
                            return {
                                commentId: real.id,
                                text: real.text,
                                likes: real.likeCount ?? 0
                            };
                        }).filter((comment): comment is NonNullable<typeof comment> => comment !== null);
                        const evidenceCoverage = Math.min(1, evidenceComments.length / 2);
                        const sampleCoverage = Math.min(1, sorted.length / 35);
                        const gapScore = Math.round((1 + 9 * ((deterministicFrustrationRate / 100) * 0.65 + evidenceCoverage * 0.35)) * 10) / 10;
                        const confidence = Math.round(Math.min(0.9, sampleCoverage * 0.7 + evidenceCoverage * 0.3) * 100) / 100;

                        return {
                            ...gap,
                            id: crypto.randomUUID(),
                            gapScore,
                            confidence,
                            whyNow: "This is a hypothesis grounded in the current comment sample; validate it with a small title or format test.",
                            quantitativeReasons: [
                            { type: "frustration", label: "Viewer Frustration", value: deterministicFrustrationRate + "%", source: "comments" }
                            ],
                            evidenceComments,
                        };
                    });
                }
                object.commentInsights.totalAnalyzed = sorted.length;
                object.commentInsights.frustrationRate = deterministicFrustrationRate;

                success = true;
                break;
            } catch (aiErr: unknown) {
                lastError = aiErr;
                logger.warn("[Key Rotation GapScanner] Key failed, trying next...");
            }
        }

        if (!success || !object) {
            logger.error("[Gap Scanner AI Error] All keys exhausted.", lastError);
            return NextResponse.json({ success: false, error: "AI service temporarily unavailable (Rate limit)." }, { status: 503, headers: corsHeaders });
        }

        // ── Deduct credit only after AI succeeds (no charge on AI failure) ────────
        const chargedUser = await deductUserCredits(dbUser.id, 1, "Extension Search Scanner");
        if (!chargedUser) {
            return NextResponse.json({ success: false, error: "Insufficient credits", message: "Your available credit was used by another request." }, { status: 402, headers: corsHeaders });
        }

        const scanId = crypto.randomUUID();

        // ── Persist to DB (non-blocking, fire-and-forget) ───────────────────────
        try {
            let targetChannelId = channelId;
            if (!targetChannelId) {
                const userChannels = await getChannelsByUserId(dbUser.id);
                if (userChannels.length > 0) {
                    targetChannelId = userChannels[0].id;
                }
            }

            if (targetChannelId) {
                await db.insert(scans).values({
                    id: scanId,
                    userId: dbUser.id,
                    channelId: targetChannelId,
                    keyword,
                    competitors: [],       // comment mining has no competitor URLs
                    rawData: {
                        source: "comment-mine",
                        collectedAt: new Date().toISOString(),
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
        } catch (dbErr) {
            // Non-blocking — user still sees results even if DB save fails
            logger.error("[GapScanner DB Error]", dbErr);
        }

        return NextResponse.json(
            { ...object, success: true, scanId, keyword },
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
