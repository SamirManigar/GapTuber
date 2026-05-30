/**
 * Centralized CORS utility.
 * Replaces the unsafe "echo origin back" pattern that was in every API route.
 */

const ALLOWED_ORIGINS = [
    // Production app
    "https://gaptuber.app",
    // Local dev
    "http://localhost:3000",
    "http://localhost:3001",
];

// Chrome extensions are allowed by extension ID at runtime.
// Chrome extension IDs are 32-char strings using [a-p] (base16 encoded),
// but may also include digits in some builds. We match all valid CRX origins.
const EXTENSION_ORIGIN_REGEX = /^chrome-extension:\/\/[a-z0-9]{32}$/;

export function getCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";

    const isAllowed =
        ALLOWED_ORIGINS.includes(origin) ||
        EXTENSION_ORIGIN_REGEX.test(origin);

    return {
        "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token, X-Session-Cookie",
        "Vary": "Origin",
    };
}

export function optionsResponse(req: Request) {
    const { NextResponse } = require("next/server");
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}
