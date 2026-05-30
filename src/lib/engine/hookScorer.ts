/**
 * Hook Scorer — Tier 3B
 * Deterministically scores the opening hook of a YouTube script
 * before it goes to production, so creators know what to fix.
 *
 * Usage:
 *   const result = scoreHookStrength(scriptText);
 *   // result.score: 0-100, result.recommendation: actionable fix
 */

export interface HookScoreResult {
    score: number;                  // 0-100 overall hook quality
    grade: "S" | "A" | "B" | "C" | "D";
    hasPatternInterrupt: boolean;   // Opens with something unexpected
    hasOpenLoop: boolean;           // Teases an answer the viewer must stay to get
    hasStatOrFact: boolean;         // Uses a concrete number or statistic
    hasDirect2ndPerson: boolean;    // Speaks directly to "You"
    firstSentenceWordCount: number; // Ideal: 8-15 words (punchy but complete)
    hookLength: number;             // Words in the first ~30 seconds (~75 words)
    recommendation: string;         // Top actionable fix
    breakdown: {
        patternInterruptScore: number;
        openLoopScore: number;
        specificityScore: number;
        clarityScore: number;
        personalScore: number;
    };
}

// ─── Pattern Interrupt Triggers ───────────────────────────────────────────────
const PATTERN_INTERRUPTS = [
    "stop", "wait", "wrong", "never", "secret", "truth", "warning",
    "most people", "everyone", "nobody", "i was wrong", "i made a mistake",
    "this changed everything", "i can't believe", "shocking", "surprising",
    "you won't believe", "here's why", "the real reason", "i tested",
    "i spent", "after", "years ago", "back when", "what if",
];

// ─── Open Loop Indicators ─────────────────────────────────────────────────────
const OPEN_LOOP_PHRASES = [
    "by the end", "at the end", "before we finish", "stick around",
    "stay until", "in this video", "i'll show you", "i'll reveal",
    "you'll discover", "you'll learn", "we'll cover", "we're going to",
    "the answer is", "the secret is", "it's not what you think",
    "but first", "here's the thing", "here's what", "this is why",
];

// ─── Stat / Specificity Patterns ──────────────────────────────────────────────
const STAT_PATTERN = /\b\d+([.,]\d+)?(%|x|\+|k|m|b|million|billion|thousand|percent|times|years|months|days|weeks|hours|minutes|seconds|dollars|\$)?\b/i;
const YEAR_PATTERN = /\b(20\d{2})\b/;

// ─── Scores a script's opening hook ───────────────────────────────────────────
export function scoreHookStrength(scriptText: string): HookScoreResult {
    // Extract the first ~75 words (approx. 30 seconds of speech)
    const allWords = scriptText.trim().split(/\s+/);
    const hookWords = allWords.slice(0, 75);
    const hookText = hookWords.join(" ").toLowerCase();

    // First sentence heuristic: up to first sentence-ending punctuation
    const firstSentenceMatch = scriptText.match(/^[^.!?]+[.!?]/);
    const firstSentence = firstSentenceMatch ? firstSentenceMatch[0] : scriptText.slice(0, 120);
    const firstSentenceWordCount = firstSentence.trim().split(/\s+/).length;

    // ─── Signal Detection ─────────────────────────────────────────────────────
    const hasPatternInterrupt = PATTERN_INTERRUPTS.some(p => hookText.includes(p));
    const hasOpenLoop = OPEN_LOOP_PHRASES.some(p => hookText.includes(p));
    const hasStatOrFact = STAT_PATTERN.test(hookText) || YEAR_PATTERN.test(hookText);
    const hasDirect2ndPerson = /\byou\b|\byour\b/.test(hookText);

    // ─── Sub-scores (each 0-20) ───────────────────────────────────────────────
    const patternInterruptScore = hasPatternInterrupt ? 20 : 0;
    const openLoopScore = hasOpenLoop ? 20 : 0;

    // Specificity: has stat + first sentence is focused (8-20 words)
    let specificityScore = 0;
    if (hasStatOrFact) specificityScore += 12;
    if (firstSentenceWordCount >= 8 && firstSentenceWordCount <= 20) specificityScore += 8;
    specificityScore = Math.min(20, specificityScore);

    // Clarity: hook isn't too long (ideal ≤60 words) and not too short (≥15 words)
    const hookLength = hookWords.length;
    let clarityScore = 0;
    if (hookLength >= 15 && hookLength <= 60) clarityScore = 20;
    else if (hookLength > 60) clarityScore = Math.max(0, 20 - (hookLength - 60));
    else clarityScore = Math.max(0, hookLength * (20 / 15));

    // Personal: speaks directly to viewer
    const personalScore = hasDirect2ndPerson ? 20 : 0;

    const score = Math.round(
        patternInterruptScore + openLoopScore + specificityScore + clarityScore + personalScore
    );

    // ─── Grade ────────────────────────────────────────────────────────────────
    const grade: HookScoreResult["grade"] =
        score >= 85 ? "S" :
        score >= 70 ? "A" :
        score >= 55 ? "B" :
        score >= 40 ? "C" : "D";

    // ─── Top Recommendation (single most impactful fix) ───────────────────────
    let recommendation = "";
    if (!hasPatternInterrupt) {
        recommendation = "Open with a pattern interrupt — start with 'Stop', 'I was wrong', or a surprising fact to break autopilot scrolling.";
    } else if (!hasOpenLoop) {
        recommendation = "Add an open loop — tease what the viewer will gain by the end ('By the end you'll know exactly how to...')";
    } else if (!hasStatOrFact) {
        recommendation = "Add a specific number or stat in the first 30 seconds to build immediate credibility.";
    } else if (!hasDirect2ndPerson) {
        recommendation = "Address the viewer directly with 'you' — this creates personal connection and reduces drop-off.";
    } else if (firstSentenceWordCount < 8) {
        recommendation = "Your opening sentence is too short. Expand it slightly to give the algorithm time to index the hook.";
    } else if (firstSentenceWordCount > 20) {
        recommendation = "Your opening sentence is too long. Trim to ≤15 words for maximum punchiness and retention.";
    } else {
        recommendation = "Hook looks strong! Ensure the energy matches in the actual recording — pacing matters as much as script.";
    }

    return {
        score,
        grade,
        hasPatternInterrupt,
        hasOpenLoop,
        hasStatOrFact,
        hasDirect2ndPerson,
        firstSentenceWordCount,
        hookLength,
        recommendation,
        breakdown: {
            patternInterruptScore,
            openLoopScore,
            specificityScore,
            clarityScore,
            personalScore,
        },
    };
}
