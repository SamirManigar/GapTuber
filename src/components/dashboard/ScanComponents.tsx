"use client";

import React from "react";
import type { GapItem, ScanAnalytics } from "@/db/schema";
import {
    Zap, Users, Film, DollarSign, Search, ShieldAlert, Brain,
    ChevronDown, Loader2, BookmarkCheck, Bookmark,
    TrendingUp, Clock, BarChart2, Crosshair
} from "lucide-react";

// ─── Score Ring ────────────────────────────────────────────────────────────────
// A clean circular score display replacing the emoji metric cards

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const filled = (score / 10) * circumference;

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative w-24 h-24">
                {/* Glow effect behind the ring */}
                <div
                    className="absolute inset-2 rounded-full blur-xl opacity-20"
                    style={{ background: color }}
                />
                <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r={radius} fill="none" stroke="#1e1e22" strokeWidth="4" />
                    <circle
                        cx="48" cy="48" r={radius} fill="none"
                        stroke={color} strokeWidth="4"
                        strokeDasharray={`${filled} ${circumference}`}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-white tabular-nums leading-none" style={{ color }}>
                        {score.toFixed(1)}
                    </span>
                    <span className="text-[8px] font-mono text-zinc-600 mt-0.5">/10</span>
                </div>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest text-center">
                {label}
            </span>
        </div>
    );
}

// ─── Signal Bar ────────────────────────────────────────────────────────────────

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
            <div className="text-xl font-bold text-white tabular-nums leading-none tracking-tight">{value}</div>
            <div className="text-[9px] font-mono text-zinc-600 mt-1.5 uppercase tracking-widest">{label}</div>
        </div>
    );
}

