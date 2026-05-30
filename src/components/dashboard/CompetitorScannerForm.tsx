"use client";

import { useState } from "react";
import { Loader2, Plus, Target, Trash2, Zap } from "lucide-react";
import { GapCard, AnalyticsPanel } from "./ScanComponents";
import { useRouter } from "next/navigation";

interface RecommendedCompetitor {
    channelId: string;
    name: string;
    handle: string;
    thumbnail: string;
    subscribers: number;
    totalViews: number;
    videoCount: number;
    description: string;
}

export function CompetitorScannerForm({ channelId, topic }: { channelId: string; topic: string }) {
    const [keyword, setKeyword] = useState("");
    const [competitors, setCompetitors] = useState<string[]>([""]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);
    
    const [recommendedCompetitors, setRecommendedCompetitors] = useState<RecommendedCompetitor[]>([]);
    const [isFetchingRecommendations, setIsFetchingRecommendations] = useState(false);
    
    const router = useRouter();

    const addCompetitor = () => {
        if (competitors.length < 3) {
            setCompetitors([...competitors, ""]);
        }
    };

    const removeCompetitor = (index: number) => {
        const newCompetitors = [...competitors];
        newCompetitors.splice(index, 1);
        if (newCompetitors.length === 0) newCompetitors.push("");
        setCompetitors(newCompetitors);
    };

    const updateCompetitor = (index: number, value: string) => {
        const newCompetitors = [...competitors];
        newCompetitors[index] = value;
        setCompetitors(newCompetitors);
    };

    const addRecommendedCompetitor = (handle: string) => {
        const handleStr = handle.startsWith("@") ? handle : `@${handle}`;
        if (!competitors.includes(handleStr)) {
            // Find first empty slot or add to end
            const emptyIndex = competitors.findIndex(c => c.trim() === "");
            if (emptyIndex !== -1) {
                updateCompetitor(emptyIndex, handleStr);
            } else if (competitors.length < 3) {
                setCompetitors([...competitors, handleStr]);
            } else {
                // Replace the last one if full
                updateCompetitor(2, handleStr);
            }
        }
    };

    const fetchRecommendations = async () => {
        if (!topic) return;
        setIsFetchingRecommendations(true);
        try {
            const res = await fetch(`/api/competitors/recommend?topic=${encodeURIComponent(topic)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.competitors) {
                    setRecommendedCompetitors(data.competitors);
                }
            }
        } catch (error) {
            console.error("Failed to fetch recommendations", error);
        } finally {
            setIsFetchingRecommendations(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);

        const filteredCompetitors = competitors.filter(c => c.trim().length > 0);
        
        if (!keyword.trim()) {
            setError("Please enter a target keyword.");
            return;
        }

        if (filteredCompetitors.length === 0) {
            setError("Please enter at least one competitor handle or URL.");
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/web-analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    keyword: keyword.trim(),
                    competitors: filteredCompetitors,
                    channelId
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to run analysis.");
            }

            setResult(data);
            window.dispatchEvent(new CustomEvent("credit-update", { detail: { deduct: 1 } }));
            router.refresh(); // Refresh to update sidebar and history if they exist elsewhere
            
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="bg-[#111113] border border-[#1e1e22] rounded-xl p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
                        <Target className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Competitor Gap Scanner</h2>
                        <p className="text-zinc-500 text-sm">Analyze competitors' recent videos to find hidden content gaps and opportunities.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">
                            Target Keyword or Topic
                        </label>
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="e.g. Next.js 14 Tutorial"
                            className="w-full bg-[#0c0c0e] border border-[#1e1e22] rounded-lg px-4 py-3 text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500/50 transition-colors"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest">
                                Competitor Channels (Max 3)
                            </label>
                            {competitors.length < 3 && (
                                <button
                                    type="button"
                                    onClick={addCompetitor}
                                    disabled={isLoading}
                                    className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 self-start sm:self-auto"
                                >
                                    <Plus className="w-3 h-3" /> ADD
                                </button>
                            )}
                        </div>
                        
                        <div className="space-y-3">
                            {competitors.map((comp, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        value={comp}
                                        onChange={(e) => updateCompetitor(index, e.target.value)}
                                        placeholder="e.g. @Fireship or youtube.com/@Fireship"
                                        className="flex-1 bg-[#0c0c0e] border border-[#1e1e22] rounded-lg px-4 py-3 text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                        disabled={isLoading}
                                    />
                                    {competitors.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeCompetitor(index)}
                                            disabled={isLoading}
                                            className="p-3 bg-[#1e1e22] hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-500/30"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-zinc-600 mt-2">Enter YouTube handles (with @) or full channel URLs.</p>
                    </div>

                    {/* Recommendations Section */}
                    {topic && (
                        <div className="pt-4 border-t border-[#1e1e22]">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                <div>
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        Suggested Competitors
                                    </h3>
                                    <p className="text-xs text-zinc-500">Based on your channel topic: <span className="text-zinc-300 font-mono">[{topic}]</span></p>
                                </div>
                                <button
                                    type="button"
                                    onClick={fetchRecommendations}
                                    disabled={isFetchingRecommendations}
                                    className="px-3 py-1.5 bg-[#1e1e22] hover:bg-[#2a2a30] text-zinc-300 rounded text-xs font-mono transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {isFetchingRecommendations ? <Loader2 className="w-3 h-3 animate-spin" /> : "FIND TOP PERFORMERS"}
                                </button>
                            </div>

                            {recommendedCompetitors.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                                    {recommendedCompetitors.map((comp) => (
                                        <div key={comp.channelId} className="p-3 bg-[#0c0c0e] border border-[#1e1e22] rounded-lg hover:border-emerald-500/30 transition-colors group">
                                            <div className="flex items-start gap-3">
                                                <img src={comp.thumbnail} alt={comp.name} className="w-10 h-10 rounded-full border border-[#2a2a30] bg-[#111113] object-cover" />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-zinc-200 truncate">{comp.name}</h4>
                                                    <p className="text-xs text-zinc-500 truncate">{comp.handle.startsWith("@") ? comp.handle : `@${comp.handle}`}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                                                            {comp.subscribers >= 1000000 
                                                                ? `${(comp.subscribers / 1000000).toFixed(1)}M` 
                                                                : `${(comp.subscribers / 1000).toFixed(1)}K`} subs
                                                        </span>
                                                        <span className="text-[10px] font-mono text-zinc-500">
                                                            {comp.videoCount} vids
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => addRecommendedCompetitor(comp.handle)}
                                                className="mt-3 w-full py-1.5 bg-[#111113] border border-[#1e1e22] group-hover:bg-[#1e1e22] rounded text-xs text-zinc-400 group-hover:text-white transition-colors"
                                            >
                                                Add to Scan
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !keyword.trim() || !competitors.find(c => c.trim().length > 0)}
                        className="w-full bg-emerald-600 text-white font-bold rounded-lg py-4 hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                SCANNING MARKET...
                            </>
                        ) : (
                            <>
                                <Target className="w-5 h-5" />
                                RUN AI GAP SCAN
                                <span className="ml-2 flex items-center gap-1 text-xs font-mono bg-emerald-700/50 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    <Zap className="w-3 h-3 fill-current text-amber-400" /> -1
                                </span>
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Results Section */}
            {result && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e1e22] pb-4">
                        <h2 className="text-2xl font-bold text-white tracking-tight">
                            Results for &ldquo;{result.keyword}&rdquo;
                        </h2>
                        {result.recommendedNiche && (
                            <span className="text-[10px] font-mono bg-[#111113] border border-[#1e1e22] text-zinc-400 rounded px-2 py-1 self-start sm:self-auto">
                                niche: {result.recommendedNiche}
                            </span>
                        )}
                    </div>

                    {result.analytics && <AnalyticsPanel analytics={result.analytics} />}

                    {result.gaps && result.gaps.length > 0 && (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {result.gaps.map((gap: any, i: number) => (
                                <GapCard key={i} gap={gap} rank={i + 1} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
