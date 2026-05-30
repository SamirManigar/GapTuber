"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function RootError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mx-auto mb-5">
                    <span className="text-2xl">⚠️</span>
                </div>
                <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
                <p className="text-zinc-500 text-sm mb-2 font-mono">
                    {error.message || "An unexpected error occurred."}
                </p>
                {error.digest && (
                    <p className="text-zinc-700 text-xs mb-6 font-mono">ID: {error.digest}</p>
                )}
                <button
                    onClick={reset}
                    className="bg-emerald-600 text-white px-6 py-2.5 rounded font-medium text-sm hover:bg-emerald-500 transition-colors"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
