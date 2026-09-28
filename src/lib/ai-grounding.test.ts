import { describe, expect, it } from "vitest";
import { buildScriptGroundingRules } from "./ai-grounding";

describe("buildScriptGroundingRules", () => {
    it("anchors the prompt to the runtime date and forbids invented outcomes", () => {
        const rules = buildScriptGroundingRules(new Date("2026-09-08T10:00:00.000Z"));
        expect(rules).toContain("2026-09-08T10:00:00.000Z");
        expect(rules).toContain("Never narrate a winner or outcome");
        expect(rules).toContain("[INSERT VERIFIED RESULT]");
    });
});

