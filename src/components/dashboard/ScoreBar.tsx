"use client";

import { useEffect, useRef, useState } from "react";

interface ScoreBarProps {
    label: string;
    score: number;
    colorClass?: string;
    benchmark?: number; // Visual marker for comparison (e.g. channel average)
}

/**
 * Animated score bar that only plays its fill animation once
 * the element scrolls into the viewport (IntersectionObserver).
 */
export function ScoreBar({ label, score, colorClass, benchmark }: ScoreBarProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [animated, setAnimated] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setAnimated(true);
                    observer.disconnect(); // fire once only
                }
            },
            { threshold: 0.2 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const autoColor = score >= 70
        ? "bg-emerald-500"
        : score >= 40
        ? "bg-amber-500"
        : "bg-red-500";

    return (
        <div ref={ref} className="flex items-center gap-3 mb-2.5">
            <span className="text-[11px] font-mono uppercase text-zinc-500 w-24 flex-shrink-0">
                {label}
            </span>
            <div className="flex-1 h-1.5 bg-[#1e1e22] rounded-full overflow-hidden relative">
                {/* Benchmark Indicator */}
                {benchmark !== undefined && (
                    <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-10"
                        style={{ left: `${benchmark}%` }}
                        title={`Benchmark: ${benchmark}`}
                    />
                )}
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass ?? autoColor}`}
                    style={{ width: animated ? `${score}%` : "0%" }}
                />
            </div>
            <span className="text-[11px] font-mono font-bold text-zinc-400 w-8 text-right tabular-nums">
                {score}
            </span>
        </div>
    );
}
