import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { decode } from "next-auth/jwt";
import { getUserByEmail } from "@/db/queries";

export async function resolveUserFromRequest(req: NextRequest) {
    let userEmail: string | null | undefined = undefined;

    // 1. Try standard next-auth session (works if cookies are passed naturally)
    try {
        const session = await auth();
        userEmail = session?.user?.email;
    } catch (e) {
        // auth() might throw in some Edge contexts, fallback
    }

    // 2. Try explicit X-Session-Cookie or X-Session-Token from Chrome Extension
    if (!userEmail) {
        const cookieValue = req.headers.get("X-Session-Cookie") || req.headers.get("X-Session-Token");
        if (cookieValue) {
            const salts = [
                "__Secure-authjs.session-token",
                "authjs.session-token",
                "__Secure-next-auth.session-token",
                "next-auth.session-token"
            ];
            for (const salt of salts) {
                try {
                    const token = await decode({
                        token: cookieValue,
                        salt,
                        secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? ""
                    });
                    if (token?.email) {
                        userEmail = token.email as string;
                        break;
                    }
                } catch (e) {
                    // ignore and try next salt
                }
            }
        }
    }

    if (!userEmail) return null;

    const user = await getUserByEmail(userEmail);
    return user || null;
}
