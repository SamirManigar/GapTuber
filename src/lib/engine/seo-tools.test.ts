import { describe, expect, it } from "vitest";
import { auditVideoSeo, buildTagSuggestions } from "./seo-tools";

describe("auditVideoSeo", () => {
    it("rewards exact keyword coverage without claiming rank probability", () => {
        const result = auditVideoSeo({
            title: "Python Tutorial for Beginners: Build a Real App",
            keyword: "python tutorial",
            description: "Python tutorial for beginners with a complete project, mistakes, and next steps. ".repeat(4),
            tags: ["python tutorial", "python for beginners", "learn python", "coding tutorial", "python project"],
        });

        expect(result.scores.title).toBeGreaterThanOrEqual(80);
        expect(result.scores.description).toBeGreaterThan(0);
        expect(result.methodology).toContain("not YouTube ranking probability");
    });

    it("reports missing metadata", () => {
        const result = auditVideoSeo({ title: "My New Video", keyword: "camera guide" });
        expect(result.issues.map(issue => issue.type)).toEqual(expect.arrayContaining(["title", "description", "tags"]));
    });
});

describe("buildTagSuggestions", () => {
    it("keeps the primary keyword and reports evidence coverage", () => {
        const result = buildTagSuggestions("camera guide", "photography", [{
            title: "Camera Guide for New Photographers",
            channel: "Example",
            views: 1000,
            likes: 50,
            uploadDate: new Date().toISOString(),
        }]);

        expect(result.tags[0]).toBe("camera guide");
        expect(result.evidence.sampleSize).toBe(1);
        expect(result.recommendation).toContain("not search-volume estimates");
    });
});
