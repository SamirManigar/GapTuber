const SIGNALS = [
    { k: "Velocity",    v: "High",   note: "2 trending videos" },
    { k: "Saturation",  v: "Low",    note: "3 uploads / 30d" },
    { k: "Frustration", v: "High",   note: "Outdated tutorials" },
    { k: "Abandonment", v: "Medium", note: "No 2026 version" },
];

const WHY = [
    "High comment frustration around outdated tutorials",
    "Only 3 uploads in last 30 days — easy to rank",
    "2 competitor videos showing strong velocity",
    "No clear beginner-focused version exists",
];

export default function SampleOutput() {
    return (
        <section id="sample-output" className="py-20 px-5 bg-[#111113] border-t border-[#1e1e22]">
            <div className="max-w-6xl mx-auto">
                <div className="mb-12">
                    <p className="text-xs font-mono text-zinc-600 tracking-widest uppercase mb-5">Real output</p>
                    <h2 className="text-3xl font-bold text-white mb-3">What a gap actually looks like.</h2>
                    <p className="text-zinc-500 text-sm">This is a real scan result on the keyword <span className="font-mono text-zinc-400">"rag tutorial"</span>.</p>
                </div>

                <div className="grid lg:grid-cols-2 gap-5">
                    {/* Terminal card */}
                    <div className="bg-[#0c0c0e] border border-[#1e1e22] rounded-xl overflow-hidden font-mono">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e22]">
                            <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                            <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                            <span className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
                            <span className="ml-2 text-xs text-zinc-700">output.json</span>
                        </div>
                        <div className="p-5 text-sm space-y-4">
                            <div>
                                <span className="text-zinc-700">gap_score: </span>
                                <span className="text-emerald-400 font-bold text-lg">8.7 / 10</span>
                            </div>
                            <div>
                                <span className="text-zinc-700">title: </span>
                                <span className="text-zinc-300">"Beginner-Friendly RAG for Solo Devs (2026 Stack)"</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                {SIGNALS.map(s => (
                                    <div key={s.k} className="border border-[#1e1e22] rounded-lg px-3 py-2">
                                        <p className="text-[10px] text-zinc-700 mb-1">{s.k.toLowerCase()}</p>
                                        <p className={`text-xs font-semibold ${s.v === "High" ? "text-emerald-400" : s.v === "Low" ? "text-amber-400" : "text-zinc-400"}`}>{s.v.toLowerCase()}</p>
                                        <p className="text-[10px] text-zinc-700 mt-0.5">{s.note}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-1">
                                <span className="text-zinc-700">hook: </span>
                                <span className="text-zinc-400 italic">"Stop using RAG tutorials from 2023."</span>
                            </div>
                            <div>
                                <span className="text-zinc-700">format: </span>
                                <span className="text-zinc-400">15-min beginner tutorial + GitHub repo</span>
                            </div>
                        </div>
                    </div>

                    {/* Why this works */}
                    <div className="flex flex-col justify-between">
                        <div>
                            <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-5">Why this works</p>
                            <div className="space-y-4">
                                {WHY.map((reason, i) => (
                                    <div key={i} className="flex items-start gap-4 pb-4 border-b border-[#1e1e22] last:border-0">
                                        <span className="text-xs font-mono text-zinc-700 flex-shrink-0 w-5 mt-0.5">0{i + 1}</span>
                                        <p className="text-sm text-zinc-400 leading-relaxed">{reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <p className="text-xs text-zinc-700 mt-8 font-mono">
                            This is strategic advantage — not another keyword suggestion.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
