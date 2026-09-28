import { describe, expect, it } from "vitest";
import {
    buildOutcomeLearningProfile,
    getOutcomeAdjustment,
} from "./outcome-learning";

describe("outcome learning", () => {
    it("does not learn from a thin sample", () => {
        const profile = buildOutcomeLearningProfile([
            { referenceId: "Market Gap", outcomeMultipliers: { day30: 2 } },
            { referenceId: "Market Gap", outcomeMultipliers: { day30: 1.5 } },
        ]);

        expect(profile.active).toBe(false);
        expect(getOutcomeAdjustment(profile, "Market Gap").adjustment).toBe(1);
    });

    it("prefers mature outcomes and applies a bounded conservative adjustment", () => {
        const records = Array.from({ length: 10 }, () => ({
            referenceId: "Market Gap",
            outcomeMultipliers: { day1: 0.4, day7: 1.2, day30: 4 },
        }));
        const profile = buildOutcomeLearningProfile(records);
        const learned = getOutcomeAdjustment(profile, "market gap");

        expect(profile.active).toBe(true);
        expect(learned.observedMultiplier).toBe(4);
        expect(learned.adjustment).toBe(1.15);
        expect(learned.confidence).toBe(1);
    });

    it("uses the channel-level result for an unseen signal", () => {
        const profile = buildOutcomeLearningProfile(
            Array.from({ length: 5 }, () => ({
                referenceId: "Velocity Signal",
                outcomeMultipliers: { day30: 0.5 },
            })),
        );

        expect(getOutcomeAdjustment(profile, "New Signal")).toEqual(profile.global);
        expect(getOutcomeAdjustment(profile, "New Signal").adjustment).toBeGreaterThanOrEqual(0.85);
    });
});
