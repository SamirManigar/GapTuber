import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { upsertUser, getUserByEmail, getChannelsByUserId, updateChannelYoutubeTokens } from "@/db/queries";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import { env } from "@/env";

export const { handlers, auth: originalAuth, signIn, signOut } = NextAuth({
    trustHost: true,
    providers: [
        Google({
            clientId: env.AUTH_GOOGLE_ID!,
            clientSecret: env.AUTH_GOOGLE_SECRET!,
            authorization: {
                params: {
                    scope: [
                        "openid",
                        "email",
                        "profile",
                        "https://www.googleapis.com/auth/youtube.readonly",
                    ].join(" "),
                    access_type: "offline",
                    prompt: "consent",
                },
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (!user.email) return false;
            try {
                const dbUser = await upsertUser(
                    user.email,
                    user.name ?? undefined,
                    user.image ?? undefined
                );
                
                const cookieStore = await cookies();
                const targetChannelId = cookieStore.get("connect_channel_id")?.value;
                const sourceEmail = cookieStore.get("connect_source_email")?.value;

                // Save YouTube OAuth tokens specifically to the target channel project
                if (targetChannelId && account?.access_token) {
                    await updateChannelYoutubeTokens(targetChannelId, {
                        accessToken: account.access_token,
                        refreshToken: account.refresh_token ?? null,
                        expiresAt: account.expires_at
                            ? new Date(account.expires_at * 1000)
                            : null,
                    });

                    // If this is a cross-account link (YouTube email != Login email),
                    // we save the tokens but BLOCK the session switch by returning a redirect.
                    // This keeps the user logged in as their primary self while successfully linking.
                    if (sourceEmail && sourceEmail !== user.email) {
                        logger.info(`[Auth] Cross-account link successful for channel ${targetChannelId}. Redirecting to prevent session swap.`);
                        return `/dashboard/settings?channelId=${targetChannelId}&link_success=true`; 
                    }
                } else if (cookieStore.get("onboarding_youtube")?.value === "true" && account?.access_token) {
                    // For new project onboarding, temporarily store tokens in secure cookies
                    // The processing route will consume these and create the channel.
                    cookieStore.set("tmp_yt_access", account.access_token, { maxAge: 600, httpOnly: true });
                    if (account.refresh_token) {
                        cookieStore.set("tmp_yt_refresh", account.refresh_token, { maxAge: 600, httpOnly: true });
                    }
                    if (account.expires_at) {
                        cookieStore.set("tmp_yt_expires", account.expires_at.toString(), { maxAge: 600, httpOnly: true });
                    }
                }
            } catch (err) {
                logger.error("[Auth] DB upsert failed (non-blocking):", err);
            }
            return true;
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
                session.user.hasChannels = token.hasChannels === true;
            }
            return session;
        },
        async jwt({ token, user, account, trigger, session }) {
            if (user) {
                token.sub = user.id;
                if (user.email) token.email = user.email;
                if (user.name) token.name = user.name;
                
                try {
                    let dbUser = await getUserByEmail(user.email!);
                    if (!dbUser) {
                        dbUser = await upsertUser(user.email!, user.name ?? undefined, user.image ?? undefined);
                    }
                    if (dbUser) {
                        token.sub = dbUser.id;
                        const channels = await getChannelsByUserId(dbUser.id);
                        token.hasChannels = channels.length > 0;
                    }
                } catch (e) {
                    logger.error("[Auth] Failed to sync DB user for JWT:", e);
                }
            }

            // Persist access token to token for downstream use if needed
            if (account?.access_token) {
                token.youtubeAccessToken = account.access_token;
            }
            
            if (trigger === "update" && session) {
                token.hasChannels = session.hasChannels;
            }
            
            return token;
        },
    },
    pages: {
        signIn: "/auth/signin",
    },
    secret: env.AUTH_SECRET,
});

export const auth = originalAuth;
