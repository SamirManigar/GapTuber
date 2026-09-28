import { CheckCircle2, XCircle } from "lucide-react";

const DOES = [
    "Samples recent competitor uploads and keyword search results",
    "Finds repeated needs in public top-level comments",
    "Keeps opportunity scores separate from AI-written creative drafts",
    "Stores the evidence sample, collection time, and scoring version",
];

const DOES_NOT = [
    "Promise views, revenue, ranking, or channel growth",
    "Expose competitors' private CTR, retention, or audience data",
    "Treat a small search sample as exact market demand",
    "Present an AI-written claim as verified evidence",
];

export default function WhySection() {
    return (
        <section id="why-gaptuber" className="border-t border-[#1e1e22] bg-[#0c0c0e] px-5 py-20" aria-labelledby="why-heading">
            <div className="mx-auto max-w-6xl">
                <div className="mb-10 max-w-2xl">
                    <p className="mb-4 font-mono text-xs uppercase tracking-widest text-zinc-600">Clear boundaries</p>
                    <h2 id="why-heading" className="text-3xl font-bold leading-tight text-white">Useful intelligence without fake certainty.</h2>
                    <p className="mt-3 text-base leading-relaxed text-zinc-500">The product is designed to narrow your next-video choices. Your packaging, execution, audience fit, and timing still decide the result.</p>
                </div>

                <div className="grid overflow-hidden rounded-xl border border-[#1e1e22] md:grid-cols-2">
                    <div className="bg-[#111113] p-6 sm:p-8">
                        <h3 className="text-base font-semibold text-emerald-300">What GapTuber can support</h3>
                        <ul className="mt-5 space-y-4">
                            {DOES.map(item => (
                                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-zinc-400">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="border-t border-[#1e1e22] bg-[#0f0f11] p-6 sm:p-8 md:border-l md:border-t-0">
                        <h3 className="text-base font-semibold text-zinc-300">What it cannot know</h3>
                        <ul className="mt-5 space-y-4">
                            {DOES_NOT.map(item => (
                                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-zinc-500">
                                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}
