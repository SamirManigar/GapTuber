import { describe, expect, it } from "vitest";
import { getCorsHeaders } from "./cors";

describe("getCorsHeaders", () => {
    it("allows the canonical production origin", () => {
        const headers = getCorsHeaders(new Request("https://www.gaptuber.app/api/health", {
            headers: { Origin: "https://www.gaptuber.app" },
        }));
        expect(headers["Access-Control-Allow-Origin"]).toBe("https://www.gaptuber.app");
    });

    it("allows Chrome extension origins", () => {
        const origin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
        const headers = getCorsHeaders(new Request("https://www.gaptuber.app/api/health", {
            headers: { Origin: origin },
        }));
        expect(headers["Access-Control-Allow-Origin"]).toBe(origin);
    });

    it("does not advertise an origin to untrusted callers", () => {
        const headers = getCorsHeaders(new Request("https://www.gaptuber.app/api/health", {
            headers: { Origin: "https://example.invalid" },
        }));
        expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });
});
