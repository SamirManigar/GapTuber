import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { channels, ideaVault } from "@/db/schema";
import { eq } from "drizzle-orm";

import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";
import { auth } from "@/auth";
import { getUserByEmail, deductUserCredits } from "@/db/queries";
import { logger } from "@/lib/logger";
import { getRandomYouTubeApiKey } from "@/lib/youtube-server";

const VideoIdeaSchema = z.object({
    title: z.string(),
    hook: z.string(),
    format: z.string(),
    whyItWorks: z.string(),
    estimatedViewPotential: z.enum(["high", "medium", "low"]),
    targetAudience: z.string(),
});

const MineResponseSchema = z.object({
    minedIdeas: z.array(VideoIdeaSchema)
});

const RequestBodySchema = z.object({
    channelId: z.string().uuid(),
});

export const maxDuration = 60; // Vercel Hobby plan max for streaming/Next.js config

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.credits < 1) {
        return NextResponse.json({ error: "Insufficient credits. Please upgrade your plan." }, { status: 403 });
    }

    let rawBody: unknown;
    try {
        rawBody = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = RequestBodySchema.safeParse(rawBody);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid request", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { channelId } = parsed.data;

    try {
        const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
        if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

        if (!channel.youtubeAccessToken) {
            return NextResponse.json({ error: "YouTube not connected" }, { status: 400 });
        }

        if (!channel.youtubeChannelId) {
            return NextResponse.json({ error: "YouTube Channel ID is missing. Please reconnect your YouTube account." }, { status: 400 });
        }

        // 1. Fetch channel's own comments by first getting their recent videos
        const apiKey = getRandomYouTubeApiKey();
        
        // A) Get Uploads Playlist ID
        const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channel.youtubeChannelId}&key=${apiKey}`;
        const channelRes = await fetch(channelUrl);
        const channelData = await channelRes.json();
        
        const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        
        let rawItems: any[] = [];

        if (uploadsPlaylistId) {
            // B) Get Recent 5 Videos
            const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=5&key=${apiKey}`;
            const playlistRes = await fetch(playlistUrl);
            const playlistData = await playlistRes.json();
            
            const videoIds = (playlistData.items || []).map((item: any) => item.snippet?.resourceId?.videoId).filter(Boolean);
            
            // C) Fetch comments for these videos
            if (videoIds.length > 0) {
                const commentPromises = videoIds.map((vid: string) => 
                    fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${vid}&maxResults=20&order=relevance&key=${apiKey}`)
                        .then(r => r.ok ? r.json() : { items: [] })
                        .catch(() => ({ items: [] }))
                );
                
                const commentResults = await Promise.all(commentPromises);
                rawItems = commentResults.flatMap((r: any) => r.items || []);
            }
        }

        if (rawItems.length === 0) {
            return NextResponse.json({ error: "Could not fetch any comments. Ensure your channel has recent videos with comments enabled." }, { status: 400 });
        }

        // 2. Ensure enough comments are available BEFORE slicing
        if (rawItems.length < 5) {
            return NextResponse.json({ error: `Not enough data. Only found ${rawItems.length} comments — need at least 5 to mine ideas. Make sure your channel has recent videos with comments enabled.` }, { status: 400 });
        }

        // Sort by like count DESC, take top 40 highest-signal comments
        const sortedItems = rawItems
            .sort((a, b) => (b.snippet?.topLevelComment?.snippet?.likeCount ?? 0) - (a.snippet?.topLevelComment?.snippet?.likeCount ?? 0))
            .slice(0, 40);
        const commentsCount = rawItems.length; // Report original count before slicing

        const commentTexts = sortedItems
            .map((c: any) => {
                const s = c.snippet?.topLevelComment?.snippet;
                return `[${s?.likeCount ?? 0} likes] "${s?.textDisplay ?? ""}"`;
            })
            .join("\n---\n");

        const prompt = `
Analyze these YouTube audience comments for a channel specializing in "${channel.category}".

TOP AUDIENCE COMMENTS (sorted by likes — higher likes = broader agreement):
${commentTexts}

TASK:
Identify the top 3 recurring pain points, questions, or content requests with the strongest like signal.
Generate 3 YouTube video ideas that directly address these audience needs with specific, evidence-backed titles.

Return ONLY a JSON object matching this schema:
{
    "minedIdeas": [
        { "title": "...", "hook": "...", "format": "...", "whyItWorks": "...", "estimatedViewPotential": "high", "targetAudience": "..." }
    ]
}
        `;


        const keys = [
            process.env.GROQ_API_KEY,
            process.env.GROQ_API_KEY_2,
            process.env.GROQ_API_KEY_3
        ].filter(Boolean) as string[];

        let object: any = null;
        let aiSuccess = false;
        let lastError: any = null;

        const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

        for (const activeKey of shuffledKeys) {
            try {
                const groqProvider = createGroq({ apiKey: activeKey });
                const result = await generateText({
                    model: groqProvider("llama-3.3-70b-versatile"),
                    messages: [
                        { role: "system", content: "You are a JSON API. Respond only with valid JSON matching the requested schema. No markdown, no explanations." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.2
                });
                
                // Parse the JSON manually with robust stripping
                let cleanedText = result.text.trim();
                if (cleanedText.startsWith("```json")) cleanedText = cleanedText.replace(/```json/g, "").replace(/```/g, "").trim();
                else if (cleanedText.startsWith("```")) cleanedText = cleanedText.replace(/```/g, "").trim();
                
                const start = cleanedText.indexOf("{");
                const end = cleanedText.lastIndexOf("}");
                if (start === -1 || end <= start) throw new Error("No JSON found");
                
                const parsedOutput = JSON.parse(cleanedText.slice(start, end + 1));
                const validation = MineResponseSchema.safeParse(parsedOutput);
                
                if (!validation.success) {
                    throw new Error("Validation failed");
                }
                
                object = validation.data;
                aiSuccess = true;
                break;
            } catch (err: any) {
                lastError = err;
                if (err.response?.status === 429) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        if (!aiSuccess) {
            throw lastError || new Error("AI service unavailable after retries.");
        }

        const minedIdeas = object.minedIdeas.map((i: any) => ({
            ...i,
            status: "ready", // Default status for new mined ideas
            isMined: true, // Mark as mined
            source: "comment_mining"
        }));

        // 3. Append to Idea Vault
        if (minedIdeas.length > 0) {
            const inserts = minedIdeas.map((idea: any) => ({
                channelId: channelId,
                title: idea.title || "Untitled Mined Idea",
                hook: idea.hook,
                format: idea.format,
                targetAudience: idea.targetAudience,
                status: "backlog" as const,
                estimatedViewPotential: (idea.estimatedViewPotential || "medium") as "high" | "medium" | "low",
                source: "comment_mining" as const,
                whyItWorks: idea.whyItWorks,
                script: "",
            }));
            await db.insert(ideaVault).values(inserts);
        }

        // Deduct credit on successful mining
        await deductUserCredits(user.id, 1, "Comment Mining");

        return NextResponse.json({ 
            success: true, 
            ideas: object.minedIdeas,
            message: `Successfully mined ${commentsCount} comments.`
        });

    } catch (e: any) {
        logger.error("Comment Mining Error:", e);
        return NextResponse.json({ error: `Failed to mine comments: ${e.message || "Unknown error"}` }, { status: 500 });
    }
}
