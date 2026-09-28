import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGroq } from "@ai-sdk/groq";
import { getRandomYouTubeApiKey, getTopCompetitorsForTopic } from "@/lib/youtube-server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const maxDuration = 300; // Fluid Compute: 5 minute max on Vercel Hobby plan



export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Rate limiting
        const { max, windowMs } = RATE_LIMITS.recommendCompetitors;
        const rl = await rateLimit(`recommend-competitors:${session.user.email}`, max, windowMs);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: `Rate limit exceeded. Max ${max} requests/hour. Try again in ${Math.ceil(rl.resetMs / 60000)} min.` },
                { status: 429 }
            );
        }

        const url = new URL(req.url);
        const topic = url.searchParams.get("topic");

        if (!topic) {
            return NextResponse.json({ error: "Topic parameter is required" }, { status: 400 });
        }

        const apiKey = getRandomYouTubeApiKey();
        if (!apiKey) {
            return NextResponse.json({ error: "YouTube API Key is missing." }, { status: 500 });
        }

        const competitors = await getTopCompetitorsForTopic(topic, apiKey, 5);

        return NextResponse.json({ success: true, competitors });
    } catch (error) {
        console.error("[Recommend Competitors Error]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
