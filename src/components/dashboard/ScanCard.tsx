import type { GapItem } from "@/db/schema";
import { Eye, Video, Coins } from "lucide-react";

interface ScanCardProps {
    keyword: string;
    gap: GapItem;
    rank: number;
    createdAt: Date;
}

export default function ScanCard({ keyword, gap, rank, createdAt }: ScanCardProps) {
    const isTopGap = gap.gapScore >= 8;

    return (
        <div className={`bg-[#111113] border rounded-xl overflow-hidden shadow-sm transition-all hover:border-[#2a2a30] ${isTopGap ? "border-emerald-600/30" : "border-[#1e1e22]"}`}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#1e1e22] bg-[#0c0c0e] flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        Gap_Result_0{rank}
                    </span>
                    <span className="text-xs font-semibold text-zinc-200 truncate max-w-[200px]" title={keyword}>
                        {keyword}
                    </span>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono font-bold border ${isTopGap ? "bg-emerald-600/10 text-emerald-400 border-emerald-600/20" : "bg-[#1e1e22] text-zinc-400 border-[#2a2a30]"}`}>
                    score:{gap.gapScore}
                </div>
            </div>

            <div className="p-5 flex flex-col h-[calc(100%-73px)]">
                {/* Title */}
                <h3 className="font-bold text-white text-sm mb-3 leading-snug">
                    {gap.title}
                </h3>

                {/* Reasoning */}
                <p className="text-[13px] text-zinc-500 mb-5 leading-relaxed tracking-wide">
                    {gap.reasoning}
                </p>

                <div className="mt-auto space-y-4">
                    {/* Hook */}
                    <div className="bg-[#0c0c0e] border border-[#1e1e22] rounded p-3">
                        <div className="text-[10px] font-mono text-zinc-600 mb-1.5 uppercase">hook_string</div>
                        <p className="text-[13px] text-zinc-300 italic">&ldquo;{gap.hook}&rdquo;</p>
                    </div>

                    {/* Format + Monetization */}
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#1e1e22]">
                        <div>
                            <div className="text-[10px] font-mono text-zinc-600 mb-2 uppercase flex items-center gap-1">
                                <Video className="w-3 h-3" /> format
                            </div>
                            <p className="text-xs text-zinc-300 font-medium">{gap.format}</p>
                        </div>
                        <div>
                            <div className="text-[10px] font-mono text-zinc-600 mb-2 uppercase flex items-center gap-1">
                                <Coins className="w-3 h-3" /> angle
                            </div>
                            <p className="text-xs text-zinc-300 font-medium truncate" title={gap.monetizationAngle}>{gap.monetizationAngle}</p>
                        </div>
                    </div>

                    {/* Timestamp */}
                    <div className="pt-2 flex justify-end">
                        <span className="text-[10px] font-mono text-zinc-600 uppercase border border-[#1e1e22] px-2 py-0.5 rounded">
                            {new Date(createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "2-digit",
                                year: "numeric",
                            }).toUpperCase()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
