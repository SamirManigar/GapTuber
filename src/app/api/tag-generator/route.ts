import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildTagSuggestions } from "@/lib/engine/seo-tools";
import { getCorsHeaders, optionsResponse } from "@/lib/cors";
import { resolveUserFromRequest } from "@/lib/resolve-user";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getRandomYouTubeApiKey, getSearchResults } from "@/lib/youtube-server";
import type { SearchResult } from "@/lib/engine/scoring";

export const runtime = "nodejs";

const RequestSchema = z.object({
    keyword: z.string().trim().min(1).max(100),
    niche: z.string().trim().max(100).optional(),
});

export async function OPTIONS(req: NextRequest) {
    return optionsResponse(req);
}

export async function POST(req: NextRequest) {
    const cors = getCorsHeaders(req);
    const user = await resolveUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: cors });

    const limit = await rateLimit(`tag-generator:${user.id}`, RATE_LIMITS.tagGenerator.max, RATE_LIMITS.tagGenerator.windowMs);
    if (!limit.allowed) return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429, headers: cors });

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400, headers: cors }); }
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid request", details: parsed.error.flatten() }, { status: 400, headers: cors });
    }

    const apiKey = getRandomYouTubeApiKey();
    let searchResults: SearchResult[] = [];
    if (apiKey) {
        try { searchResults = await getSearchResults(parsed.data.keyword, apiKey, 15); } catch { /* deterministic fallback below */ }
    }

    return NextResponse.json(buildTagSuggestions(parsed.data.keyword, parsed.data.niche, searchResults), {
        headers: { ...cors, "Cache-Control": "private, no-store" },
    });
}
