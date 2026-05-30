"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
    Radar, Plus, Trash2, Zap, Search, Eye, Calendar,
    ArrowRight, Loader2, AlertCircle, TrendingUp, Clock,
    ThumbsUp, MessageSquare, Tag, Target, Lightbulb, Copy, CheckCheck, Film,
    Bot, Save
} from "lucide-react";
import { toast } from "sonner";

interface Monitor {
    id: string;
    competitorName: string;
    competitorHandle: string;
    competitorImage: string;
    lastScannedAt: string | null;
    insights: Insight[];
}

interface Insight {
    id: string;
    videoId: string;
    title: string;
    thumbnail: string;
    views: string;
    publishedAt: string;
    analysis: {
        whyItWorked: string;
        theGap: string;
        suggestedHook: string;
        counterTitle: string;
        targetKeywords: string;
        contentAngle: string;
        estimatedProductionTime: number;
        viralityScore: number;
        // rich metric fields
        likes?: string;
        comments?: string;
        duration?: string;
        engagementRate?: string;
        tags?: string[];
    };
}

function HeatBar({ score }: { score: number }) {
    const isHigh = score >= 80;
    const isMedium = score >= 50 && score < 80;
    
    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-[#111113] rounded-full overflow-hidden border border-[#1e1e22]">
                <div 
                    className={`h-full rounded-full transition-all relative overflow-hidden ${
                        isHigh ? 'bg-gradient-to-r from-red-500 to-rose-400' :
                        isMedium ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                        'bg-gradient-to-r from-blue-500 to-cyan-400'
                    }`} 
                    style={{ width: `${score}%` }}
                >
                    {isHigh && (
                        <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    )}
                </div>
            </div>
            <span className={`text-[10px] font-mono font-bold tracking-widest uppercase ${
                isHigh ? "text-rose-400" : isMedium ? "text-amber-400" : "text-blue-400"
            }`}>
                {score >= 80 ? "High Heat" : score >= 50 ? "Medium Heat" : "Low Heat"} {score}%
            </span>
        </div>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button
            onClick={handleCopy}
            className="p-1 rounded text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors shrink-0"
            title="Copy to clipboard"
        >
            {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
}

function buildScriptPrompt(analysis: Insight["analysis"], fallbackTitle: string) {
    const titleStr = analysis.counterTitle || fallbackTitle;
    const hookStr = analysis.suggestedHook || "High energy hook";
    const angleStr = analysis.contentAngle || "Competitor Remix";
    const gapStr = analysis.theGap || "Address missing value";
    const keywordStr = analysis.targetKeywords || "General audience";

    return `Write a comprehensive, professionally-structured YouTube script for a ${angleStr} video titled: "${titleStr}".

STRUCTURE REQUIREMENTS:
1. HOOK (0:00-0:30): High-energy, curiosity-driven opening that addresses the viewer's pain point.
2. INTRO: Brief overview of what they will learn and why they should stay until the end.
3. CHAPTERS (Value Delivery): Break the content into 3-5 logical, high-value segments with transitions.
4. MID-ROLL CTA: A natural, context-aware call to action.
5. CONCLUSION & OUTRO: Summarize key takeaways and provide a "Next Step" for the viewer.

CONTEXT:
Hook Idea: "${hookStr}"
The Gap it fills (Competitor weakness): "${gapStr}"
Target Keywords: ${keywordStr}
Target Duration: 10-15 min

**CRITICAL SCRIPT REQUIREMENTS:**
1. **Length**: Scaled for a video that is roughly **5 to 15 minutes long**.
2. **Pacing & Timestamps**: Group the script into logical scenes or chapters with their estimated timestamp ranges (e.g., [0:00 - 1:30], [1:30 - 3:00]).
3. **Structure**: Do NOT duplicate scene titles. Each scene should be a single row in the table, containing all visuals and audio for that section.
4. **FORMAT**: Output the actual script as a single **Markdown Table** — no plain paragraphs.
5. **Table Columns**: | Scene / Section | Timestamp | Visuals / B-Roll | Audio / Voiceover |

Ensure high-retention storytelling with a strong CTA. Generate the complete script now.`;
}

function InsightCard({ insight, channelId }: { insight: Insight & { monitorName: string }, channelId: string }) {
    const [expanded, setExpanded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const router = useRouter();

    const { analysis } = insight;

    const handleSaveIdea = async () => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/save-idea", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelId,
                    ideas: [{
                        title: `[Signal] ${analysis.counterTitle || "Remix: " + insight.title}`,
                        hook: analysis.suggestedHook,
                        format: analysis.contentAngle || "Competitor Remix",
                        whyItWorks: `${analysis.viralityScore}/100 Virality — Gap: ${analysis.theGap}`,
                        estimatedViewPotential: analysis.viralityScore >= 80 ? "high" : "medium",
                        targetAudience: "Your existing audience",
                        targetKeywords: analysis.targetKeywords,
                        estimatedProductionTime: analysis.estimatedProductionTime,
                        source: "watchtower_manual",
                    }]
                })
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch (e) {
            console.error("Failed to save idea", e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateScript = () => {
        const title = encodeURIComponent(analysis.counterTitle || insight.title);
        const prompt = encodeURIComponent(buildScriptPrompt(analysis, insight.title));
        router.push(`/dashboard/bot?title=${title}&prompt=${prompt}&channelId=${channelId}`);
    };
    const views = parseInt(insight.views);
    const viewsFormatted = views >= 1_000_000
        ? `${(views / 1_000_000).toFixed(1)}M`
        : views >= 1_000
        ? `${(views / 1_000).toFixed(0)}K`
        : String(views);

    const isHigh = analysis.viralityScore >= 80;
    const accentColor = isHigh ? "bg-rose-500" : analysis.viralityScore >= 50 ? "bg-amber-500" : "bg-blue-500";
    const bgGradient = isHigh ? "from-rose-500/5 to-transparent" : "from-transparent to-transparent";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative bg-[#0c0c0e] border border-[#1e1e22] rounded-xl overflow-hidden hover:border-[#2a2a30] transition-all bg-gradient-to-br ${bgGradient}`}
        >
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />
            {/* Top row: thumbnail + meta */}
            <div className="flex gap-4 p-4">
                <div className="relative shrink-0">
                    <img
                        src={insight.thumbnail}
                        className="w-36 h-22 rounded-lg object-cover border border-[#1e1e22]"
                        style={{ height: "5.5rem" }}
                        alt=""
                    />
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/80 backdrop-blur rounded text-[9px] font-mono font-bold text-white border border-white/10">
                        {analysis.viralityScore}% HEAT
                    </div>
                    {analysis.duration && (
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-zinc-300">
                            {analysis.duration}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest truncate">{insight.monitorName}</span>
                        <span className="text-[9px] font-mono text-zinc-600 shrink-0">
                            {new Date(insight.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                    </div>

                    <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug">{insight.title}</h4>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                            <Eye className="w-3 h-3" /> {viewsFormatted}
                        </div>
                        {analysis.likes && (
                            <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                                <ThumbsUp className="w-3 h-3" /> {(parseInt(analysis.likes) / 1000).toFixed(1)}K
                            </div>
                        )}
                        {analysis.comments && (
                            <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                                <MessageSquare className="w-3 h-3" /> {(parseInt(analysis.comments) / 1000).toFixed(1)}K
                            </div>
                        )}
                        {analysis.engagementRate && (
                            <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                                <TrendingUp className="w-3 h-3" /> {analysis.engagementRate}% ER
                            </div>
                        )}
                        {analysis.estimatedProductionTime && (
                            <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                                <Clock className="w-3 h-3" /> ~{analysis.estimatedProductionTime}h to produce
                            </div>
                        )}
                    </div>

                    <HeatBar score={analysis.viralityScore} />
                </div>
            </div>

            {/* Content Angle badge + Tags */}
            <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                {analysis.contentAngle && (
                    <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-mono font-bold rounded-full uppercase">
                        {analysis.contentAngle}
                    </span>
                )}
                {analysis.tags?.slice(0, 3).map((tag) => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-[#1e1e22] text-zinc-500 text-[9px] font-mono rounded-full">
                        <Tag className="w-2.5 h-2.5" />{tag}
                    </span>
                ))}
            </div>

            {/* Core Analysis */}
            <div className="border-t border-[#1e1e22] mx-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                <div className="space-y-2 bg-[#111113] border border-[#1e1e22] rounded-lg p-3">
                    <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Success Factors</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">{analysis.whyItWorked}</p>
                </div>
                <div className="space-y-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
                    <div className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[9px] font-mono text-emerald-600 uppercase tracking-widest font-bold">The Exploitable Gap</span>
                    </div>
                    <p className="text-[11px] text-emerald-400/90 leading-relaxed line-clamp-3">{analysis.theGap}</p>
                </div>
            </div>

            {/* Expanded section */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-[#1e1e22]/60 mx-4" />
                        <div className="p-4 space-y-4">
                            {/* Counter Title */}
                            {analysis.counterTitle && (
                                <div className="space-y-1.5">
                                    <span className="text-[8px] font-mono text-blue-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <Film className="w-3 h-3" /> Counter_Title (Ready to Use)
                                    </span>
                                    <div className="flex items-start justify-between gap-2 bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
                                        <p className="text-sm font-bold text-blue-300 leading-snug">{analysis.counterTitle}</p>
                                        <CopyButton text={analysis.counterTitle} />
                                    </div>
                                </div>
                            )}

                            {/* Suggested Hook */}
                            <div className="space-y-1.5">
                                <span className="text-[8px] font-mono text-purple-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Lightbulb className="w-3 h-3" /> 10-Second_Hook_Script
                                </span>
                                <div className="flex items-start justify-between gap-2 bg-purple-500/5 border border-purple-500/15 rounded-lg p-3">
                                    <p className="text-[12px] text-purple-300 italic leading-relaxed">"{analysis.suggestedHook}"</p>
                                    <CopyButton text={analysis.suggestedHook} />
                                </div>
                            </div>

                            {/* Target Keywords */}
                            {analysis.targetKeywords && (
                                <div className="space-y-1.5">
                                    <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                                        <Target className="w-3 h-3" /> Target_Keywords
                                    </span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {analysis.targetKeywords.split(",").map((kw) => (
                                            <span key={kw} className="px-2.5 py-1 bg-[#1e1e22] border border-[#2a2a30] text-zinc-300 text-[10px] font-mono rounded-lg">
                                                {kw.trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 pt-3 border-t border-[#1e1e22]/60">
                                <button
                                    onClick={handleSaveIdea}
                                    disabled={isSaving || saved}
                                    className="flex-1 py-2.5 rounded-lg bg-[#111113] hover:bg-[#1e1e22] border border-[#1e1e22] text-zinc-300 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {saved ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : isSaving ? <Loader2 className="w-4 h-4 animate-spin text-zinc-500" /> : <Save className="w-4 h-4 text-amber-500" />}
                                    {saved ? "Saved to Vault" : "Save to Vault"}
                                </button>
                                <button
                                    onClick={handleGenerateScript}
                                    className="flex-1 py-2.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Bot className="w-4 h-4" />
                                    Generate Script
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Expand toggle */}
            <div className="px-4 pb-4">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full py-2 rounded-lg border border-[#1e1e22] text-[10px] font-mono font-bold uppercase text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                >
                    {expanded ? "▲ Hide Strategy Details" : "▼ Show Counter-Strategy + Hook"}
                </button>
            </div>
        </motion.div>
    );
}

export function CompetitorWatchtower({ channelId }: { channelId: string }) {
    const [monitors, setMonitors] = useState<Monitor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newHandle, setNewHandle] = useState("");
    const [isScanning, setIsScanning] = useState<string | null>(null);
    const [isScanningAll, setIsScanningAll] = useState(false);
    const [scanResult, setScanResult] = useState<{ total: number; analyzed: number } | null>(null);
    const [isSavingTop, setIsSavingTop] = useState(false);
    const [savedTop, setSavedTop] = useState(false);
    const router = useRouter();

    const fetchWatchtower = async () => {
        try {
            const res = await fetch(`/api/watchtower?channelId=${channelId}`);
            if (res.ok) {
                const data = await res.json();
                setMonitors(data);
            }
        } catch (e) {
            console.error("Watchtower fetch error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (channelId) fetchWatchtower();
    }, [channelId]);

    const handleAdd = async () => {
        if (!newHandle.trim()) return;
        setIsAdding(true);
        try {
            const res = await fetch("/api/watchtower", {
                method: "POST",
                body: JSON.stringify({ channelId, handle: newHandle }),
            });
            if (res.ok) {
                setNewHandle("");
                fetchWatchtower();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to add competitor");
            }
        } catch (e) {
            console.error("Add error:", e);
            toast.error("An unexpected error occurred.");
        } finally {
            setIsAdding(false);
        }
    };

    const handleScan = async (monitorId: string) => {
        setIsScanning(monitorId);
        setScanResult(null);
        try {
            const res = await fetch("/api/watchtower/scan", {
                method: "POST",
                body: JSON.stringify({ monitorId }),
            });
            if (res.ok) {
                const data = await res.json();
                window.dispatchEvent(new CustomEvent("credit-update", { detail: { deduct: 1 } }));
                setScanResult({ total: data.totalLongForm ?? 0, analyzed: data.analyzed ?? 0 });
                fetchWatchtower();
            }
        } catch (e) {
            console.error("Scan error:", e);
        } finally {
            setIsScanning(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Stop monitoring this competitor?")) return;
        try {
            const res = await fetch(`/api/watchtower?id=${id}`, { method: "DELETE" });
            if (res.ok) fetchWatchtower();
        } catch (e) {
            console.error("Delete error:", e);
        }
    };

    const handleScanAll = async () => {
        if (monitors.length === 0 || isScanningAll) return;
        setIsScanningAll(true);
        setScanResult(null);
        try {
            const results = await Promise.allSettled(
                monitors.map(m =>
                    fetch("/api/watchtower/scan", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ monitorId: m.id }),
                    }).then(r => r.ok ? r.json() : Promise.reject())
                )
            );
            const totals = results.reduce(
                (acc, r) => r.status === "fulfilled"
                    ? { total: acc.total + (r.value.totalLongForm ?? 0), analyzed: acc.analyzed + (r.value.analyzed ?? 0) }
                    : acc,
                { total: 0, analyzed: 0 }
            );
            window.dispatchEvent(new CustomEvent("credit-update", { detail: { deduct: monitors.length } }));
            setScanResult(totals);
            fetchWatchtower();
        } catch (e) {
            console.error("Scan All error:", e);
        } finally {
            setIsScanningAll(false);
        }
    };

    // Flatten all insights across monitors with monitor name attached
    const allInsights = monitors
        .flatMap(m => m.insights.map(i => ({ ...i, monitorName: m.competitorName })))
        .sort((a, b) => (b.analysis.viralityScore ?? 0) - (a.analysis.viralityScore ?? 0));

    const topSignal = allInsights[0];

    const handleSaveTopSignal = async () => {
        if (!topSignal) return;
        setIsSavingTop(true);
        try {
            const res = await fetch("/api/save-idea", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelId,
                    ideas: [{
                        title: `[Signal] ${topSignal.analysis.counterTitle || "Remix: " + topSignal.title}`,
                        hook: topSignal.analysis.suggestedHook,
                        format: topSignal.analysis.contentAngle || "Competitor Remix",
                        whyItWorks: `${topSignal.analysis.viralityScore}/100 Virality — Gap: ${topSignal.analysis.theGap}`,
                        estimatedViewPotential: (topSignal.analysis.viralityScore ?? 0) >= 80 ? "high" : "medium",
                        targetAudience: "Your existing audience",
                        targetKeywords: topSignal.analysis.targetKeywords,
                        estimatedProductionTime: topSignal.analysis.estimatedProductionTime,
                        source: "watchtower_manual",
                    }]
                })
            });
            if (res.ok) {
                setSavedTop(true);
                setTimeout(() => setSavedTop(false), 3000);
            }
        } catch (e) {
            console.error("Failed to save top signal", e);
        } finally {
            setIsSavingTop(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header & Add Competitor */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-[#111113]/40 border border-[#1e1e22]/50 rounded-2xl backdrop-blur-sm">
                <div className="space-y-1">
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Radar className="w-5 h-5 text-amber-500 animate-pulse" />
                        Competitor Watchtower
                        <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase ml-1">Long-Form Only</span>
                    </h2>
                    <p className="text-sm text-zinc-500">Tracking rival long-form videos. Shorts are automatically filtered out.</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                        <input
                            type="text"
                            placeholder="Enter handle (e.g. @MrBeast)"
                            value={newHandle}
                            onChange={(e) => setNewHandle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                            className="bg-[#0c0c0e] border border-[#1e1e22] text-zinc-300 text-xs rounded-lg pl-9 pr-4 py-2.5 w-64 outline-none focus:border-amber-500/50 transition-colors"
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        disabled={isAdding}
                        className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Track
                    </button>
                    {monitors.length > 1 && (
                        <button
                            onClick={handleScanAll}
                            disabled={isScanningAll}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {isScanningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            Scan All <Zap className="w-3 h-3 text-amber-500 fill-amber-500 inline -mr-1" /> {monitors.length}
                        </button>
                    )}
                </div>
            </div>

            {/* Scan Result Toast */}
            <AnimatePresence>
                {scanResult && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-mono"
                    >
                        <Zap className="w-4 h-4 shrink-0" />
                        Scan complete — Found <strong className="mx-1">{scanResult.total}</strong> long-form videos, analyzed top <strong className="mx-1">{scanResult.analyzed}</strong>. Shorts auto-filtered.
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Radar Grid of tracked competitors */}
            {monitors.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {monitors.map((m) => (
                        <div key={m.id} className="group relative bg-[#111113]/60 border border-[#1e1e22]/50 rounded-xl p-4 transition-all hover:border-amber-500/30">
                            <button
                                onClick={() => handleDelete(m.id)}
                                className="absolute top-2 right-2 p-1 rounded bg-[#0c0c0e] text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                            <div className="flex flex-col items-center text-center space-y-3">
                                <div className="relative">
                                    <img src={m.competitorImage} className="w-12 h-12 rounded-full border-2 border-[#1e1e22] group-hover:border-amber-500/50 transition-colors" alt="" />
                                    {/* Online dot / Staleness warning */}
                                    {(() => {
                                        const isStale = !m.lastScannedAt || (Date.now() - new Date(m.lastScannedAt).getTime()) > 48 * 3600 * 1000;
                                        return (
                                            <div title={isStale ? "Not scanned in 48h — click Scan" : "Recently scanned"}
                                                className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-[#111113] rounded-full transition-colors ${
                                                    isStale ? "bg-red-500 animate-pulse" : "bg-emerald-500"
                                                }`} />
                                        );
                                    })()}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-white truncate w-full">{m.competitorName}</p>
                                    <p className="text-[10px] font-mono text-zinc-600 uppercase mt-0.5">{m.competitorHandle}</p>
                                    {m.lastScannedAt && (
                                        <p className="text-[9px] font-mono text-zinc-700 mt-1">
                                            Last: {new Date(m.lastScannedAt).toLocaleDateString()}
                                        </p>
                                    )}
                                    <p className="text-[9px] font-mono text-amber-600 mt-0.5">{m.insights.length} signals</p>
                                </div>
                                <button
                                    onClick={() => handleScan(m.id)}
                                    disabled={isScanning === m.id}
                                    className="w-full py-1.5 rounded bg-[#0c0c0e] border border-[#1e1e22] text-[10px] font-mono font-bold uppercase text-zinc-500 hover:text-amber-400 hover:border-amber-500/30 transition-all flex items-center justify-center gap-1.5"
                                >
                                    {isScanning === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                    Scan <Zap className="w-3 h-3 text-amber-500 fill-amber-500 inline -mx-0.5" /> 1
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Insights Feed */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Market_Intel_Feed</h3>
                        {allInsights.length > 0 && (
                            <span className="text-[10px] font-mono bg-[#1e1e22] text-zinc-500 px-1.5 py-0.5 rounded font-bold">{allInsights.length}</span>
                        )}
                    </div>

                    {allInsights.length === 0 ? (
                        <div className="p-10 border border-dashed border-[#1e1e22] rounded-2xl text-center">
                            <AlertCircle className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">No radar signals detected</p>
                            <p className="text-[10px] text-zinc-600 mt-1">Add a competitor handle and click Scan to analyze their long-form videos.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {allInsights.slice(0, 10).map((insight) => (
                                <InsightCard key={insight.id} insight={insight} channelId={channelId} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Top Signal & Recommendations */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-emerald-500" />
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Top_Signal</h3>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-600/10 to-transparent border border-emerald-500/20 rounded-2xl p-5 space-y-5">
                        {topSignal ? (
                            <>
                                <div className="space-y-3">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Highest Heat Opportunity</span>
                                    </div>
                                    <p className="text-base font-bold text-white leading-snug">{topSignal.analysis.counterTitle || topSignal.title}</p>
                                    <div className="pt-2">
                                        <HeatBar score={topSignal.analysis.viralityScore} />
                                    </div>
                                </div>

                                {topSignal.analysis.suggestedHook && (
                                    <div className="space-y-2 bg-[#111113]/80 border border-[#1e1e22] rounded-xl p-4">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                                            <span className="text-[9px] font-mono text-amber-500/80 uppercase tracking-widest font-bold">Recommended Hook</span>
                                        </div>
                                        <p className="text-sm text-zinc-300 leading-relaxed italic">
                                            "{topSignal.analysis.suggestedHook}"
                                        </p>
                                    </div>
                                )}

                                {topSignal.analysis.targetKeywords && (
                                    <div className="space-y-2">
                                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Target Keywords</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {topSignal.analysis.targetKeywords.split(",").map((kw) => (
                                                <span key={kw} className="px-2.5 py-1 bg-[#111113] border border-[#1e1e22] text-zinc-300 hover:text-white transition-colors text-[10px] font-mono rounded-lg">
                                                    {kw.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-emerald-500/10 flex flex-col gap-3">
                                    <button
                                        onClick={() => {
                                            const title = encodeURIComponent(topSignal.analysis.counterTitle || topSignal.title);
                                            const prompt = encodeURIComponent(buildScriptPrompt(topSignal.analysis, topSignal.title));
                                            router.push(`/dashboard/bot?title=${title}&prompt=${prompt}&channelId=${channelId}`);
                                        }}
                                        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                                    >
                                        <Bot className="w-5 h-5" /> Generate Script in AI Studio
                                    </button>
                                    <button
                                        onClick={handleSaveTopSignal}
                                        disabled={isSavingTop || savedTop}
                                        className="w-full py-2.5 rounded-xl bg-[#111113] hover:bg-[#1e1e22] border border-emerald-500/30 text-emerald-400 text-sm font-mono font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {savedTop ? <CheckCheck className="w-4 h-4" /> : isSavingTop ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {savedTop ? "Saved to Vault" : "Save to Vault"}
                                    </button>
                                </div>
                                <div className="pt-4 border-t border-emerald-500/10 space-y-3">
                                    {[
                                        "Find competitor videos with 80%+ Heat — check the Gap field to out-compete with a fresh angle.",
                                        "Copy the suggested hook script and paste it directly into your recording teleprompter.",
                                        "Use the counter-title as your working title to capture the same audience search intent.",
                                    ].map((tip, i) => (
                                        <div key={i} className="flex items-start gap-2.5">
                                            <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                <ArrowRight className="w-2.5 h-2.5 text-emerald-400" />
                                            </div>
                                            <p className="text-[11px] text-zinc-400 leading-relaxed">{tip}</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <div className="relative mx-auto w-fit">
                                    <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
                                    <Radar className="w-20 h-20 text-emerald-500/10 relative" />
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-0 border-t-2 border-emerald-500/40 rounded-full"
                                    />
                                </div>
                                <p className="text-xs text-zinc-600 font-mono mt-4 uppercase">Awaiting radar scan...</p>
                            </div>
                        )}
                    </div>

                    {/* Stats summary */}
                    {allInsights.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#111113]/60 border border-[#1e1e22]/50 rounded-xl p-3 text-center">
                                <p className="text-lg font-bold text-white">{monitors.length}</p>
                                <p className="text-[9px] font-mono text-zinc-600 uppercase mt-0.5">Tracked Rivals</p>
                            </div>
                            <div className="bg-[#111113]/60 border border-[#1e1e22]/50 rounded-xl p-3 text-center">
                                <p className="text-lg font-bold text-amber-400">{allInsights.filter(i => i.analysis.viralityScore >= 80).length}</p>
                                <p className="text-[9px] font-mono text-zinc-600 uppercase mt-0.5">High Signals</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
