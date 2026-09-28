import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auditVideoSeo } from "@/lib/engine/seo-tools";
import { getCorsHeaders, optionsResponse } from "@/lib/cors";
import { resolveUserFromRequest } from "@/lib/resolve-user";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const RequestSchema = z.object({
    title: z.string().trim().min(1).max(200),
    keyword: z.string().trim().min(1).max(100),
    description: z.string().max(10_000).optional(),
    tags: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
});

export async function OPTIONS(req: NextRequest) {
    return optionsResponse(req);
}

export async function POST(req: NextRequest) {
    const cors = getCorsHeaders(req);
    const user = await resolveUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: cors });

    const limit = await rateLimit(`seo-audit:${user.id}`, RATE_LIMITS.seoAudit.max, RATE_LIMITS.seoAudit.windowMs);
    if (!limit.allowed) return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429, headers: cors });

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400, headers: cors }); }
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid request", details: parsed.error.flatten() }, { status: 400, headers: cors });
    }

    return NextResponse.json(auditVideoSeo(parsed.data), {
        headers: { ...cors, "Cache-Control": "private, no-store" },
    });
}
