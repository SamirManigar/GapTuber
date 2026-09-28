import { describe, expect, it } from "vitest";
import { scoreHookStrength } from "./hookScorer";

describe("scoreHookStrength", () => {
    it("scores the voiceover cell of a Markdown hook row", () => {
        const script = `| Scene / Section | Timestamp | Visuals | Audio / Voiceover |
|---|---|---|---|
| **Hook – Showdown** | 0:00–0:30 | Timer | **VO:** What if you had 60 seconds to win? Stay tuned to see which workflow actually performs better. |`;
        const result = scoreHookStrength(script);
        expect(result.hasPatternInterrupt).toBe(true);
        expect(result.hasOpenLoop).toBe(true);
        expect(result.hasDirect2ndPerson).toBe(true);
        expect(result.hasStatOrFact).toBe(true);
    });
});
