import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
    const channelId = searchParams.get("channelId") || "";
    
    // Determine redirect URI dynamically
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const redirectUri = `${protocol}://${host}/api/youtube/callback`;

    // Save state in a cookie for the callback to know where to redirect and what to do
    const stateObj = { callbackUrl, channelId };
    const stateStr = Buffer.from(JSON.stringify(stateObj)).toString('base64');

    const params = new URLSearchParams({
        client_id: env.AUTH_GOOGLE_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/youtube.readonly",
            "https://www.googleapis.com/auth/yt-analytics.readonly",
        ].join(" "),
        access_type: "offline",
        prompt: "consent",
        state: stateStr,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.redirect(url);
}
