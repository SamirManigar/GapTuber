const STEPS = [
    {
        num: "01",
        title: "Analyse Any Competitor Channel",
        desc: "Paste any YouTube channel link and GapTuber instantly shows you what videos are growing fast, which are flopping, and how often they post.",
        details: ["See which videos get the most engagement", "Spot channels growing rapidly", "Understand their posting patterns"],
    },
    {
        num: "02",
        title: "Find Video Topics Nobody Has Covered",
        desc: "GapTuber checks 7 different signals to find video topics your audience wants to watch but no one has made well yet. No guesswork.",
        details: ["See how strong each topic opportunity is", "Know if a topic is rising or fading", "Find relevant keywords easily"],
    },
    {
        num: "03",
        title: "Discover What Viewers Actually Want",
        desc: "GapTuber reads through thousands of YouTube comments to find complaints, questions, and requests that viewers keep repeating.",
        details: ["Find recurring viewer complaints", "Spot missing topics people ask for", "Understand your audience's biggest frustrations"],
    },
    {
        num: "04",
        title: "Stay Ahead of Competitors",
        desc: "Get notified the moment a competitor posts a video that blows up. See what worked for them and adapt your strategy before others do.",
        details: ["Instant alerts on viral competitor videos", "Track their view and subscriber growth", "See what topics they're doubling down on"],
    },
    {
        num: "05",
        title: "GapTuber AI Studio",
        desc: "Turn any video idea into a full script in minutes. Chat with your personal AI assistant that knows your channel niche and audience.",
        details: ["Full script writer", "Instant video idea generator", "Personalised channel strategy"],
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
