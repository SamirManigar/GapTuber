"use client";
import { useState, useEffect } from "react";
import { X, CheckCircle2, Loader2, Crown, MapPin } from "lucide-react";
import { toast } from "sonner";

// ── Region detection ─────────────────────────────────────────────────────────
// Detect India via Intl timezone — works without any API call or extra latency.
function detectRegion(): "india" | "global" {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && tz.startsWith("Asia/Kolkata")) return "india";
        // Also catch if locale says India
        const locale = navigator.language ?? "";
        if (locale === "en-IN" || locale.startsWith("hi")) return "india";
    } catch {
        // Safe fallback
    }
    return "global";
}

// ── Types ────────────────────────────────────────────────────────────────────
type Plan = "lite" | "pro" | "lifetime";
type Region = "india" | "global";

// ── Razorpay script loader (idempotent) ──────────────────────────────────────
function loadRazorpayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if ((window as any).Razorpay) {
            resolve();
            return;
        }
        const existing = document.getElementById("razorpay-sdk");
        if (existing) {
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", reject);
            return;
        }
        const script = document.createElement("script");
        script.id = "razorpay-sdk";
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
        document.body.appendChild(script);
    });
}

export function PricingModal({
    isOpen,
    onClose,
    currentTier = "free",
}: {
    isOpen: boolean;
    onClose: () => void;
    currentTier?: "free" | "lite" | "pro" | "lifetime";
}) {
    const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
    // Start with null so the toggle doesn't flash "global" before detection runs
    const [region, setRegion] = useState<Region | null>(null);

    const isLifetime = currentTier === "lifetime";
    const isPro = currentTier === "pro";
    const isLite = currentTier === "lite";

    // Auto-detect region on mount (client-only)
    useEffect(() => {
        setRegion(detectRegion());
    }, []);

    const handleCheckout = async (plan: Plan) => {
        if (!region) return;
        try {
            setLoadingPlan(plan);

            if (region === "global") {
                // ── Lemon Squeezy (USD) ─────────────────────────────────────
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
                // ── Razorpay (INR) ──────────────────────────────────────────
                const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
                if (!razorpayKey) {
                    toast.error("Razorpay is not configured. Please contact support.");
                    setLoadingPlan(null);
                    return;
                }

                // Load SDK (idempotent — safe to call multiple times)
                try {
                    await loadRazorpayScript();
                } catch {
                    toast.error("Failed to load payment SDK. Check your internet connection.");
                    setLoadingPlan(null);
                    return;
                }

                // Create server-side order
                const res = await fetch("/api/razorpay/order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ plan }),
                });

                if (!res.ok) {
                    const error = await res.text();
                    toast.error(error || "Failed to create payment order. Please try again.");
                    setLoadingPlan(null);
                    return;
                }

                const data = await res.json() as {
                    id: string;
                    currency: string;
                    amount: number;
                };

                if (!data.id) {
                    toast.error("Server returned an invalid order. Please try again.");
                    setLoadingPlan(null);
                    return;
                }

                const planLabel =
                    plan === "lite" ? "Creator Lite" :
                    plan === "pro"  ? "Creator Pro"  :
                                     "Pro Credit Pack";

                const options = {
                    key: razorpayKey,
                    amount: data.amount,
                    currency: data.currency,
                    name: "GapTuber",
                    description: `Upgrade to ${planLabel}`,
                    image: "/logo.png",
                    order_id: data.id,
                    handler: async function (response: {
                        razorpay_payment_id: string;
                        razorpay_order_id: string;
                        razorpay_signature: string;
                    }) {
                        try {
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

                            toast.success("🎉 Payment verified! Upgrading your account…");
                            setTimeout(() => window.location.reload(), 1500);
                        } catch {
                            toast.error("Could not verify payment. Please contact support.");
                            setLoadingPlan(null);
                        }
                    },
                    prefill: {},
                    theme: { color: "#10b981" },
                    modal: {
                        ondismiss: () => setLoadingPlan(null),
                        escape: true,
                        backdropclose: false,
                    },
                };

                const rzp = new (window as any).Razorpay(options);
                rzp.on("payment.failed", function (response: { error: { description: string } }) {
                    toast.error("Payment failed: " + response.error.description);
                    setLoadingPlan(null);
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

    // While region is being detected, show a neutral loading state
    const isIndia = region === "india";
    const isGlobal = region === "global";

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

                    {/* Region detected badge + manual toggle */}
                    {region === null ? (
                        <div className="inline-flex items-center gap-2 text-sm text-zinc-500">
                            <Loader2 className="w-4 h-4 animate-spin" /> Detecting your region…
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            {/* Auto-detected badge */}
                            <div className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600 font-mono">
                                <MapPin className="w-3 h-3" />
                                Auto-detected: {isIndia ? "India 🇮🇳" : "International 🌍"}
                                <span className="text-zinc-700">·</span>
                                <button
                                    onClick={() => setRegion(isIndia ? "global" : "india")}
                                    className="text-emerald-500 hover:text-emerald-400 underline underline-offset-2 transition-colors"
                                >
                                    Switch to {isIndia ? "USD" : "INR"}
                                </button>
                            </div>

                            {/* Gateway toggle */}
                            <div className="inline-flex items-center bg-[#1a1a1e] border border-[#2a2a30] rounded-lg p-1 mt-1">
                                <button
                                    onClick={() => setRegion("global")}
                                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${isGlobal ? "bg-[#2a2a30] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
                                >
                                    🌍 Global (USD)
                                </button>
                                <button
                                    onClick={() => setRegion("india")}
                                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors flex items-center gap-1.5 ${isIndia ? "bg-[#2a2a30] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
                                >
                                    🇮🇳 India (UPI / Razorpay)
                                </button>
                            </div>

                            {isGlobal && (
                                <p className="text-xs text-zinc-500 mt-1">
                                    Powered by Lemon Squeezy · All taxes handled · Secure checkout
                                </p>
                            )}
                            {isIndia && (
                                <p className="text-xs text-zinc-500 mt-1">
                                    Powered by Razorpay · UPI, Cards, Netbanking accepted
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Pricing Tiers */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Lite Tier */}
                    <div className="bg-[#1a1a1e] border border-[#2a2a30] rounded-xl p-6 flex flex-col hover:border-zinc-500/30 transition-colors">
                        <h3 className="text-lg font-bold text-zinc-200">Creator Lite</h3>
                        <div className="mt-4 mb-6 flex items-end">
                            <span className="text-4xl font-bold text-white">
                                {region === null ? "…" : isIndia ? "₹299" : "$5"}
                            </span>
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
                            disabled={region === null || loadingPlan !== null || isLite || isPro || isLifetime}
                            className={`w-full py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                                isLite || isPro || isLifetime
                                    ? "bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 cursor-not-allowed"
                                    : "bg-zinc-200 hover:bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.1)] disabled:opacity-70 disabled:cursor-not-allowed"
                            }`}
                        >
                            {isLite || isPro || isLifetime
                                ? <><Crown className="w-4 h-4" /> Current Plan</>
                                : loadingPlan === "lite"
                                    ? <Loader2 className="w-5 h-5 animate-spin" />
                                    : isIndia ? "Subscribe Now 🇮🇳" : "Subscribe Now →"
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
                            <span className="text-4xl font-bold text-white">
                                {region === null ? "…" : isIndia ? "₹799" : "$15"}
                            </span>
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
                            disabled={region === null || loadingPlan !== null || isPro || isLifetime}
                            className={`w-full py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                                isPro || isLifetime
                                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 cursor-not-allowed"
                                    : "bg-amber-500 hover:bg-amber-600 text-black shadow-[0_0_15px_rgba(245,158,11,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
                            }`}
                        >
                            {isPro || isLifetime
                                ? <><Crown className="w-4 h-4" /> Current Plan</>
                                : loadingPlan === "pro"
                                    ? <Loader2 className="w-5 h-5 animate-spin" />
                                    : isIndia ? "Subscribe Now 🇮🇳" : "Subscribe Now →"
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
                            <span className="text-4xl font-bold text-white">
                                {region === null ? "…" : isIndia ? "₹4,999" : "$99"}
                            </span>
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
                            disabled={region === null || loadingPlan !== null || isLifetime}
                            className={`w-full py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                                isLifetime
                                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-not-allowed"
                                    : "bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-70 disabled:cursor-not-allowed"
                            }`}
                        >
                            {isLifetime
                                ? <><Crown className="w-4 h-4" /> Current Plan</>
                                : loadingPlan === "lifetime"
                                    ? <Loader2 className="w-5 h-5 animate-spin" />
                                    : isIndia ? "Get Credit Pack 🇮🇳" : "Get Credit Pack →"
                            }
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-[#0a0a0c] border-t border-[#2a2a30] py-3 text-xs text-center text-zinc-500">
                    <span className="text-emerald-500">⚡</span> Need more credits?{" "}
                    <strong className="text-zinc-400">Credit Booster Packs</strong> are coming soon so you never run out!
                </div>
            </div>
        </div>
    );
}
