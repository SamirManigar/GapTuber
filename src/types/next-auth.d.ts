/**
 * Extends NextAuth's built-in types to include custom fields
 * added to the session and JWT token (hasChannels, etc.).
 * This removes the need for @ts-ignore on session.user.hasChannels.
 */
import type { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            hasChannels?: boolean;
        } & DefaultSession["user"];
    }
}

declare module "next-auth/jwt" {
    interface JWT extends DefaultJWT {
        hasChannels?: boolean;
        youtubeAccessToken?: string;
    }
}
