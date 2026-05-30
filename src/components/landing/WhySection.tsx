"use client";

import { motion, Variants } from "framer-motion";

type CellValue = boolean | "partial";

type Row = { feature: string; us: CellValue; vidiq: CellValue; tubebuddy: CellValue; note: string; };

// Honest comparison — VidIQ and TubeBuddy do have basic keyword/competitor tools on paid plans.
// Showing partial ticks is more credible than claiming they have zero features.
const ROWS: Row[] = [
    { feature: "Statistical Gap Detection",       us: true,  vidiq: false, tubebuddy: false, note: "" },
    { feature: "Chrome Extension",                us: true,  vidiq: true,  tubebuddy: true,  note: "VidIQ & TubeBuddy extensions exist but lack live gap scanning" },
    { feature: "GapTuber AI Studio",              us: true,  vidiq: false, tubebuddy: false, note: "" },
    { feature: "Competitors Gap Analysis",        us: true,  vidiq: "partial", tubebuddy: "partial", note: "Competitors offer basic tracking, not gap-specific scoring" },
    { feature: "Competitor Watchtower",           us: true,  vidiq: false, tubebuddy: false, note: "" },
    { feature: "Comment Miner (NLP Analysis)",    us: true,  vidiq: false, tubebuddy: false, note: "" },
    { feature: "Free to use",                     us: true,  vidiq: false, tubebuddy: false, note: "VidIQ & TubeBuddy require paid plans for most features" },
];

const Tick = ({ on, highlight }: { on: CellValue; highlight?: boolean }) => {
    if (on === "partial") {
        return (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-amber-400 border border-amber-500/30">
                ~
            </span>
        );
    }
    if (on) {
        return (
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${highlight ? "bg-emerald-600 text-white" : "text-emerald-400"}`}>
                ✓
            </span>
        );
    }
    return <span className="text-zinc-800 text-sm">—</span>;
};

const tableVariant: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

export default function WhySection() {
    return (
        <section id="why-gaptuber" className="py-20 px-5 bg-[#0c0c0e] border-t border-[#1e1e22]">
            <div className="max-w-6xl mx-auto">
                <motion.div
                    variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } } as Variants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    className="mb-12"
                >
                    <p className="text-xs font-mono text-zinc-600 tracking-widest uppercase mb-5">Comparison</p>
                    <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
                        Why GapTuber beats VidIQ &amp; TubeBuddy.
                    </h2>
                    <p className="text-zinc-500 text-sm">More features. Statistical accuracy. Free during early access.</p>
                </motion.div>

                <motion.div
                    variants={tableVariant}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-60px" }}
                    className="border border-[#1e1e22] rounded-xl overflow-hidden"
                >
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#1e1e22]">
                                <th className="text-left px-5 py-3.5 text-xs font-mono text-zinc-600 uppercase tracking-widest w-1/2">Feature</th>
                                <th className="px-4 py-3.5 text-center">
                                    <span className="text-xs font-semibold text-white bg-emerald-600 px-3 py-1 rounded-md">GapTuber</span>
                                </th>
                                <th className="px-4 py-3.5 text-center text-xs font-mono text-zinc-600 uppercase">VidIQ</th>
                                <th className="px-4 py-3.5 text-center text-xs font-mono text-zinc-600 uppercase">TubeBuddy</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ROWS.map((row, i) => (
                                <tr key={row.feature} className={`border-b border-[#1e1e22] last:border-0 ${i % 2 === 1 ? "bg-[#111113]" : ""}`}>
                                    <td className="px-5 py-3 text-zinc-400">
                                        {row.feature}
                                        {row.note && (
                                            <span className="ml-2 text-[10px] text-zinc-600 hidden sm:inline">({row.note})</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center"><Tick on={row.us} highlight /></td>
                                    <td className="px-4 py-3 text-center"><Tick on={row.vidiq} /></td>
                                    <td className="px-4 py-3 text-center"><Tick on={row.tubebuddy} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </motion.div>
                <p className="text-xs text-zinc-700 mt-4">
                    ✓ = Full feature&nbsp;&nbsp;~ = Partial / paid-only&nbsp;&nbsp;— = Not available
                </p>
            </div>
        </section>
    );
}
