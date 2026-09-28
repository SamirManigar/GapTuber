import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { cookies } from "next/headers";
import { updateChannelYoutubeTokens } from "@/db/queries";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const stateStr = searchParams.get("state");
    const error = searchParams.get("error");

    let callbackUrl = "/dashboard";
    let channelId = "";
    
    if (stateStr) {
        try {
            const stateObj = JSON.parse(Buffer.from(stateStr, 'base64').toString('utf8'));
            if (stateObj.callbackUrl) callbackUrl = stateObj.callbackUrl;
            if (stateObj.channelId) channelId = stateObj.channelId;
        } catch(e) {}
    }

    if (error || !code) {
        return NextResponse.redirect(new URL(`${callbackUrl}?error=oauth_failed`, req.url));
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const redirectUri = `${protocol}://${host}/api/youtube/callback`;

    try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: env.AUTH_GOOGLE_ID!,
                client_secret: env.AUTH_GOOGLE_SECRET!,
                code,
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenRes.ok) {
            console.error("Token fetch failed:", await tokenRes.text());
            return NextResponse.redirect(new URL(`${callbackUrl}?error=token_fetch_failed`, req.url));
        }

        const tokenData = await tokenRes.json();
        
        // We have the tokens!
        const cookieStore = await cookies();
        
        if (channelId) {
            // Update existing channel
            await updateChannelYoutubeTokens(channelId, {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token ?? null,
                expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
            });
            callbackUrl = `/dashboard/settings?channelId=${channelId}&link_success=true`;
        } else {
            // Onboarding new channel
            cookieStore.set("tmp_yt_access", tokenData.access_token, { maxAge: 600, httpOnly: true, path: '/' });
            if (tokenData.refresh_token) {
                cookieStore.set("tmp_yt_refresh", tokenData.refresh_token, { maxAge: 600, httpOnly: true, path: '/' });
            }
            if (tokenData.expires_in) {
                const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
                cookieStore.set("tmp_yt_expires", Math.floor(expiresAt.getTime() / 1000).toString(), { maxAge: 600, httpOnly: true, path: '/' });
            }
        }

        return NextResponse.redirect(new URL(callbackUrl, req.url));
    } catch (e) {
        console.error("YouTube Callback Error:", e);
        return NextResponse.redirect(new URL(`${callbackUrl}?error=internal_error`, req.url));
    }
}
