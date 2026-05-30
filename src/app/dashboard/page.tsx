import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { GapItem, ScanAnalytics, VideoIdeaDB } from "@/db/schema";
import { ScoreBar } from "@/components/dashboard/ScoreBar";
import { MetricCard, GapCard, AnalyticsPanel } from "@/components/dashboard/ScanComponents";
import { DeleteScanButton } from "@/components/dashboard/DeleteScanButton";
import { getCachedUser, getCachedChannels, getCachedScans } from "@/lib/data";
import { db } from "@/db";
import { ideaVault } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// Heavy components lazy-loaded to reduce initial bundle
const FlashcardRoadmap = dynamic(() => import("@/components/dashboard/FlashcardRoadmap"), {
    loading: () => <div className="h-64 bg-[#111113] border border-[#1e1e22] rounded-xl animate-pulse" />,
});
const MarketInsights = dynamic(() => import("@/components/dashboard/MarketInsights"), {
    loading: () => <div className="h-32 bg-[#111113] border border-[#1e1e22] rounded-xl animate-pulse mb-8" />,
});

export const metadata = {
    title: "Dashboard — GapTuber",
};



// ─── Scan History Skeleton ─────────────────────────────────────────────────────

function ScanHistorySkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="flex items-center justify-between border-b border-[#1e1e22] pb-3">
                <div className="h-5 w-32 bg-[#1e1e22] rounded" />
                <div className="h-4 w-24 bg-[#1e1e22] rounded" />
            </div>
            <div className="space-y-4">
                <div className="h-4 w-48 bg-[#1e1e22] rounded" />
                <div className="bg-[#111113] border border-[#1e1e22] rounded-xl p-5 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-20 bg-[#0c0c0e] border border-[#1e1e22] rounded-lg" />
                        ))}
                    </div>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-64 bg-[#111113] border border-[#1e1e22] rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Scan History Section (Async) ──────────────────────────────────────────────

async function ScanHistorySection({ channelId, limit, savedIdeas = [] }: { channelId: string; limit: number; savedIdeas?: VideoIdeaDB[] }) {
    const scans = await getCachedScans(channelId, limit);
    const hasMore = scans.length === limit;

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e1e22] pb-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Scan History
                </h2>
                <div className="text-[10px] font-mono text-zinc-500 px-2 py-1 bg-[#1e1e22] rounded self-start sm:self-auto">
                    via GapTuber Extension
                </div>
            </div>

            {scans.length === 0 ? (
                <div className="text-center py-20 bg-[#111113] border border-[#1e1e22] rounded-xl flex flex-col items-center">
                    <div className="w-12 h-12 bg-[#1e1e22] border border-[#2a2a30] rounded flex items-center justify-center mb-5 text-xl">📡</div>
                    <h3 className="text-zinc-200 font-bold mb-2">Awaiting first scan data</h3>
                    <p className="text-zinc-500 text-sm mb-6 max-w-sm">Use the GapTuber extension on any YouTube channel to execute a new gap scan.</p>
                    <Link
                        href="https://chromewebstore.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-600 text-white px-5 py-2.5 rounded text-sm font-semibold hover:bg-emerald-500 transition-colors"
                    >
                        Get the Extension
                    </Link>
                </div>
            ) : (
                <div className="space-y-16">
                    {scans.map((scan) => {
                        const result = scan.result as { gaps: GapItem[]; overallOpportunity?: string; recommendedNiche?: string } | null;
                        const analytics = scan.analytics as ScanAnalytics | null;
                        if (!result?.gaps?.length) return null;

                        return (
                            <div key={scan.id}>
                                <div className="mb-6 flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                            <span className="text-xl font-bold text-white tracking-tight">
                                                query: &ldquo;{scan.keyword}&rdquo;
                                            </span>
                                            {result.recommendedNiche && (
                                                <span className="text-[10px] font-mono bg-[#111113]/60 backdrop-blur-md border border-[#1e1e22] text-zinc-400 rounded px-2 py-0.5">
                                                    niche: {result.recommendedNiche}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs font-mono text-zinc-600">
                                            <span>{new Date(scan.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase()}</span>
                                            <span>|</span>
                                            <span>FOUND {result.gaps.length} GAPS</span>
                                        </div>
                                    </div>
                                    <DeleteScanButton scanId={scan.id} />
                                </div>

                                {analytics && <AnalyticsPanel analytics={analytics} />}

                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {result.gaps.map((gap, i) => (
                                        <GapCard key={i} gap={gap} rank={i + 1} channelId={channelId} isAlreadySaved={savedIdeas.some(s => s.title === gap.title)} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Issue #14: Load More pagination */}
                    {hasMore && (
                        <div className="text-center pt-4">
                            <Link
                                href={`?limit=${limit + 10}`}
                                className="inline-flex items-center gap-2 text-xs font-mono text-zinc-500 hover:text-zinc-300 border border-[#1e1e22] hover:border-[#2a2a30] px-4 py-2 rounded transition-colors"
                            >
                                [ LOAD_MORE_SCANS ]
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Channel Header Skeleton ───────────────────────────────────────────────────

function ChannelHeaderSkeleton() {
    return (
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#1e1e22] pb-6 animate-pulse">
            <div className="space-y-3 w-full">
                <div className="h-4 w-24 bg-[#1e1e22] rounded" />
                <div className="h-9 w-64 max-w-full bg-[#1e1e22] rounded" />
                <div className="h-4 w-80 max-w-full bg-[#1e1e22] rounded" />
            </div>
            <div className="h-20 w-full md:w-48 bg-[#111113]/60 backdrop-blur-md border border-[#1e1e22]/50 rounded-lg shrink-0" />
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ channelId?: string; limit?: string }>;
}) {
    const session = await auth();
    const { channelId: selectedId, limit: limitParam } = await searchParams;
    // Issue #14: pagination via ?limit= param, capped at 100
    const scanLimit = Math.min(parseInt(limitParam ?? "10") || 10, 100);

    if (!session?.user?.email) {
        redirect("/auth/signin");
    }

    const user = await getCachedUser(session.user.email);
    if (!user) {
        redirect("/auth/signin");
    }

    const allChannels = await getCachedChannels(user.id);

    const activeChannel = selectedId
        ? allChannels.find((c) => c.id === selectedId) || allChannels[0]
        : allChannels[0];

    if (!activeChannel) {
        redirect("/onboarding");
    }

    // Issue #10: compute stats from the same getCachedScans call used in ScanHistorySection.
    // React.cache() deduplicates the DB call — only one query fires per request.
    const scans = await getCachedScans(activeChannel.id, scanLimit);
    const totalGaps = scans.reduce((s, scan) => {
        const result = scan.result as { gaps: GapItem[] } | null;
        return s + (result?.gaps?.length ?? 0);
    }, 0);

    // Fetch YouTube Stats if connected
    let youtubeStats = null;
    let isYoutubeConnected = false;
    let isTokenExpired = false;
    
    if (activeChannel.youtubeAccessToken) {
        try {
            const { getValidYouTubeToken } = await import("@/lib/youtube-tokens");
            const { accessToken } = await getValidYouTubeToken(activeChannel.id);
            const channelRes = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true`,
                { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
            );
            const channelData = await channelRes.json();
            if (channelData.items && channelData.items.length > 0) {
                youtubeStats = channelData.items[0];
                isYoutubeConnected = true;
            } else if (channelData.error) {
                isTokenExpired = true;
            }
        } catch (e) {
            console.error("Failed to fetch YouTube stats for dashboard", e);
            isTokenExpired = true;
        }
    }

    // Fetch ideas from ideaVault
    const allVaultIdeasRaw = await db.query.ideaVault.findMany({
        where: (iv, { eq }) => eq(iv.channelId, activeChannel.id),
        orderBy: (iv, { desc }) => [desc(iv.createdAt)]
    });

    const systemIdeas = allVaultIdeasRaw.filter(i => i.source === "system");
    const mappedSystemIdeas = systemIdeas.map(iv => ({
        title: iv.title,
        hook: iv.hook || "",
        format: iv.format || "",
        targetAudience: iv.targetAudience || "",
        whyItWorks: iv.whyItWorks || "",
        script: iv.script || "",
        estimatedViewPotential: iv.estimatedViewPotential as any,
        signalSource: iv.referenceId || iv.source,  // referenceId holds AI signal for system ideas
        description: iv.description || "",
        tags: iv.tags || [],
    }));
    // Map ideaVault statuses → component statuses (ready/filming/done)
    const toCardStatus = (status: string): string => {
        if (status === "launched") return "done";
        if (status === "filming" || status === "scripting" || status === "production") return "filming";
        return "ready"; // backlog or anything else
    };

    const mappedSystemStatuses = systemIdeas.reduce((acc, iv, i) => {
        acc[String(i)] = toCardStatus(iv.status);
        return acc;
    }, {} as Record<string, string>);

    const manualIdeas = allVaultIdeasRaw.filter(i => i.source !== "system");
    const mappedManualIdeas = manualIdeas.map(iv => ({
        title: iv.title,
        hook: iv.hook || "",
        format: iv.format || "",
        targetAudience: iv.targetAudience || "",
        whyItWorks: iv.whyItWorks || "",
        script: iv.script || "",
        estimatedViewPotential: iv.estimatedViewPotential as any,
        signalSource: iv.referenceId || iv.source,  // referenceId holds AI signal for system ideas
        description: iv.description || "",
        tags: iv.tags || [],
    }));

    return (
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 fade-up">
            {isTokenExpired && (
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-400">YouTube session expired</p>
                            <p className="text-xs text-amber-400/80 mt-0.5">Please re-connect your YouTube channel to continue syncing your analytics.</p>
                        </div>
                    </div>
                    <Link href={`/dashboard/settings?channelId=${activeChannel.id}`} className="shrink-0 bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-lg font-bold text-sm transition-colors text-center">
                        Re-connect YouTube
                    </Link>
                </div>
            )}
            
            {/* Channel Header */}
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#1e1e22] pb-6">
                <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-[#1e1e22] text-zinc-400 rounded text-[10px] font-mono font-bold uppercase tracking-wider">
                        {activeChannel.role === "new_tuber" ? "project_new" : "project_existing"}
                    </div>
                    {youtubeStats ? (
                        <div className="flex items-center gap-4 mt-2">
                            <Image
                                src={youtubeStats.snippet?.thumbnails?.default?.url}
                                alt="Channel Thumbnail"
                                width={48}
                                height={48}
                                className="rounded-full border border-[#1e1e22]"
                                priority
                            />
                            <div>
                                <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">{youtubeStats.snippet?.title}</h1>
                                <p className="text-sm font-mono text-zinc-400">
                                    {Number(youtubeStats.statistics?.subscriberCount).toLocaleString()} subs • {Number(youtubeStats.statistics?.viewCount).toLocaleString()} views
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-4xl font-extrabold text-white tracking-tight">{activeChannel.name}</h1>
                            <p className="text-zinc-500 text-sm max-w-xl">
                                {activeChannel.role === "new_tuber"
                                    ? `Computed strategy for a new channel in the [${activeChannel.category}] category focusing on [${activeChannel.topic}].`
                                    : `Analyzing gap signals for YouTube handle [${activeChannel.youtubeChannelId}].`
                                }
                            </p>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    {youtubeStats ? (
                        <a href="#roadmap" className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-600/20 px-4 py-2 rounded font-semibold text-sm transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                            Synthesize Ideas
                        </a>
                    ) : (
                        <Link 
                            href={`/dashboard/settings?channelId=${activeChannel.id}`} 
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded font-semibold text-sm transition-colors ${
                                activeChannel.youtubeAccessToken 
                                    ? "bg-amber-600/10 text-amber-400 border border-amber-600/20 hover:bg-amber-600/20" 
                                    : "bg-[#1e1e22] hover:bg-[#2a2a30] text-white border border-[#2a2a30]"
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
                            {activeChannel.youtubeAccessToken ? "Session Expired" : "Connect YouTube"}
                        </Link>
                    )}
                    <div className="flex items-center justify-between md:justify-center gap-4 border border-[#1e1e22]/50 bg-[#111113]/60 backdrop-blur-md rounded-lg px-6 py-2.5 flex-1 md:flex-none">
                        <div className="text-center pr-4 md:pr-6 border-r border-[#1e1e22]">
                            <div className="text-xl font-bold text-white leading-none mb-1">{scans.length}</div>
                            <div className="text-[10px] font-mono uppercase text-zinc-600 tracking-widest">Scans</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-bold text-white leading-none mb-1">{totalGaps}</div>
                            <div className="text-[10px] font-mono uppercase text-zinc-600 tracking-widest">Gaps</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Roadmap */}
            <div id="roadmap" className="mb-16">
                {/* Market Intelligence */}
                {activeChannel.marketSnapshot && (activeChannel.marketSnapshot as any).outlierVideos && (
                    <MarketInsights 
                        outlierVideos={(activeChannel.marketSnapshot as any).outlierVideos} 
                        uploadFrequency={(activeChannel.marketSnapshot as any).uploadFrequencyBenchmark}
                    />
                )}

                {/* Roadmaps */}
                <FlashcardRoadmap
                    key={activeChannel.id}
                    category={activeChannel.category ?? "General"}
                    topic={activeChannel.topic ?? "YouTube Channel"}
                    theme={activeChannel.brandingData ? (activeChannel.brandingData as { theme?: string }).theme ?? "tech" : "tech"}
                    channelId={activeChannel.id}
                    videoIdeas={mappedSystemIdeas}
                    savedIdeas={mappedManualIdeas}
                    videoIdeaStatus={mappedSystemStatuses}
                    isYoutubeConnected={isYoutubeConnected}
                />
            </div>

            <Suspense fallback={<ScanHistorySkeleton />}>
                <ScanHistorySection channelId={activeChannel.id} limit={scanLimit} savedIdeas={mappedManualIdeas} />
            </Suspense>
        </div>
    );
}
