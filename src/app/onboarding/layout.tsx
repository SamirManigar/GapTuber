import { ReactNode } from "react";
import Link from "next/link";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
            {/* Ambient background glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[5%] w-[500px] h-[500px] bg-emerald-400/4 rounded-full blur-[100px]" />
            </div>

            <header className="relative z-10 w-full px-8 py-5 flex justify-center items-center border-b border-white/5">
                <Link href="/" className="flex items-center gap-2.5">
                    <img src="/logo.svg" alt="GapTuber Logo" className="h-8 w-auto" />
                    <span className="text-xl font-bold text-white font-mono tracking-tight">GapTuber</span>
                    <span className="text-[10px] font-mono text-zinc-600 border border-zinc-800 px-1.5 py-0.5 rounded">beta</span>
                </Link>
            </header>

            <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
                <div className="w-full max-w-4xl">
                    {children}
                </div>
            </main>

            <footer className="relative z-10 py-4 text-center text-xs text-zinc-700 font-mono border-t border-white/5">
                GapTuber by Aurion Stack — Find YouTube gaps before your competitors do.
            </footer>
        </div>
    );
}
