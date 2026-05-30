"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pickaxe, Sparkles, Database, Loader2, CheckCircle2, AlertCircle, ArrowRight, Coins, Zap } from "lucide-react";

interface MinedIdea {
    title: string;
    hook: string;
    format: string;
    whyItWorks: string;
    estimatedViewPotential: "high" | "medium" | "low";
    targetAudience: string;
    isMined?: boolean;
    source?: string;
}

export function CommentMiner({ channelId }: { channelId: string }) {
    const [isMining, setIsMining] = useState(false);
    const [result, setResult] = useState<MinedIdea[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleMine = async () => {
        setIsMining(true);
        setError(null);
        setMessage(null);
        setResult(null);
        try {
            const res = await fetch("/api/mine-comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelId }),
            });
            const data = await res.json();
            if (res.ok) {
                window.dispatchEvent(new CustomEvent("credit-update", { detail: { deduct: 1 } }));
                setResult(data.ideas);
                if (data.message) {
                    setMessage(data.message);
                }
            } else {
                setError(data.error || "Failed to mine comments");
            }
        } catch (e) {
            setError("Connection error during mining");
        } finally {
            setIsMining(false);
        }
    };

    return (
        <div className="bg-[#111113]/40 border border-[#1e1e22]/50 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden group">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full -mr-32 -mt-32 transition-colors group-hover:bg-amber-500/10" />
            
            <div className="flex flex-col lg:flex-row items-center gap-8 relative z-10">
                <div className="flex-1 space-y-4 text-center lg:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                        <Coins className="w-4 h-4 text-amber-500" />
                        <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">Audience_Mining_Active</span>
                    </div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
                        Turn your <span className="text-amber-500">Comments</span> into viral concepts.
                    </h2>
                    <p className="text-sm text-zinc-500 max-w-md">
                        Our AI mines your latest 50+ comments to find hidden pain points and video requests your fans are begging for.
                    </p>
                    
                    <div className="pt-4">
                        <button
                            onClick={handleMine}
                            disabled={isMining}
                            className="relative px-8 py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-[#1e1e22] text-black font-bold rounded-xl transition-all flex items-center gap-3 overflow-hidden group/btn mx-auto lg:mx-0"
                        >
                            {isMining ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Digging for Gold...</span>
                                </>
                            ) : (
                                <>
                                    <Pickaxe className="w-5 h-5 transition-transform group-hover/btn:-rotate-45" />
                                    <span>Start Mining <Zap className="w-4 h-4 text-amber-900 fill-amber-900 inline -mr-1" /> 1</span>
                                </>
                            )}
                            
                            {isMining && (
                                <motion.div 
                                    className="absolute inset-0 bg-white/20"
                                    initial={{ x: "-100%" }}
                                    animate={{ x: "100%" }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                />
                            )}
                        </button>
                    </div>
                </div>

                <div className="w-full lg:w-[400px] shrink-0">
                    <AnimatePresence mode="wait">
                        {!result && !error && !isMining && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-[#0c0c0e] border border-[#1e1e22] rounded-2xl p-6 border-dashed flex flex-col items-center justify-center text-center space-y-4 h-[240px]"
                            >
                                <Database className="w-10 h-10 text-zinc-700" />
                                <div>
                                    <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Ready_To_Analyze</p>
                                    <p className="text-[10px] text-zinc-600 mt-1">Connect your channel and click Start to begin extraction.</p>
                                </div>
                            </motion.div>
                        )}

                        {isMining && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="bg-[#0c0c0e] border border-amber-500/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-6 h-[240px]"
                            >
                                <div className="relative">
                                    <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full animate-pulse" />
                                    <div className="relative grid grid-cols-2 gap-2">
                                        {[...Array(4)].map((_, i) => (
                                            <motion.div
                                                key={i}
                                                animate={{ 
                                                    scale: [1, 1.2, 1],
                                                    opacity: [0.3, 1, 0.3]
                                                }}
                                                transition={{ 
                                                    duration: 1, 
                                                    repeat: Infinity, 
                                                    delay: i * 0.2 
                                                }}
                                                className="w-4 h-4 bg-amber-500 rounded-sm rotate-45"
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-mono text-amber-500 uppercase animate-pulse">Extracting_Value</p>
                                    <div className="flex gap-1 justify-center">
                                        {[...Array(3)].map((_, i) => (
                                            <div key={i} className="w-1.5 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                <motion.div 
                                                    animate={{ y: ["100%", "0%", "-100%"] }}
                                                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                                    className="w-full h-full bg-amber-500"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {result && (
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 h-[240px] overflow-hidden flex flex-col"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold">{result.length}_Gems_Discovered</span>
                                </div>
                                {message && (
                                    <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-mono text-amber-400">
                                        <AlertCircle className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />
                                        {message}
                                    </div>
                                )}
                                <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                    {result.map((idea, i) => (
                                        <div key={i} className="p-3 bg-black/40 border border-emerald-500/10 rounded-lg group/item hover:border-emerald-500/30 transition-colors">
                                            <p className="text-[10px] text-zinc-500 font-mono mb-1">DISCOVERY_{i+1}</p>
                                            <h4 className="text-[13px] font-bold text-white line-clamp-1">{idea.title}</h4>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-4 border-t border-emerald-500/10 mt-auto flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Sent_To_Vault</span>
                                    <ArrowRight className="w-3 h-3 text-zinc-500" />
                                </div>
                            </motion.div>
                        )}

                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 h-[240px]"
                            >
                                <AlertCircle className="w-8 h-8 text-red-500" />
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-red-500 uppercase tracking-widest">Mining_Failed</p>
                                    <p className="text-[10px] text-zinc-500">{error}</p>
                                </div>
                                <button 
                                    onClick={handleMine}
                                    className="text-[10px] font-mono text-zinc-400 underline hover:text-zinc-200"
                                >
                                    Try_Again
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
