"use client";

import { motion, Variants } from "framer-motion";

import { Zap, Pickaxe, Target, Radar } from "lucide-react";

const BEFORE = [
    "Searching trending topics and copying them",
    "Using generic keyword tools everyone else uses",
    "Guessing from view counts with no signal context",
    "Blindly copying competitors' best-performing videos",
];

const AFTER = [
    { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", label: "Spot rising channels early", desc: "See which channels and topics are gaining momentum before everyone else jumps on them." },
    { icon: Pickaxe, color: "text-rose-400", bg: "bg-rose-500/10", label: "Mine viewer complaints", desc: "AI reads thousands of comments to find exactly what viewers hate about existing videos — and what they wish existed." },
    { icon: Target, color: "text-blue-500", bg: "bg-blue-500/10", label: "Score every opportunity", desc: "Each video idea gets a simple score from 1–10, so you always know which one is worth filming first." },
    { icon: Radar, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Watch competitors 24/7", desc: "Get an alert the moment a competitor posts a video that takes off — so you can react before it's too late." },
];

const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, x: -16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const rightItemVariants: Variants = {
    hidden: { opacity: 0, x: 16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const headingVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function ProblemSection() {
    return (
        <section className="py-20 px-5 bg-[#0c0c0e]">
            <div className="max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-16">
                    {/* Left — The problem */}
                    <motion.div
                        variants={headingVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-80px" }}
                    >
                        <p className="text-xs font-mono text-zinc-600 tracking-widest uppercase mb-5">The problem</p>
                        <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
                            You&apos;re not losing views.<br />You&apos;re missing the right topics.
                        </h2>
                        <p className="text-zinc-500 text-base mb-8 leading-relaxed">
                            By the time a topic &ldquo;looks hot,&rdquo; it&apos;s already overcrowded. Most tools show you what already worked — but that window has closed.
                        </p>
                        <div className="space-y-3">
                            <p className="text-xs font-mono text-zinc-600 uppercase mb-3">What most creators do instead</p>
                            <motion.div
                                variants={containerVariants}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true, margin: "-60px" }}
                                className="space-y-3"
                            >
                                {BEFORE.map((item, i) => (
                                    <motion.div key={i} variants={itemVariants} className="flex items-start gap-3 text-zinc-500">
                                        <span className="text-zinc-700 mt-0.5 flex-shrink-0">–</span>
                                        <span className="text-sm">{item}</span>
                                    </motion.div>
                                ))}
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Right — The solution */}
                    <div className="border-l border-[#1e1e22] pl-12 lg:pl-16">
                        <motion.p
                            variants={headingVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-80px" }}
                            className="text-xs font-mono text-emerald-400 tracking-widest uppercase mb-5"
                        >
                            What GapTuber does
                        </motion.p>
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-60px" }}
                            className="space-y-4"
                        >
                            {AFTER.map(item => (
                                <motion.div 
                                    key={item.label} 
                                    variants={rightItemVariants} 
                                    className="flex gap-4 p-4 rounded-xl border border-[#1e1e22]/50 bg-[#111113]/30 hover:bg-[#111113] hover:border-[#2a2a30] transition-colors group"
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.bg}`}>
                                        <item.icon className={`w-5 h-5 ${item.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-zinc-200 mb-1 group-hover:text-white transition-colors">{item.label}</p>
                                        <p className="text-sm text-zinc-500 leading-relaxed group-hover:text-zinc-400 transition-colors">{item.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}
