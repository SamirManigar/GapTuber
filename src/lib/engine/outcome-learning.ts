export const OUTCOME_LEARNING_VERSION = "outcome-v1";

type OutcomeMultipliers = {
    day1?: number;
    day7?: number;
    day30?: number;
} | null;

export interface OutcomeLearningRecord {
    referenceId?: string | null;
    outcomeMultipliers?: OutcomeMultipliers;
}

export interface LearnedSignal {
    sampleSize: number;
    observedMultiplier: number;
    adjustment: number;
    confidence: number;
}

export interface OutcomeLearningProfile {
    version: typeof OUTCOME_LEARNING_VERSION;
    sampleSize: number;
    active: boolean;
    global: LearnedSignal | null;
    signals: Record<string, LearnedSignal>;
}

type MatureOutcome = { multiplier: number; maturity: number };

function normalizeSignal(signal: string | null | undefined): string {
    return (signal || "unknown").trim().toLowerCase();
}

function selectMostMatureOutcome(outcomes: OutcomeMultipliers): MatureOutcome | null {
    if (!outcomes) return null;

    const candidates: Array<[number | undefined, number]> = [
        [outcomes.day30, 1],
        [outcomes.day7, 0.65],
        [outcomes.day1, 0.35],
    ];

    for (const [value, maturity] of candidates) {
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
            // Winsorise extreme outcomes so one viral hit or failed upload cannot
            // permanently distort recommendations for a small channel.
            return { multiplier: Math.min(4, Math.max(0.25, value)), maturity };
        }
    }
    return null;
}

function summarize(outcomes: MatureOutcome[], minimumSamples: number): LearnedSignal | null {
    if (outcomes.length < minimumSamples) return null;

    // A geometric mean is appropriate for ratios and is less sensitive to a
    // single large value than an arithmetic mean.
    const observedMultiplier = Math.exp(
        outcomes.reduce((sum, item) => sum + Math.log(item.multiplier), 0) / outcomes.length,
    );
    const maturity = outcomes.reduce((sum, item) => sum + item.maturity, 0) / outcomes.length;
    const confidence = Math.min(1, outcomes.length / 10) * maturity;

    // Learn conservatively. Even with strong evidence, historical performance
    // can shift future priority by at most 15%.
    const boundedObserved = Math.min(2, Math.max(0.5, observedMultiplier));
    const adjustment = Math.min(1.15, Math.max(0.85, 1 + (boundedObserved - 1) * 0.25 * confidence));

    return {
        sampleSize: outcomes.length,
        observedMultiplier: Number(observedMultiplier.toFixed(3)),
        adjustment: Number(adjustment.toFixed(3)),
        confidence: Number(confidence.toFixed(3)),
    };
}

export function buildOutcomeLearningProfile(records: OutcomeLearningRecord[]): OutcomeLearningProfile {
    const allOutcomes: MatureOutcome[] = [];
    const bySignal = new Map<string, MatureOutcome[]>();

    for (const record of records) {
        const outcome = selectMostMatureOutcome(record.outcomeMultipliers ?? null);
        if (!outcome) continue;

        allOutcomes.push(outcome);
        const signal = normalizeSignal(record.referenceId);
        const group = bySignal.get(signal) ?? [];
        group.push(outcome);
        bySignal.set(signal, group);
    }

    const signals: Record<string, LearnedSignal> = {};
    for (const [signal, outcomes] of bySignal) {
        const learned = summarize(outcomes, 3);
        if (learned) signals[signal] = learned;
    }

    const global = summarize(allOutcomes, 5);
    return {
        version: OUTCOME_LEARNING_VERSION,
        sampleSize: allOutcomes.length,
        active: Boolean(global || Object.keys(signals).length > 0),
        global,
        signals,
    };
}

export function getOutcomeAdjustment(profile: OutcomeLearningProfile, signal: string | null | undefined): LearnedSignal {
    const learned = profile.signals[normalizeSignal(signal)] ?? profile.global;
    return learned ?? { sampleSize: 0, observedMultiplier: 1, adjustment: 1, confidence: 0 };
}

export function formatOutcomeLearningContext(profile: OutcomeLearningProfile): string {
    if (!profile.active) {
        return "\nOUTCOME LEARNING: Not active yet. Fewer than 3 comparable published outcomes are available; do not infer preferences from this thin sample.\n";
    }

    const lines = Object.entries(profile.signals)
        .sort(([, a], [, b]) => b.adjustment - a.adjustment)
        .map(([signal, learned]) =>
            `  - ${signal}: ${learned.sampleSize} outcomes, ${learned.observedMultiplier.toFixed(2)}x observed vs channel baseline, ${(learned.adjustment * 100).toFixed(0)}% conservative priority weight`,
        );

    if (profile.global) {
        lines.push(`  - channel overall: ${profile.global.sampleSize} outcomes, ${profile.global.observedMultiplier.toFixed(2)}x observed, ${(profile.global.adjustment * 100).toFixed(0)}% conservative priority weight`);
    }

    return `\nCREATOR-SPECIFIC OUTCOME LEARNING (measured from linked videos, not AI opinion):\n${lines.join("\n")}\nUse these weights only as supporting evidence. Prefer live market evidence when it conflicts, and never claim causation from correlation.\n`;
}
