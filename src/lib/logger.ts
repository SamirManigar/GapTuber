import * as Sentry from "@sentry/nextjs";

/**
 * Production-safe logger.
 * In production builds, debug/verbose logs are suppressed.
 * Use this instead of console.log in API routes.
 */

const isDev = process.env.NODE_ENV === "development";

export const logger = {
    /** Only logs in development */
    debug: (...args: unknown[]) => {
        if (isDev) console.log("[DEBUG]", ...args);
    },
    /** Always logs — use for important state transitions */
    info: (...args: unknown[]) => {
        console.log("[INFO]", ...args);
    },
    /** Always logs — use for non-fatal errors */
    warn: (...args: unknown[]) => {
        console.warn("[WARN]", ...args);
        if (!isDev) Sentry.captureMessage(args.map(String).join(" "), "warning");
    },
    /** Always logs — use for actual errors */
    error: (...args: unknown[]) => {
        console.error("[ERROR]", ...args);
        if (!isDev) {
            const errorObj = args.find(a => a instanceof Error);
            if (errorObj) {
                Sentry.captureException(errorObj, { extra: { args } });
            } else {
                Sentry.captureMessage(args.map(String).join(" "), "error");
            }
        }
    },
};
