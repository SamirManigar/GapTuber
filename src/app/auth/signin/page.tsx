"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

function SignInContent() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-emerald-600/15 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(124,58,237,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(124,58,237,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
            </div>

            <div className="w-full max-w-md relative">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2.5">
                            <img src="/logo.svg" alt="GapTuber Logo" className="w-10 h-10 object-contain" />
                            <span className="text-2xl font-extrabold text-white">GapTuber</span>
                        </div>
                        <span className="text-xs text-gray-600 font-medium tracking-wider">by AurionStack</span>
                    </Link>
                </div>

                {/* Card */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
                    <h1 className="text-2xl font-bold text-white mb-2 text-center">
                        Welcome back
                    </h1>
                    <p className="text-slate-400 text-sm text-center mb-8">
                        Sign in to run your gap scans and access your dashboard.
                    </p>

                    {/* Google OAuth */}
                    <button
                        onClick={() => signIn("google", { callbackUrl })}
                        className="w-full flex items-center justify-center gap-3 border border-white/10 bg-white/5 rounded-xl px-5 py-3.5 text-slate-300 font-medium hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-white transition-all group"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>

                    <p className="text-center text-xs text-slate-600 mt-6">
                        By continuing, you agree to our{" "}
                        <Link href="/terms" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                            Terms
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                            Privacy Policy
                        </Link>
                        .
                    </p>
                </div>

                <p className="text-center text-sm text-slate-600 mt-6">
                    No credit card required.
                </p>
            </div>
        </div>
    );
}

export default function SignInPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center" />}>
            <SignInContent />
        </Suspense>
    );
}
