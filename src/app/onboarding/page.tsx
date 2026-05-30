"use client";

import { motion } from "framer-motion";
import { Video, Youtube, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";

export default function OnboardingRoleSelection() {
    return (
        <div className="flex flex-col items-center text-center space-y-10 max-w-3xl mx-auto">
            {/* Header */}
            <div className="space-y-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-widest border border-emerald-500/20 mb-2"
                >
                    <TrendingUp className="w-3 h-3" /> YouTube Intelligence Platform
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="text-4xl md:text-5xl font-extrabold tracking-tight text-white"
                >
                    Welcome to{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">
                        GapTuber
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-lg text-zinc-400 max-w-2xl mx-auto"
                >
                    Let&apos;s tailor your experience. Where are you in your YouTube journey?
                </motion.p>
            </div>

            {/* Cards */}
            <div className="grid md:grid-cols-2 gap-5 w-full pt-4">
                {/* Starting Fresh */}
                <Link href="/onboarding/new-tuber" className="block w-full">
                    <motion.div
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="group relative flex flex-col items-center p-8 bg-[#0f1a14] border border-emerald-900/50 rounded-2xl hover:border-emerald-500/60 hover:shadow-xl hover:shadow-emerald-500/10 transition-all cursor-pointer h-full text-left"
                    >
                        {/* Corner glow */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all" />

                        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 transition-colors rounded-2xl flex items-center justify-center mb-5 border border-emerald-500/20">
                            <Video className="w-8 h-8" />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-3">Starting Fresh</h3>
                        <p className="text-zinc-500 text-sm leading-relaxed group-hover:text-zinc-400 transition-colors">
                            I want to create a brand new channel. Help me find a niche, topic, and generate my branding.
                        </p>

                        <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Zap className="w-3 h-3" /> Build my channel blueprint →
                        </div>
                    </motion.div>
                </Link>

                {/* Existing Creator */}
                <Link href="/onboarding/existing-tuber" className="block w-full">
                    <motion.div
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="group relative flex flex-col items-center p-8 bg-[#0c0e18] border border-zinc-800 rounded-2xl hover:border-emerald-700/50 hover:shadow-xl hover:shadow-emerald-500/8 transition-all cursor-pointer h-full text-left"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/3 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/8 transition-all" />

                        <div className="w-16 h-16 bg-zinc-800 text-zinc-400 group-hover:bg-emerald-500/15 group-hover:text-emerald-400 transition-colors rounded-2xl flex items-center justify-center mb-5 border border-zinc-700 group-hover:border-emerald-700/50">
                            <Youtube className="w-8 h-8" />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-3">Existing Creator</h3>
                        <p className="text-zinc-500 text-sm leading-relaxed group-hover:text-zinc-400 transition-colors">
                            I already have a channel. Analyze my content and give me data-driven viral ideas.
                        </p>

                        <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TrendingUp className="w-3 h-3" /> Analyze my channel gaps →
                        </div>
                    </motion.div>
                </Link>
            </div>

            {/* Bottom note */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xs text-zinc-700 font-mono"
            >
                You can always add more channels later from your dashboard.
            </motion.p>
        </div>
    );
}
