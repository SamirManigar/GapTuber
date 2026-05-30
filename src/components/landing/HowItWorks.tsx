const STEPS = [
    {
        num: "01",
        title: "Competitors Gap Analysis",
        desc: "Point GapTuber at any YouTube channel with 500+ videos. We pull view velocity, engagement rates, and upload consistency — from real API data.",
        details: ["Bayesian engagement scoring", "EMA trend detection", "Upload schedule analysis"],
    },
    {
        num: "02",
        title: "Statistical gap detection",
        desc: "Our 7-signal engine uses exponential decay weighting and keyword relevance to surface gaps with statistical confidence. No guessing.",
        details: ["Wilson score engagement reliability", "Exponential decay velocity", "Keyword relevance"],
    },
    {
        num: "03",
        title: "Comment Miner",
        desc: "NLP analysis of comment pain points to find what viewers hate about existing content, surfacing direct opportunities.",
        details: ["Frustration NLP", "Extract viewer pain points", "Identify missing topics"],
    },
    {
        num: "04",
        title: "Competitor Watchtower",
        desc: "Track competitor performance over time. Get alerted when they post highly successful videos or when their metrics drop.",
        details: ["Performance tracking", "Upload alerts", "Trend visualization"],
    },
    {
        num: "05",
        title: "GapTuber AI Studio",
        desc: "Your personal YouTube AI assistant. Generate scripts, brainstorm ideas, and strategize with AI trained on YouTube analytics.",
        details: ["Script Writer", "Idea Generator", "Channel Blueprint"],
    },
];

export default function HowItWorks() {
    return (
        <section id="how-it-works" className="py-20 px-5 bg-[#111113] border-t border-[#1e1e22]">
            <div className="max-w-6xl mx-auto">
                <div className="mb-14 max-w-xl">
                    <p className="text-xs font-mono text-zinc-600 tracking-widest uppercase mb-5">How it works</p>
                    <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
                        From noise to opportunity<br />in under 60 seconds.
                    </h2>
                    <p className="text-zinc-500 text-base">
                        A hybrid deterministic + AI system. Every signal has a reason.
                    </p>
                </div>

                <div className="space-y-0">
                    {STEPS.map((step, i) => (
                        <div
                            key={step.num}
                            className={`grid lg:grid-cols-[80px_1fr_1fr] gap-0 border-t border-[#1e1e22] py-10 ${i === STEPS.length - 1 ? "border-b" : ""}`}
                        >
                            {/* Step number */}
                            <div className="mb-4 lg:mb-0">
                                <span className="text-xs font-mono text-zinc-700">{step.num}</span>
                            </div>
                            {/* Title + desc */}
                            <div className="lg:pr-12 mb-4 lg:mb-0">
                                <h3 className="text-base font-semibold text-zinc-100 mb-2">{step.title}</h3>
                                <p className="text-sm text-zinc-500 leading-relaxed">{step.desc}</p>
                            </div>
                            {/* Detail list */}
                            <div className="space-y-2 lg:border-l lg:border-[#1e1e22] lg:pl-12">
                                {step.details.map(d => (
                                    <div key={d} className="flex items-center gap-2 text-sm text-zinc-400">
                                        <span className="w-1 h-1 rounded-full bg-emerald-500 flex-shrink-0" />
                                        {d}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
