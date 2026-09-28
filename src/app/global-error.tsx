"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * global-error.tsx — catches errors in the root layout itself (e.g. Providers crashing).
 * Must include its own <html> and <body> because the root layout is unavailable.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="en">
            <body style={{ background: "#0a0a0f", margin: 0, fontFamily: "system-ui, sans-serif" }}>
                <div
                    style={{
                        minHeight: "100vh",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "1rem",
                    }}
                >
                    <div style={{ textAlign: "center", maxWidth: "28rem" }}>
                        <div
                            style={{
                                width: 56,
                                height: 56,
                                background: "rgba(239,68,68,0.1)",
                                border: "1px solid rgba(239,68,68,0.2)",
                                borderRadius: 12,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 1.25rem",
                                fontSize: "1.5rem",
                            }}
                        >
                            ⚠️
                        </div>
                        <h1 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 700, marginBottom: 8 }}>
                            Critical Error
                        </h1>
                        <p style={{ color: "#71717a", fontSize: "0.875rem", marginBottom: 6, fontFamily: "monospace" }}>
                            {error.message || "A critical error occurred."}
                        </p>
                        {error.digest && (
                            <p style={{ color: "#3f3f46", fontSize: "0.75rem", marginBottom: 24, fontFamily: "monospace" }}>
                                ID: {error.digest}
                            </p>
                        )}
                        <button
                            onClick={reset}
                            style={{
                                background: "#059669",
                                color: "#fff",
                                padding: "0.625rem 1.5rem",
                                borderRadius: 6,
                                border: "none",
                                fontWeight: 500,
                                fontSize: "0.875rem",
                                cursor: "pointer",
                            }}
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
