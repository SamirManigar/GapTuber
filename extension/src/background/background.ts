/// <reference types="chrome" />

// ─── Side Panel Setup ──────────────────────────────────────────────────────────
// Open the Side Panel whenever the user clicks the extension icon.
// This is the only permitted way to open sidePanel in MV3 —
// sidePanel.open() is blocked in background events (requires a direct user gesture).
try {
    if (chrome.sidePanel) {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
} catch (err) {
    console.error("[GapTuber] Failed to configure side panel behavior:", err);
}

// ─── Trend Alert System ───────────────────────────────────────────────────────
// Every 6 hours, check if any tracked keyword has a rising velocity score.
// If velocity rose 20+ points since last check → send a Chrome notification.

const ALARM_NAME = "gaptuber-trend-check";
const CHECK_INTERVAL_MINUTES = 6 * 60; // 6 hours
const VELOCITY_SPIKE_THRESHOLD = 20;   // points rise to trigger alert
const API_URL = "https://gaptuber.app";

// Create (or re-create) the periodic alarm on install / update
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: CHECK_INTERVAL_MINUTES,
        delayInMinutes: 1, // First check 1 min after install
    });
    console.log("[GapTuber] Trend alert alarm scheduled (every 6h).");
});

// Also recreate alarm on service worker startup (alarms persist across restarts, but
// re-creating is idempotent — Chrome ignores duplicates with the same name)
chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MINUTES });

// Handle the alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    await checkTrendAlerts();
});

interface TrackedKeyword {
    keyword: string;
    gapScore: number;
    trackedAt: number;
    lastVelocity?: number;  // velocity score at last check (0–10 scale)
    lastCheckedAt?: number;
}

async function checkTrendAlerts(): Promise<void> {
    try {
        const stored = await chrome.storage.local.get(["trackedKeywords", "trendAlertHistory"]);
        const tracked: TrackedKeyword[] = (stored.trackedKeywords as TrackedKeyword[] | undefined) ?? [];

        if (!tracked.length) return;

        const alertsFired: string[] = (stored.trendAlertHistory as string[] | undefined) ?? [];

        for (const entry of tracked) {
            try {
                // Fetch fresh gap data for this keyword
                const res = await fetch(`${API_URL}/api/analyze`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ keyword: entry.keyword, competitors: [] }),
                    signal: AbortSignal.timeout(25_000),
                });

                if (!res.ok) continue;

                const data = await res.json() as { success?: boolean; analytics?: { velocity?: { score?: number } } };
                if (!data.success) continue;

                const currentVelocity = (data.analytics?.velocity?.score ?? 0) * 10; // Convert 0-10 to 0-100
                const previousVelocity = entry.lastVelocity ?? (entry.gapScore * 10);
                const rise = currentVelocity - previousVelocity;

                // Update stored velocity
                entry.lastVelocity = currentVelocity;
                entry.lastCheckedAt = Date.now();

                // Fire alert if velocity spiked significantly
                if (rise >= VELOCITY_SPIKE_THRESHOLD) {
                    const alertKey = `${entry.keyword}:${Math.floor(Date.now() / (12 * 60 * 60 * 1000))}`; // Once per 12h per keyword
                    if (!alertsFired.includes(alertKey)) {
                        await sendTrendNotification(entry.keyword, currentVelocity, rise);
                        alertsFired.push(alertKey);
                        // Keep only last 50 alert history entries
                        if (alertsFired.length > 50) alertsFired.splice(0, alertsFired.length - 50);
                    }
                }
            } catch { /* skip this keyword, try next */ }
        }

        // Persist updated velocities and alert history
        await chrome.storage.local.set({
            trackedKeywords: tracked,
            trendAlertHistory: alertsFired,
        });

    } catch (err) {
        console.error("[GapTuber Trend Alert] Error during check:", err);
    }
}

async function sendTrendNotification(keyword: string, velocity: number, rise: number): Promise<void> {
    const notifId = `gaptuber-trend-${Date.now()}`;
    chrome.notifications.create(notifId, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "📈 Trending Now — Time to Make This Video!",
        message: `"${keyword}" velocity rose +${Math.round(rise)} points (now ${Math.round(velocity)}/100). Your competitors are moving — strike now.`,
        priority: 2,
        buttons: [{ title: "Open GapTuber" }],
    });

    // Clicking the button opens the extension
    chrome.notifications.onButtonClicked.addListener((id, btnIdx) => {
        if (id === notifId && btnIdx === 0) {
            chrome.tabs.create({ url: `${API_URL}/dashboard` });
        }
    });

    console.log(`[GapTuber] Trend alert fired for: ${keyword} (+${Math.round(rise)} velocity)`);
}

// ─── Manual check trigger (from sidebar "Check Trends Now" button if added) ───
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "TRIGGER_TREND_CHECK") {
        checkTrendAlerts().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true; // async response
    }
});

export {};
