try {
  if (chrome.sidePanel) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
} catch (err) {
  console.error("[GapTuber] Failed to configure side panel behavior:", err);
}
const ALARM_NAME = "gaptuber-trend-check";
const CHECK_INTERVAL_MINUTES = 6 * 60;
const VELOCITY_SPIKE_THRESHOLD = 20;
const API_URL = "https://gaptuber.app";
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL_MINUTES,
    delayInMinutes: 1
    // First check 1 min after install
  });
  console.log("[GapTuber] Trend alert alarm scheduled (every 6h).");
});
chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MINUTES });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  await checkTrendAlerts();
});
async function checkTrendAlerts() {
  try {
    const stored = await chrome.storage.local.get(["trackedKeywords", "trendAlertHistory"]);
    const tracked = stored.trackedKeywords ?? [];
    if (!tracked.length) return;
    const alertsFired = stored.trendAlertHistory ?? [];
    for (const entry of tracked) {
      try {
        const res = await fetch(`${API_URL}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: entry.keyword, competitors: [] }),
          signal: AbortSignal.timeout(25e3)
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.success) continue;
        const currentVelocity = (data.analytics?.velocity?.score ?? 0) * 10;
        const previousVelocity = entry.lastVelocity ?? entry.gapScore * 10;
        const rise = currentVelocity - previousVelocity;
        entry.lastVelocity = currentVelocity;
        entry.lastCheckedAt = Date.now();
        if (rise >= VELOCITY_SPIKE_THRESHOLD) {
          const alertKey = `${entry.keyword}:${Math.floor(Date.now() / (12 * 60 * 60 * 1e3))}`;
          if (!alertsFired.includes(alertKey)) {
            await sendTrendNotification(entry.keyword, currentVelocity, rise);
            alertsFired.push(alertKey);
            if (alertsFired.length > 50) alertsFired.splice(0, alertsFired.length - 50);
          }
        }
      } catch {
      }
    }
    await chrome.storage.local.set({
      trackedKeywords: tracked,
      trendAlertHistory: alertsFired
    });
  } catch (err) {
    console.error("[GapTuber Trend Alert] Error during check:", err);
  }
}
async function sendTrendNotification(keyword, velocity, rise) {
  const notifId = `gaptuber-trend-${Date.now()}`;
  chrome.notifications.create(notifId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "📈 Trending Now — Time to Make This Video!",
    message: `"${keyword}" velocity rose +${Math.round(rise)} points (now ${Math.round(velocity)}/100). Your competitors are moving — strike now.`,
    priority: 2,
    buttons: [{ title: "Open GapTuber" }]
  });
  chrome.notifications.onButtonClicked.addListener((id, btnIdx) => {
    if (id === notifId && btnIdx === 0) {
      chrome.tabs.create({ url: `${API_URL}/dashboard` });
    }
  });
  console.log(`[GapTuber] Trend alert fired for: ${keyword} (+${Math.round(rise)} velocity)`);
}
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "TRIGGER_TREND_CHECK") {
    checkTrendAlerts().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
});
