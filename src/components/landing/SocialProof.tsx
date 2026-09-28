import { Braces, Database, ShieldCheck } from "lucide-react";

const TRUST_POINTS = [
    {
        icon: Database,
        title: "Official public data",
        text: "Video, channel, search-result, and comment samples come from the YouTube Data API v3 and include a collection timestamp.",
    },
    {
        icon: Braces,
        title: "Scores stay deterministic",
        text: "The server calculates opportunity scores from the sample. AI can draft creative ideas, but it cannot raise a score.",
    },
    {
        icon: ShieldCheck,
        title: "Evidence is verifiable",
        text: "A comment appears as evidence only when the model returns an ID that matches a real comment in the collected sample.",
    },
];

export default function SocialProof() {
    return (
        <section className="border-t border-[#1e1e22] bg-[#0c0c0e] px-5 py-20" aria-labelledby="trust-heading">
            <div className="mx-auto max-w-6xl">
                <div className="mb-10 max-w-2xl">
                    <p className="mb-4 font-mono text-xs uppercase tracking-widest text-sky-400">How trust is earned</p>
                    <h2 id="trust-heading" className="text-3xl font-bold leading-tight text-white">See what is measured, estimated, and AI-written.</h2>
                    <p className="mt-3 text-base leading-relaxed text-zinc-500">
                        GapTuber does not have access to private impressions, click-through rate, retention, search volume, audience geography, or creator revenue. It should help you choose experiments—not promise views.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {TRUST_POINTS.map(point => (
                        <article key={point.title} className="rounded-xl border border-[#1e1e22] bg-[#111113] p-5">
                            <point.icon className="mb-5 h-5 w-5 text-emerald-400" aria-hidden="true" />
                            <h3 className="text-base font-semibold text-zinc-100">{point.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{point.text}</p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
