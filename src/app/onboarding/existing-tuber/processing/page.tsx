"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Search, Zap, CheckCircle2, AlertCircle } from "lucide-react";

const STEPS = [
    { id: 1, label: "Acquiring YouTube channel access..." },
    { id: 2, label: "Fetching public statistics and recent videos..." },
    { id: 3, label: "Synthesizing market positioning..." },
    { id: 4, label: "Generating data-driven video ideas..." },
    { id: 5, label: "Finalizing project workspace..." }
];

export default function ProcessingPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Fake progress animation while API runs
        const interval = setInterval(() => {
            setCurrentStep((prev) => (prev < 4 ? prev + 1 : prev));
        }, 3000);

        const setupChannel = async () => {
            try {
                const res = await fetch("/api/onboarding/youtube-create", { method: "POST" });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Failed to setup channel");
                }
                
                const data = await res.json();
                setCurrentStep(5);
                
                // Add a small delay to show the final step completed
                setTimeout(() => {
                    router.push(`/dashboard?channelId=${data.channelId}`);
                }, 1000);
            } catch (err: any) {
                setError(err.message || "An unexpected error occurred");
                clearInterval(interval);
            }
        };

        setupChannel();

        return () => clearInterval(interval);
    }, [router]);

    if (error) {
        return (
            <div className="max-w-md mx-auto mt-20">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#111113] border border-red-500/20 rounded-2xl p-10 text-center"
                >
                    <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="text-white font-bold mb-2">Connection Failed</h3>
                    <p className="text-zinc-500 text-sm mb-6 font-mono leading-relaxed">{error}</p>
                    <button
                        onClick={() => router.push("/onboarding/existing-tuber")}
                        className="bg-[#1e1e22] hover:bg-[#2a2a30] text-zinc-200 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    >
                        Try Again
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-20">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#111113] border border-[#1e1e22] rounded-2xl p-10 text-center relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-[#1e1e22]">
                    <motion.div 
                        className="h-full bg-emerald-500"
                        animate={{ width: `${(currentStep / STEPS.length) * 100}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>

                <div className="relative mb-8 w-24 h-24 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-full" />
                    <div className="absolute inset-2 border-2 border-emerald-500/40 rounded-full border-t-emerald-400 animate-spin" style={{ animationDuration: '3s' }} />
                    <div className="absolute inset-4 border-2 border-emerald-500/60 rounded-full border-b-emerald-400 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
                    <Zap className="relative z-10 w-8 h-8 text-emerald-400 animate-pulse" />
                </div>

                <h2 className="text-xl font-bold text-white mb-6">GapTuber Engine Running</h2>
                
                <div className="space-y-3 text-left max-w-[280px] mx-auto">
                    {STEPS.map((step) => (
                        <div key={step.id} className="flex items-center gap-3">
                            {currentStep > step.id ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : currentStep === step.id ? (
                                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                            ) : (
                                <div className="w-4 h-4 rounded-full border border-[#2a2a30] shrink-0" />
                            )}
                            <span className={`text-xs font-mono transition-colors ${
                                currentStep > step.id ? "text-zinc-500" :
                                currentStep === step.id ? "text-emerald-400 font-bold" :
                                "text-zinc-700"
                            }`}>
                                {step.label}
                            </span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
