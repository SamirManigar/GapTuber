import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getScanById } from "@/db/queries";
import { getUserByEmail } from "@/db/queries";
import type { ScanResult, ScanAnalytics } from "@/db/schema";
import type { Metadata } from "next";
import Link from "next/link";

interface PageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const scan = await getScanById(id);
    if (!scan) return { title: "Scan Not Found — GapTuber" };

    const result = scan.result as ScanResult | null;
    const topGap = result?.gaps?.[0];
    const topScore = topGap ? Math.round(Math.min(Math.max(topGap.gapScore ?? 0, 0), 10) * 10) : 0;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gaptuber.app";

    return {
        title: `"${scan.keyword}" Gap Analysis — Score ${topScore}/100 · GapTuber`,
        description: `${result?.gaps?.length ?? 0} content gaps found for "${scan.keyword}". Top opportunity scored ${topScore}/100. Find your YouTube niche on GapTuber.`,
        openGraph: {
            title: `"${scan.keyword}" — ${result?.gaps?.length ?? 0} gaps found · GapTuber`,
            description: `Top opportunity scored ${topScore}/100. Powered by YouTube Data API + AI gap detection.`,
            images: [`${appUrl}/api/scans/${id}/share`],
            type: "website",
            url: `${appUrl}/dashboard/scans/${id}/share`,
        },
        twitter: {
            card: "summary_large_image",
            title: `"${scan.keyword}" Gap Analysis — Score ${topScore}/100 · GapTuber`,
            description: `${result?.gaps?.length ?? 0} content gaps found. Powered by GapTuber Intelligence Engine.`,
            images: [`${appUrl}/api/scans/${id}/share`],
        },
    };
}

export default async function ScanSharePage({ params }: PageProps) {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.email) redirect("/auth/signin");

    const dbUser = await getUserByEmail(session.user.email);
    if (!dbUser) redirect("/auth/signin");

    const scan = await getScanById(id);
    if (!scan || scan.userId !== dbUser.id) redirect("/dashboard");

    const result = scan.result as ScanResult | null;
    const analytics = scan.analytics as ScanAnalytics | null;
    const topGap = result?.gaps?.[0];
    const topScore = topGap ? Math.round(Math.min(Math.max(topGap.gapScore ?? 0, 0), 10) * 10) : 0;
    const scoreColor = topScore >= 75 ? "#34d399" : topScore >= 55 ? "#fbbf24" : "#71717a";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gaptuber.app";
    const shareImageUrl = `${appUrl}/api/scans/${id}/share`;
    const sharePageUrl = `${appUrl}/dashboard/scans/${id}/share`;

    const tweetText = encodeURIComponent(
        `I just analyzed "${scan.keyword}" on @GapTuber and found ${result?.gaps?.length ?? 0} content gaps — top score ${topScore}/100! 🔥\n\nFind your YouTube niche 👇`
    );
    const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(sharePageUrl)}`;

    return (
        <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-4 py-12">
            <div className="w-full max-w-3xl">

                {/* Back */}
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 mb-8 transition-colors font-mono">
                    ← Back to Dashboard
                </Link>

                {/* Heading */}
                <h1 className="text-2xl font-bold text-white mb-1">Share Your Gap Report</h1>
                <p className="text-zinc-500 text-sm mb-8">
                    Share this analysis on social media to grow your audience.
                </p>

                {/* Preview card */}
                <div className="rounded-2xl overflow-hidden border border-[#1e1e22] mb-8 shadow-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={`/api/scans/${id}/share`}
                        alt={`GapTuber gap analysis for "${scan.keyword}"`}
                        className="w-full"
                        style={{ aspectRatio: "1200/630" }}
                    />
                </div>

                {/* Stats summary */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-[#0f0f11] border border-[#1e1e22] rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold" style={{ color: scoreColor }}>{topScore}</div>
                        <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mt-1">Top Score</div>
                    </div>
                    <div className="bg-[#0f0f11] border border-[#1e1e22] rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-white">{result?.gaps?.length ?? 0}</div>
                        <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mt-1">Gaps Found</div>
                    </div>
                    <div className="bg-[#0f0f11] border border-[#1e1e22] rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-amber-400">{analytics?.saturation?.competitionLevel ?? "—"}</div>
                        <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mt-1">Competition</div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Tweet */}
                    <a
                        href={tweetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-[#1d9bf0]/10 border border-[#1d9bf0]/30 text-[#1d9bf0] hover:bg-[#1d9bf0]/20 font-semibold text-sm transition-all"
                    >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Share on X (Twitter)
                    </a>

                    {/* Copy link */}
                    <CopyLinkButton url={sharePageUrl} imageUrl={shareImageUrl} />

                    {/* Download image */}
                    <a
                        href={`/api/scans/${id}/share`}
                        download={`gaptuber-${scan.keyword.replace(/\s+/g, "-")}.png`}
                        className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-[#111113] border border-[#1e1e22] text-zinc-400 hover:text-zinc-200 hover:border-[#2a2a30] font-semibold text-sm transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
                        </svg>
                        Download Image
                    </a>
                </div>

                <p className="text-center text-xs text-zinc-700 mt-6">
                    Powered by GapTuber · YouTube Data API · AI Gap Detection
                </p>
            </div>
        </div>
    );
}

// ── Client component for copy-to-clipboard ────────────────────────────────────
// Using a Server Component page + inline client component pattern

function CopyLinkButton({ url, imageUrl }: { url: string; imageUrl: string }) {
    // This must be a client component — we'll emit a script-based approach
    // for the copy functionality without adding a separate file
    return (
        <button
            id="copy-share-link"
            data-url={url}
            data-image={imageUrl}
            onClick={undefined}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-emerald-600/10 border border-emerald-600/20 text-emerald-400 hover:bg-emerald-600/20 font-semibold text-sm transition-all cursor-pointer"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            Copy Share Link
            <script
                dangerouslySetInnerHTML={{
                    __html: `
                        document.getElementById('copy-share-link').addEventListener('click', function() {
                            navigator.clipboard.writeText(this.dataset.url).then(() => {
                                const orig = this.innerHTML;
                                this.textContent = '✓ Copied!';
                                setTimeout(() => { this.innerHTML = orig; }, 2000);
                            });
                        });
                    `,
                }}
            />
        </button>
    );
}
