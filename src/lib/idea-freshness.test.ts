import { describe, expect, it } from "vitest";
import { hasNonCurrentYear } from "./idea-freshness";

describe("hasNonCurrentYear", () => {
    it("rejects stale years in recommendation-facing copy", () => {
        expect(hasNonCurrentYear({ title: "Best free editor in 2025" }, 2026)).toBe(true);
    });

    it("allows the current year and year-free evergreen ideas", () => {
        expect(hasNonCurrentYear({ title: "Best free editor in 2026" }, 2026)).toBe(false);
        expect(hasNonCurrentYear({ title: "Build a game with AI" }, 2026)).toBe(false);
    });

    it("checks hooks as well as titles", () => {
        expect(hasNonCurrentYear({ title: "AI tools", hook: "These changed in 2024" }, 2026)).toBe(true);
    });
});

