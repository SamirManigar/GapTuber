import { NextRequest, NextResponse, after } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createGroq } from "@ai-sdk/groq";
import { generateText, generateObject } from "ai";
import { auth } from "@/auth";
import { decode } from "next-auth/jwt";
import { db } from "@/db";
import { scans } from "@/db/schema";
import { getUserByEmail, getChannelsByUserId, deductUserCredits } from "@/db/queries";
import { resolveUserFromRequest } from "@/lib/resolve-user";
import {
    buildGapCandidates,
    computeVelocityScore,
    computeSaturationScore,
    computeFrustrationScore,
    computeEngagementScore,
    computeTrendMomentum,
    computeCompetitionScore,
    computeOptimalUploadSchedule,
    estimateRevenue,
    generateOptimalTags,
} from "@/lib/engine/scoring";
import { buildAnalysisPrompt } from "@/lib/engine/prompts";
import { AnalyzeRequestSchema, GapOutputSchema } from "@/lib/engine/schemas";
import { getRandomYouTubeApiKey, getChannelIdFromHandle, getRecentChannelVideos, getSearchResults, getTopComments } from "@/lib/youtube-server";
import { VideoData } from "@/lib/engine/scoring";

export const runtime = "nodejs";
export const maxDuration = 300; // Fluid Compute: 5 minute max on Vercel Hobby plan

// CORS: reflect origin for credentialed requests (Access-Control-Allow-Origin: * won't work with credentials)
function getCorsHeaders(req: NextRequest): Record<string, string> {
    const origin = req.headers.get("origin") ?? "*";
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token, X-Session-Cookie",
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    };
}

// Handle preflight requests from Chrome Extension
export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}

function getClientIp(req: NextRequest): string {
    return (
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        "unknown"
    );
}