export function AnalyticsPanel({ analytics }: { analytics: ScanAnalytics }) {
    const s = (v: number | null | undefined) => +(v ?? 0);
    const r = (v: number | null | undefined) => Math.round((v ?? 0) * 10);

    const rings = [
        { score: s(analytics.velocity?.score),    label: "Growth Speed",   color: "#34d399" },
        { score: s(analytics.saturation?.score),  label: "Opportunity",    color: "#60a5fa" },
        { score: s(analytics.frustration?.score), label: "Viewer Demand",  color: "#f87171" },
        { score: s(analytics.trend?.score),       label: "Trend Strength", color: "#a78bfa" },
    ];

    const bars = [
        { label: "Growth Speed",    score: r(analytics.velocity?.score) },
        { label: "Opportunity",     score: r(analytics.saturation?.score) },
        { label: "Viewer Demand",   score: r(analytics.frustration?.score) },
        { label: "Trend Strength",  score: r(analytics.trend?.score) },
        { label: "Competition",     score: r(analytics.competition?.score) },
        { label: "Engagement",      score: r(analytics.engagement?.score) },
    ];

    return (
        <div className="bg-[#0f0f11] border border-[#1e1e22] rounded-2xl overflow-hidden mb-8">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1e22]">
                <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Opportunity Breakdown</span>
                    <p className="text-[9px] text-zinc-700 mt-0.5">Higher scores = stronger opportunity in that area</p>
                </div>
                {analytics.revenueEstimate && (
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                        ${analytics.revenueEstimate.low.toLocaleString()}–${analytics.revenueEstimate.high.toLocaleString()}
                        <span className="text-zinc-600 font-normal ml-1">estimated monthly earnings</span>
                    </span>
                )}
            </div>

            <div className="p-5 space-y-6">

                {/* Score rings row */}
                <div className="flex items-start justify-around gap-4">
                    {rings.map(r => <ScoreRing key={r.label} {...r} />)}
                </div>

                {/* Two-col: bars + insights */}
                <div className="grid lg:grid-cols-2 gap-6 pt-4 border-t border-[#1e1e22]/50">

                    {/* Signal bars */}
                    <div className="space-y-2.5">
                        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-3">Score Breakdown</p>
                        {bars.map(b => <SignalBar key={b.label} {...b} />)}
                    </div>

                    {/* Key insights — only the most actionable */}
                    <div className="space-y-3">
                        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">What to do next</p>

                        {/* Best upload window */}
                        {analytics.uploadSchedule?.bestDay && (
                            <div className="flex items-start gap-3 p-3 bg-[#111113] border border-[#1e1e22] rounded-xl">
                                <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-mono text-zinc-500 uppercase mb-0.5">Best Time to Post</p>
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

                        {/* Competition difficulty */}
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

                        {/* Velocity trend */}
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

                {/* Pain Points — only if meaningful */}
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

                {/* Tags — compact, max 12 */}
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

export function GapCard({ gap, rank, channelId, isAlreadySaved }: {
    gap: GapItem;
    rank: number;
    channelId?: string;
    isAlreadySaved?: boolean;
}) {
    const isTop = gap.gapScore >= 8;
    const isMid = gap.gapScore >= 6;

    const scoreColor =
        isTop ? "text-emerald-300" :
        isMid ? "text-amber-300" :
                "text-zinc-400";

    const accentBorder =
        isTop ? "border-emerald-500/20" :
        isMid ? "border-amber-500/15" :
                "border-[#1e1e22]";

    const leftBar =
        isTop ? "bg-gradient-to-b from-emerald-400 via-emerald-500/40 to-transparent" :
        isMid ? "bg-gradient-to-b from-amber-400 via-amber-500/40 to-transparent" :
                "bg-gradient-to-b from-zinc-700 to-transparent";

    return (
        <div className={`group relative flex flex-col bg-[#0f0f11] border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 ${accentBorder} ${isTop ? "hover:border-emerald-500/35 hover:shadow-emerald-500/5" : "hover:border-[#2a2a30]"}`}>

            {/* Left accent */}
            <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${leftBar} rounded-l-2xl`} />

            {/* Top line */}
            <div className={`h-px w-full ${isTop ? "bg-gradient-to-r from-emerald-500/50 via-emerald-500/15 to-transparent" : isMid ? "bg-gradient-to-r from-amber-500/40 via-amber-500/10 to-transparent" : "bg-gradient-to-r from-zinc-800/60 to-transparent"}`} />

            {/* Header */}
            <div className="pl-5 pr-4 pt-4 pb-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    {/* Rank + trigger */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                            Gap #{rank}
                        </span>
                        {(gap as any).psychologicalTrigger && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full border text-purple-400/80 border-purple-500/20 bg-purple-500/8">
                                <Brain className="w-2.5 h-2.5" />
                                {(gap as any).psychologicalTrigger.replace(/_/g, " ")}
                            </span>
                        )}
                    </div>
                    <h3 className="font-bold text-zinc-100 text-[14px] leading-snug tracking-tight">{gap.title}</h3>
                </div>

                {/* Score badge + save */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl border ${isTop ? "bg-emerald-500/10 border-emerald-500/20" : isMid ? "bg-amber-500/8 border-amber-500/15" : "bg-[#1e1e22] border-[#2a2a30]"}`}>
                        <span className={`text-sm font-bold leading-none tabular-nums ${scoreColor}`}>{gap.gapScore}</span>
                        <span className="text-[7px] font-mono text-zinc-600 uppercase mt-0.5">/ 10</span>
                    </div>           {channelId && <SaveIdeaButton gap={gap} channelId={channelId} isAlreadySaved={isAlreadySaved} />}
                </div>
            </div>

            {/* Body */}
            <div className="pl-5 pr-4 pb-4 space-y-4">

                {/* Reasoning — the core value prop */}
                <p className="text-[12px] text-zinc-400 leading-relaxed">{gap.reasoning}</p>

                {/* Hook — hero line */}
                <div className={`pl-3 border-l-2 py-0.5 ${isTop ? "border-emerald-500/50" : "border-zinc-700/60"}`}>
                    <p className={`text-[12px] italic leading-relaxed ${isTop ? "text-emerald-100/80" : "text-zinc-300"}`}>
                        &ldquo;{gap.hook}&rdquo;
                    </p>
                </div>

                {/* Meta row — only show fields that exist, inline */}
                <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
                    {gap.targetAudience && (
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Users className="w-3 h-3 text-zinc-600 shrink-0" />
                            <span className="text-[10px] text-zinc-500 truncate">{gap.targetAudience}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Film className="w-3 h-3 text-zinc-600 shrink-0" />
                        <span className="text-[10px] text-zinc-500 truncate">{gap.format}</span>
                    </div>
                    {gap.monetizationAngle && (
                        <div className="flex items-center gap-1.5 min-w-0">
                            <DollarSign className="w-3 h-3 text-zinc-600 shrink-0" />
                            <span className="text-[10px] text-zinc-500 truncate">{gap.monetizationAngle}</span>
                        </div>
                    )}
                    {gap.competitorWeakness && (
                        <div className="flex items-center gap-1.5 min-w-0">
                            <ShieldAlert className="w-3 h-3 text-red-500/60 shrink-0" />
                            <span className="text-[10px] text-red-400/70 truncate">{gap.competitorWeakness}</span>
                        </div>
                    )}
                </div>

                {/* Content outline — collapsible, only if exists */}
                {gap.contentOutline && gap.contentOutline.length > 0 && (
                    <CollapsibleOutline items={gap.contentOutline} />
                )}

                {/* SEO tips — compact pills, max 6 */}
                {gap.seoTips && gap.seoTips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {gap.seoTips.slice(0, 6).map((tip, i) => (
                            <span key={i} className="text-[9px] font-mono bg-[#1a1a1e] border border-[#232328] text-zinc-500 rounded-lg px-2 py-0.5">
                                {tip}
                            </span>
                        ))}
                    </div>
                )}
            </div>
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
            className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${
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
