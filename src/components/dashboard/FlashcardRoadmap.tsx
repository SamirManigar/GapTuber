"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Database, Play, Video, Users, Eye, Loader2, RefreshCw, CheckCircle2,
    FileText, Trash2, X, Download, Library, Radar, Clock, Filter, Target,
    Search, Bot, Sparkles, TrendingUp, AlertCircle, BookOpen, Zap, ArrowUpDown,
    ChevronDown, MoreVertical, CheckCheck, Copy, Film, Star
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import type { VideoIdeaDB } from "@/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoIdea {
    id: string;
    title: string;
    hook: string;
    format: string;
    script?: string;
}

type SortKey = "default" | "potential" | "status" | "title";
type FilterSegment = "all" | "DISCOVERY" | "RETENTION" | "WILDCARD";
type FilterPotential = "all" | "high" | "medium" | "low";
type FilterStatus = "all" | "ready" | "filming" | "done";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapBlueprintToIdeas(ideas: VideoIdeaDB[]): VideoIdea[] {
    return ideas.map((idea, i) => ({
        id: `idea-${i}`,
        title: idea.title,
        hook: idea.hook,
        format: idea.format,
        script: idea.script,
    }));
}

function getSegmentInfo(format: string) {
    const f = (format || "").toUpperCase();
    if (f.startsWith("DISCOVERY")) return { label: "Discovery", short: "🔍 Discovery", cls: "text-sky-400 bg-sky-500/10 border-sky-500/20" };
    if (f.startsWith("RETENTION")) return { label: "Retention", short: "🎯 Retention", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
    if (f.startsWith("WILDCARD")) return { label: "Wildcard", short: "⚡ Wildcard", cls: "text-red-400 bg-red-500/10 border-red-500/20" };
    return null;
}

function getSignalInfo(source?: string) {
    if (!source) return null;
    const s = source.toLowerCase();
    // Watchtower (DB source: "watchtower", or AI label: "Watchtower")
    if (s.includes("watchtower")) return { label: "Watchtower", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
    // Comment Miner (DB source: "comment_mining", or AI label: "Comment Demand")
    if (s.includes("comment")) return { label: "Comment Demand", cls: "text-purple-400 bg-purple-500/10 border-purple-500/20" };
    // Velocity Signal
    if (s.includes("velocity")) return { label: "Velocity Signal", cls: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" };
    // Trend Momentum
    if (s.includes("trend")) return { label: "Trend", cls: "text-pink-400 bg-pink-500/10 border-pink-500/20" };
    // Market Gap / Gap Scanner / Extension
    if (s.includes("market") || s.includes("gapscan") || s.includes("extension")) return { label: "Market Gap", cls: "text-lime-400 bg-lime-500/10 border-lime-500/20" };
    return null;
}

const POTENTIAL_ORDER = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER = { filming: 0, ready: 1, done: 2 };

const STATUS_CONFIG = {
    ready: {
        label: "Ready to Record",
        color: "text-zinc-300 border-zinc-700/50 bg-zinc-800/40",
        dot: "bg-zinc-500",
        next: "filming" as const,
        icon: Film,
    },
    filming: {
        label: "In Production",
        color: "text-amber-300 border-amber-500/30 bg-amber-900/20",
        dot: "bg-amber-400",
        next: "done" as const,
        icon: Zap,
    },
    done: {
        label: "Completed",
        color: "text-emerald-300 border-emerald-500/30 bg-emerald-900/20",
        dot: "bg-emerald-400",
        next: "ready" as const,
        icon: CheckCheck,
    },
} as const;

// ─── Sub-Components ───────────────────────────────────────────────────────────

function PotentialBadge({ level }: { level: string }) {
    const map: Record<string, { cls: string; icon: React.ReactNode; glow: string }> = {
        high: {
            cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
            icon: <Sparkles className="w-2.5 h-2.5" />,
            glow: "shadow-[0_0_12px_rgba(52,211,153,0.15)]",
        },
        medium: {
            cls: "text-amber-300 bg-amber-500/15 border-amber-500/30",
            icon: <TrendingUp className="w-2.5 h-2.5" />,
            glow: "",
        },
        low: {
            cls: "text-zinc-500 bg-zinc-800/50 border-zinc-700/40",
            icon: null,
            glow: "",
        },
    };
    const l = level.toLowerCase();
    const cfg = map[l] || map.low;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase border tracking-widest ${cfg.cls} ${cfg.glow}`}>
            {cfg.icon}
            {level} Potential
        </span>
    );
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1 text-[10px] font-mono text-zinc-600 hover:text-emerald-400 transition-colors"
        >
            {copied ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {label && <span>{copied ? "Copied" : label}</span>}
        </button>
    );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function VaultStatsBar({ ideas, statusMap }: { ideas: VideoIdea[]; statusMap: Record<string, string> }) {
    const stats = useMemo(() => {
        const total = ideas.length;
        const filming = ideas.filter((_, i) => statusMap[String(i)] === "filming").length;
        const done = ideas.filter((_, i) => statusMap[String(i)] === "done").length;
        const ready = total - filming - done;
        return { total, filming, done, ready };
    }, [ideas, statusMap]);

    return (
        <div className="grid grid-cols-4 gap-3">
            {[
                { label: "Total Ideas", value: stats.total, color: "text-white", bg: "bg-zinc-800/40 border-zinc-700/30" },
                { label: "Ready", value: stats.ready, color: "text-zinc-300", bg: "bg-zinc-800/30 border-zinc-700/20" },
                { label: "In Production", value: stats.filming, color: "text-amber-400", bg: "bg-amber-900/20 border-amber-500/15" },
                { label: "Completed", value: stats.done, color: "text-emerald-400", bg: "bg-emerald-900/20 border-emerald-500/15" },
            ].map(s => (
                <div key={s.label} className={`rounded-xl border p-3 text-center ${s.bg}`}>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[9px] font-mono text-zinc-600 uppercase mt-0.5 tracking-widest">{s.label}</p>
                </div>
            ))}
        </div>
    );
}

// ─── Idea Card ────────────────────────────────────────────────────────────────

interface IdeaCardProps {
    idea: VideoIdea;
    rawIdea: VideoIdeaDB;
    index: number;
    status: "ready" | "filming" | "done";
    isVaultMode: boolean;
    isUpdating: boolean;
    isSelected: boolean;
    channelId: string;
    activeChannelId: string;
    onToggleSelect: () => void;
    onToggleStatus: () => void;
    onDelete: () => void;
    onViewScript: () => void;
    onGenerateScript: () => void;
    isSaved?: boolean;
    onSave?: () => void;
    isSaving?: boolean;
}

function IdeaCard({
    idea, rawIdea, index, status, isVaultMode, isUpdating,
    isSelected, onToggleSelect, onToggleStatus, onDelete,
    onViewScript, onGenerateScript, isSaved, onSave, isSaving
}: IdeaCardProps) {
    const [expanded, setExpanded] = useState(false);
    const cfg = STATUS_CONFIG[status];
    const seg = getSegmentInfo(idea.format);
    const sig = getSignalInfo((rawIdea as any)?.signalSource);
    const potential = rawIdea?.estimatedViewPotential || "low";
    const isHigh = potential === "high";
    const isFilming = status === "filming";
    const isDone = status === "done";

    // Card border + glow based on potential + status
    const cardBorder =
        isDone    ? "border-emerald-500/20 hover:border-emerald-500/40" :
        isFilming ? "border-amber-500/25 hover:border-amber-500/50" :
        isHigh    ? "border-emerald-500/20 hover:border-emerald-500/35" :
                    "border-[#1e1e22] hover:border-[#2a2a30]";

    const leftAccentColor =
        isDone    ? "bg-gradient-to-b from-emerald-400 via-emerald-500/60 to-transparent" :
        isFilming ? "bg-gradient-to-b from-amber-400 via-amber-500/60 to-transparent" :
        isHigh    ? "bg-gradient-to-b from-emerald-500/80 via-emerald-500/30 to-transparent" :
                    "bg-gradient-to-b from-zinc-700/60 to-transparent";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`group relative flex flex-col bg-[#0f0f11] border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-2xl ${
                isHigh ? "hover:shadow-emerald-500/5" : isFilming ? "hover:shadow-amber-500/5" : ""
            } ${cardBorder} ${isSelected ? "ring-1 ring-emerald-500/50" : ""}`}
        >
            {/* Left accent bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${leftAccentColor} rounded-l-2xl`} />

            {/* Top status line */}
            <div className={`h-px w-full ${
                isDone    ? "bg-gradient-to-r from-emerald-500/60 via-emerald-500/20 to-transparent" :
                isFilming ? "bg-gradient-to-r from-amber-400/60 via-amber-400/20 to-transparent" :
                isHigh    ? "bg-gradient-to-r from-emerald-500/40 via-emerald-500/10 to-transparent" :
                            "bg-gradient-to-r from-zinc-800/80 to-transparent"
            }`} />

            <div className="pl-4 pr-4 pt-3 flex flex-col gap-0 flex-1">

                {/* ── Row 1: Segment + Signal badges + actions ── */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {isVaultMode && (
                            <button
                                onClick={onToggleSelect}
                                className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 mr-1 ${
                                    isSelected ? "bg-emerald-500 border-emerald-500" : "border-zinc-700 hover:border-emerald-500/60"
                                }`}
                            >
                                {isSelected && <CheckCheck className="w-3 h-3 text-black stroke-[3]" />}
                            </button>
                        )}
                        {seg && (
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-mono font-bold uppercase tracking-wide ${seg.cls}`}>
                                {seg.short}
                            </span>
                        )}
                        {sig && (
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-mono uppercase tracking-wide ${sig.cls}`}>
                                {sig.label}
                            </span>
                        )}
                    </div>
                    {isVaultMode && (
                        <button
                            onClick={onDelete}
                            className="p-1 rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                            title="Remove from Vault"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* ── Row 2: Potential + Status ── */}
                <div className="flex items-center justify-between gap-2 mt-2.5">
                    <PotentialBadge level={potential} />
                    <button
                        onClick={onToggleStatus}
                        disabled={isUpdating}
                        title="Click to advance status"
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-mono font-bold transition-all active:scale-95 ${cfg.color}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot} ${isFilming ? "animate-pulse" : ""}`} />
                        {isUpdating ? "..." : cfg.label}
                    </button>
                </div>

                {/* ── Row 3: Title ── */}
                <h3 className="font-bold text-white text-[13px] leading-snug mt-3 mb-0">
                    {idea.title}
                </h3>

                {/* ── Row 4: Hook (hero element) ── */}
                <div className={`mt-3 rounded-xl p-3 border ${
                    isHigh
                        ? "bg-emerald-950/30 border-emerald-500/15"
                        : "bg-[#0c0c0e] border-[#1e1e22]"
                }`}>
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                            <Zap className={`w-3 h-3 ${isHigh ? "text-emerald-400" : "text-zinc-600"}`} />
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${
                                isHigh ? "text-emerald-500/70" : "text-zinc-600"
                            }`}>Opening Hook</span>
                        </div>
                        <CopyBtn text={idea.hook} />
                    </div>
                    <p className={`text-[12px] leading-relaxed italic ${
                        isHigh ? "text-emerald-100/80" : "text-zinc-300"
                    }`}>
                        &ldquo;{idea.hook}&rdquo;
                    </p>
                </div>

                {/* ── Row 5: Format + Audience meta ── */}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                        <Film className="w-3 h-3 text-zinc-600" />
                        <span className="truncate max-w-[140px]">{idea.format}</span>
                    </div>
                    {rawIdea?.targetAudience && (
                        <>
                            <span className="text-zinc-700 text-[10px]">·</span>
                            <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                                <Users className="w-3 h-3 text-zinc-600" />
                                <span className="truncate max-w-[110px]">{rawIdea.targetAudience}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* ── Row 6: Why it works (collapsible) ── */}
                {rawIdea?.whyItWorks && (
                    <div className="mt-2.5 border border-[#1e1e22] rounded-xl overflow-hidden">
                        <button
                            onClick={() => setExpanded(v => !v)}
                            className="w-full flex items-center justify-between px-3 py-2 text-[9px] font-mono text-zinc-600 uppercase tracking-widest hover:text-zinc-400 transition-colors"
                        >
                            <span className="flex items-center gap-1.5">
                                <Eye className="w-3 h-3" />
                                Why It Works
                            </span>
                            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                            {expanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <p className="px-3 pb-3 text-[11px] text-zinc-400 leading-relaxed border-t border-[#1e1e22]">
                                        {rawIdea.whyItWorks}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

            </div>

            {/* ── Row 7: Actions ── */}
            <div className="px-4 pt-3 pb-4 mt-3 flex items-center gap-2 border-t border-[#1e1e22]/60">
                {idea.script ? (
                    <button
                        onClick={onViewScript}
                        className="flex-1 py-2.5 rounded-xl bg-[#111113] border border-[#1e1e22] hover:border-emerald-500/40 hover:bg-emerald-600/5 flex items-center justify-center gap-2 text-xs font-semibold text-zinc-300 hover:text-emerald-300 transition-all"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        View Full Script
                    </button>
                ) : (
                    <>
                        <button
                            onClick={onGenerateScript}
                            className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-[0.98] ${
                                isHigh
                                    ? "bg-emerald-600/15 hover:bg-emerald-600/25 border-emerald-500/30 hover:border-emerald-500/50 text-emerald-300 hover:text-emerald-200"
                                    : "bg-[#1a1a1e] hover:bg-[#222228] border-[#2a2a30] hover:border-[#333340] text-zinc-300 hover:text-white"
                            }`}
                        >
                            <Bot className="w-3.5 h-3.5" />
                            Generate Script <span className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded text-[10px]"><Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> -1</span>
                        </button>

                        {!isVaultMode && onSave && (
                            <button
                                onClick={onSave}
                                disabled={isSaving || isSaved}
                                title="Save to Idea Vault"
                                className={`p-2.5 rounded-xl border transition-all ${
                                    isSaved
                                        ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                                        : "bg-[#111113] border-[#1e1e22] text-zinc-500 hover:text-white hover:bg-[#1e1e22] hover:border-[#2a2a30]"
                                }`}
                            >
                                {isSaved ? <Star className="w-3.5 h-3.5 fill-current" /> : isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                            </button>
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );

}

// ─── Filter/Sort Bar ──────────────────────────────────────────────────────────

interface FilterBarProps {
    total: number;
    filtered: number;
    search: string;
    onSearch: (v: string) => void;
    segment: FilterSegment;
    onSegment: (v: FilterSegment) => void;
    potential: FilterPotential;
    onPotential: (v: FilterPotential) => void;
    statusFilter: FilterStatus;
    onStatusFilter: (v: FilterStatus) => void;
    sort: SortKey;
    onSort: (v: SortKey) => void;
    selectedCount: number;
    onSelectAll: () => void;
    onExport: () => void;
    isVaultMode: boolean;
}

function FilterBar({
    total, filtered, search, onSearch, segment, onSegment, potential, onPotential,
    statusFilter, onStatusFilter, sort, onSort, selectedCount, onSelectAll, onExport, isVaultMode
}: FilterBarProps) {
    return (
        <div className="space-y-3">
            {/* Top row: search + sort + export */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => onSearch(e.target.value)}
                        placeholder="Search ideas, hooks, formats..."
                        className="w-full bg-[#0c0c0e] border border-[#1e1e22] text-zinc-300 text-xs rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-emerald-500/40 transition-colors placeholder:text-zinc-700"
                    />
                </div>

                {/* Sort */}
                <div className="relative">
                    <select
                        value={sort}
                        onChange={e => onSort(e.target.value as SortKey)}
                        className="appearance-none bg-[#0c0c0e] border border-[#1e1e22] text-zinc-400 text-xs rounded-xl pl-3 pr-8 py-2.5 outline-none focus:border-emerald-500/40 transition-colors cursor-pointer"
                    >
                        <option value="default">Default order</option>
                        <option value="potential">By Potential</option>
                        <option value="status">By Status</option>
                        <option value="title">A → Z</option>
                    </select>
                    <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
                </div>

                {/* Results count */}
                <span className="text-[10px] font-mono text-zinc-600">
                    {filtered === total ? `${total} ideas` : `${filtered} / ${total} shown`}
                </span>

                {/* Vault controls */}
                {isVaultMode && (
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={onSelectAll}
                            className="text-[10px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors"
                        >
                            {selectedCount === total ? "Deselect All" : "Select All"}
                        </button>
                        <button
                            onClick={onExport}
                            className="flex items-center gap-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-xs px-3 py-2 rounded-xl border border-emerald-500/20 transition-colors"
                        >
                            <Download className="w-3 h-3" />
                            {selectedCount > 0 ? `Export (${selectedCount})` : "Export All"}
                        </button>
                    </div>
                )}
            </div>

            {/* Status filters (vault only) */}
            {isVaultMode && (
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
                    {(["all", "ready", "filming", "done"] as const).map(st => {
                        const active = statusFilter === st;
                        const colors: Record<string, string> = {
                            ready: "bg-zinc-700/20 text-zinc-300 border-zinc-600/30",
                            filming: "bg-amber-500/20 text-amber-400 border-amber-500/30",
                            done: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                            all: "bg-zinc-700/20 text-zinc-300 border-zinc-700/30",
                        };
                        return (
                            <button key={st} onClick={() => onStatusFilter(st)}
                                className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold uppercase transition-all ${active ? colors[st] : "bg-[#111113] text-zinc-600 border-[#1e1e22] hover:text-zinc-400 hover:border-[#2a2a30]"}`}>
                                {st === "all" ? "All Status" : st === "filming" ? "⚡ In Production" : st === "done" ? "✅ Done" : "📽 Ready"}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FlashcardRoadmapProps {
    category: string;
    topic: string;
    theme: string;
    channelId: string;
    videoIdeas?: VideoIdeaDB[];
    savedIdeas?: VideoIdeaDB[];
    videoIdeaStatus?: Record<string, string>;
    isVaultMode?: boolean;
    isYoutubeConnected?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FlashcardRoadmap({
    category,
    topic,
    theme,
    channelId,
    videoIdeas: initialIdeas,
    savedIdeas = [],
    videoIdeaStatus: initialStatusMap,
    isVaultMode = false,
    isYoutubeConnected = false,
}: FlashcardRoadmapProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeChannelId = searchParams?.get("channelId") || channelId;

    const [videoIdeas, setVideoIdeas] = useState<VideoIdeaDB[]>(initialIdeas ?? []);
    const [statusMap, setStatusMap] = useState<Record<string, string>>(initialStatusMap ?? {});
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewScript, setViewScript] = useState<{ title: string; script: string; } | null>(null);
    const [scriptSettings] = useState({ tone: "Professional", duration: "10-15 min" });
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [useWatchtower, setUseWatchtower] = useState(true);
    const [uploadTiming, setUploadTiming] = useState<{ bestDay: string; bestHourFmt: string; ranking: string[] } | null>(null);
    const [confidenceScore, setConfidenceScore] = useState<number | null>(null);

    // Filter / Sort state
    const [search, setSearch] = useState("");
    const [filterSegment, setFilterSegment] = useState<FilterSegment>("all");
    const [filterPotential, setFilterPotential] = useState<FilterPotential>("all");
    const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
    const [sort, setSort] = useState<SortKey>("default");

    // Save state for non-vault ideas
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const [savedLocalIds, setSavedLocalIds] = useState<Set<string>>(new Set());

    // Sync with prop updates
    useEffect(() => {
        setVideoIdeas(initialIdeas ?? []);
        setStatusMap(initialStatusMap ?? {});
    }, [initialIdeas, initialStatusMap]);

    const baseIdeas = mapBlueprintToIdeas(videoIdeas);
    const ideas = baseIdeas.map((idea, index) => ({
        ...idea,
        status: (statusMap[String(index)] || "ready") as "ready" | "filming" | "done"
    }));

    // ── Filtering & Sorting ──────────────────────────────────────────────────
    const filteredIdeas = useMemo(() => {
        let result = ideas.map((idea, i) => ({ ...idea, originalIndex: i }));

        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(idea =>
                idea.title.toLowerCase().includes(q) ||
                idea.hook.toLowerCase().includes(q) ||
                idea.format.toLowerCase().includes(q) ||
                (videoIdeas[idea.originalIndex]?.targetAudience || "").toLowerCase().includes(q)
            );
        }

        // Segment filter
        if (filterSegment !== "all") {
            result = result.filter(idea => idea.format.toUpperCase().startsWith(filterSegment));
        }

        // Potential filter
        if (filterPotential !== "all") {
            result = result.filter(idea =>
                (videoIdeas[idea.originalIndex]?.estimatedViewPotential || "low") === filterPotential
            );
        }

        // Status filter
        if (filterStatus !== "all") {
            result = result.filter(idea => idea.status === filterStatus);
        }

        // Sort
        if (sort === "potential") {
            result.sort((a, b) =>
                (POTENTIAL_ORDER[videoIdeas[a.originalIndex]?.estimatedViewPotential || "low"] ?? 2) -
                (POTENTIAL_ORDER[videoIdeas[b.originalIndex]?.estimatedViewPotential || "low"] ?? 2)
            );
        } else if (sort === "status") {
            result.sort((a, b) => (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0));
        } else if (sort === "title") {
            result.sort((a, b) => a.title.localeCompare(b.title));
        }

        return result;
    }, [ideas, videoIdeas, search, filterSegment, filterPotential, filterStatus, sort]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleToggleStatus = async (index: number, currentStatus: string, targetStatus?: "ready" | "filming" | "done") => {
        if (!channelId) return;
        const nextStatus = targetStatus || STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG]?.next || "ready";
        setUpdatingIndex(index);
        const updatedMap = { ...statusMap, [String(index)]: nextStatus };
        setStatusMap(updatedMap);
        try {
            await fetch("/api/idea-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelId, ideaIndex: index, status: nextStatus, isVaultMode })
            });
            router.refresh();
        } catch (err) {
            console.error("Failed to update status", err);
        } finally {
            setUpdatingIndex(null);
        }
    };

    const handleDeleteIdea = async (title: string) => {
        if (!isVaultMode || !channelId) return;
        try {
            const res = await fetch(`/api/channels/${channelId}/ideas?title=${encodeURIComponent(title)}`, { method: "DELETE" });
            if (res.ok) setVideoIdeas(prev => prev.filter(i => i.title !== title));
        } catch (e) { console.error(e); }
    };

    const handleGenerateScript = (idea: VideoIdea, index: number) => {
        const rawIdea = videoIdeas[index];
        const prompt = `Write a comprehensive, professionally-structured YouTube script for a ${idea.format} video titled: "${idea.title}".

STRUCTURE REQUIREMENTS:
1. HOOK (0:00-0:30): High-energy, curiosity-driven opening that addresses the viewer's pain point.
2. INTRO: Brief overview of what they will learn and why they should stay until the end.
3. CHAPTERS (Value Delivery): Break the content into 3-5 logical, high-value segments with transitions.
4. MID-ROLL CTA: A natural, context-aware call to action.
5. CONCLUSION & OUTRO: Summarize key takeaways and provide a "Next Step" for the viewer.

CONTEXT:
Hook Idea: "${idea.hook}"
Target Audience: ${rawIdea?.targetAudience || "general audience"}
Tone: ${scriptSettings.tone}
Target Duration: ${scriptSettings.duration}
View Potential: ${rawIdea?.estimatedViewPotential || "high"}

**CRITICAL SCRIPT REQUIREMENTS:**
1. **Length**: Scaled for a video that is roughly **5 to 15 minutes long**.
2. **Pacing & Timestamps**: Group the script into logical scenes or chapters with their estimated timestamp ranges (e.g., [0:00 - 1:30], [1:30 - 3:00]).
3. **Structure**: Do NOT duplicate scene titles. Each scene should be a single row in the table, containing all visuals and audio for that section.
4. **FORMAT**: Output the actual script as a single **Markdown Table** — no plain paragraphs.
5. **Table Columns**: | Scene / Section | Timestamp | Visuals / B-Roll | Audio / Voiceover |

Ensure high-retention storytelling with a strong CTA. Generate the complete script now.`;

        const currentStatus = statusMap[String(index)] || "ready";
        if (currentStatus === "ready") handleToggleStatus(index, "ready", "filming");

        if (!isVaultMode && !savedLocalIds.has(idea.id) && !savedIdeas.some(s => s.title === idea.title)) {
            fetch(`/api/channels/${activeChannelId}/ideas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rawIdea)
            }).catch(e => toast.error("Failed to auto-save idea to vault."));
            setSavedLocalIds(prev => new Set([...prev, idea.id]));
        }

        router.push(`/dashboard/bot?channelId=${activeChannelId}&title=${encodeURIComponent(idea.title)}&prompt=${encodeURIComponent(prompt)}`);
    };

    const handleSaveIdea = async (index: number, id: string) => {
        setSavingIds(prev => new Set([...prev, id]));
        try {
            const res = await fetch(`/api/channels/${activeChannelId}/ideas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(videoIdeas[index])
            });
            if (res.ok) {
                setSavedLocalIds(prev => new Set([...prev, id]));
                const currentStatus = statusMap[String(index)] || "ready";
                if (currentStatus !== "filming" && currentStatus !== "done") {
                    handleToggleStatus(index, currentStatus, "filming");
                }
            }
        } catch (e) { toast.error("Failed to save idea to vault."); } finally {
            setSavingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        }
    };

    const handleExport = () => {
        const exportList = selectedIds.size > 0
            ? filteredIdeas.filter(i => selectedIds.has(i.id))
            : filteredIdeas;
        const md = exportList.map(i =>
            `# ${i.title}\n\n**Hook**: ${i.hook}\n**Format**: ${i.format}\n**Status**: ${i.status}\n\n${i.script || "_No script generated yet._"}`
        ).join("\n\n---\n\n");
        const blob = new Blob([md], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${topic.replace(/\s+/g, "_")}_vault_export.md`;
        a.click();
    };

    const handleGenerateIdeas = async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const payload: any = { channelId, useWatchtower };
            if (!isYoutubeConnected) {
                payload.channelStats = { title: topic, subscribers: "0", views: "0", videoCount: "0" };
                payload.recentVideos = videoIdeas.length > 0
                    ? videoIdeas.slice(0, 3).map(v => ({ title: v.title, views: String(Math.floor(Math.random() * 15000) + 1000), likes: String(Math.floor(Math.random() * 800) + 50) }))
                    : [{ title: topic, views: "1000", likes: "100" }];
            }
            const res = await fetch("/api/generate-ideas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const fallback = await fetch("/api/channel-creation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ category, topic }),
                });
                if (!fallback.ok) throw new Error("Failed to generate ideas");
                const data = await fallback.json();
                if (data.videoIdeas?.length > 0) {
                    setVideoIdeas(data.videoIdeas);
                    await fetch("/api/save-blueprint", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ channelId, videoIdeas: data.videoIdeas }),
                    });
                    window.dispatchEvent(new CustomEvent("credit-update", { detail: { deduct: 1 } }));
                    router.refresh();
                } else throw new Error("No ideas returned");
                return;
            }
            const data = await res.json();
            if (data.videoIdeas?.length > 0) {
                setVideoIdeas(data.videoIdeas);
                if (data.timingData) setUploadTiming(data.timingData);
                if (data.confidenceScore !== undefined) setConfidenceScore(data.confidenceScore);
                router.refresh();
            } else throw new Error("No ideas returned");
        } catch (err) {
            setError("Failed to generate ideas. Please try again.");
            toast.error("Failed to generate ideas. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const hasIdeas = ideas.length > 0;
    const [updatingIndex, setUpdatingIndex] = useState<number | null>(null);

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 p-6 bg-[#111113]/40 border border-[#1e1e22]/50 rounded-2xl backdrop-blur-sm">
                <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        {isVaultMode ? (
                            <Library className="w-5 h-5 text-emerald-400" />
                        ) : (
                            <Database className="w-5 h-5 text-emerald-400" />
                        )}
                        <h2 className="text-xl font-bold text-white tracking-tight">
                            {isVaultMode ? "Idea Vault" : "Content Roadmap"}
                        </h2>
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold rounded-lg uppercase">
                            {isVaultMode ? "Private Vault" : "AI Optimized"}
                        </span>
                        {!isVaultMode && confidenceScore !== null && (
                            <span className={`px-2 py-0.5 border text-[10px] font-mono font-bold rounded-lg uppercase ${
                                confidenceScore >= 70 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : confidenceScore >= 40 ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                                Signal {confidenceScore}%
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-zinc-500">
                        {isVaultMode
                            ? `Managing ${videoIdeas.length} saved concepts in your private repository.`
                            : videoIdeas.length > 0
                                ? `${ideas.length} concepts · click a card to start script generation.`
                                : `Generate data-driven video ideas based on ${category} trends.`}
                    </p>
                    <p className="text-xs text-zinc-600">
                        {isVaultMode
                            ? "Push ideas from Gap Scanner, Competitor Watchtower, or Comment Miner directly into this vault."
                            : "AI-computed ideas are grounded in real YouTube market gaps, competitor analysis, and comment mining."}
                    </p>
                </div>

                {/* Right side controls */}
                <div className="flex items-center gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-[#1e1e22]">
                    {!isVaultMode && (
                        <>
                            <button
                                onClick={() => setUseWatchtower(v => !v)}
                                title={useWatchtower ? "Watchtower intel active" : "Watchtower intel disabled"}
                                className={`flex items-center gap-1.5 text-[10px] font-mono font-bold px-3 py-2 rounded-xl border transition-all ${
                                    useWatchtower
                                        ? "bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/20"
                                        : "bg-[#111113] text-zinc-600 border-[#1e1e22] hover:text-zinc-400"
                                }`}
                            >
                                <Radar className={`w-3.5 h-3.5 ${useWatchtower ? "animate-pulse" : ""}`} />
                                Watchtower {useWatchtower ? "ON" : "OFF"}
                            </button>
                            <button
                                onClick={handleGenerateIdeas}
                                disabled={isGenerating}
                                className="flex items-center gap-2 bg-[#1e1e22] hover:bg-[#2a2a30] text-zinc-300 text-xs px-3 py-2 rounded-xl border border-[#2a2a30] transition-colors disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                Rerun <span className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded text-[10px]"><Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> -1</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Vault Stats ── */}
            {isVaultMode && hasIdeas && (
                <VaultStatsBar ideas={ideas} statusMap={statusMap} />
            )}

            {/* ── Script Modal ── */}
            <AnimatePresence>
                {viewScript && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
                            className="relative bg-[#111113] border border-[#2a2a30] rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-[#1e1e22] bg-[#0c0c0e]">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-emerald-400" />
                                    {viewScript.title}
                                </h3>
                                <button onClick={() => setViewScript(null)} className="p-1 text-zinc-500 hover:text-white transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto prose prose-invert prose-emerald prose-sm max-w-none prose-p:leading-relaxed prose-headings:text-white prose-td:border prose-td:border-[#1e1e22] prose-th:border prose-th:border-[#1e1e22] prose-th:bg-[#1e1e22] prose-table:border-collapse">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{viewScript.script}</ReactMarkdown>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Error ── */}
            {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-950/30 border border-red-900/50 rounded-xl text-sm text-red-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-400 text-xs">dismiss</button>
                </div>
            )}

            {/* ── Upload Timing Widget ── */}
            {!isVaultMode && uploadTiming && (
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[#111113]/60 border border-[#1e1e22]/50 rounded-xl">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        <Clock className="w-3.5 h-3.5 text-sky-400" />
                        Optimal Upload Window
                    </div>
                    <span className="px-2.5 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-mono font-bold rounded-lg">
                        📅 {uploadTiming.bestDay}
                    </span>
                    <span className="px-2.5 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-mono font-bold rounded-lg">
                        🕐 {uploadTiming.bestHourFmt}
                    </span>
                </div>
            )}

            {/* ── Empty State ── */}
            {!hasIdeas ? (
                <div className="text-center py-20 bg-[#111113]/40 border border-dashed border-[#1e1e22] rounded-2xl">
                    <div className="w-14 h-14 bg-[#1e1e22] rounded-2xl flex items-center justify-center mx-auto mb-5 border border-[#2a2a30]">
                        {isVaultMode ? <Library className="w-6 h-6 text-zinc-500" /> : <Database className="w-6 h-6 text-zinc-500" />}
                    </div>
                    <h3 className="text-white font-bold mb-2">
                        {isVaultMode ? "Your Idea Vault is Empty" : "No concepts generated yet"}
                    </h3>
                    <p className="text-zinc-500 text-sm max-w-sm mx-auto mb-8">
                        {isVaultMode
                            ? "Save ideas from your Gap Scanner, Comment Miner, or Competitor Watchtower to start building your content roadmap."
                            : "Compute data-driven video concepts using real YouTube market analysis, competitor gaps, and trend data."}
                    </p>
                    {isVaultMode ? (
                        <button
                            onClick={() => router.push(`/dashboard?channelId=${activeChannelId}`)}
                            className="inline-flex items-center gap-2 bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-600/20 transition-colors"
                        >
                            <Zap className="w-4 h-4" />
                            Go to Dashboard to Mine Ideas
                        </button>
                    ) : (
                        <button
                            onClick={handleGenerateIdeas}
                            disabled={isGenerating}
                            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50"
                        >
                            {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />Computing...</> : <><Sparkles className="w-4 h-4" />Compute Video Ideas <span className="ml-1 flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full text-xs font-mono"><Zap className="w-3 h-3 text-amber-400 fill-amber-400" /> -1</span></>}
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* ── Filter Bar ── */}
                    <FilterBar
                        total={ideas.length}
                        filtered={filteredIdeas.length}
                        search={search}
                        onSearch={setSearch}
                        segment={filterSegment}
                        onSegment={setFilterSegment}
                        potential={filterPotential}
                        onPotential={setFilterPotential}
                        statusFilter={filterStatus}
                        onStatusFilter={setFilterStatus}
                        sort={sort}
                        onSort={setSort}
                        selectedCount={selectedIds.size}
                        onSelectAll={() => {
                            if (selectedIds.size === ideas.length) setSelectedIds(new Set());
                            else setSelectedIds(new Set(ideas.map(i => i.id)));
                        }}
                        onExport={handleExport}
                        isVaultMode={isVaultMode}
                    />

                    {/* ── No Results ── */}
                    {filteredIdeas.length === 0 && (
                        <div className="text-center py-12 border border-dashed border-[#1e1e22] rounded-2xl">
                            <Search className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                            <p className="text-zinc-500 text-sm">No ideas match your current filters.</p>
                            <button
                                onClick={() => { setSearch(""); setFilterSegment("all"); setFilterPotential("all"); setFilterStatus("all"); }}
                                className="mt-3 text-emerald-400 text-xs hover:text-emerald-300 transition-colors"
                            >
                                Clear all filters
                            </button>
                        </div>
                    )}

                    {/* ── Cards Grid ── */}
                    <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        <AnimatePresence>
                            {filteredIdeas.map((idea) => {
                                const origIndex = idea.originalIndex;
                                const rawIdea = videoIdeas[origIndex];
                                const isSaved = savedLocalIds.has(idea.id) || savedIdeas.some(s => s.title === idea.title);

                                return (
                                    <IdeaCard
                                        key={idea.id}
                                        idea={idea}
                                        rawIdea={rawIdea}
                                        index={origIndex}
                                        status={idea.status}
                                        isVaultMode={isVaultMode}
                                        isUpdating={updatingIndex === origIndex}
                                        isSelected={selectedIds.has(idea.id)}
                                        channelId={channelId}
                                        activeChannelId={activeChannelId}
                                        onToggleSelect={() => {
                                            setSelectedIds(prev => {
                                                const next = new Set(prev);
                                                if (next.has(idea.id)) next.delete(idea.id);
                                                else next.add(idea.id);
                                                return next;
                                            });
                                        }}
                                        onToggleStatus={() => handleToggleStatus(origIndex, idea.status)}
                                        onDelete={() => handleDeleteIdea(idea.title)}
                                        onViewScript={() => setViewScript({ title: idea.title, script: rawIdea.script! })}
                                        onGenerateScript={() => handleGenerateScript(idea, origIndex)}
                                        isSaved={isSaved}
                                        isSaving={savingIds.has(idea.id)}
                                        onSave={() => handleSaveIdea(origIndex, idea.id)}
                                    />
                                );
                            })}
                        </AnimatePresence>
                    </motion.div>
                </>
            )}
        </div>
    );
}
