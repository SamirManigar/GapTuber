/**
 * GET /api/health
 *
 * Used by hosting providers (Railway, Render, Vercel) for uptime monitoring.
 * Also used by the GapTuber Chrome extension to detect whether the local dev
 * server is running (so it can route to localhost vs production).
 * Returns 200 when the app is healthy, 503 if a critical dependency is down.
 */
import { getCorsHeaders, optionsResponse } from "@/lib/cors";

export const runtime = "nodejs";
// No cache — always fresh check
export const dynamic = "force-dynamic";

// Allow extension preflight checks
export async function OPTIONS(req: Request) {
    return optionsResponse(req);
}

export async function GET(req: Request) {
    const start = Date.now();
    const corsHeaders = getCorsHeaders(req);

    try {
        return Response.json(
            {
                status: "ok",
                timestamp: new Date().toISOString(),
                latencyMs: Date.now() - start,
            },
            { status: 200, headers: corsHeaders }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return Response.json(
            {
                status: "degraded",
                timestamp: new Date().toISOString(),
                latencyMs: Date.now() - start,
                error: message,
            },
            { status: 503, headers: corsHeaders }
        );
    }
}
