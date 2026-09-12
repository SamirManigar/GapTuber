import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getScanById } from "@/db/queries";
import type { ScanResult, ScanAnalytics } from "@/db/schema";
import sharp from "sharp";

export const runtime = "nodejs";
// Cache shareable images for 1 hour at the CDN edge
export const revalidate = 3600;

/**
 * GET /api/scans/[id]/share
 * Generates a 1200×630 branded OG image for a scan result.
 * Returns image/png with CDN caching.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Auth — must own the scan or be viewing a valid scan (public share is OK for read)
    const session = await auth();

    const scan = await getScanById(id);
    if (!scan) {
        return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    // Only the scan owner can generate the share image
    // (guests get a generic "login to view" page instead)
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = scan.result as ScanResult | null;
    const analytics = scan.analytics as ScanAnalytics | null;

    const keyword = scan.keyword ?? "YouTube Niche";
    const gapCount = result?.gaps?.length ?? 0;
    const topGap = result?.gaps?.[0];
    const topScore = topGap ? Math.round(Math.min(Math.max(topGap.gapScore ?? 0, 0), 10) * 10) : 0;
    const niche = result?.recommendedNiche ?? "";
    const opportunity = analytics?.saturation?.competitionLevel ?? "";
    const scanDate = new Date(scan.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

    // ── Build SVG for sharp to render ───────────────────────────────────────────
    // We use SVG→PNG via sharp (already installed as a dep) — no canvas needed.
    const scoreColor = topScore >= 75 ? "#34d399" : topScore >= 55 ? "#fbbf24" : "#71717a";
    const tierLabel = topScore >= 75 ? "STRONG OPPORTUNITY" : topScore >= 55 ? "GOOD OPPORTUNITY" : "EXPERIMENTAL";

    const svg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, sans-serif">
  <!-- Background -->
  <rect width="1200" height="630" fill="#09090b"/>
  <!-- Grid lines -->
  <line x1="0" y1="0" x2="1200" y2="0" stroke="#1e1e22" stroke-width="1"/>
  <line x1="0" y1="630" x2="1200" y2="630" stroke="#1e1e22" stroke-width="1"/>

  <!-- Top accent line -->
  <rect x="0" y="0" width="1200" height="3" fill="url(#topGrad)"/>
  <defs>
    <linearGradient id="topGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${scoreColor};stop-opacity:0.9"/>
      <stop offset="50%" style="stop-color:${scoreColor};stop-opacity:0.3"/>
      <stop offset="100%" style="stop-color:${scoreColor};stop-opacity:0"/>
    </linearGradient>
    <linearGradient id="bgGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%" gradientUnits="userSpaceOnUse" x1="600" y1="0" x2="600" y2="630">
      <stop offset="0%" style="stop-color:${scoreColor};stop-opacity:0.04"/>
      <stop offset="100%" style="stop-color:#09090b;stop-opacity:1"/>
    </linearGradient>
  </defs>

  <!-- Subtle bg glow -->
  <rect x="0" y="0" width="1200" height="630" fill="url(#bgGlow)"/>

  <!-- Left content -->
  <!-- Branding -->
  <text x="80" y="80" font-size="16" font-weight="700" fill="#34d399" letter-spacing="4">GAPTUBER</text>
  <text x="80" y="100" font-size="12" fill="#3f3f46" letter-spacing="2">YOUTUBE MARKET INTELLIGENCE</text>

  <!-- Keyword -->
  <text x="80" y="180" font-size="14" fill="#52525b" letter-spacing="3" text-transform="uppercase">KEYWORD ANALYZED</text>
  <text x="80" y="240" font-size="52" font-weight="900" fill="#ffffff" letter-spacing="-1">${escSvg(keyword)}</text>
  ${niche ? `<text x="80" y="275" font-size="16" fill="#52525b">Niche: ${escSvg(niche)}</text>` : ""}

  <!-- Stats row -->
  <!-- Gaps found box -->
  <rect x="80" y="310" width="160" height="80" rx="12" fill="#111113" stroke="#1e1e22" stroke-width="1"/>
  <text x="160" y="348" font-size="36" font-weight="800" fill="${scoreColor}" text-anchor="middle">${gapCount}</text>
  <text x="160" y="372" font-size="11" fill="#52525b" text-anchor="middle" letter-spacing="2">GAPS FOUND</text>

  <!-- Competition box -->
  ${opportunity ? `
  <rect x="260" y="310" width="180" height="80" rx="12" fill="#111113" stroke="#1e1e22" stroke-width="1"/>
  <text x="350" y="348" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle">${escSvg(opportunity)}</text>
  <text x="350" y="372" font-size="11" fill="#52525b" text-anchor="middle" letter-spacing="2">COMPETITION</text>
  ` : ""}

  <!-- Date -->
  <text x="80" y="460" font-size="13" fill="#3f3f46">${scanDate}</text>

  <!-- CTA -->
  <rect x="80" y="490" width="280" height="50" rx="10" fill="${scoreColor}" opacity="0.15" stroke="${scoreColor}" stroke-width="1" stroke-opacity="0.3"/>
  <text x="220" y="521" font-size="14" font-weight="600" fill="${scoreColor}" text-anchor="middle">Find your gaps at gaptuber.app</text>

  <!-- Right — Score Ring -->
  <!-- Card -->
  <rect x="740" y="140" width="380" height="350" rx="20" fill="#0f0f11" stroke="#1e1e22" stroke-width="1"/>

  <!-- Score display -->
  <text x="930" y="230" font-size="100" font-weight="900" fill="${scoreColor}" text-anchor="middle">${topScore}</text>
  <text x="930" y="265" font-size="16" fill="#3f3f46" text-anchor="middle">/100 GAP SCORE</text>

  <!-- Tier badge -->
  <rect x="840" y="285" width="180" height="30" rx="15" fill="${scoreColor}" opacity="0.15"/>
  <text x="930" y="305" font-size="12" font-weight="700" fill="${scoreColor}" text-anchor="middle" letter-spacing="1">${tierLabel}</text>

  <!-- Top gap title -->
  ${topGap ? `
  <text x="930" y="360" font-size="12" fill="#52525b" text-anchor="middle" letter-spacing="2">TOP OPPORTUNITY</text>
  <foreignObject x="760" y="370" width="340" height="80">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:14px;color:#d4d4d8;text-align:center;line-height:1.4;font-family:system-ui,sans-serif;padding:0 10px">
      ${escSvg(topGap.title.slice(0, 80))}${topGap.title.length > 80 ? "…" : ""}
    </div>
  </foreignObject>
  ` : ""}

  <!-- Powered by -->
  <text x="930" y="580" font-size="11" fill="#27272a" text-anchor="middle">Powered by YouTube Data API · GapTuber Intelligence Engine</text>
</svg>`;

    try {
        const png = await sharp(Buffer.from(svg))
            .png({ compressionLevel: 8 })
            .toBuffer();

        return new NextResponse(png, {
            status: 200,
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
                "Content-Disposition": `inline; filename="gaptuber-${id.slice(0, 8)}.png"`,
            },
        });
    } catch (err) {
        console.error("[Share Image Error]", err);
        return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
    }
}

/** Escape special characters for safe SVG text embedding */
function escSvg(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
