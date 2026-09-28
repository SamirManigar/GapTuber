import Link from "next/link";

const LINKS = [
    { href: "#how-it-works", label: "How it works" },
    { href: "#why-gaptuber", label: "Compare" },
    { href: "#sample-output", label: "Example" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "mailto:hello@aurionstack.dev", label: "Contact" },
];

export default function Footer() {
    return (
        <footer className="bg-[#0c0c0e] border-t border-[#1e1e22] px-5 py-10">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                {/* Wordmark */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-white font-mono">GapTuber</span>
                        <span className="text-[10px] font-mono text-zinc-700 border border-zinc-800 px-1.5 py-0.5 rounded">by AurionStack</span>
                    </div>
                    <p className="text-xs text-zinc-700 max-w-[220px]">
                        Statistical gap detection for YouTube creators.
                    </p>
                </div>

                {/* Links */}
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {LINKS.map(l => (
                        l.href.startsWith('#') || l.href.startsWith('mailto:') ? (
                            <a key={l.href} href={l.href} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                                {l.label}
                            </a>
                        ) : (
                            <Link key={l.href} href={l.href} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                                {l.label}
                            </Link>
                        )
                    ))}
                </div>
            </div>
            <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-[#1e1e22] flex items-center justify-between">
                <p className="text-xs text-zinc-800">© {new Date().getFullYear()} GapTuber. All rights reserved.</p>
                <p className="text-xs text-zinc-800">Built by a creator, for creators.</p>
            </div>
        </footer>
    );
}