export async function POST(req: NextRequest) {
    try {
        // Rate limiting
        const ip = getClientIp(req);
        const { allowed, remaining, resetMs } = await rateLimit(`analyze:${ip}`, RATE_LIMITS.analyze.max, RATE_LIMITS.analyze.windowMs);

        if (!allowed) {
            return NextResponse.json(
                {
                    error: "Rate limit exceeded",
                    message: `You can run ${RATE_LIMITS.analyze.max} scans per hour. Please try again later.`,
                    retryAfter: Math.ceil(resetMs / 1000),
                },
                {
                    status: 429,
                    headers: {
                        ...getCorsHeaders(req),
                        "X-RateLimit-Reset": (Date.now() + resetMs).toString(),
                    },
                }
            );
        }

        // Parse and validate input
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON", message: "Request body must be valid JSON." },
                { status: 400 }
            );
        }

        const parseResult = AnalyzeRequestSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    message: "Invalid request data.",
                    details: parseResult.error.flatten(),
                },
                { status: 400 }
            );
        }

        const input = parseResult.data;

        // ── Auth & Credit Check ──
        const dbUser = await resolveUserFromRequest(req);
        if (!dbUser) {
            return NextResponse.json({ error: "Unauthorized", message: "Please log in to the extension." }, { status: 401, headers: getCorsHeaders(req) });
        }
        if (dbUser.credits < 1) {
            return NextResponse.json({ error: "Insufficient credits", message: "You need at least 1 credit to analyze." }, { status: 402, headers: getCorsHeaders(req) });
        }

        let videos = input.videos ?? [];
        let searchResults = input.searchResults ?? [];
        let comments = input.comments ?? [];

        // 1. Fetch competitors' videos if provided
        if (input.competitors && input.competitors.length > 0) {
            const apiKey = getRandomYouTubeApiKey();
            if (!apiKey) {
                return NextResponse.json({ error: "YouTube API Key is missing for competitor analysis." }, { status: 500, headers: getCorsHeaders(req) });
            }

            for (const competitor of input.competitors) {
                const ytChannelId = await getChannelIdFromHandle(competitor, apiKey);
                if (ytChannelId) {
                    const recentVideos = await getRecentChannelVideos(ytChannelId, apiKey, 10);
                    videos = [...videos, ...recentVideos];
                }
            }
            // Deduplicate
            videos = Array.from(new Map(videos.map(v => [v.url, v])).values());
        }

        if (videos.length === 0) {
             return NextResponse.json({ error: "No videos found for analysis. Please provide valid competitor channels." }, { status: 400, headers: getCorsHeaders(req) });
        }

        // 2. Fetch search results and comments if not provided
        if (searchResults.length === 0 || comments.length === 0) {
            const apiKey = getRandomYouTubeApiKey();
            if (apiKey) {
                if (searchResults.length === 0) {
                    searchResults = await getSearchResults(input.keyword, apiKey, 15);
                }
                if (comments.length === 0) {
                    const topVideos = [...videos].sort((a, b) => b.views - a.views).slice(0, 3);
                    for (const video of topVideos) {
                        const videoId = video.url.split("v=")[1];
                        if (videoId) {
                            const topComms = await getTopComments(videoId, apiKey, 10);
                            comments = [...comments, ...topComms.map((c: any) => ({
                                text: c.text,
                                videoUrl: video.url,
                                likeCount: c.likeCount,
                                authorName: c.authorName
                            }))];
                        }
                    }
                }
            }
        }

        if (videos.length === 0) {
             return NextResponse.json({ error: "No videos found for analysis. Please provide valid competitor channels." }, { status: 400, headers: getCorsHeaders(req) });
        }

        // Phase 1: Deterministic scoring engine
        const candidates = buildGapCandidates({
            keyword: input.keyword,
            videos: videos,
            comments: comments,
            searchResults: searchResults,
        });

        // Compute enhanced analytics ONCE
        const velocityData = computeVelocityScore(videos);
        const saturationData = computeSaturationScore(searchResults);
        const frustrationData = computeFrustrationScore(comments);
        const engagementData = computeEngagementScore(videos);
        const trendData = computeTrendMomentum(videos);
        const competitionData = computeCompetitionScore(searchResults);
        const scheduleData = computeOptimalUploadSchedule(videos);
        const suggestedTags = generateOptimalTags(input.keyword, videos, frustrationData.topKeywords);

        const avgViews = videos.length > 0
            ? videos.reduce((s, v) => s + v.views, 0) / videos.length
            : 10000;
        const revenueEstimate = estimateRevenue(avgViews, input.keyword);

        // Phase 2: AI refinement via Groq
        const competitorTitles = videos.map(v => v.title);
        const verbatimPainPoints = frustrationData.verbatimQuestions;
        const prompt = buildAnalysisPrompt(input.keyword, candidates, competitorTitles, verbatimPainPoints);

        const keys = [
            process.env.GROQ_API_KEY,
            process.env.GROQ_API_KEY_2,
            process.env.GROQ_API_KEY_3
        ].filter(Boolean) as string[];

        if (keys.length === 0) {
            return NextResponse.json(
                { error: "Groq API keys not configured", message: "Missing API keys." },
                { status: 503, headers: getCorsHeaders(req) }
            );
        }

        let scanResult: any = null;
        let aiSuccess = false;
        let lastError: any = null;

        const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

        for (const activeKey of shuffledKeys) {
            try {
                const groq = createGroq({ apiKey: activeKey });
                const result = await generateText({
                    model: groq("llama-3.3-70b-versatile"),
                    messages: [
                        { role: "system", content: "You are an expert YouTube strategist. Explain this like I am a tired YouTuber, not a marketing executive. You are strictly forbidden from using words like: leverage, unlock, dive deep, landscape, synergy, dynamic, or comprehensive. Respond ONLY with valid JSON matching the schema exactly. No markdown, no explanation." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.75,
                });
                
                const start = result.text.indexOf("{");
                const end = result.text.lastIndexOf("}");
                if (start === -1 || end <= start) throw new Error("No JSON found");
                
                const parsed = JSON.parse(result.text.slice(start, end + 1));
                scanResult = GapOutputSchema.parse(parsed);

                // ── Post-processing: enforce keyword anchoring in titles ─────────
                // LLMs often ignore title rules even when explicitly instructed.
                // This ensures every title contains the keyword and is long enough.
                const kwLower = input.keyword.toLowerCase();
                const kwWords = kwLower.split(/\s+/).filter(w => w.length > 2);

                scanResult = {
                    ...scanResult,
                    gaps: scanResult.gaps.map((gap: any) => {
                        const title: string = gap.title ?? "";
                        const titleLower = title.toLowerCase();

                        // Check if title contains at least 2 consecutive keyword words
                        const hasKeyword = kwWords.length < 2
                            ? kwWords.some(w => titleLower.includes(w))
                            : kwWords.some((w, i) => i < kwWords.length - 1 &&
                                titleLower.includes(w) && titleLower.includes(kwWords[i + 1]));

                        // 26 chars is the floor — very short hooks are still valid
                        const isTooShort = title.length < 26;

                        if (!hasKeyword || isTooShort) {
                            // Pick the best hook prefix from the existing title
                            const hookStarters = [
                                "I Tested", "Stop", "The Brutal Truth About", "Nobody Tells You",
                                "Why I Quit", "The Real Reason", "I Spent", "Unpopular Opinion",
                                "Most Creators Get", "This Changed Everything About",
                            ];
                            const matchedHook = hookStarters.find(h =>
                                title.toLowerCase().startsWith(h.toLowerCase())
                            );

                            // Friendly-case the keyword for title text
                            const kwTitle = input.keyword
                                .split(" ")
                                .map((w: string, i: number) =>
                                    i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)
                                .join(" ");

                            // Strip trailing punctuation from hook before joining (prevents ::)
                            const rawHook = (matchedHook ?? title.split(":")[0] ?? "The Truth About")
                                .replace(/[:\s]+$/, "").trim();

                            // If the original title already partially mentions the keyword topic,
                            // extend it naturally; otherwise append "— keyword" for clarity
                            const hasPartialKeyword = kwWords.some(w => titleLower.includes(w));
                            const fixedTitle = hasPartialKeyword
                                ? `${rawHook} — ${kwTitle}`.slice(0, 70)
                                : `${rawHook}: ${kwTitle}`.slice(0, 70);

                            return { ...gap, title: fixedTitle };
                        }

                        return gap;
                    }),
                };


                aiSuccess = true;
                break;

            } catch (aiError: any) {
                lastError = aiError;
                console.warn("[Key Rotation Analyze] Key failed, trying next...");
                if (aiError.response?.status === 429) {
                    const retryAfter = aiError.response.headers.get("Retry-After");
                    if (retryAfter) {
                        const waitTime = parseInt(retryAfter) * 1000;
                        await new Promise(r => setTimeout(r, Math.min(waitTime, 2000)));
                    }
                }
            }
        }

        if (!aiSuccess) {
            console.error("[AI Error] All keys exhausted.", lastError);
            return NextResponse.json(
                {
                    error: "AI service error",
                    message: "The AI service is temporarily unavailable. Please try again.",
                },
                { status: 503, headers: getCorsHeaders(req) }
            );
        }

        // Deduct 1 credit for analysis
        await deductUserCredits(dbUser.id, 1, "Extension Gap Analysis");

        // Background DB Insert Execution
        const executeDbInsert = async () => {
            try {
                if (dbUser) {
                    const userChannels = await getChannelsByUserId(dbUser.id);
                        if (userChannels.length > 0) {
                            const targetChannelId = userChannels[0].id;

                            await db.insert(scans).values({
                                userId: dbUser.id,
                                channelId: targetChannelId,
                                keyword: input.keyword,
                                competitors: input.competitors,
                                rawData: {
                                    videoCount: videos.length,
                                    commentCount: comments.length,
                                    searchResultCount: searchResults.length,
                                    candidateScores: candidates.map((c) => ({
                                        title: c.title,
                                        score: c.scores.compositeScore,
                                    })),
                                },
                                result: scanResult,
                                analytics: {
                                    velocity: { score: velocityData.score, insight: velocityData.insight, weeklyGrowthRate: velocityData.weeklyGrowthRate },
                                    saturation: { score: saturationData.score, insight: saturationData.insight, competitionLevel: saturationData.competitionLevel },
                                    frustration: { score: frustrationData.score, topKeywords: frustrationData.topKeywords, painPoints: frustrationData.painPoints },
                                    engagement: { score: engagementData.score, avgLikeRate: engagementData.avgLikeRate, avgCommentRate: engagementData.avgCommentRate },
                                    trend: { score: trendData.score, trend: trendData.trend, insight: trendData.insight },
                                    competition: { score: competitionData.score, difficulty: competitionData.difficulty, insight: competitionData.insight },
                                    uploadSchedule: { bestDay: scheduleData.bestDay, bestHour: scheduleData.bestHour, insight: scheduleData.insight },
                                    revenueEstimate: { low: revenueEstimate.low, mid: revenueEstimate.mid, high: revenueEstimate.high },
                                    suggestedTags: suggestedTags.slice(0, 20),
                                },
                            });
                        }
                    }
            } catch (dbError) {
                console.error("[DB Error] Failed to save scan:", dbError);
            }
        };

        if (typeof after === 'function') {
            after(executeDbInsert);
        } else {
            // fallback for older Next.js versions
            executeDbInsert();
        }

        return NextResponse.json(
            {
                success: true,
                keyword: input.keyword,
                gaps: scanResult.gaps,
                overallOpportunity: scanResult.overallOpportunity,
                recommendedNiche: scanResult.recommendedNiche,
                analytics: {
                    velocity: {
                        score: velocityData.score,
                        insight: velocityData.insight,
                        weeklyGrowthRate: velocityData.weeklyGrowthRate,
                    },
                    saturation: {
                        score: saturationData.score,
                        insight: saturationData.insight,
                        competitionLevel: saturationData.competitionLevel,
                    },
                    frustration: {
                        score: frustrationData.score,
                        topKeywords: frustrationData.topKeywords,
                        painPoints: frustrationData.painPoints,
                        sentimentBreakdown: frustrationData.sentimentBreakdown,
                    },
                    engagement: {
                        score: engagementData.score,
                        avgLikeRate: engagementData.avgLikeRate,
                        avgCommentRate: engagementData.avgCommentRate,
                    },
                    trend: {
                        score: trendData.score,
                        trend: trendData.trend,
                        insight: trendData.insight,
                    },
                    competition: {
                        score: competitionData.score,
                        difficulty: competitionData.difficulty,
                        insight: competitionData.insight,
                    },
                    uploadSchedule: {
                        bestDay: scheduleData.bestDay,
                        bestHour: scheduleData.bestHour,
                        insight: scheduleData.insight,
                    },
                    revenueEstimate,
                    suggestedTags: suggestedTags.slice(0, 20),
                },
                meta: {
                    videoCount: videos.length,
                    commentCount: comments.length,
                    searchResultCount: searchResults.length,
                    candidatesEvaluated: candidates.length,
                    confidence: candidates[0]?.scores.confidence ?? 0,
                },
            },
            {
                status: 200,
                headers: {
                    ...getCorsHeaders(req),
                    "X-RateLimit-Remaining": remaining.toString(),
                },
            }
        );
    } catch (error) {
        console.error("[Analyze Error]", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                message: "An unexpected error occurred. Please try again.",
            },
            { status: 500, headers: getCorsHeaders(req) }
        );
    }
}
