"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { completeNewTuberOnboarding } from "../actions";
import {
    Loader2, CheckCircle2, Wand2, Youtube, Sparkles, Hash,
    TrendingUp, BarChart3, Target, Zap, Users, Globe,
    ArrowRight, Star, Trophy, Flame, Shield, Eye, ChevronDown
} from "lucide-react";

// ─── Full Category List ──────────────────────────────────────────────────────

const CATEGORIES = [
    { value: "cars", label: "Cars and vehicles", icon_emoji: "🚗" },
    { value: "comedy", label: "Comedy", icon_emoji: "😂" },
    { value: "education", label: "Education", icon_emoji: "📚" },
    { value: "entertainment", label: "Entertainment", icon_emoji: "🎬" },
    { value: "film", label: "Film and animation", icon_emoji: "🎞️" },
    { value: "gaming", label: "Gaming", icon_emoji: "🎮" },
    { value: "howto", label: "How-to and style", icon_emoji: "💅" },
    { value: "music", label: "Music", icon_emoji: "🎵" },
    { value: "news", label: "News and politics", icon_emoji: "📰" },
    { value: "nonprofit", label: "Non-profits and activism", icon_emoji: "🤝" },
    { value: "people", label: "People and blogs", icon_emoji: "🤳" },
    { value: "pets", label: "Pets and animals", icon_emoji: "🐶" },
    { value: "science", label: "Science and technology", icon_emoji: "🧪" },
    { value: "sport", label: "Sport", icon_emoji: "⚽" },
    { value: "travel", label: "Travel and events", icon_emoji: "✈️" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChannelName {
    name: string;
    reasoning: string;
    vibe: string;
}

interface VideoIdea {
    title: string;
    hook: string;
    format: string;
    whyItWorks: string;
    estimatedViewPotential: string;
    targetAudience: string;
}

interface SubNiche {
    name: string;
    opportunity: string;
    competition: string;
}

interface MarketAnalysis {
    demandScore: number;
    saturationLevel: string;
    growthTrajectory: string;
    difficultyRating: string;
    topCompetitorChannels: number;
    avgCompetitorViews: number;
    avgCompetitorSubs: number;
    contentGapCount: number;
    uploadFrequencyBenchmark: number;
    trendingKeywords: string[];
    bestSubNiches: string[];
    overallVerdict: string;
}

interface BlueprintData {
    channelNames: ChannelName[];
    channelDescription: string;
    videoIdeas: VideoIdea[];
    subNiches: SubNiche[];
    contentStrategy: string;
    suggestedTags: string[];
    marketAnalysis: MarketAnalysis;
    estimatedFirstYearViews: { low: number; mid: number; high: number };
    revenueEstimate: { low: number; mid: number; high: number };
}

// ─── Helper Components ────────────────────────────────────────────────────────

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
    const circumference = 2 * Math.PI * 36;
    const offset = circumference - (score / 100) * circumference;
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="none" />
                    <circle cx="40" cy="40" r="36" stroke={color} strokeWidth="6" fill="none"
                        strokeDasharray={circumference} strokeDashoffset={offset}
                        strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-black text-white">{score}</span>
                </div>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{label}</span>
        </div>
    );
}

