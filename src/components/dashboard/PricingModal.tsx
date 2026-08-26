"use client";
import { useState } from "react";
import { X, CheckCircle2, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";
import { env } from "@/env";

export function PricingModal({ isOpen, onClose, currentTier = "free" }: { isOpen: boolean; onClose: () => void; currentTier?: "free" | "lite" | "pro" | "lifetime" }) {
    const [loadingPlan, setLoadingPlan] = useState<"lite" | "pro" | "lifetime" | null>(null);
    const [region, setRegion] = useState<"india" | "global">("global");
    const isLifetime = currentTier === "lifetime";
    const isPro = currentTier === "pro";
    const isLite = currentTier === "lite";

    const handleCheckout = async (plan: "lite" | "pro" | "lifetime") => {
        try {
            setLoadingPlan(plan);
            if (region === "global") {
                const res = await fetch("/api/lemonsqueezy/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ plan }),
                });

                if (!res.ok) {
                    const error = await res.text();
                    toast.error(error || "Failed to initiate checkout");
                    setLoadingPlan(null);
                    return;
                }

                const data = await res.json();
                if (data.url) {
                    window.location.href = data.url;
                } else {
                    toast.error("Invalid response from server");
                    setLoadingPlan(null);
                }
            } else {
                // Load Razorpay Script
                if (!(window as any).Razorpay) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement("script");
                        script.src = "https://checkout.razorpay.com/v1/checkout.js";
                        script.onload = resolve;
                        script.onerror = reject;
                        document.body.appendChild(script);
                    });
                }

                const res = await fetch("/api/razorpay/order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ plan }),
                });

                if (!res.ok) {
                    const error = await res.text();
                    throw new Error(error || "Failed to create Razorpay order");
                }

                const data = await res.json();

                const options = {
                    key: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                    amount: data.amount,
                    currency: data.currency,
                    name: "GapTuber",
                    description: `Upgrade to ${plan === 'pro' ? 'Creator Pro' : 'Lifetime Deal'}`,
                    order_id: data.id,
                    handler: async function (response: {
                        razorpay_payment_id: string;
                        razorpay_order_id: string;
                        razorpay_signature: string;
                    }) {
                        try {
                            // Verify the payment signature on the backend
                            const verifyRes = await fetch("/api/razorpay/verify-payment", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    razorpay_payment_id: response.razorpay_payment_id,
                                    razorpay_order_id: response.razorpay_order_id,
                                    razorpay_signature: response.razorpay_signature,
                                    plan,
                                }),
                            });

                            if (!verifyRes.ok) {
                                const errText = await verifyRes.text();
                                toast.error("Payment verification failed: " + errText);
                                setLoadingPlan(null);
                                return;
                            }

                            toast.success("Payment verified! Upgrading your account...");
                            setTimeout(() => window.location.reload(), 1500);
                        } catch {
                            toast.error("Could not verify payment. Please contact support.");
                            setLoadingPlan(null);
                        }
                    },
                    theme: {
                        color: "#10b981",
                    },
                    modal: {
                        ondismiss: function() {
                            setLoadingPlan(null);
                        }
                    }
                };

                const rzp = new (window as any).Razorpay(options);
                rzp.on("payment.failed", function (response: any) {
                    toast.error("Payment failed: " + response.error.description);
                });
                rzp.open();
            }
        } catch (error) {
            console.error("Checkout error:", error);
            toast.error("Something went wrong. Please try again.");
            setLoadingPlan(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#111113] border border-[#2a2a30] rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 text-center border-b border-[#2a2a30] relative">
                    <button onClick={onClose} className="absolute right-4 top-4 text-zinc-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-bold text-white mb-2">Upgrade to GapTuber Pro</h2>
                    <p className="text-zinc-400 mb-6">Unlock the full power of AI to dominate your niche.</p>

                    {/* Dual Gateway Toggle */}
                    <div className="inline-flex items-center bg-[#1a1a1e] border border-[#2a2a30] rounded-lg p-1">
                        <button
                            onClick={() => setRegion("global")}
                            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${region === "global" ? "bg-[#2a2a30] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
                        >
                            🌍 Global (USD)
                        </button>
                        <button
                            onClick={() => setRegion("india")}
                            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors flex items-center gap-1.5 ${region === "india" ? "bg-[#2a2a30] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
                        >
                            🇮🇳 India (UPI)
                        </button>
                    </div>

                    {region === "global" && (
                        <p className="text-xs text-zinc-500 mt-3">
                            Powered by Lemon Squeezy · All taxes handled · Secure checkout
                        </p>
                    )}
                </div>

                {/* Pricing Tiers */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Lite Tier */}
                    <div className="bg-[#1a1a1e] border border-[#2a2a30] rounded-xl p-6 flex flex-col hover:border-zinc-500/30 transition-colors">
                        <h3 className="text-lg font-bold text-zinc-200">Creator Lite</h3>
                        <div className="mt-4 mb-6 flex items-end">
                            <span className="text-4xl font-bold text-white">{region === 'india' ? '₹299' : '$5'}</span>
                            <span className="text-zinc-500 ml-1 mb-1">/mo</span>
                        </div>
                        <p className="text-sm text-zinc-400 mb-6 flex-1">
                            Hobbyists uploading 1 video/week.
                        </p>
                        <ul className="space-y-3 mb-8">
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 100 AI Credits / month
                            </li>
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Limited Competitors
                            </li>
                        </ul>
                        <button
                            onClick={() => handleCheckout("lite")}
                            disabled={loadingPlan !== null || isLite || isPro || isLifetime}
                            className={`w-full py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                                isLite || isPro || isLifetime
                                    ? "bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 cursor-not-allowed"
                                    : "bg-zinc-200 hover:bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.1)] disabled:opacity-70 disabled:cursor-not-allowed"
                            }`}
                        >
                            {isLite || isPro || isLifetime
                                ? <><Crown className="w-4 h-4" /> Current Plan</>
                                : loadingPlan === "lite" ? <Loader2 className="w-5 h-5 animate-spin" /> : (region === "india" ? "Subscribe Now" : "Subscribe Now →")
                            }
                        </button>
                    </div>

                    {/* Pro Tier */}
                    <div className="bg-[#1a1a1e] border border-amber-500/50 rounded-xl p-6 flex flex-col relative shadow-[0_0_30px_rgba(245,158,11,0.1)] scale-[1.02] z-10">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                            Most Popular
                        </div>
                        <h3 className="text-lg font-bold text-amber-500">Creator Pro</h3>
                        <div className="mt-4 mb-6 flex items-end">
                            <span className="text-4xl font-bold text-white">{region === 'india' ? '₹799' : '$15'}</span>
                            <span className="text-zinc-500 ml-1 mb-1">/mo</span>
                        </div>
                        <p className="text-sm text-zinc-400 mb-6 flex-1">
                            Active creators uploading multiple times a week.
                        </p>
                        <ul className="space-y-3 mb-8">
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-amber-500" /> 500 AI Credits / month
                            </li>
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-amber-500" /> Unlimited Competitors
                            </li>
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-amber-500" /> Priority Support
                            </li>
                        </ul>
                        <button
                            onClick={() => handleCheckout("pro")}
                            disabled={loadingPlan !== null || isPro || isLifetime}
                            className={`w-full py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                                isPro || isLifetime
                                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 cursor-not-allowed"
                                    : "bg-amber-500 hover:bg-amber-600 text-black shadow-[0_0_15px_rgba(245,158,11,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
                            }`}
                        >
                            {isPro || isLifetime
                                ? <><Crown className="w-4 h-4" /> Current Plan</>
                                : loadingPlan === "pro" ? <Loader2 className="w-5 h-5 animate-spin" /> : (region === "india" ? "Subscribe Now" : "Subscribe Now →")
                            }
                        </button>
                    </div>

                    {/* Pro Credit Pack */}
                    <div className="bg-[#1a1a1e] border border-emerald-500/50 rounded-xl p-6 flex flex-col relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap">
                            No Subscription
                        </div>
                        <h3 className="text-lg font-bold text-emerald-500">Pro Credit Pack</h3>
                        <div className="mt-4 mb-6 flex flex-col">
                            <span className="text-4xl font-bold text-white">{region === 'india' ? '₹4,999' : '$99'}</span>
                            <span className="text-zinc-500 text-sm mt-1">One-time</span>
                        </div>
                        <p className="text-sm text-zinc-400 mb-6 flex-1">
                            Agencies or power users who hate subscriptions.
                        </p>
                        <ul className="space-y-3 mb-8">
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 5,000 Lifetime Credits
                            </li>
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> All Future Pro Features
                            </li>
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Exclusive Discord Role
                            </li>
                        </ul>
                        <button
                            onClick={() => handleCheckout("lifetime")}
                            disabled={loadingPlan !== null || isLifetime}
                            className={`w-full py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                                isLifetime
                                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-not-allowed"
                                    : "bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-70 disabled:cursor-not-allowed"
                            }`}
                        >
                            {isLifetime
                                ? <><Crown className="w-4 h-4" /> Current Plan</>
                                : loadingPlan === "lifetime" ? <Loader2 className="w-5 h-5 animate-spin" /> : (region === "india" ? "Get Credit Pack" : "Get Credit Pack →")
                            }
                        </button>
                    </div>
                </div>

                {/* FAQ / Credit Info Section */}
                <div className="bg-[#0a0a0c] border-t border-[#2a2a30] py-3 text-xs text-center text-zinc-500">
                    <span className="text-emerald-500">⚡</span> Need more credits? <strong className="text-zinc-400">Credit Booster Packs</strong> are coming soon so you never run out!
                </div>
            </div>
        </div>
    );
}
