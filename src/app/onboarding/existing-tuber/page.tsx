"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Youtube, BarChart3, Lock, ShieldCheck, ArrowLeft } from "lucide-react";
import { useState } from "react";

export default function ExistingTuberPage() {
    const router = useRouter();
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnect = () => {
        setIsConnecting(true);
        // Set cookie to instruct auth.ts to save tokens for onboarding
        document.cookie = "onboarding_youtube=true; path=/; max-age=3600";
        // Clear any existing connection intent just in case
        document.cookie = "connect_channel_id=; path=/; max-age=0";
        
        signIn("google", { callbackUrl: "/onboarding/existing-tuber/processing" });
    };

    return (
        <div className="max-w-2xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#111113] border border-[#1e1e22] rounded-2xl p-8 md:p-12"
            >
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Youtube className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white mb-4 tracking-tight">Connect Your Channel</h2>
                    <p className="text-zinc-500 text-base leading-relaxed max-w-md mx-auto">
                        Securely connect your Google account. GapTuber will acquire your channel's public statistics and recent performance data to automatically generate highly tailored video ideas.
                    </p>
                </div>

                <div className="space-y-6 max-w-sm mx-auto">
                    <div className="bg-[#0c0c0e] border border-[#1e1e22] rounded-xl p-4 space-y-3 mb-8">
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-zinc-400 leading-snug">
                                <strong className="text-zinc-200">Read-Only Access.</strong> We only view your channel statistics and public videos.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <Lock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-zinc-400 leading-snug">
                                <strong className="text-zinc-200">Bank-Grade Encryption.</strong> Your access tokens are encrypted before being stored.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <BarChart3 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-zinc-400 leading-snug">
                                <strong className="text-zinc-200">Data-Driven Ideation.</strong> We use this real data to compute proven content gaps.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleConnect}
                        disabled={isConnecting}
                        className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                    >
                        {isConnecting ? (
                            "Connecting to Google..."
                        ) : (
                            <>
                                <Youtube className="w-5 h-5" />
                                Connect with YouTube
                            </>
                        )}
                    </button>

                    <div className="text-center pt-2">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="text-zinc-600 hover:text-zinc-400 text-sm font-medium transition-colors flex items-center gap-1.5 mx-auto"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Go back
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
