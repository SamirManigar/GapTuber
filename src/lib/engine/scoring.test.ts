import { describe, expect, it } from "vitest";

import {
    buildGapCandidates,
    computeCompetitionScore,
    computeEngagementScore,
    computeOptimalUploadSchedule,
    computeSaturationScore,
    computeTrendMomentum,
    estimateVideoViews,
} from "./scoring";

describe("scoring data-integrity guardrails", () => {
    it("does not turn a missing search sample into an opportunity", () => {
        expect(computeSaturationScore([])).toMatchObject({
            score: 0,
            competitionLevel: "Unknown",
        });
        expect(computeCompetitionScore([])).toMatchObject({
            score: 0,
            difficulty: "Unknown",
        });
    });

    it("does not invent engagement or trend confidence from thin data", () => {
        expect(computeEngagementScore([]).score).toBe(0);
        expect(computeTrendMomentum([])).toMatchObject({ score: 0, trend: "stable" });
    });

    it("does not invent a publishing window without valid timestamps", () => {
        expect(computeOptimalUploadSchedule([])).toMatchObject({
            bestDay: "",
            bestHour: -1,
        });
    });

    it("does not invent a 10,000-view baseline", () => {
        expect(estimateVideoViews(8, 8, 8, 0)).toEqual({ low: 0, mid: 0, high: 0 });
    });

    it("keeps all no-data candidate signals and confidence at zero", () => {
        const candidates = buildGapCandidates({
            keyword: "test topic",
            videos: [],
            comments: [],
            searchResults: [],
        });

        expect(candidates.length).toBeGreaterThan(0);
        for (const candidate of candidates) {
            expect(candidate.scores.compositeScore).toBe(0);
            expect(candidate.scores.confidence).toBe(0);
            expect(candidate.estimatedViews).toEqual({ low: 0, mid: 0, high: 0 });
        }
    });
});
