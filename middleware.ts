import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    
    // Check for NextAuth session cookies
    const hasSession = 
        req.cookies.has("authjs.session-token") || 
        req.cookies.has("__Secure-authjs.session-token");

    // Secure dashboard routes
    if (pathname.startsWith("/dashboard") && !hasSession) {
        const signInUrl = new URL("/auth/signin", req.url);
        signInUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(signInUrl);
    }
    
    // If the user has a session but tries to go to onboarding, we cannot 
    // reliably verify 'hasChannels' purely from Edge without hitting DB.
    // However, the dashboard /layout.tsx Server Component will do the strict
    // check and redirect them back to onboarding if they have 0 channels.
    // So we just passively allow navigation here and let the server components
    // enforce the exact onboarding logic.

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/onboarding/:path*"],
};
