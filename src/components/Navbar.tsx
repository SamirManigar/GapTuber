"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
    const { data: session } = useSession();

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0c0c0e] border-b border-[#1e1e22]">
            <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
                {/* Wordmark */}
                <Link href="/" className="flex items-center gap-2">
                    <img src="/logo.svg" alt="GapTuber Logo" className="h-7 w-auto relative -top-[1px]" />
                    <span className="text-sm font-bold text-white font-mono tracking-tight">GapTuber</span>
                    <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">beta</span>
                </Link>

                {/* Nav */}
                <div className="hidden md:flex items-center gap-7 text-sm text-zinc-500">
                    <a href="#why-gaptuber" className="hover:text-zinc-200 transition-colors">Compare</a>
                    <a href="#how-it-works" className="hover:text-zinc-200 transition-colors">How it works</a>
                    <a href="#sample-output" className="hover:text-zinc-200 transition-colors">Example</a>
                </div>

                {/* Auth */}
                <div className="flex items-center gap-4 text-sm">
                    {session ? (
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                                Dashboard →
                            </Link>
                            <button
                                onClick={() => signOut({ callbackUrl: "/" })}
                                className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs"
                            >
                                Sign out
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <Link href="/auth/signin" className="text-zinc-500 hover:text-zinc-200 transition-colors">
                                Sign in
                            </Link>
                            <Link
                                href="/auth/signin"
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-1.5 rounded-md font-medium transition-colors"
                            >
                                Get started
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
