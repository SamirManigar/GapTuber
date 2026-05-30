"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, Variants } from "framer-motion";
import { Chrome } from "lucide-react";

const TOOLS = [
    { label: "Gap Scanner", desc: "Statistical content gap detection" },
    { label: "GapTuber AI Studio", desc: "Your personal YouTube AI assistant" },
    { label: "Competitors Gap Analysis", desc: "In-depth competitor insights" },
    { label: "Competitor Watchtower", desc: "Track competitor performance" },
    { label: "Comment Miner", desc: "Extract viewer pain points" },
    { label: "Chrome Extension", desc: "Live gap scans & idea saving on YouTube" },
];

const SAMPLE_GAP = {
    keyword: "rag tutorial",
    title: "Beginner-Friendly RAG for Solo Devs (2026 Stack)",
    score: "8.7",
    signals: [
        { k: "Velocity", v: "High" },
        { k: "Saturation", v: "Low" },
        { k: "Frustration", v: "High" },
        { k: "Competition", v: "Easy" },
    ],
    hook: '"Stop using RAG tutorials from 2023."',
};

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
    }),
};

const cardVariant: Variants = {
    hidden: { opacity: 0, y: 32, scale: 0.97 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { delay: 0.35, duration: 0.6, ease: "easeOut" },
    },
};

export default function Hero() {
    const { data: session } = useSession();

    return (
        <section className="pt-24 pb-16 px-5 border-b border-[#1e1e22]">
            <div className="max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-12 items-start">
                    {/* Left — Copy */}
                    <div className="pt-6">
                        <motion.div
                            custom={0}
                            variants={fadeUp}
                            initial="hidden"
                            animate="visible"
                            className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6"
                        >
                            <Chrome className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Extension + Web Studio</span>
                        </motion.div>

                        <motion.h1
                            custom={1}
                            variants={fadeUp}
                            initial="hidden"
                            animate="visible"
                            className="text-5xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500 leading-[1.05] tracking-tight mb-6"
                        >
                            Find the content gap.<br />
                            <span className="text-white">Before they do.</span>
                        </motion.h1>

                        <motion.p
                            custom={2}
                            variants={fadeUp}
                            initial="hidden"
                            animate="visible"
                            className="text-zinc-400 text-lg leading-relaxed mb-8 max-w-md"
                        >
                            Scan competitor channels directly from YouTube with our Chrome Extension. Save viral hooks to your Vault, and generate full scripts in the AI Studio.
                        </motion.p>

                        <motion.div
                            custom={3}
                            variants={fadeUp}
                            initial="hidden"
                            animate="visible"
                            className="flex flex-wrap items-center gap-3 mb-10"
                        >
                            {session ? (
                                <Link
                                    href="/dashboard"
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-md font-semibold text-sm transition-colors"
                                >
                                    Open Dashboard →
                                </Link>
                            ) : (
                                <Link
                                    href="/auth/signin"
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-md font-semibold text-sm transition-colors"
                                >
                                    Start for free →
                                </Link>
                            )}
                            <a
                                href="#"
                                title="GapTuber Chrome Extension — coming soon to Chrome Web Store"
                                className="flex items-center gap-2 border border-[#2a2a30] hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 px-4 py-2.5 rounded-md text-sm transition-all"
                            >
                                <Chrome className="w-4 h-4" />
                                Get Extension
                            </a>
                            <a href="#how-it-works" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                                How it works
                            </a>
                        </motion.div>

                        {/* Tool list */}
                        <motion.div
                            custom={4}
                            variants={fadeUp}
                            initial="hidden"
                            animate="visible"
                            className="border-t border-[#1e1e22] pt-6"
                        >
                            <p className="text-xs text-zinc-600 font-mono mb-4">WHAT&apos;S INCLUDED</p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                {TOOLS.map(t => (
                                    <div key={t.label} className="hover:translate-x-1 transition-transform duration-200">
                                        <span className="text-sm font-medium text-zinc-300">{t.label}</span>
                                        <p className="text-xs text-zinc-600 mt-0.5">{t.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* Right — Sample Terminal Card */}
                    <motion.div
                        variants={cardVariant}
                        initial="hidden"
                        animate="visible"
                        className="bg-[#111113] border border-[#1e1e22] rounded-xl overflow-hidden font-mono text-sm mt-4 shadow-2xl relative group"
                    >
                        <div className="absolute -inset-1 bg-emerald-500/10 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="relative bg-[#111113] border border-[#1e1e22] rounded-xl overflow-hidden">
                            {/* Terminal bar */}
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e22]">
                                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                                <span className="ml-3 text-xs text-zinc-600">gap_scan → &quot;{SAMPLE_GAP.keyword}&quot;</span>
                            </div>
                            {/* Output */}
                            <div className="p-5 space-y-4">
                                <div>
                                    <p className="text-zinc-600 text-xs mb-1">GAP #1 · SCORE</p>
                                    <p className="text-emerald-400 text-3xl font-extrabold">{SAMPLE_GAP.score}<span className="text-zinc-700 text-lg">/10</span></p>
                                </div>
                                <div>
                                    <p className="text-zinc-600 text-xs mb-1">SUGGESTED TITLE</p>
                                    <p className="text-zinc-200 text-[13px] leading-snug">{SAMPLE_GAP.title}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {SAMPLE_GAP.signals.map(s => (
                                        <div key={s.k} className="bg-[#0c0c0e] border border-[#1e1e22] rounded-lg px-3 py-2">
                                            <p className="text-zinc-600 text-[10px]">{s.k}</p>
                                            <p className={`text-xs font-semibold mt-0.5 ${s.v === "High" || s.v === "Easy" ? "text-emerald-400" : s.v === "Low" ? "text-amber-400" : "text-zinc-300"}`}>{s.v}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-[#1e1e22] pt-3">
                                    <p className="text-zinc-600 text-[10px] mb-1">HOOK</p>
                                    <p className="text-zinc-300 text-[13px] italic">{SAMPLE_GAP.hook}</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
