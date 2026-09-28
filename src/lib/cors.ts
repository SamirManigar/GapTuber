/**
 * Centralized CORS utility.
 * Replaces the unsafe "echo origin back" pattern that was in every API route.
 */

import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
    // Canonical production app + apex redirect origin
    "https://www.gaptuber.app",
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

    const headers: Record<string, string> = {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token, X-Session-Cookie",
        "Vary": "Origin",
    };

    // Never advertise an allowed origin to an untrusted caller. Requests from
    // the web app itself normally have no Origin header and do not need CORS.
    if (isAllowed) headers["Access-Control-Allow-Origin"] = origin;

    return headers;
}

export function optionsResponse(req: Request) {
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}
