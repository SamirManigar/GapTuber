import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { createChannel, getUserByEmail, updateChannelYoutubeTokens, updateChannelBlueprint, getChannelsByUserId } from "@/db/queries";
import { logger } from "@/lib/logger";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { db } from "@/db";
import { ideaVault } from "@/db/schema";

export const maxDuration = 300; // Fluid Compute: 5 minute max on Vercel Hobby plan

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUser = await getUserByEmail(session.user.email);
        if (!dbUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const existingChannels = await getChannelsByUserId(dbUser.id);
        if (existingChannels.length >= 5) {
            return NextResponse.json({ error: "You have reached the maximum limit of 5 projects." }, { status: 400 });
        }

        const cookieStore = await cookies();
        const accessToken = cookieStore.get("tmp_yt_access")?.value;
        const refreshToken = cookieStore.get("tmp_yt_refresh")?.value;
        const expiresAtStr = cookieStore.get("tmp_yt_expires")?.value;

        if (!accessToken) {
            return NextResponse.json({ error: "No YouTube connection tokens found. Please try connecting again." }, { status: 400 });
        }

        // Clear the temporary cookies and the onboarding flag
        cookieStore.set("tmp_yt_access", "", { maxAge: 0 });
        cookieStore.set("tmp_yt_refresh", "", { maxAge: 0 });
        cookieStore.set("tmp_yt_expires", "", { maxAge: 0 });
        cookieStore.set("onboarding_youtube", "", { maxAge: 0 });

        const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
        
        // 1. Fetch channel info from YouTube API
        const channelRes = await fetch(
            `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&mine=true`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const channelData = await channelRes.json();
        const ytChannel = channelData.items?.[0];

        if (!ytChannel) {
            return NextResponse.json({ error: "No YouTube channel found for this Google account." }, { status: 400 });
        }

        const channelName = ytChannel.snippet?.title || "My Channel";
        const channelHandle = ytChannel.snippet?.customUrl || ytChannel.id;
        const youtubeChannelId = ytChannel.id;

        // 2. Create the channel in DB
        const channel = await createChannel({
            userId: dbUser.id,
            name: channelName,
            role: "existing_tuber",
            youtubeChannelId: youtubeChannelId,
            brandingData: {
                thumbnail: ytChannel.snippet?.thumbnails?.high?.url || ytChannel.snippet?.thumbnails?.default?.url,
                subscribers: ytChannel.statistics?.subscriberCount || "0",
            }
        });

        // 3. Save the OAuth tokens securely to the new channel
        await updateChannelYoutubeTokens(channel.id, {
            accessToken: accessToken,
            refreshToken: refreshToken ?? null,
            expiresAt: expiresAtStr ? new Date(parseInt(expiresAtStr) * 1000) : null,
            youtubeChannelId: youtubeChannelId
        });

        // 4. Fetch actual stats and videos for idea generation
        const actualChannelStats = {
            title: channelName,
            subscribers: ytChannel.statistics?.subscriberCount,
            views: ytChannel.statistics?.viewCount,
            videoCount: ytChannel.statistics?.videoCount,
        };

        const videosRes = await fetch(
            `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${ytChannel.id}&maxResults=10&order=date&type=video`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const videosData = await videosRes.json();
        
        let actualRecentVideos: any[] = [];
        const videoIds = videosData.items?.map((v: any) => v.id.videoId).filter(Boolean).join(",");
        if (videoIds) {
            const statsRes = await fetch(
                `${YOUTUBE_API_BASE}/videos?part=statistics,snippet&id=${videoIds}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const statsData = await statsRes.json();
            actualRecentVideos = (statsData.items || []).map((v: any) => ({
                title: v.snippet?.title,
                views: v.statistics?.viewCount,
                likes: v.statistics?.likeCount,
            }));
        }

        // 5. Generate Ideas
        if (actualRecentVideos.length > 0) {
            const keys = [
                process.env.GROQ_API_KEY,
                process.env.GROQ_API_KEY_2,
                process.env.GROQ_API_KEY_3,
            ].filter(Boolean) as string[];

            if (keys.length > 0) {
                const topVideos = actualRecentVideos
                    .sort((a, b) => (parseInt(b.views) || 0) - (parseInt(a.views) || 0))
                    .slice(0, 10)
                    .map((v, i) => `  ${i + 1}. "${v.title}" — ${parseInt(v.views || "0").toLocaleString()} views, ${parseInt(v.likes || "0").toLocaleString()} likes`)
                    .join("\n");

                const prompt = `You are an elite YouTube growth strategist.

TASK: Analyze this creator's actual recent performance data and generate exactly 5 highly-tailored, high-potential video ideas that perfectly match their proven audience.

CREATOR CHANNEL DATA:
- Channel Name: ${actualChannelStats.title || "Unknown"}
- Subscribers: ${parseInt(actualChannelStats.subscribers || "0").toLocaleString()}
- Total Views: ${parseInt(actualChannelStats.views || "0").toLocaleString()}
- Total Videos: ${parseInt(actualChannelStats.videoCount || "0").toLocaleString()}

THEIR TOP RECENT VIDEOS (Ground Truth API Data):
${topVideos}

Based *only* on what is clearly working for this creator right now, generate 5 new video ideas that act as natural sequels, deeper dives, or better variations of their proven content.`;

                let videoIdeas = null;
                const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

                for (const activeKey of shuffledKeys) {
                    try {
                        const groq = createGroq({ apiKey: activeKey });
                        const result = await generateText({
                            model: groq("llama-3.3-70b-versatile"),
                            messages: [
                                { role: "system", content: "You must output ONLY valid JSON that strictly matches the required schema. No markdown fences, no explanatory text." },
                                { role: "user", content: prompt + `\n\nREQUIRED JSON SCHEMA:\n${JSON.stringify({ videoIdeas: [{ title: "string", hook: "string (first 10 seconds script hook)", format: "string (e.g. Tutorial, Vlog, Deep Dive)", whyItWorks: "string (why this fits the creator's current audience)", estimatedViewPotential: "high|medium|low", targetAudience: "string" }] }, null, 2)}` }
                            ],
                            temperature: 0.7,
                        });
                        let rawText = result.text.trim();
                        if (rawText.startsWith("\`\`\`json")) rawText = rawText.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
                        else if (rawText.startsWith("\`\`\`")) rawText = rawText.replace(/\`\`\`/g, "").trim();
                        
                        const parsed = JSON.parse(rawText);
                        videoIdeas = parsed.videoIdeas || parsed;
                        if (!Array.isArray(videoIdeas)) throw new Error("Not an array");
                        break;
                    } catch (err) {
                        logger.warn("[YoutubeCreate] Key failed, rotating...");
                    }
                }

                if (videoIdeas && videoIdeas.length > 0) {
                    const inserts = videoIdeas.map((idea: any) => ({
                        channelId: channel.id,
                        title: idea.title || "Untitled Idea",
                        hook: idea.hook,
                        format: idea.format,
                        targetAudience: idea.targetAudience,
                        status: "backlog" as const,
                        estimatedViewPotential: (idea.estimatedViewPotential || "medium") as "high" | "medium" | "low",
                        source: "system" as const,
                        whyItWorks: idea.whyItWorks,
                        script: "",
                    }));
                    await db.insert(ideaVault).values(inserts);
                }
            }
        }

        return NextResponse.json({ success: true, channelId: channel.id });

    } catch (err: any) {
        logger.error("[YoutubeCreate]", err);
        return NextResponse.json({ error: err.message || "Failed to create channel setup." }, { status: 500 });
    }
}
