import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: process.env.ENV_FILE || ".env.local", quiet: true });

const errors = [];
const warnings = [];
const required = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "GROQ_API_KEY",
    "YOUTUBE_API_KEY",
    "TOKEN_ENCRYPTION_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "CRON_SECRET",
    "NEXT_PUBLIC_APP_URL",
];

for (const name of required) {
    if (!process.env[name]?.trim()) errors.push(`${name} is missing`);
}

if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) {
    errors.push("AUTH_SECRET must contain at least 32 characters");
}
if (process.env.CRON_SECRET && process.env.CRON_SECRET.length < 32) {
    errors.push("CRON_SECRET must contain at least 32 characters");
}
if (process.env.TOKEN_ENCRYPTION_KEY && !/^[a-f\d]{64}$/i.test(process.env.TOKEN_ENCRYPTION_KEY)) {
    errors.push("TOKEN_ENCRYPTION_KEY must be exactly 64 hexadecimal characters");
}

try {
    const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://invalid.local");
    if (appUrl.protocol !== "https:") errors.push("NEXT_PUBLIC_APP_URL must use HTTPS in production");
    if (["localhost", "127.0.0.1"].includes(appUrl.hostname)) errors.push("NEXT_PUBLIC_APP_URL still points to a local host");
    if (appUrl.hostname === "gaptuber.app") {
        errors.push("NEXT_PUBLIC_APP_URL must use the canonical https://www.gaptuber.app origin");
    }
} catch {
    errors.push("NEXT_PUBLIC_APP_URL is not a valid URL");
}

const razorpayReady = [
    "NEXT_PUBLIC_RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
].every((name) => process.env[name]?.trim());
const lemonReady = [
    "LEMONSQUEEZY_API_KEY",
    "LEMONSQUEEZY_STORE_ID",
    "LEMONSQUEEZY_WEBHOOK_SECRET",
    "LEMONSQUEEZY_PRO_VARIANT_ID",
].every((name) => process.env[name]?.trim());
if (!razorpayReady && !lemonReady) {
    errors.push("No complete payment provider configuration was found");
}
if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    warnings.push("NEXT_PUBLIC_SENTRY_DSN is missing; production errors will have limited visibility");
}

if (!errors.length) {
    try {
        const sql = neon(process.env.DATABASE_URL);
        const schemaCheck = await sql.query(`
            SELECT
                to_regclass('public.baseline_performance') IS NOT NULL AS has_baselines,
                to_regclass('public.video_performance_snapshots') IS NOT NULL AS has_snapshots,
                EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'idea_vault'
                      AND column_name = 'outcome_multipliers'
                ) AS has_outcomes
        `);
        const state = schemaCheck[0];
        if (!state?.has_baselines || !state?.has_snapshots || !state?.has_outcomes) {
            errors.push("Outcome-learning database migration has not been applied");
        }
    } catch (error) {
        errors.push(`Database readiness check failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
}

if (warnings.length) {
    console.warn("Production readiness warnings:");
    for (const warning of warnings) console.warn(`- ${warning}`);
}
if (errors.length) {
    console.error("Production readiness failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
} else {
    console.log("Production environment and database checks passed.");
}