function DifficultyBadge({ level }: { level: string }) {
    const colors: Record<string, string> = {
        "Easy": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        "Moderate": "bg-amber-500/20 text-amber-300 border-amber-500/30",
        "Hard": "bg-orange-500/20 text-orange-300 border-orange-500/30",
        "Very Hard": "bg-red-500/20 text-red-300 border-red-500/30",
    };
    const icons: Record<string, React.ReactNode> = {
        "Easy": <Shield className="w-3 h-3" />,
        "Moderate": <Target className="w-3 h-3" />,
        "Hard": <Flame className="w-3 h-3" />,
        "Very Hard": <Zap className="w-3 h-3" />,
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${colors[level] || colors["Moderate"]}`}>
            {icons[level] || icons["Moderate"]} {level}
        </span>
    );
}

function ViewPotentialBadge({ level }: { level: string }) {
    const colors: Record<string, string> = {
        high: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        medium: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        low: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${colors[level] || colors["medium"]}`}>
            <Eye className="w-3 h-3" /> {level.toUpperCase()} POTENTIAL
        </span>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewTuberPage() {
    const [step, setStep] = useState(1);
    const [category, setCategory] = useState("");
    const [topic, setTopic] = useState("");
    const [selectedChannelName, setSelectedChannelName] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStage, setGenerationStage] = useState(0);
    const [error, setError] = useState("");
    const [blueprint, setBlueprint] = useState<BlueprintData | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Handle click outside dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ── Tab title updates during generation ───────────────────────────────────
    useEffect(() => {
        const STAGE_TITLES: Record<number, string> = {
            1: "⏳ Mining YouTube Market...",
            2: "🔍 Analyzing Competition...",
            3: "✨ Generating Channel Names...",
            4: "🎯 Building Video Roadmap...",
            5: "✅ Blueprint Ready!",
        };
        if (isGenerating && generationStage > 0) {
            document.title = STAGE_TITLES[generationStage] ?? "⏳ Building Channel...";
        } else if (!isGenerating && blueprint) {
            document.title = "✅ Blueprint Ready — GapTuber";
        } else {
            document.title = "New Channel — GapTuber";
        }
        return () => { document.title = "GapTuber"; };
    }, [isGenerating, generationStage, blueprint]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError("");
        setGenerationStage(1);

        try {
            // Simulate progress stages while API works
            const progressTimer = setInterval(() => {
                setGenerationStage(prev => Math.min(prev + 1, 4));
            }, 2500);

            const res = await fetch("/api/channel-creation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category, topic }),
            });

            clearInterval(progressTimer);

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to generate blueprint");
            }

            const data = await res.json();
            setBlueprint(data);
            setGenerationStage(5);

            // Auto-select first channel name
            if (data.channelNames?.length > 0) {
                setSelectedChannelName(data.channelNames[0].name);
            }

            setTimeout(() => {
                setIsGenerating(false);
                setStep(2);
            }, 800);

        } catch (err) {
            setIsGenerating(false);
            setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
            setGenerationStage(0);
        }
    };

    const STAGES = [
        { label: "Searching YouTube market data...", icon: Globe },
        { label: "Running competition analysis...", icon: BarChart3 },
        { label: "Generating channel names & branding...", icon: Sparkles },
        { label: "Creating aligned video ideas...", icon: Youtube },
        { label: "Finalizing your blueprint...", icon: CheckCircle2 },
    ];

    return (
        <div className="max-w-5xl mx-auto">
            <AnimatePresence mode="wait">
                {/* ─── Step 1: Input Form ─────────────────────────────────── */}
                {step === 1 && !isGenerating && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="bg-[#0c0c0e] p-8 md:p-12 border border-[#1e1e22] rounded-3xl"
                    >
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-bold text-white mb-4">Let&apos;s Build Your Channel</h2>
                            <p className="text-zinc-500">Tell us what you want to create. Our AI will analyze the YouTube market and engineer the perfect foundation.</p>
                        </div>

                        <div className="space-y-8">
                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-3">What&apos;s your niche?</label>
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className="w-full p-4 bg-[#111113] border border-[#1e1e22] text-white rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all text-lg flex items-center justify-between outline-none cursor-pointer"
                                    >
                                        <span className={category ? "text-white" : "text-zinc-600"}>
                                            {category ? category : "Select your niche"}
                                        </span>
                                        <ChevronDown className={`w-5 h-5 text-zinc-500 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                                    </button>
                                    
                                    <AnimatePresence>
                                        {isDropdownOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                                                className="absolute z-50 w-full mt-2 bg-[#0c0c0e] border border-[#1e1e22] rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
                                            >
                                                <div className="max-h-[280px] overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-zinc-800">
                                                    {CATEGORIES.map(cat => (
                                                        <button
                                                            key={cat.value}
                                                            type="button"
                                                            onClick={() => {
                                                                setCategory(cat.label);
                                                                setIsDropdownOpen(false);
                                                            }}
                                                            className={`w-full p-3 text-left rounded-lg transition-all flex items-center gap-3 ${
                                                                category === cat.label
                                                                    ? "bg-emerald-500/10 text-emerald-400 font-bold"
                                                                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                                            }`}
                                                        >
                                                            <span className="text-xl">{cat.icon_emoji}</span>
                                                            <span className="text-base">{cat.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-400 mb-3">What&apos;s the specific topic?</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Building home lab servers, AI coding tools, Minimalist desk setups"
                                    className="w-full p-4 border border-[#1e1e22] bg-[#111113] text-white rounded-xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all text-lg placeholder:text-zinc-700 outline-none"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                />
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="button"
                                disabled={!category || !topic || topic.length < 2}
                                onClick={handleGenerate}
                                className="w-full py-5 bg-gradient-to-r from-emerald-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                            >
                                <Wand2 className="w-5 h-5" />
                                Analyze Market & Generate Blueprint
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* ─── Loading: Real Progress ─────────────────────────────── */}
                {isGenerating && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="bg-[#0c0c0e] p-12 border border-[#1e1e22] rounded-3xl text-center flex flex-col items-center justify-center min-h-[400px]"
                    >
                        <div className="relative mb-8">
                            <div className="w-24 h-24 border-4 border-emerald-900/40 rounded-full animate-pulse" />
                            <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            <Wand2 className="absolute inset-0 m-auto w-8 h-8 text-emerald-400 animate-bounce" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Analyzing &ldquo;{topic}&rdquo; Market...</h3>
                        <p className="text-zinc-500 mb-6">Scanning real YouTube data for your niche</p>
                        <div className="w-full max-w-md bg-[#1e1e22] rounded-full h-2 mb-6 overflow-hidden">
                            <motion.div
                                className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-2 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(generationStage * 20, 100)}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <div className="space-y-3 font-medium">
                            {STAGES.map((stage, i) => {
                                const Icon = stage.icon;
                                const active = generationStage > i;
                                return (
                                    <p key={i} className={`flex items-center justify-center gap-2 transition-all ${active ? "text-emerald-400" : "text-zinc-700"}`}>
                                        {active ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                                        {stage.label}
                                    </p>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* ─── Step 2: Results ────────────────────────────────────── */}
                {step === 2 && !isGenerating && blueprint && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Market Analysis Panel */}
                        <div className="bg-[#0a0a0f] p-8 border border-white/10 rounded-3xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-indigo-500 to-purple-600" />

                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-300 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-500/20 mb-3">
                                        <TrendingUp className="w-3 h-3" /> Market Intelligence Report
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">&ldquo;{topic}&rdquo; — YouTube Market Analysis</h2>
                                    <p className="text-slate-400 text-sm max-w-xl">{blueprint.marketAnalysis.overallVerdict}</p>
                                </div>
                                <DifficultyBadge level={blueprint.marketAnalysis.difficultyRating} />
                            </div>

                            {/* Score Rings */}
                            <div className="flex flex-wrap justify-center gap-6 mb-8">
                                <ScoreRing score={blueprint.marketAnalysis.demandScore} label="Demand" color="#8b5cf6" />
                                <ScoreRing
                                    score={blueprint.marketAnalysis.saturationLevel === "Low" ? 80 : blueprint.marketAnalysis.saturationLevel === "Medium" ? 50 : 25}
                                    label="Opportunity"
                                    color="#10b981"
                                />
                                <ScoreRing
                                    score={blueprint.marketAnalysis.growthTrajectory === "accelerating" ? 85 : blueprint.marketAnalysis.growthTrajectory === "stable" ? 50 : 20}
                                    label="Growth"
                                    color="#3b82f6"
                                />
                                <ScoreRing score={blueprint.marketAnalysis.contentGapCount * 10} label="Content Gaps" color="#f59e0b" />
                            </div>

                            {/* Market Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                    <div className="text-xl font-black text-white">{blueprint.marketAnalysis.topCompetitorChannels}</div>
                                    <div className="text-xs text-slate-500 mt-1">Competitors</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                    <div className="text-xl font-black text-white">{(blueprint.marketAnalysis.avgCompetitorViews / 1000).toFixed(0)}K</div>
                                    <div className="text-xs text-slate-500 mt-1">Avg Views</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                    <div className="text-xl font-black text-white">{blueprint.marketAnalysis.uploadFrequencyBenchmark}/wk</div>
                                    <div className="text-xs text-slate-500 mt-1">Upload Benchmark</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                    <div className="text-xl font-black text-white">${blueprint.revenueEstimate.low}-${blueprint.revenueEstimate.high}</div>
                                    <div className="text-xs text-slate-500 mt-1">Est. Year 1 Revenue</div>
                                </div>
                            </div>

                            {/* Estimated Views */}
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                                <div className="text-xs font-bold text-emerald-300 mb-2 flex items-center gap-2">
                                    <BarChart3 className="w-3 h-3" /> Estimated First Year Views
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-slate-400">Conservative: <strong className="text-white">{blueprint.estimatedFirstYearViews.low.toLocaleString()}</strong></span>
                                    <span className="text-emerald-300">Expected: <strong className="text-white">{blueprint.estimatedFirstYearViews.mid.toLocaleString()}</strong></span>
                                    <span className="text-slate-400">Optimistic: <strong className="text-white">{blueprint.estimatedFirstYearViews.high.toLocaleString()}</strong></span>
                                </div>
                            </div>

                            {/* Trending Keywords */}
                            {blueprint.marketAnalysis.trendingKeywords.length > 0 && (
                                <div className="mt-4">
                                    <div className="text-xs font-bold text-slate-400 mb-2">🔥 Trending Keywords</div>
                                    <div className="flex flex-wrap gap-2">
                                        {blueprint.marketAnalysis.trendingKeywords.map((kw, i) => (
                                            <span key={i} className="text-xs bg-white/5 text-slate-300 border border-white/10 rounded-full px-3 py-1">{kw}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Channel Name Selection */}
                        <div className="bg-[#0c0c0e] p-8 border border-[#1e1e22] rounded-3xl">
                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <Star className="w-5 h-5 text-amber-400" /> Choose Your Channel Name
                            </h3>
                            <p className="text-zinc-500 text-sm mb-6">AI-generated unique names for your &ldquo;{topic}&rdquo; channel</p>

                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {blueprint.channelNames.map((cn, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setSelectedChannelName(cn.name)}
                                        className={`p-4 text-left border rounded-xl transition-all ${
                                            selectedChannelName === cn.name
                                                ? "border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/10"
                                                : "border-[#1e1e22] hover:border-emerald-800 bg-[#111113]"
                                        }`}
                                    >
                                        <div className="font-bold text-white text-lg mb-1">{cn.name}</div>
                                        <div className="text-xs text-emerald-400 font-semibold mb-1">{cn.vibe}</div>
                                        <div className="text-xs text-zinc-500 leading-relaxed">{cn.reasoning}</div>
                                    </button>
                                ))}
                            </div>

                            {blueprint.channelDescription && (
                                <div className="mt-6 bg-[#111113] p-4 rounded-xl border border-[#1e1e22]">
                                    <div className="text-xs font-bold text-zinc-500 mb-2">📝 AI Generated Description</div>
                                    <p className="text-sm text-zinc-400 leading-relaxed">{blueprint.channelDescription}</p>
                                </div>
                            )}

                            <div className="mt-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-zinc-500 mb-2">
                                    <Hash className="w-4 h-4" /> Optimized Tags
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {blueprint.suggestedTags.slice(0, 15).map((tag, i) => (
                                        <span key={i} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Video Ideas */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Youtube className="w-5 h-5 text-red-500" /> Your First Videos (AI-Powered Roadmap)
                            </h3>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {blueprint.videoIdeas.map((idea, idx) => (
                                    <div key={idx} className="bg-[#0c0c0e] border border-[#1e1e22] rounded-2xl p-6 hover:border-emerald-700 hover:shadow-lg hover:shadow-emerald-500/5 transition-all group">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-sm">
                                                {idx + 1}
                                            </div>
                                            <ViewPotentialBadge level={idea.estimatedViewPotential} />
                                        </div>

                                        <h4 className="font-bold text-white mb-2 leading-tight group-hover:text-emerald-400 transition-colors text-sm">
                                            {idea.title}
                                        </h4>

                                        <div className="bg-[#111113] rounded-lg p-3 mb-3 border border-[#1e1e22]">
                                            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1">Hook</div>
                                            <p className="text-xs text-zinc-400 italic">&ldquo;{idea.hook}&rdquo;</p>
                                        </div>

                                        <div className="space-y-2 text-xs">
                                            <div className="flex items-center gap-2 text-zinc-500">
                                                <span className="font-semibold text-zinc-400">Format:</span> {idea.format}
                                            </div>
                                            <div className="flex items-center gap-2 text-zinc-500">
                                                <Users className="w-3 h-3" /> {idea.targetAudience}
                                            </div>
                                        </div>

                                        <p className="text-xs text-zinc-600 mt-3 leading-relaxed">{idea.whyItWorks}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sub-Niches */}
                        {blueprint.subNiches.length > 0 && (
                            <div className="bg-[#0c0c0e] p-6 border border-[#1e1e22] rounded-3xl">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-amber-400" /> Promising Sub-Niches
                                </h3>
                                <div className="grid md:grid-cols-3 gap-3">
                                    {blueprint.subNiches.map((sn, i) => (
                                        <div key={i} className="p-4 bg-[#111113] rounded-xl border border-[#1e1e22]">
                                            <div className="font-semibold text-white mb-1">{sn.name}</div>
                                            <div className="text-xs text-zinc-500 mb-2">{sn.opportunity}</div>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                sn.competition === "Low" ? "bg-emerald-500/10 text-emerald-400" :
                                                sn.competition === "Medium" ? "bg-amber-500/10 text-amber-400" :
                                                "bg-red-500/10 text-red-400"
                                            }`}>
                                                {sn.competition} Competition
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {blueprint.contentStrategy && (
                            <div className="bg-emerald-500/5 p-6 border border-emerald-500/20 rounded-3xl">
                                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-emerald-400" /> First Month Strategy
                                </h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">{blueprint.contentStrategy}</p>
                            </div>
                        )}

                        {/* Submit */}
                        <form action={completeNewTuberOnboarding} className="pt-4">
                            <input type="hidden" name="category" value={category} />
                            <input type="hidden" name="topic" value={topic} />
                            <input type="hidden" name="channelName" value={selectedChannelName} />
                            <input type="hidden" name="theme" value="default" />
                            <input type="hidden" name="videoIdeas" value={JSON.stringify(blueprint?.videoIdeas ?? [])} />
                            <input type="hidden" name="contentStrategy" value={blueprint?.contentStrategy ?? ""} />
                            <input type="hidden" name="marketSnapshot" value={JSON.stringify(blueprint?.marketAnalysis ?? {})} />

                            <button
                                type="submit"
                                disabled={!selectedChannelName}
                                className="w-full py-5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl font-bold text-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-[0.98]"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Save &ldquo;{selectedChannelName || "Select a Name"}&rdquo; & Enter Dashboard
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
