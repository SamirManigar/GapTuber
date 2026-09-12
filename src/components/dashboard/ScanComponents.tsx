"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { GapItem, ScanAnalytics } from "@/db/schema";
import {
    Users, Film, DollarSign, ShieldAlert, Brain,
    ChevronDown, Loader2, BookmarkCheck, Bookmark,
    TrendingUp, Clock, BarChart2, Crosshair,
    Target, FileText, AlertCircle, CheckCircle2,
    MessageSquare, Lightbulb, ArrowRight, Share2, Image, X, LineChart,
} from "lucide-react";

// Lazy-load the heavy ScriptModal so it's not in the initial bundle
const ScriptModal = dynamic(() => import("./ScriptModal"), { ssr: false });

// ─── Score helpers ─────────────────────────────────────────────────────────────

/** Convert 1–10 gapScore to 0–100 display score */
function toDisplayScore(raw: number): number {
    return Math.round(Math.min(Math.max(raw, 0), 10) * 10);
}

function getScoreLabel(score100: number): { label: string; tier: "strong" | "good" | "experimental" } {
    if (score100 >= 75) return { label: "Strong Opportunity", tier: "strong" };
    if (score100 >= 55) return { label: "Good Opportunity",   tier: "good" };
    return                      { label: "Experimental",       tier: "experimental" };
}

