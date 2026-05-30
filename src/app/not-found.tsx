import Link from "next/link";

export const metadata = {
    title: "404 — Page Not Found | GapTuber",
    description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
            <div className="text-center max-w-lg">
                {/* Glowing 404 */}
                <div className="relative mb-8">
                    <p
                        className="text-[8rem] font-black text-transparent bg-clip-text leading-none select-none"
                        style={{
                            backgroundImage: "linear-gradient(135deg, #8b5cf6, #6366f1, #3b82f6)",
                            filter: "drop-shadow(0 0 40px rgba(139,92,246,0.4))",
                        }}
                    >
                        404
                    </p>
                    <div
                        className="absolute inset-0 blur-3xl opacity-20"
                        style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }}
                    />
                </div>

                <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
                <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                    Looks like this page took a content gap too literally and went missing.
                    <br />
                    Let&apos;s get you back to finding real gaps.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/dashboard"
                        className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm rounded-lg transition-colors"
                    >
                        Go to Dashboard
                    </Link>
                    <Link
                        href="/"
                        className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm rounded-lg transition-colors border border-zinc-700/50"
                    >
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
