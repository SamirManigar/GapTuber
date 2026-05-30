import { X, CheckCircle2, Zap } from "lucide-react";

export function PricingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
                    <p className="text-zinc-400">Unlock the full power of AI to dominate your niche.</p>
                </div>

                {/* Pricing Tiers */}
                <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Free Tier */}
                    <div className="bg-[#1a1a1e] border border-[#2a2a30] rounded-xl p-6 flex flex-col">
                        <h3 className="text-lg font-bold text-zinc-300">Starter</h3>
                        <div className="mt-4 mb-6">
                            <span className="text-4xl font-bold text-white">$0</span>
                        </div>
                        <p className="text-sm text-zinc-400 mb-6 flex-1">
                            Perfect for exploring the dashboard and basic scans.
                        </p>
                        <ul className="space-y-3 mb-8">
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 20 One-time AI Credits
                            </li>
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Basic Competitor Tracking
                            </li>
                        </ul>
                        <button disabled className="w-full py-2.5 rounded-lg border border-[#2a2a30] text-zinc-500 font-bold bg-[#111113]">
                            Current Plan
                        </button>
                    </div>

                    {/* Pro Tier */}
                    <div className="bg-[#1a1a1e] border border-amber-500/50 rounded-xl p-6 flex flex-col relative shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                            Most Popular
                        </div>
                        <h3 className="text-lg font-bold text-amber-500">Creator Pro</h3>
                        <div className="mt-4 mb-6">
                            <span className="text-4xl font-bold text-white">$15</span>
                            <span className="text-zinc-500">/mo</span>
                        </div>
                        <p className="text-sm text-zinc-400 mb-6 flex-1">
                            The ultimate toolkit for growing channels actively uploading.
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
                        <button className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                            Subscribe Now
                        </button>
                    </div>

                    {/* Lifetime Tier */}
                    <div className="bg-[#1a1a1e] border border-emerald-500/50 rounded-xl p-6 flex flex-col relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                            Early Bird
                        </div>
                        <h3 className="text-lg font-bold text-emerald-500">Lifetime Deal</h3>
                        <div className="mt-4 mb-6">
                            <span className="text-4xl font-bold text-white">$99</span>
                            <span className="text-zinc-500 text-sm"> one-time</span>
                        </div>
                        <p className="text-sm text-zinc-400 mb-6 flex-1">
                            Pay once, use forever. Never worry about monthly subscriptions.
                        </p>
                        <ul className="space-y-3 mb-8">
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 5,000 AI Credits
                            </li>
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> All Future Pro Features
                            </li>
                            <li className="flex items-center gap-2 text-sm text-zinc-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Exclusive Discord Role
                            </li>
                        </ul>
                        <button className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors">
                            Get Lifetime Access
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