function getTierColors(tier: "strong" | "good" | "experimental") {
    switch (tier) {
        case "strong":       return { ring: "#34d399", text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/25", glow: "shadow-emerald-500/10" };
        case "good":         return { ring: "#fbbf24", text: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-500/25",   glow: "" };
        case "experimental": return { ring: "#52525b", text: "text-zinc-400",    bg: "bg-zinc-800/50",    border: "border-zinc-700/40",    glow: "" };
    }
}

// ─── Hero Score Ring ───────────────────────────────────────────────────────────

function HeroScoreRing({ score100, tier }: { score100: number; tier: "strong" | "good" | "experimental" }) {
    const colors = getTierColors(tier);
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const filled = (score100 / 100) * circumference;

    return (
        <div className="relative w-[100px] h-[100px] shrink-0">
            {/* Glow */}
            <div
                className="absolute inset-3 rounded-full blur-xl opacity-25"
                style={{ background: colors.ring }}
            />
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e1e22" strokeWidth="5" />
                <circle
                    cx="50" cy="50" r={radius} fill="none"
                    stroke={colors.ring} strokeWidth="5"
                    strokeDasharray={`${filled} ${circumference}`}
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 8px ${colors.ring}80)`, transition: "stroke-dasharray 0.6s ease" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: colors.ring }}>
                    {score100}
                </span>
                <span className="text-[9px] font-mono text-zinc-600 mt-0.5">/100</span>
            </div>
        </div>
    );
}

// ─── Score Sub-Bar ─────────────────────────────────────────────────────────────

function ScoreSubBar({ label, score, max = 10, insight }: { label: string; score: number; max?: number; insight?: string }) {
    const pct = Math.min((score / max) * 100, 100);
    const color =
        pct >= 70 ? "bg-emerald-500" :
        pct >= 45 ? "bg-amber-500" :
                    "bg-zinc-600";

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide">{label}</span>
                <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{Math.round(pct)}</span>
            </div>
            <div className="h-1.5 bg-[#1e1e22] rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${color}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            {insight && (
                <p className="text-[9px] text-zinc-600 leading-relaxed">{insight}</p>
            )}
        </div>
    );
}

// ─── Signal Bar (for AnalyticsPanel) ──────────────────────────────────────────

function SignalBar({ label, score, max = 100 }: { label: string; score: number; max?: number }) {
    const pct = Math.min((score / max) * 100, 100);
    const color =
        pct >= 70 ? "bg-emerald-500" :
        pct >= 40 ? "bg-amber-500" :
                    "bg-zinc-600";

    return (
        <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-500 w-20 shrink-0 uppercase tracking-wide">{label}</span>
            <div className="flex-1 h-1 bg-[#1e1e22] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-mono text-zinc-400 w-6 text-right tabular-nums">{score}</span>
        </div>
    );
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────

export function MetricCard({ value, label, icon }: { value: string; label: string; icon: string }) {
    return (
        <div className="rounded-xl p-3 border border-[#1e1e22] bg-[#0c0c0e] text-center">
            <div className="mb-1 text-base" aria-hidden="true">{icon}</div>
            <div className="text-xl font-bold text-white tabular-nums leading-none tracking-tight">{value}</div>
            <div className="text-[9px] font-mono text-zinc-600 mt-1.5 uppercase tracking-widest">{label}</div>
        </div>
    );
}

export function AnalyticsPanel({ analytics }: { analytics: ScanAnalytics }) {
    const s = (v: number | null | undefined) => +(v ?? 0);
    const r = (v: number | null | undefined) => Math.round((v ?? 0) * 10);

    const rings = [
        { score: s(analytics.velocity?.score),    label: "Average Pace",  color: "#34d399" },
        { score: s(analytics.saturation?.score),  label: "Opportunity",    color: "#60a5fa" },
        { score: s(analytics.frustration?.score), label: "Comment Need",   color: "#f87171" },
        { score: s(analytics.trend?.score),       label: "Recent Direction", color: "#a78bfa" },
    ];

    const bars = [
        { label: "Average Pace",    score: r(analytics.velocity?.score) },
        { label: "Opportunity",     score: r(analytics.saturation?.score) },
        { label: "Comment Need",    score: r(analytics.frustration?.score) },
        { label: "Recent Direction", score: r(analytics.trend?.score) },
        { label: "Competition",     score: r(analytics.competition?.score) },
        { label: "Engagement",      score: r(analytics.engagement?.score) },
    ];

    // Confidence means sample coverage, not how high the opportunity scores are.
    const confidence = analytics.provenance?.dataConfidence;
    const confLabel = confidence == null ? "Not recorded" : confidence >= 70 ? "High" : confidence >= 45 ? "Moderate" : "Low";
    const confColor = confidence == null ? "text-zinc-500" : confidence >= 70 ? "text-emerald-400" : confidence >= 45 ? "text-amber-400" : "text-zinc-500";

    return (
        <div className="bg-[#0f0f11] border border-[#1e1e22] rounded-2xl overflow-hidden mb-8">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1e22]">
                <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Opportunity Breakdown</span>
                    <p className="text-[9px] text-zinc-700 mt-0.5">Higher scores = stronger opportunity in that area</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Data coverage</p>
                        <p className={`text-xs font-bold font-mono ${confColor}`}>
                            {confidence == null ? confLabel : `${confLabel} · ${confidence}%`}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-6">

                {analytics.provenance && (
                    <div className="grid gap-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4 md:grid-cols-[1fr_auto] md:items-center">
                        <div>
                            <p className="text-xs font-semibold text-sky-300">Grounded in public YouTube data</p>
                            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                                {analytics.provenance.sample.videos} videos · {analytics.provenance.sample.searchResults} search results · {analytics.provenance.sample.comments} comments · scan generated {new Date(analytics.provenance.generatedAt).toLocaleString()} · source cache up to {analytics.provenance.cacheMaxAgeMinutes} min
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{analytics.provenance.aiRole}</p>
                        </div>
                        <span className="whitespace-nowrap rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300">
                            {analytics.provenance.source}
                        </span>
                    </div>
                )}

                {/* Score rings row */}
                <div className="flex items-start justify-around gap-4">
                    {rings.map(r => {
                        const radius = 36;
                        const circumference = 2 * Math.PI * radius;
                        const filled = (r.score / 10) * circumference;
                        return (
                            <div key={r.label} className="flex flex-col items-center gap-2">
                                <div className="relative w-24 h-24">
                                    <div className="absolute inset-2 rounded-full blur-xl opacity-20" style={{ background: r.color }} />
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
                                        <circle cx="48" cy="48" r={radius} fill="none" stroke="#1e1e22" strokeWidth="4" />
                                        <circle
                                            cx="48" cy="48" r={radius} fill="none"
                                            stroke={r.color} strokeWidth="4"
                                            strokeDasharray={`${filled} ${circumference}`}
                                            strokeLinecap="round"
                                            style={{ filter: `drop-shadow(0 0 6px ${r.color}80)` }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-xl font-bold text-white tabular-nums leading-none" style={{ color: r.color }}>
                                            {r.score.toFixed(1)}
                                        </span>
                                        <span className="text-[8px] font-mono text-zinc-600 mt-0.5">/10</span>
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest text-center">
                                    {r.label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Two-col: bars + insights */}
                <div className="grid lg:grid-cols-2 gap-6 pt-4 border-t border-[#1e1e22]/50">

                    {/* Signal bars */}
                    <div className="space-y-2.5">
                        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-3">Score Breakdown</p>
                        {bars.map(b => <SignalBar key={b.label} {...b} />)}
                    </div>

                    {/* Key insights */}
                    <div className="space-y-3">
                        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">What to do next</p>

                        {analytics.uploadSchedule?.bestDay && (
                            <div className="flex items-start gap-3 p-3 bg-[#111113] border border-[#1e1e22] rounded-xl">
                                <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-mono text-zinc-500 uppercase mb-0.5">Observed publishing window</p>
                                    <p className="text-xs font-semibold text-zinc-200">
                                        {analytics.uploadSchedule.bestDay} · {analytics.uploadSchedule.bestHour}:00 UTC
                                    </p>
                                    {analytics.uploadSchedule.insight && (
                                        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                                            {analytics.uploadSchedule.insight}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {analytics.competition?.difficulty && (
                            <div className="flex items-start gap-3 p-3 bg-[#111113] border border-[#1e1e22] rounded-xl">
                                <BarChart2 className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-mono text-zinc-500 uppercase mb-0.5">Competition</p>
                                    <p className="text-xs font-semibold text-zinc-200">{analytics.competition.difficulty}</p>
                                    {analytics.competition.insight && (
                                        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                                            {analytics.competition.insight}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {analytics.trend?.trend && (
                            <div className="flex items-start gap-3 p-3 bg-[#111113] border border-[#1e1e22] rounded-xl">
                                <TrendingUp className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-mono text-zinc-500 uppercase mb-0.5">Trend Direction</p>
                                    <p className="text-xs font-semibold text-zinc-200">{analytics.trend.trend}</p>
                                    {analytics.trend.insight && (
                                        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                                            {analytics.trend.insight}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <div className="space-y-1">
                        <p className="text-xs font-semibold text-amber-200">Use these scores to prioritize tests—not predict outcomes.</p>
                        <p className="text-xs leading-relaxed text-zinc-500">
                            Public data cannot reveal impressions, click-through rate, retention, audience geography, or actual revenue. The publishing-time and revenue models are directional scenarios only.
                        </p>
                    </div>
                </div>

                {/* Pain Points */}
                {(analytics.frustration?.painPoints?.length ?? 0) > 0 && (
                    <div className="pt-4 border-t border-[#1e1e22]/50">
                        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2.5">What Viewers Complain About</p>
                        <div className="flex flex-wrap gap-2">
                            {analytics.frustration.painPoints.slice(0, 6).map((p, i) => (
                                <span key={i} className="text-[10px] font-mono text-red-400/80 border border-red-900/40 bg-red-950/20 rounded-lg px-2.5 py-1">
                                    {p}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tags */}
                {(analytics.suggestedTags?.length ?? 0) > 0 && (
                    <div className="pt-1">
                        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2.5">Recommended Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                            {analytics.suggestedTags.slice(0, 12).map((tag, i) => (
                                <span key={i} className="text-[10px] font-mono bg-[#1a1a1e] text-zinc-500 border border-[#232328] rounded-lg px-2 py-0.5 hover:text-zinc-300 transition-colors cursor-default">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Gap Card ─────────────────────────────────────────────────────────────────

export function GapCard({ gap, rank, channelId, scanId, isAlreadySaved, analytics }: {
    gap: GapItem;
    rank: number;
    channelId?: string;
    scanId?: string;
    isAlreadySaved?: boolean;
    analytics?: ScanAnalytics | null;
}) {
    const [scriptOpen, setScriptOpen] = React.useState(false);
    const [thumbOpen, setThumbOpen] = React.useState(false);
    const [evidenceOpen, setEvidenceOpen] = React.useState(false);

    const score100 = toDisplayScore(gap.gapScore);
    const classification = gap.classification || "EVERGREEN";
    const classificationEmoji = classification === "BREAKOUT" ? "🔥" : classification === "EMERGING" ? "📈" : classification === "WATCH" ? "👀" : "🌲";
    const scoreLabel = `${classificationEmoji} ${classification} OPPORTUNITY`;
    const tier = classification === "BREAKOUT" ? "strong" : classification === "EMERGING" ? "good" : classification === "WATCH" ? "experimental" : "good";
    const tierColors = getTierColors(tier);

    const accentBorder =
        tier === "strong"       ? "border-emerald-500/20 hover:border-emerald-500/35 hover:shadow-emerald-500/5" :
        tier === "good"         ? "border-amber-500/15   hover:border-amber-500/30" :
                                  "border-[#1e1e22]       hover:border-[#2a2a30]";

    const leftBar =
        tier === "strong"       ? "bg-gradient-to-b from-emerald-400 via-emerald-500/40 to-transparent" :
        tier === "good"         ? "bg-gradient-to-b from-amber-400  via-amber-500/40  to-transparent" :
                                  "bg-gradient-to-b from-zinc-700   to-transparent";

    const topLine =
        tier === "strong"       ? "bg-gradient-to-r from-emerald-500/50 via-emerald-500/15 to-transparent" :
        tier === "good"         ? "bg-gradient-to-r from-amber-500/40  via-amber-500/10  to-transparent" :
                                  "bg-gradient-to-r from-zinc-800/60   to-transparent";

    const confValue = typeof gap.confidence === 'number' ? gap.confidence * 100 :
                      analytics?.provenance?.dataConfidence ?? null;
    const confLabel = confValue !== null
        ? (confValue >= 70 ? "High" : confValue >= 45 ? "Moderate" : "Low")
        : null;
    const confColor = confValue !== null
        ? (confValue >= 70 ? "text-emerald-400" : confValue >= 45 ? "text-amber-400" : "text-zinc-500")
        : "text-zinc-500";

    // Build top 3 signals for summary
    const bars = [
        { label: "Comment Need",    score: typeof analytics?.frustration?.score === "number" ? analytics.frustration.score * 10 : null },
        { label: "Competition Gap", score: typeof analytics?.competition?.score === "number" ? analytics.competition.score * 10 : null },
        { label: "Average Pace",    score: typeof analytics?.velocity?.score === "number" ? analytics.velocity.score * 10 : null },
        { label: "Recent Direction", score: typeof analytics?.trend?.score === "number" ? analytics.trend.score * 10 : null },
    ].filter(b => b.score !== null) as { label: string; score: number; }[];

    return (
        <>
            <div className={`group relative flex flex-col bg-[#0f0f11] border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 ${accentBorder}`}>

                {/* Left accent */}
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${leftBar} rounded-l-2xl`} />

                {/* Top line */}
                <div className={`h-px w-full ${topLine}`} />

                {/* ── HEADER: Score + Title ── */}
                <div className="pl-5 pr-4 pt-5 pb-3 flex items-start gap-4">

                    {/* Hero Score Ring */}
                    <HeroScoreRing score100={score100} tier={tier} />

                    {/* Title block */}
                    <div className="flex-1 min-w-0 pt-1">
                        {/* Rank + psychological trigger */}
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                                #{rank} Gap
                            </span>
                            {gap.psychologicalTrigger && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full border text-purple-400/80 border-purple-500/20 bg-purple-500/8">
                                    <Brain className="w-2.5 h-2.5" />
                                    {gap.psychologicalTrigger.replace(/_/g, " ")}
                                </span>
                            )}
                        </div>

                        {/* Score label & Confidence */}
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <p className={`text-[10px] font-mono font-bold uppercase tracking-widest ${tierColors.text}`}>
                                OPPORTUNITY {score100}/100
                            </p>
                            {confLabel && (
                                <p className={`text-[10px] font-mono font-bold uppercase tracking-widest ${confColor}`}>
                                    · EVIDENCE CONFIDENCE {Math.round(confValue!)}/100 ({confLabel.toUpperCase()})
                                </p>
                            )}
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-zinc-100 text-[14px] leading-snug tracking-tight mb-2">{gap.title}</h3>
                    </div>
                </div>

                {/* ── BODY ── */}
                <div className="pl-5 pr-4 pb-0 space-y-4">

                    {/* Metadata strip: VIDEO IDEA label */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-0.5">
                        <div className="flex items-center gap-1.5">
                            <Film className="w-3 h-3 text-zinc-600 shrink-0" />
                            <span className="text-[10px] text-zinc-500">{gap.format}</span>
                        </div>
                        {gap.targetAudience && (
                            <div className="flex items-center gap-1.5">
                                <Users className="w-3 h-3 text-zinc-600 shrink-0" />
                                <span className="text-[10px] text-zinc-500">{gap.targetAudience}</span>
                            </div>
                        )}
                        {gap.monetizationAngle && (
                            <div className="flex items-center gap-1.5">
                                <DollarSign className="w-3 h-3 text-zinc-600 shrink-0" />
                                <span className="text-[10px] text-zinc-500">{gap.monetizationAngle}</span>
                            </div>
                        )}
                    </div>

                    {/* ── 🔥 EVIDENCE ── */}
                    {(gap.evidenceComments?.length ?? 0) > 0 ? (
                        <div className="p-4 rounded-xl border border-amber-500/20 bg-[#161311] space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <MessageSquare className="w-4 h-4 text-amber-500" />
                                    <p className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-widest">Verified comment evidence</p>
                                </div>
                                {analytics?.frustration?.score && (
                                    <span className="text-[9px] font-mono text-zinc-500 uppercase">
                                        {analytics.frustration.painPoints?.length ?? 0 > 0 ? "Multiple pain points found" : ""}
                                    </span>
                                )}
                            </div>
                            <div className="space-y-4">
                                {gap.evidenceComments?.map((c, i) => (
                                    <div key={i} className="pl-3 border-l-2 border-amber-500/30">
                                        <p className="text-[12px] text-zinc-300 italic leading-relaxed">&ldquo;{c.text}&rdquo;</p>
                                        <p className="text-[10px] text-amber-500/70 font-mono mt-1.5">— {c.likes} likes</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-[#24242a] bg-[#111113] p-3">
                            <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-zinc-600">AI hypothesis · no direct comment evidence</p>
                            <p className="text-[12px] text-zinc-400 leading-relaxed">{gap.reasoning}</p>
                        </div>
                    )}

                    {/* ── WHY NOW & EVIDENCE ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        {/* WHY NOW */}
                        {gap.scoreReasons && gap.scoreReasons.length > 0 && (
                            <div className="p-3 rounded-xl bg-[#111113] border border-[#1e1e22]">
                                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Why Now</p>
                                <div className="space-y-1.5">
                                    {gap.scoreReasons.map((reason, i) => (
                                        <p key={i} className={`text-[10px] leading-snug font-mono ${reason.startsWith('+') ? 'text-emerald-400/90' : reason.startsWith('-') ? 'text-rose-400/90' : 'text-zinc-400'}`}>
                                            {reason}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* BREAKOUT EVIDENCE */}
                        {gap.evidenceOutliers && gap.evidenceOutliers.length > 0 && (
                            <div className="p-3 rounded-xl bg-[#111113] border border-[#1e1e22]">
                                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Breakout Evidence</p>
                                <div className="space-y-1.5">
                                    {gap.evidenceOutliers.slice(0, 3).map((outlier, i) => (
                                        <div key={i} className="flex justify-between items-center text-[10px] font-mono">
                                            <span className="text-zinc-400 truncate max-w-[120px]">{outlier.channelName}</span>
                                            <span className="text-emerald-400">{outlier.normalMedian.toLocaleString()} &rarr; {outlier.candidateViews.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Top 3 Signals Summary ── */}
                    <div className="space-y-2 pt-1 pb-2">
                        {bars.slice(0, 3).map(b => (
                            <div key={b.label} className="flex items-center gap-3">
                                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wide w-28">{b.label}</span>
                                <div className="flex-1 h-1 bg-[#1e1e22] rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500/80 rounded-full" style={{ width: `${b.score}%` }} />
                                </div>
                                <span className="text-[10px] font-mono text-zinc-400 tabular-nums w-6 text-right">{Math.round(b.score)}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── HOOK ── */}
                    <div className={`pl-3 border-l-2 py-0.5 ${tier === "strong" ? "border-emerald-500/50" : "border-zinc-700/60"}`}>
                        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-0.5">Hook</p>
                        <p className={`text-[12px] italic leading-relaxed ${tier === "strong" ? "text-emerald-100/80" : "text-zinc-300"}`}>
                            &ldquo;{gap.hook}&rdquo;
                        </p>
                    </div>

                    {/* ── Score Breakdown (collapsible) ── */}
                    <ScoreBreakdownPanel gap={gap} analytics={analytics} confidence={confValue === null ? null : Math.round(confValue)} confLabel={confLabel} confColor={confColor} />

                    {/* ── Content Outline ── */}
                    {gap.contentOutline && gap.contentOutline.length > 0 && (
                        <CollapsibleOutline items={gap.contentOutline} />
                    )}

                    {/* ── SEO Tips ── */}
                    {gap.seoTips && gap.seoTips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {gap.seoTips.slice(0, 6).map((tip, i) => (
                                <span key={i} className="text-[9px] font-mono bg-[#1a1a1e] border border-[#232328] text-zinc-500 rounded-lg px-2 py-0.5">
                                    {tip}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── CTA ROW ── */}
                <div className="mt-4 px-4 pb-4 pt-3 border-t border-[#1e1e22]/60 flex items-center gap-2">
                    {/* Write Script */}
                    <button
                        onClick={() => setScriptOpen(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600/10 border border-emerald-600/20 text-emerald-400 hover:bg-emerald-600/20 hover:border-emerald-500/30 text-[11px] font-semibold transition-all duration-150 group/btn"
                    >
                        <FileText className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                        Write Script
                    </button>

                    {/* Analyze Thumbnails */}
                    <button
                        onClick={() => setThumbOpen(true)}
                        title="Analyze competitor thumbnails for this topic"
                        className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#1e1e22] bg-[#111113] text-zinc-500 hover:text-violet-400 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all shrink-0"
                    >
                        <Image className="w-3.5 h-3.5" />
                    </button>

                    {/* Share */}
                    {scanId && (
                        <a
                            href={`/dashboard/scans/${scanId}/share`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Share this scan result"
                            className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#1e1e22] bg-[#111113] text-zinc-500 hover:text-sky-400 hover:border-sky-500/30 hover:bg-sky-500/5 transition-all shrink-0"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                        </a>
                    )}

                    {/* Create Brief (save + go to vault) */}
                    {channelId && (
                        <CreateBriefButton gap={gap} channelId={channelId} />
                    )}

                    {/* Save bookmark */}
                    {channelId && (
                        <SaveIdeaButton gap={gap} channelId={channelId} isAlreadySaved={isAlreadySaved} />
                    )}
                </div>
            </div>

            {/* Script Modal */}
            {scriptOpen && (
                <ScriptModal
                    idea={{
                        id: `gap-${rank}`,
                        title: gap.title,
                        hook: gap.hook,
                        format: gap.format,
                        duration: "10-15 min",
                    }}
                    onClose={() => setScriptOpen(false)}
                />
            )}

            {/* Thumbnail Modal */}
            {thumbOpen && (
                <ThumbnailModal
                    keyword={gap.title}
                    channelId={channelId}
                    onClose={() => setThumbOpen(false)}
                />
            )}
        </>
    );
}

// ─── Score Breakdown Panel ────────────────────────────────────────────────────

function ScoreBreakdownPanel({ gap, analytics, confidence, confLabel, confColor }: {
    gap: GapItem;
    analytics?: ScanAnalytics | null;
    confidence: number | null;
    confLabel: string | null;
    confColor: string;
}) {
    const [open, setOpen] = React.useState(false);

    const bars = [
        { label: "Comment Need",  score: typeof analytics?.frustration?.score === "number" ? analytics.frustration.score * 10 : null, insight: undefined },
        { label: "Competition",   score: typeof analytics?.competition?.score === "number" ? analytics.competition.score * 10 : null, insight: analytics?.competition?.insight },
        { label: "View Velocity", score: typeof analytics?.velocity?.score === "number" ? analytics.velocity.score * 10 : null, insight: analytics?.velocity?.insight },
        { label: "Recent Direction", score: typeof analytics?.trend?.score === "number" ? analytics.trend.score * 10 : null, insight: analytics?.trend?.insight },
        { label: "Engagement",    score: typeof analytics?.engagement?.score === "number" ? analytics.engagement.score * 10 : null, insight: undefined },
    ].filter(b => b.score !== null) as { label: string; score: number; insight?: string }[];

    if (bars.length === 0) return null;

    return (
        <div className="border border-[#1e1e22] rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-[9px] font-mono text-zinc-600 uppercase tracking-widest hover:text-zinc-400 transition-colors hover:bg-[#111113]"
            >
                <span className="flex items-center gap-1.5">
                    <Target className="w-3 h-3" />
                    View full breakdown
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="border-t border-[#1e1e22] px-3 pb-3 pt-3 space-y-3">
                    {confLabel && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#0c0c0e] border border-[#1e1e22]">
                            <CheckCircle2 className={`w-3 h-3 shrink-0 ${confColor}`} />
                            <p className="text-[10px] text-zinc-500">
                                <span className={`font-bold ${confColor}`}>{confLabel} data coverage ({confidence}%)</span>
                                {" "}— based on how much video, search, and comment evidence was available.
                            </p>
                        </div>
                    )}
                    {bars.map(b => (
                        <ScoreSubBar key={b.label} label={b.label} score={b.score} max={10 * 10} insight={b.insight} />
                    ))}
                    {gap.reasoning && (
                        <div className="pt-2 border-t border-[#1e1e22]/50">
                            <div className="flex items-start gap-2">
                                <Lightbulb className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-zinc-500 leading-relaxed">{gap.reasoning}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Collapsible Outline ──────────────────────────────────────────────────────

function CollapsibleOutline({ items }: { items: string[] }) {
    const [open, setOpen] = React.useState(false);
    return (
        <div className="border border-[#1e1e22] rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-[9px] font-mono text-zinc-600 uppercase tracking-widest hover:text-zinc-400 transition-colors"
            >
                <span className="flex items-center gap-1.5">
                    <Crosshair className="w-3 h-3" /> Video Outline ({items.length} parts)
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="border-t border-[#1e1e22] px-3 pb-3 pt-2 space-y-1.5">
                    {items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-400">
                            <span className="text-zinc-700 font-mono tabular-nums shrink-0">{i + 1}.</span>
                            {item}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Create Brief Button ──────────────────────────────────────────────────────

function CreateBriefButton({ gap, channelId }: { gap: GapItem; channelId: string }) {
    const [loading, setLoading] = React.useState(false);
    const [done, setDone] = React.useState(false);

    const handle = async () => {
        if (loading || done) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/channels/${channelId}/ideas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(gap),
            });
            if (res.ok) {
                setDone(true);
                // Navigate to vault after short delay
                setTimeout(() => window.location.href = "/dashboard/vault", 800);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handle}
            disabled={loading || done}
            title="Save to Idea Vault and open brief"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-semibold transition-all duration-150 border ${
                done
                    ? "bg-sky-500/10 border-sky-500/20 text-sky-400"
                    : "bg-[#111113] border-[#1e1e22] text-zinc-400 hover:text-zinc-200 hover:border-[#2a2a30] hover:bg-[#1a1a1e]"
            }`}
        >
            {loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : done
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</>
                    : <><ArrowRight className="w-3.5 h-3.5" /> Create Brief</>
            }
        </button>
    );
}

// ─── Save Button ──────────────────────────────────────────────────────────────

export function SaveIdeaButton({ gap, channelId, isAlreadySaved }: {
    gap: GapItem;
    channelId: string;
    isAlreadySaved?: boolean;
}) {
    const [isSaving, setIsSaving] = React.useState(false);
    const [saved, setSaved] = React.useState(isAlreadySaved || false);

    const handleSave = async () => {
        if (isSaving || saved) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/channels/${channelId}/ideas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(gap)
            });
            if (res.ok) setSaved(true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <button
            onClick={handleSave}
            disabled={isSaving || saved}
            title={saved ? "Saved to Vault" : "Save to Idea Vault"}
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
                saved
                    ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                    : "bg-[#111113] border-[#1e1e22] text-zinc-500 hover:text-zinc-200 hover:border-[#2a2a30]"
            }`}
        >
            {isSaving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : saved
                    ? <BookmarkCheck className="w-3.5 h-3.5" />
                    : <Bookmark className="w-3.5 h-3.5" />
            }
        </button>
    );
}

// ─── Thumbnail Modal ──────────────────────────────────────────────────────────

interface ThumbnailData {
    videoId: string;
    title: string;
    channel: string;
    thumbnailUrl: string;
    views: number;
}

interface ThumbnailAnalysis {
    patterns?: string[];
    gaps?: string[];
    myRecommendation?: string;
    textTips?: string[];
    colorPalette?: string[];
}

export function ThumbnailModal({ keyword, channelId, onClose }: {
    keyword: string;
    channelId?: string;
    onClose: () => void;
}) {
    const [loading, setLoading] = React.useState(false);
    const [thumbnails, setThumbnails] = React.useState<ThumbnailData[]>([]);
    const [analysis, setAnalysis] = React.useState<ThumbnailAnalysis | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [fetched, setFetched] = React.useState(false);

    const run = async () => {
        if (!channelId) {
            setError("No channel selected. Please add a channel first.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/thumbnail-analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keyword, channelId }),
            });
            const data = await res.json() as {
                success?: boolean;
                error?: string;
                thumbnails?: ThumbnailData[];
                analysis?: ThumbnailAnalysis;
            };
            if (!res.ok || !data.success) {
                setError(data.error ?? "Analysis failed.");
                return;
            }
            setThumbnails(data.thumbnails ?? []);
            setAnalysis(data.analysis ?? null);
            setFetched(true);
        } catch (e) {
            setError("Network error. Please try again.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
        >
            <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0f0f11] border border-[#1e1e22] rounded-2xl shadow-2xl">

                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#1e1e22] bg-[#0f0f11]">
                    <div>
                        <p className="text-[10px] font-mono text-violet-400 uppercase tracking-widest mb-0.5">Thumbnail Intelligence</p>
                        <h2 className="text-sm font-bold text-zinc-100 truncate max-w-md">"{keyword}"</h2>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-[#1e1e22] transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-6">

                    {!fetched && !loading && (
                        <div className="text-center py-8">
                            <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
                                <Image className="w-6 h-6 text-violet-400" />
                            </div>
                            <p className="text-zinc-400 text-sm mb-2">Analyze top competitor thumbnails for this gap.</p>
                            <p className="text-zinc-600 text-xs mb-6">Costs 1 credit. Fetches top 6 YouTube results + AI pattern analysis.</p>
                            <button
                                onClick={run}
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600/15 border border-violet-500/30 text-violet-400 hover:bg-violet-600/25 font-semibold text-sm transition-all"
                            >
                                <Image className="w-4 h-4" />
                                Analyze Thumbnails (1 credit)
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div className="text-center py-12">
                            <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-3" />
                            <p className="text-zinc-400 text-sm">Fetching competitor thumbnails + running AI analysis…</p>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {fetched && thumbnails.length > 0 && (
                        <>
                            {/* Thumbnail grid */}
                            <div>
                                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Competitor Thumbnails</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {thumbnails.map(t => (
                                        <a
                                            key={t.videoId}
                                            href={`https://youtube.com/watch?v=${t.videoId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group relative rounded-xl overflow-hidden border border-[#1e1e22] hover:border-[#2a2a30] transition-all"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={t.thumbnailUrl} alt={t.title} className="w-full aspect-video object-cover" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-[10px] text-white font-semibold line-clamp-2">{t.title}</p>
                                                <p className="text-[9px] text-zinc-400 mt-0.5">{t.views.toLocaleString()} views</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>

                            {/* AI Analysis */}
                            {analysis && (
                                <div className="space-y-4">
                                    {analysis.patterns && analysis.patterns.length > 0 && (
                                        <div className="rounded-xl border border-[#1e1e22] bg-[#111113] p-4">
                                            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">✓ What's Working (Patterns)</p>
                                            <ul className="space-y-1.5">
                                                {analysis.patterns.map((p, i) => (
                                                    <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                                                        <span className="text-emerald-500 shrink-0 mt-0.5">→</span>{p}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {analysis.gaps && analysis.gaps.length > 0 && (
                                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4">
                                            <p className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-2">⚡ Thumbnail Gaps (Untapped)</p>
                                            <ul className="space-y-1.5">
                                                {analysis.gaps.map((g, i) => (
                                                    <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                                                        <span className="text-amber-400 shrink-0 mt-0.5">→</span>{g}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {analysis.myRecommendation && (
                                        <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-4">
                                            <p className="text-[10px] font-mono text-violet-400 uppercase tracking-widest mb-2">🎯 Your Thumbnail Strategy</p>
                                            <p className="text-sm text-zinc-200 leading-relaxed">{analysis.myRecommendation}</p>
                                        </div>
                                    )}

                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {analysis.textTips && analysis.textTips.length > 0 && (
                                            <div className="rounded-xl border border-[#1e1e22] bg-[#111113] p-4">
                                                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Text Overlay Tips</p>
                                                <ul className="space-y-1">
                                                    {analysis.textTips.map((t, i) => (
                                                        <li key={i} className="text-xs text-zinc-400">{t}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {analysis.colorPalette && analysis.colorPalette.length > 0 && (
                                            <div className="rounded-xl border border-[#1e1e22] bg-[#111113] p-4">
                                                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Suggested Colors</p>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {analysis.colorPalette.map((c, i) => (
                                                        <span key={i} className="text-[10px] font-mono bg-[#0c0c0e] border border-[#232328] text-zinc-300 rounded-lg px-2 py-0.5">{c}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function EvidenceDrawer({ gap, isOpen, onClose }: { gap: GapItem; isOpen: boolean; onClose: () => void }) {
    if (!isOpen) return null;

    const liftList = gap.evidenceOutliers?.map(o => o.lift) || [];
    const meanLift = liftList.length > 0 ? (liftList.reduce((a, b) => a + b, 0) / liftList.length) : 0;
    const sortedLifts = [...liftList].sort((a, b) => a - b);
    const medianLift = sortedLifts.length > 0 ? 
        (sortedLifts.length % 2 !== 0 ? sortedLifts[Math.floor(sortedLifts.length / 2)] : 
        (sortedLifts[sortedLifts.length / 2 - 1] + sortedLifts[sortedLifts.length / 2]) / 2) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-[#0f0f11] border border-[#2a2a30] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e22] bg-[#141417]">
                    <div className="flex items-center gap-2">
                        <LineChart className="w-4 h-4 text-sky-400" />
                        <h3 className="text-sm font-bold text-zinc-100">Breakout Evidence</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div>
                        <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Detected Outliers</h4>
                        <div className="space-y-3">
                            {gap.evidenceOutliers?.map((outlier, i) => (
                                <div key={i} className="p-4 rounded-xl bg-[#141417] border border-[#1e1e22]">
                                    <p className="text-xs font-bold text-zinc-200 mb-2 truncate">{outlier.channelName}</p>
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                        <div>
                                            <p className="text-[9px] font-mono text-zinc-500 uppercase">Normal Median</p>
                                            <p className="text-xs text-zinc-300 tabular-nums">{outlier.normalMedian.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-mono text-zinc-500 uppercase">Candidate Views</p>
                                            <p className="text-xs font-bold text-emerald-400 tabular-nums">{outlier.candidateViews.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-mono text-zinc-500 uppercase">Channel Lift</p>
                                            <p className="text-xs font-bold text-emerald-400 tabular-nums">{outlier.lift.toFixed(1)}×</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-mono text-zinc-500 uppercase">Video Age</p>
                                            <p className="text-xs text-zinc-400 tabular-nums">{Math.round(outlier.ageHours)}h</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[#1e1e22]">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <p className="text-[9px] font-mono text-zinc-500 uppercase">Mean Lift</p>
                                <p className="text-sm font-bold text-zinc-200">{meanLift.toFixed(1)}×</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-mono text-zinc-500 uppercase">Median Lift</p>
                                <p className="text-sm font-bold text-emerald-400">{medianLift.toFixed(1)}×</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-mono text-zinc-500 uppercase">Independent Creators</p>
                                <p className="text-sm font-bold text-zinc-200">{liftList.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
