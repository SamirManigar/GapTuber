import { afterEach, describe, expect, it, vi } from "vitest";

import { getHistoricalVideoViews } from "./youtube-analytics";

describe("YouTube Analytics outcome windows", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("uses actual calendar dates instead of row positions when zero-view days are omitted", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                rows: [
                    ["2026-01-01", 10],
                    ["2026-01-03", 30],
                    ["2026-01-07", 70],
                    ["2026-01-30", 300],
                ],
            }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await getHistoricalVideoViews(
            "abcdefghijk",
            new Date("2026-01-01T20:00:00Z"),
            "test-access-token",
        );

        expect(result).toEqual({ day1: 10, day7: 110, day30: 410 });
        expect(fetchMock).toHaveBeenCalledOnce();
    });
});
