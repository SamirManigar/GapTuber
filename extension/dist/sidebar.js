(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const PROD_URL = "https://gaptuber.app";
const LOCAL_URL = "http://localhost:3000";
let API_URL = PROD_URL;
const API_CACHE_KEY = "_apiUrl_v3";
const API_CACHE_TS_KEY = "_apiUrlAt_v3";
async function probeLocalhost() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3e3);
    await fetch(`${LOCAL_URL}/api/health`, {
      signal: ctrl.signal,
      cache: "no-store",
      mode: "no-cors"
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}
async function resolveApiUrl() {
  try {
    const cached = await chrome.storage.local.get([API_CACHE_KEY, API_CACHE_TS_KEY]);
    const cachedUrl = cached[API_CACHE_KEY];
    const cachedAt = cached[API_CACHE_TS_KEY];
    const ttl = cachedUrl === LOCAL_URL ? 5 * 60 * 1e3 : 30 * 60 * 1e3;
    if (cachedUrl && cachedAt && Date.now() - cachedAt < ttl) {
      API_URL = cachedUrl;
      return;
    }
  } catch {
  }
  const localUp = await probeLocalhost();
  API_URL = localUp ? LOCAL_URL : PROD_URL;
  chrome.storage.local.set({ [API_CACHE_KEY]: API_URL, [API_CACHE_TS_KEY]: Date.now() }).catch(() => {
  });
}
const channelResult = document.getElementById("channelResult");
const keyword = document.getElementById("keyword");
const keywordChipsEl = document.getElementById("keywordChips");
const gapChannel1 = document.getElementById("gapChannel1");
const gapChannel2 = document.getElementById("gapChannel2");
const gapChannel3 = document.getElementById("gapChannel3");
const gapResult = document.getElementById("gapResult");
function addChannelToGapScan(url) {
  if (!url) return;
  const cleanUrl = url.split("?")[0].replace(/\/(videos|featured|shorts|streams|playlists|community)$/i, "").replace(/\/$/, "");
  const inputs = [gapChannel1, gapChannel2, gapChannel3];
  if (inputs.some((input) => input.value.trim().includes(cleanUrl))) return;
  const emptyInput = inputs.find((input) => !input.value.trim());
  if (emptyInput) {
    emptyInput.value = cleanUrl;
  }
}
const seoTitle = document.getElementById("seoTitle");
const seoKeyword = document.getElementById("seoKeyword");
const seoDescription = document.getElementById("seoDescription");
const seoTags = document.getElementById("seoTags");
document.getElementById("runSeoBtn");
const seoResult = document.getElementById("seoResult");
const tagKeyword = document.getElementById("tagKeyword");
const tagNiche = document.getElementById("tagNiche");
document.getElementById("runTagBtn");
const tagResult = document.getElementById("tagResult");
const historyList = document.getElementById("historyList");
const trackedKeywordsList = document.getElementById("trackedKeywordsList");
async function saveAnalysisToHistory(data) {
  try {
    const stored = await chrome.storage.local.get("analysisHistory");
    const history = stored.analysisHistory ?? [];
    const entry = {
      id: `${Date.now()}`,
      channelName: data.channel?.name ?? "Unknown Channel",
      channelUrl: data.channel?.url ?? "",
      niche: data.niche ?? "General",
      savedAt: Date.now(),
      metrics: {
        viewVelocity: data.metrics.viewVelocity,
        hitRate: data.metrics.hitRate,
        averageViews: data.metrics.averageViews,
        postsPerWeek: data.metrics.postsPerWeek,
        uploadConsistency: data.metrics.uploadConsistency
      },
      data
    };
    const updated = [entry, ...history].slice(0, 5);
    await chrome.storage.local.set({ analysisHistory: updated });
  } catch {
  }
}
async function renderHistoryTab() {
  try {
    const stored = await chrome.storage.local.get("analysisHistory");
    const history = stored.analysisHistory ?? [];
    if (!history.length) {
      historyList.innerHTML = '<div class="history-empty">No analyses yet.<br/>Run a Channel Analysis to see history here.</div>';
      return;
    }
    historyList.innerHTML = history.map((h) => `
            <div class="history-card" data-id="${h.id}">
                <div class="history-card-header">
                    <span class="history-channel">${h.channelName}</span>
                    <span class="history-date">${new Date(h.savedAt).toLocaleDateString()}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                    <span class="history-niche">${h.niche}</span>
                </div>
                <div class="history-meta">
                    <span>⚡ ${h.metrics.viewVelocity}/100 vel</span>
                    <span>⭐ ${h.metrics.hitRate}/100 hit</span>
                    <span>👁️ ${formatNumber(h.metrics.averageViews)} avg</span>
                    <span>${postsPerWeekLabel(h.metrics.postsPerWeek)}</span>
                </div>
            </div>
        `).join("");
    historyList.querySelectorAll(".history-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        const entry = history.find((h) => h.id === id);
        if (!entry) return;
        document.querySelector('[data-tab="channel"]')?.click();
        renderChannelAnalysis(entry.data);
        const banner = document.createElement("div");
        banner.className = "success-banner";
        banner.style.marginBottom = "8px";
        banner.innerHTML = `🕐 Loaded from history · ${new Date(entry.savedAt).toLocaleString()}`;
        channelResult.prepend(banner);
        setTimeout(() => banner.remove(), 4e3);
      });
    });
  } catch {
  }
}
async function trackKeyword(kw, gapScore) {
  try {
    const stored = await chrome.storage.local.get("trackedKeywords");
    const tracked = stored.trackedKeywords ?? [];
    if (tracked.some((t) => t.keyword === kw)) return;
    tracked.unshift({ keyword: kw, gapScore, trackedAt: Date.now() });
    await chrome.storage.local.set({ trackedKeywords: tracked.slice(0, 20) });
    renderTrackedKeywords();
  } catch {
  }
}
async function renderTrackedKeywords() {
  try {
    const stored = await chrome.storage.local.get("trackedKeywords");
    const tracked = stored.trackedKeywords ?? [];
    if (!tracked.length) {
      trackedKeywordsList.innerHTML = '<div class="history-empty">No tracked keywords.<br/>Click "📡 Track" in Gap Scanner results.</div>';
      return;
    }
    trackedKeywordsList.innerHTML = tracked.map((t) => `
            <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #1e1e22">
                <span style="flex:1;font-size:11px;color:#e4e4e7;font-family:monospace">${t.keyword}</span>
                <span style="font-size:10px;color:#818cf8;font-family:monospace">${t.gapScore.toFixed(1)}/10</span>
                <button class="untrack-btn" data-kw="${t.keyword.replace(/"/g, "&quot;")}" style="font-size:9px;color:#52525b;background:none;border:1px solid #1e1e22;border-radius:4px;padding:2px 6px;cursor:pointer;font-family:monospace">✕</button>
            </div>
        `).join("");
    trackedKeywordsList.querySelectorAll(".untrack-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const kw = btn.dataset.kw ?? "";
        const s = await chrome.storage.local.get("trackedKeywords");
        const arr = s.trackedKeywords ?? [];
        await chrome.storage.local.set({ trackedKeywords: arr.filter((t) => t.keyword !== kw) });
        renderTrackedKeywords();
      });
    });
  } catch {
  }
}
async function analyzeCompetitorChannel(url) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (!tabId) return;
  await chrome.tabs.update(tabId, { url: url + "/videos" });
  document.querySelector('[data-tab="channel"]')?.click();
  showLoading(channelResult, `Opening competitor...`, "Navigating to channel, please wait");
  await new Promise((r) => setTimeout(r, 4e3));
  runChannelAnalysis();
}
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${tab}`)?.classList.add("active");
    if (tab === "history") {
      renderHistoryTab();
      renderTrackedKeywords();
    }
  });
});
function showLoading(container, msg, sub, steps) {
  const stepsHtml = steps ? `
        <div class="loading-steps">
            ${steps.map((s, i) => `<div class="loading-step" id="step-${i}"><div class="step-dot"></div>${s}</div>`).join("")}
        </div>` : "";
  container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <div class="loading-text">${msg}</div>
            ${sub ? `<div class="loading-sub">${sub}</div>` : ""}
            ${stepsHtml}
        </div>`;
}
function showError(container, msg) {
  container.innerHTML = `<div class="error-state">⚠️ ${msg}</div>`;
}
const SCORE_TOOLTIPS = {
  "Velocity": "How fast recent videos are growing views/day vs older ones. >57 = growing, 43-57 = stable, <43 = declining.",
  "Consistency": "How regularly the channel publishes. 100 = perfectly consistent posting cadence.",
  "Hit Rate": "How much better the top 3 videos perform vs the channel median. Higher = stronger hit potential.",
  "SEO": "Search demand vs competition for this keyword. Higher = easier to rank with strong demand.",
  "Growth": "Channel growth alignment + topic trend acceleration. Higher = rising opportunity.",
  "Gap": "Combined opportunity score: SEO + Growth + Uniqueness. Higher = bigger gap to fill.",
  "Unique": "How underserved this topic is vs the channel's existing content. Higher = fresher angle.",
  "Trending": "Recent upload activity in this topic cluster. Higher = more creators are covering it now.",
  "Gap Size": "How much of this topic the channel is NOT covering. Higher = bigger content gap to exploit."
};
function scoreBar(label, score, fillClass) {
  const tip = SCORE_TOOLTIPS[label] ?? "";
  return `
        <div class="score-item">
            <span class="score-label" title="${tip}">${label}${tip ? ' <span style="color:#4b5563;font-size:8px">?</span>' : ""}</span>
            <div class="score-track"><div class="score-fill ${fillClass}" style="width:${score}%"></div></div>
            <span class="score-pct">${score}%</span>
        </div>`;
}
function competitionBadge(level) {
  const cls = level === "Low" ? "badge-green" : level === "Medium" ? "badge-amber" : "badge-red";
  return `<span class="badge ${cls}">${level}</span>`;
}
function formatNumber(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}
function postsPerWeekLabel(ppw) {
  if (!ppw || ppw <= 0) return "?";
  if (ppw >= 7) return "Daily";
  if (ppw >= 4) return `${Math.round(ppw)}×/week`;
  if (ppw >= 1) return `${Math.round(ppw)}×/week`;
  const perMonth = Math.round(ppw * 4);
  return perMonth <= 1 ? "~1×/month" : `~${perMonth}×/month`;
}
async function getSessionToken() {
  try {
    const allCookies = await chrome.cookies.getAll({ domain: "localhost" });
    const sessionCookies = allCookies.filter((c) => c.name.includes("session-token"));
    if (!sessionCookies.length) return void 0;
    const chunks = sessionCookies.filter((c) => /\.\d+$/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name));
    if (chunks.length > 0) {
      const fullToken = chunks.map((c) => c.value).join("");
      return fullToken;
    }
    return sessionCookies[0].value;
  } catch (e) {
    console.error("[GapTuber] getSessionToken error:", e);
    return void 0;
  }
}
function showToast(msg, type = "success") {
  const existing = document.getElementById("gt-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "gt-toast";
  const bg = type === "success" ? "rgba(16,185,129,0.15)" : type === "warn" ? "rgba(251,191,36,0.12)" : "rgba(239,68,68,0.12)";
  const border = type === "success" ? "rgba(16,185,129,0.3)" : type === "warn" ? "rgba(251,191,36,0.3)" : "rgba(239,68,68,0.3)";
  const color = type === "success" ? "#34d399" : type === "warn" ? "#fbbf24" : "#f87171";
  toast.style.cssText = `position:fixed;top:10px;left:50%;transform:translateX(-50%);background:${bg};border:1px solid ${border};border-radius:8px;padding:7px 14px;font-size:11px;color:${color};font-weight:600;z-index:9999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:fadeIn 0.2s ease`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
async function saveScanToServer(payload) {
  try {
    const sessionToken = await getSessionToken();
    const res = await fetch(`${API_URL}/api/save-scan`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...sessionToken ? { "X-Session-Cookie": sessionToken } : {}
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.status === 401) {
      console.warn("[SaveScan] Not signed in to dashboard");
      if (!payload.silent) {
        const dashUrl = API_URL === LOCAL_URL ? "localhost:3000" : "gaptuber.app";
        showToast(`⚠️ Sign in at ${dashUrl} to save scans`, "warn");
        if (payload.containerEl) {
          const notice = document.createElement("div");
          notice.style.cssText = "background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:8px 12px;margin-bottom:8px;display:flex;align-items:center;gap:8px;font-size:11px;color:#fbbf24;";
          notice.innerHTML = `⚠️ <span>Sign in at <a href="${API_URL}" target="_blank" style="color:#fbbf24;text-decoration:underline">${dashUrl}</a> to save scans to your dashboard</span>`;
          payload.containerEl.insertAdjacentElement("afterbegin", notice);
        }
      }
      return { success: false };
    }
    if (data.success) {
      if (!payload.silent) showToast("✅ Saved to your GapTuber Dashboard!");
      return { success: true, id: data.id };
    } else {
      console.warn("[SaveScan] Failed:", data.error);
      if (!payload.silent) showToast("❌ Save failed: " + (data.error ?? "unknown error"), "error");
      return { success: false };
    }
  } catch (err) {
    console.error("[SaveScan] Error:", err);
    if (!payload.silent) showToast("❌ Could not reach the dashboard server", "error");
    return { success: false };
  }
}
async function saveIdeaToVault(gap, keyword2) {
  try {
    const sessionToken = await getSessionToken();
    const res = await fetch(`${API_URL}/api/save-idea`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...sessionToken ? { "X-Session-Cookie": sessionToken } : {}
      },
      body: JSON.stringify({
        ideas: [{
          title: gap.title,
          hook: gap.hook,
          format: gap.format,
          whyItWorks: gap.reasoning,
          estimatedViewPotential: gap.gapScore >= 8 ? "high" : gap.gapScore >= 5 ? "medium" : "low",
          targetAudience: gap.targetAudience ?? "",
          signalSource: `gap-scanner:${keyword2}`,
          tags: []
        }],
        mode: "append"
      })
    });
    const data = await res.json();
    if (res.status === 401) {
      const dashUrl = API_URL === LOCAL_URL ? "localhost:3000" : "gaptuber.app";
      showToast(`⚠️ Sign in at ${dashUrl} to save ideas`, "warn");
    } else if (data.success) {
      showToast("💡 Idea saved to your Vault!");
    } else {
      showToast("❌ " + (data.error ?? "Failed to save idea"), "error");
    }
  } catch (err) {
    console.error("[SaveIdea] Error:", err);
    showToast("❌ Could not reach the dashboard server", "error");
  }
}
async function detectCurrentChannel() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.url) return null;
    const url = new URL(tab.url);
    if (!url.hostname.includes("youtube.com")) return null;
    const path = url.pathname;
    const handleMatch = path.match(/^\/@([A-Za-z0-9_.\-]+)/);
    if (handleMatch) return `https://www.youtube.com/@${handleMatch[1]}`;
    const channelMatch = path.match(/^\/channel\/([A-Za-z0-9_\-]+)/);
    if (channelMatch) return `https://www.youtube.com/channel/${channelMatch[1]}`;
    return null;
  } catch {
    return null;
  }
}
function renderKeywordChips(kw) {
  if (!kw.trim()) {
    keywordChipsEl.innerHTML = "";
    return;
  }
  const suggestions = [
    `${kw} tutorial 2026`,
    `beginner guide to ${kw}`,
    `${kw} explained`,
    `${kw} tips & tricks`,
    `${kw} crash course`,
    `${kw} vs alternatives`,
    `how to ${kw}`,
    `${kw} for beginners`
  ];
  keywordChipsEl.innerHTML = suggestions.map((s) => `
        <div class="kw-chip" data-value="${s.replace(/"/g, "&quot;")}">
            <span>${s}</span><span class="kw-chip-add">+</span>
        </div>`).join("");
  keywordChipsEl.querySelectorAll(".kw-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      keyword.value = chip.dataset.value ?? "";
      keywordChipsEl.innerHTML = "";
    });
  });
}
let kwDebounce;
keyword.addEventListener("input", () => {
  clearTimeout(kwDebounce);
  kwDebounce = setTimeout(() => renderKeywordChips(keyword.value), 300);
});
async function runChannelAnalysis() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  const tabUrl = tabs[0]?.url ?? "";
  const isChannelPage = /youtube\.com\/@|youtube\.com\/channel\//i.test(tabUrl);
  if (!isChannelPage || !tabId) {
    showError(channelResult, "Please navigate to a YouTube channel page to analyze it.");
    return;
  }
  const baseUrl = tabUrl.split("?")[0].replace(/\/$/, "");
  const cleanUrl = baseUrl.replace(/\/(featured|shorts|streams|playlists|community)$/i, "");
  keyword.value = "";
  gapChannel1.value = "";
  gapChannel2.value = "";
  gapChannel3.value = "";
  gapResult.innerHTML = "";
  if (!tabUrl.includes("/videos")) {
    const videosUrl = cleanUrl + "/videos";
    showLoading(channelResult, "Redirecting...", "Navigating to the Videos tab to collect data.");
    await chrome.tabs.update(tabId, { url: videosUrl });
    await new Promise((r) => setTimeout(r, 3e3));
  }
  showLoading(channelResult, `Scraping channel...`, "Extracting latest videos directly from the page", [
    "Extracting videos",
    "Computing metrics",
    "Running AI analysis",
    "Generating insights"
  ]);
  const stepTimers = [];
  const advanceStep = (idx) => {
    const el = document.getElementById(`step-${idx}`);
    if (el) {
      el.style.color = "#34d399";
      const dot = el.querySelector(".step-dot");
      if (dot) {
        dot.style.background = "#34d399";
        dot.style.boxShadow = "0 0 6px #34d399";
      }
    }
  };
  stepTimers.push(setTimeout(() => advanceStep(0), 800));
  stepTimers.push(setTimeout(() => advanceStep(1), 3e3));
  stepTimers.push(setTimeout(() => advanceStep(2), 6e3));
  stepTimers.push(setTimeout(() => advanceStep(3), 1e4));
  const clearStepTimers = () => stepTimers.forEach((t) => clearTimeout(t));
  let scrapedData = null;
  try {
    const isAlive = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: "PING" }, (r) => {
        if (chrome.runtime.lastError || !r?.pong) {
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
    if (!isAlive) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content.js"]
        });
        await new Promise((r) => setTimeout(r, 1200));
      } catch {
      }
    }
    let attempts = 0;
    while (attempts < 6) {
      scrapedData = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: "RESCRAPE_NOW" }, (r) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          if (!r?.success) {
            resolve(null);
            return;
          }
          resolve({
            videos: r.data.videos,
            channelInfo: { name: r.data.channelName, subscribers: r.data.subscriberCount }
          });
        });
      });
      if (scrapedData && scrapedData.videos && scrapedData.videos.length > 0) {
        break;
      }
      attempts++;
      if (attempts < 6) await new Promise((r) => setTimeout(r, 2e3));
    }
    if (!scrapedData) throw new Error("Connection failed");
  } catch (err) {
    clearStepTimers();
    showError(channelResult, `Could not connect to the page. Try refreshing the YouTube tab and clicking Analyze again.`);
    return;
  }
  if (!scrapedData || !scrapedData.videos || !scrapedData.videos.length) {
    clearStepTimers();
    showError(channelResult, [
      "No videos found on this page.",
      scrapedData === null ? "The content script could not connect — try refreshing the YouTube tab." : "YouTube's layout may have changed, or the Videos tab is still loading. Scroll down on the channel page to trigger video loading, then retry."
    ].join(" "));
    return;
  }
  const sessionToken = await getSessionToken();
  try {
    const res = await fetch(`${API_URL}/api/channel-analyze`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...sessionToken ? { "X-Session-Token": sessionToken } : {}
      },
      body: JSON.stringify({
        channelUrl: tabUrl,
        videos: scrapedData.videos,
        channelInfo: scrapedData.channelInfo
      })
    });
    if (res.status === 429) {
      const d = await res.json();
      showError(channelResult, d.error ?? "API quota exceeded. Try again tomorrow.");
      return;
    }
    if (!res.ok) {
      const d = await res.json();
      showError(channelResult, d.error ?? d.message ?? "Analysis failed. Please retry.");
      return;
    }
    const data = await res.json();
    clearStepTimers();
    if (!data.success) {
      showError(channelResult, "Analysis returned empty. Please retry.");
      return;
    }
    renderChannelAnalysis(data);
  } catch (err) {
    clearStepTimers();
    console.error("[Channel Analyze]", err);
    showError(channelResult, "Could not reach the server. Check your connection.");
  }
}
function renderChannelAnalysis(r) {
  const { metrics, niche, summary, keywords, competitors, contentOpportunityGaps, growthActions, revenue, uploadSchedule, topPerformers } = r;
  const trendIcon = metrics.recentTrend === "growing" ? "📈" : metrics.recentTrend === "stable" ? "➡️" : "📉";
  const subCount = r.channel?.subscribers;
  const subLabel = subCount && subCount > 0 ? formatNumber(subCount) + " subs" : "";
  const avgViews = metrics.averageViews;
  channelResult.innerHTML = `
        <!-- Channel Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="niche-badge" style="margin-bottom:0">🎯 ${niche}</div>
            ${subLabel ? `<div style="font-size:10px;font-weight:700;color:#64748b;font-family:monospace">👤 ${subLabel}</div>` : ""}
        </div>
        <div class="channel-summary">${summary}</div>

        <!-- Key Metrics (2×2 grid — 4 cards) -->
        <div class="metrics-grid" style="grid-template-columns:repeat(2,1fr)">
            <div class="metric-card">
                <div class="metric-value" style="color:${metrics.viewVelocity >= 57 ? "#34d399" : metrics.viewVelocity >= 43 ? "#fbbf24" : "#f87171"}">${metrics.viewVelocity}</div>
                <div class="metric-label">${trendIcon} Velocity</div>
                <div class="metric-sub">/100</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.hitRate}</div>
                <div class="metric-label">⭐ Hit Rate</div>
                <div class="metric-sub">/100</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${formatNumber(metrics.averageViews)}</div>
                <div class="metric-label">👁️ Avg Views</div>
                <div class="metric-sub">per video</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${postsPerWeekLabel(metrics.postsPerWeek)}</div>
                <div class="metric-label">📅 Posts/Week</div>
                <div class="metric-sub">frequency</div>
            </div>
        </div>

        <!-- Score Bars -->
        <div class="card">
            <div class="card-title" style="margin-bottom:8px">📊 Channel Health Scores</div>
            ${scoreBar("Velocity", metrics.viewVelocity, "fill-emerald")}
            ${scoreBar("Consistency", metrics.uploadConsistency, "fill-blue")}
            ${scoreBar("Hit Rate", metrics.hitRate, "fill-amber")}
        </div>

        <!-- Top Performers -->
        ${topPerformers.length ? `
        <div class="section-divider">🏆 Top Performing Videos</div>
        ${topPerformers.slice(0, 3).map((v) => `
            <div class="card" style="padding:8px 10px">
                <div style="font-size:11.5px;font-weight:600;color:#e2e8f0;line-height:1.35;margin-bottom:4px">${v.title}</div>
                <div style="display:flex;gap:10px;align-items:center;font-size:10px;color:#64748b">
                    <span>👁️ ${formatNumber(v.views)}</span>
                    <span>📅 ${new Date(v.uploadDate).toLocaleDateString()}</span>
                    ${v.likeRate && parseFloat(v.likeRate) > 0 ? `<span style="color:${parseFloat(v.likeRate) >= 4 ? "#34d399" : "#64748b"}">❤️ ${v.likeRate}%</span>` : `<span style="color:#3f3f46;font-size:9px;font-family:monospace">❤️ N/A</span>`}
                    ${v.views >= avgViews * 3 ? '<span style="background:rgba(251,191,36,.12);color:#fbbf24;font-size:9px;padding:1px 5px;border-radius:20px;font-weight:700">🔥 Viral</span>' : ""}
                </div>
            </div>`).join("")}` : ""}

        <!-- Keyword Opportunities -->
        <div class="section-divider">🔑 Keyword Opportunities (${keywords.length})
            <button id="exportKwCsv" title="Export keywords as CSV" style="margin-left:auto;background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.3);color:#818cf8;font-size:8px;font-weight:700;padding:2px 7px;border-radius:10px;cursor:pointer;font-family:monospace;text-transform:uppercase;letter-spacing:.04em">💾 Export CSV</button>
        </div>
        ${keywords.map((kw) => `
            <div class="kw-card" data-keyword="${kw.keyword.replace(/"/g, "&quot;")}">
                <div class="kw-card-header">
                    <div class="kw-name">${kw.keyword}</div>
                    ${competitionBadge(kw.competition)}
                </div>
                <div style="display:flex;flex-direction:column;gap:3px">
                    ${scoreBar("SEO", kw.seoScore, "fill-blue")}
                    ${scoreBar("Growth", kw.growthScore, "fill-emerald")}
                    ${scoreBar("Gap", kw.gapScore, "fill-purple")}
                    ${scoreBar("Unique", kw.uniquenessScore, "fill-amber")}
                </div>
                <div class="kw-reasoning">${kw.reasoning}</div>
                <div class="kw-hook">"${kw.hook}"</div>
            </div>`).join("")}

        <!-- Content Opportunity Gaps -->
        ${contentOpportunityGaps.length ? `
        <div class="section-divider">⚡ Content Opportunity Gaps</div>
        ${contentOpportunityGaps.map((g) => `
            <div class="gap-index-card">
                <div class="gap-index-header">
                    <span class="gap-index-name">${g.clusterName}</span>
                    <span class="opportunity-score">${g.opportunityIndex}/100</span>
                </div>
                ${scoreBar("Trending", g.trendingAcceleration, "fill-emerald")}
                ${scoreBar("Gap Size", Math.round(100 - g.channelPresence), "fill-purple")}
                <div class="gap-insight">${g.insight}</div>
            </div>`).join("")}` : ""}

        <!-- Growth Actions -->
        ${growthActions.length ? `
        <div class="section-divider">🚀 30-Day Growth Actions</div>
        ${growthActions.map((action, i) => `
            <div class="action-item">
                <div class="action-num">${i + 1}</div>
                <div class="action-text">${action}</div>
            </div>`).join("")}` : ""}

        <!-- Competitors -->
        ${competitors.length ? `
        <div class="section-divider">🏆 Competitors <span class="ai-tag">(AI-identified)</span></div>
        ${competitors.map((c) => `
            <div class="competitor-card">
                <span class="competitor-handle">${c.handle}</span>
                <span class="competitor-reason">${c.reason}</span>
                <span class="overlap-pct">${c.topicOverlap}%</span>
                <button class="add-btn" data-url="https://www.youtube.com/${c.handle}">+ Add</button>
                <button class="analyze-btn" data-url="https://www.youtube.com/${c.handle}">🔍 Analyze</button>
            </div>`).join("")}` : ""}

        <!-- Top Patterns -->
        ${r.topPatterns.length ? `
        <div class="section-divider">💡 Content Patterns That Work</div>
        <div class="card">
            ${r.topPatterns.map((p, i) => `
                <div style="display:flex;gap:6px;padding:4px 0;border-bottom:1px solid #1e293b;font-size:11px;color:#94a3b8">
                    <span style="color:#6366f1;font-weight:700">${i + 1}.</span>${p}
                </div>`).join("")}
        </div>` : ""}

        <a href="${API_URL}/dashboard" target="_blank" class="view-all" style="margin-top:10px">
            View Full Dashboard →
        </a>
    `;
  channelResult.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url ?? "";
      btn.textContent = "✓ Added";
      btn.style.color = "#34d399";
      addChannelToGapScan(url);
    });
  });
  channelResult.querySelectorAll(".analyze-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url ?? "";
      analyzeCompetitorChannel(url);
    });
  });
  saveAnalysisToHistory(r);
  channelResult.querySelectorAll(".kw-card").forEach((card) => {
    card.addEventListener("click", () => {
      keyword.value = card.dataset.keyword ?? "";
      document.querySelector('[data-tab="gap"]')?.click();
      document.querySelector(".main-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  document.getElementById("exportKwCsv")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const header = ["Keyword", "Competition", "SEO Score", "Growth Score", "Gap Score", "Uniqueness Score", "Hook"];
    const rows = keywords.map((kw) => [
      `"${kw.keyword.replace(/"/g, '""')}"`,
      kw.competition,
      kw.seoScore,
      kw.growthScore,
      kw.gapScore,
      kw.uniquenessScore,
      `"${kw.hook.replace(/"/g, '""')}"`
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gaptuber-keywords-${niche.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
async function runMultiKeywordScan(keywords) {
  const channels = [gapChannel1.value.trim(), gapChannel2.value.trim(), gapChannel3.value.trim()].filter(Boolean);
  const sessionToken = await getSessionToken();
  showLoading(
    gapResult,
    `Scanning ${keywords.length} keyword cluster...`,
    keywords.map((k, i) => `${i + 1}. ${k}`).join(" · "),
    [
      `Analyzing: ${keywords[0]}`,
      keywords[1] ? `Analyzing: ${keywords[1]}` : "Processing...",
      keywords[2] ? `Analyzing: ${keywords[2]}` : "Merging results",
      "Synthesizing cluster gaps"
    ]
  );
  const results = [];
  await Promise.all(keywords.slice(0, 3).map(async (kw, idx) => {
    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...sessionToken ? { "X-Session-Cookie": sessionToken } : {} },
        body: JSON.stringify({ keyword: kw, competitors: channels })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.gaps?.length) results.push(data);
      }
    } catch {
    }
  }));
  if (!results.length) {
    showError(gapResult, "No gaps found across the keyword cluster. Try different keywords or add competitor channels.");
    return;
  }
  const allGaps = results.flatMap(
    (r) => (r.gaps ?? []).map((g) => ({ ...g, _sourceKw: r.keyword }))
  );
  const uniqueGaps = [];
  for (const g of allGaps) {
    const wordsA = new Set(g.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const isDupe = uniqueGaps.some((existing) => {
      const wordsB = new Set(existing.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
      const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
      const union = (/* @__PURE__ */ new Set([...wordsA, ...wordsB])).size;
      return union > 0 && intersection / union > 0.6;
    });
    if (!isDupe) uniqueGaps.push(g);
  }
  uniqueGaps.sort((a, b) => b.gapScore - a.gapScore);
  const primaryResult = results.find((r) => r.analytics) ?? results[0];
  const mergedData = {
    ...primaryResult,
    keyword: keywords.join(" · "),
    gaps: uniqueGaps.slice(0, 6),
    // Show up to 6 for cluster scans
    meta: {
      videoCount: results.reduce((s, r) => s + (r.meta?.videoCount ?? 0), 0),
      commentCount: results.reduce((s, r) => s + (r.meta?.commentCount ?? 0), 0),
      candidatesEvaluated: results.reduce((s, r) => s + (r.meta?.candidatesEvaluated ?? 0), 0),
      confidence: results.reduce((s, r) => s + (r.meta?.confidence ?? 0.75), 0) / results.length
    }
  };
  renderGapResult(mergedData);
  const clusterBanner = document.createElement("div");
  clusterBanner.style.cssText = "background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:9px 12px;margin-bottom:10px;font-size:10px;";
  clusterBanner.innerHTML = `
        <div style="font-weight:700;color:#818cf8;margin-bottom:4px;font-family:monospace;text-transform:uppercase;letter-spacing:.05em">🔗 Multi-Keyword Cluster (${results.length}/${keywords.length} analyzed)</div>
        ${keywords.map((k, i) => {
    const r = results.find((r2) => r2.keyword === k);
    return `<span style="display:inline-block;margin:2px 3px 2px 0;padding:2px 7px;border-radius:5px;font-family:monospace;font-size:9px;${r ? "background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25);color:#34d399" : "background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);color:#f87171"}">${k}${r ? ` · ${r.gaps?.length ?? 0} gaps` : " (failed)"}</span>`;
  }).join("")}
        <div style="color:#52525b;margin-top:4px">${uniqueGaps.length} unique gaps across cluster · sorted by score</div>
    `;
  gapResult.insertAdjacentElement("afterbegin", clusterBanner);
}
async function runGapScan() {
  const rawInput = keyword.value.trim();
  if (!rawInput) {
    showError(gapResult, "Type a keyword to run a gap scan.");
    return;
  }
  const keywords = rawInput.split(",").map((k) => k.trim()).filter(Boolean);
  if (keywords.length > 1) {
    await runMultiKeywordScan(keywords);
    return;
  }
  const kw = rawInput;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  const tabUrl = tabs[0]?.url ?? "";
  const isVideoPage = tabUrl.includes("youtube.com/watch");
  const isChannelPage = /youtube\.com\/@|youtube\.com\/channel\//i.test(tabUrl);
  if (isVideoPage && tabId) {
    showLoading(gapResult, "Mining comments...", "Scrolling & extracting top viewer pain points", [
      "Triggering comment load",
      "Collecting top comments",
      "Sending to AI engine",
      "Generating gap ideas"
    ]);
    let commentResponse;
    try {
      commentResponse = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { type: "SCRAPE_VIDEO_COMMENTS" }, (r) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(r ?? { success: false, reason: "no_response" });
        });
      });
    } catch (err) {
      showError(gapResult, `Could not reach content script: ${String(err)}`);
      return;
    }
    if (!commentResponse.success || !commentResponse.comments?.length) {
      showError(
        gapResult,
        commentResponse.reason === "not_video_page" ? "Navigate to a YouTube video page to use Comment Mining mode." : `Could not scrape comments. Please wait a moment and try again.`
      );
      return;
    }
    showLoading(gapResult, "AI analysing comments...", `Found ${commentResponse.comments.length} comments — running Groq analysis`);
    try {
      const sessionToken = await getSessionToken();
      const res = await fetch(`${API_URL}/api/gap-scanner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...sessionToken ? { "X-Session-Token": sessionToken } : {}
        },
        body: JSON.stringify({
          keyword: kw,
          videoTitle: commentResponse.videoTitle ?? "Unknown Video",
          comments: commentResponse.comments
        })
      });
      if (!res.ok) {
        const err = await res.json();
        showError(gapResult, err.error ?? "Gap scanner API error.");
        return;
      }
      const data = await res.json();
      if (!data.success || !data.gaps?.length) {
        showError(gapResult, "No gaps found. Try a video with more comments.");
        return;
      }
      renderGapResult({ ...data, analytics: null, meta: { videoCount: 0, commentCount: commentResponse.comments.length, candidatesEvaluated: data.gaps.length, confidence: 0.85 } });
      saveScanToServer({
        keyword: kw,
        competitors: [],
        result: {
          gaps: data.gaps,
          overallOpportunity: data.overallOpportunity
        },
        rawData: {
          source: "comment-mine",
          videoTitle: commentResponse.videoTitle ?? "Unknown Video",
          commentCount: commentResponse.comments.length,
          commentInsights: data.commentInsights
        },
        containerEl: gapResult
      });
      if (data.commentInsights) {
        const ins = data.commentInsights;
        const insightBanner = `
                    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:10px 12px;margin-bottom:8px">
                        <div style="font-size:10px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">💬 Comment Mine Report · ${ins.totalAnalyzed} comments analyzed</div>
                        <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">😤 <strong style="color:#f87171">${ins.frustrationRate}%</strong> of comments express frustration or unanswered questions</div>
                        ${ins.topPainPoints.length ? `<div style="font-size:10px;color:#64748b;margin-top:5px">⚡ Top pain points: ${ins.topPainPoints.slice(0, 3).join(" · ")}</div>` : ""}
                        ${ins.topQuestions.length ? `<div style="font-size:10px;color:#6366f1;margin-top:3px">❓ Top asks: ${ins.topQuestions.slice(0, 2).join(" · ")}</div>` : ""}
                    </div>`;
        gapResult.insertAdjacentHTML("afterbegin", insightBanner);
      }
    } catch (err) {
      console.error("[Comment Mine]", err);
      showError(gapResult, "Unexpected error. Please try again.");
    }
    return;
  }
  const channels = [gapChannel1.value.trim(), gapChannel2.value.trim(), gapChannel3.value.trim()].filter(Boolean);
  if (isChannelPage && tabUrl) {
    const cleanTabUrl = tabUrl.split("?")[0].replace(/\/(videos|featured|shorts|streams|playlists|community)$/i, "").replace(/\/$/, "");
    if (!channels.some((c) => c.includes(cleanTabUrl))) {
      channels.unshift(cleanTabUrl);
    }
  }
  if (!channels.length) {
    showError(gapResult, "Open a YouTube video (comment mining) or add competitor channel URLs below.");
    return;
  }
  const validChannels = channels.slice(0, 3).filter((c) => {
    try {
      return new URL(c).hostname.includes("youtube.com");
    } catch {
      return false;
    }
  });
  if (!validChannels.length) {
    showError(gapResult, "Enter valid YouTube channel URLs.");
    return;
  }
  if (!tabId) {
    showError(gapResult, "No active YouTube tab found.");
    return;
  }
  showLoading(gapResult, "Scanning channels...", "Analyzing video velocity & gaps", [
    "Scraping YouTube data",
    "Computing gap scores",
    "Running AI analysis",
    "Generating recommendations"
  ]);
  try {
    showLoading(gapResult, "Running AI analysis...", "Detecting content gaps with advanced algorithms (fetching competitor data via API)");
    const sessionToken = await getSessionToken();
    const res = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...sessionToken ? { "X-Session-Cookie": sessionToken } : {} },
      body: JSON.stringify({ keyword: kw, competitors: validChannels })
    });
    if (res.status === 429) {
      const d = await res.json();
      showError(gapResult, d.message);
      return;
    }
    if (!res.ok) {
      const d = await res.json();
      showError(gapResult, d.message ?? "API error.");
      return;
    }
    const data = await res.json();
    if (!data.success || !data.gaps?.length) {
      showError(gapResult, "No gaps found. Try different channels or keywords.");
      return;
    }
    renderGapResult(data);
    saveScanToServer({
      keyword: kw,
      competitors: validChannels,
      result: {
        gaps: data.gaps,
        overallOpportunity: data.overallOpportunity
      },
      analytics: data.analytics ?? null,
      rawData: {
        source: "channel-scrape",
        videoCount: data.meta?.videoCount ?? 0,
        commentCount: data.meta?.commentCount ?? 0
      }
    });
  } catch (err) {
    console.error("[Gap Scan]", err);
    showError(gapResult, "Unexpected error. Please try again.");
  }
}
function renderGapResult(data) {
  const { gaps, analytics, meta } = data;
  const topGap = gaps[0];
  const scoreColor = topGap.gapScore >= 8 ? "#a78bfa" : topGap.gapScore >= 6 ? "#60a5fa" : topGap.gapScore >= 4 ? "#fbbf24" : "#64748b";
  const vScore = analytics?.velocity?.score ?? 0;
  const sScore = analytics?.saturation?.score ?? 0;
  const fScore = analytics?.frustration?.score ?? 0;
  const tScore = analytics?.trend?.score ?? 0;
  const cScore = analytics?.competition?.score ?? 0;
  const conf = meta?.confidence ?? 0;
  analytics?.frustration?.sentimentBreakdown ?? {};
  gapResult.innerHTML = `
        <!-- Analytics Overview -->
        <div class="metrics-grid" style="margin-top:8px">
            <div class="metric-card">
                <div class="metric-value" style="color:${vScore >= 6 ? "#34d399" : "#fbbf24"}">${vScore.toFixed(1)}</div>
                <div class="metric-label">📈 Velocity</div>
                <div class="metric-sub">/10</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color:${sScore >= 6 ? "#34d399" : sScore >= 3 ? "#fbbf24" : "#f87171"}">${sScore.toFixed(1)}</div>
                <div class="metric-label">🎯 Open Space</div>
                <div class="metric-sub">↑ = more open</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${fScore.toFixed(1)}</div>
                <div class="metric-label">😤 Frustration</div>
                <div class="metric-sub">/10</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${tScore.toFixed(1)}</div>
                <div class="metric-label">📊 Trend</div>
                <div class="metric-sub">/10</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${cScore.toFixed(1)}</div>
                <div class="metric-label">🥊 Ease</div>
                <div class="metric-sub">/10</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${(conf * 100).toFixed(0)}%</div>
                <div class="metric-label">🎯 Confidence</div>
                <div class="metric-sub">data quality</div>
            </div>
        </div>



        <!-- Pain Points -->
        ${analytics?.frustration?.painPoints?.length ? `
        <div class="section-divider">😤 Audience Pain Points</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px">
            ${analytics.frustration.painPoints.map((p) => `<span class="pain-point">⚡ ${p}</span>`).join("")}
        </div>` : ""}

        <!-- Top Gap -->
        <div class="section-divider">🎯 Top Content Gaps (${gaps.length})</div>
        ${gaps.map((gap, i) => `
            <div class="gap-card">
                <div class="gap-card-header">
                    <span class="gap-label">Gap #${i + 1}</span>
                    <span class="gap-score-badge" style="background:${i === 0 ? scoreColor : "rgba(255,255,255,0.15)"}">${gap.gapScore}/10</span>
                </div>
                <div class="gap-body">
                    <div class="gap-title" style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
                        <span>${gap.title}</span>
                        <button class="copy-title-btn" data-copy="${gap.title.replace(/"/g, "&quot;")}" title="Copy title" style="flex-shrink:0;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);color:#818cf8;font-size:9px;padding:2px 6px;border-radius:5px;cursor:pointer;font-family:monospace;white-space:nowrap">📋 Copy</button>
                    </div>
                    <div class="gap-hook">
                        <div class="hook-label" style="display:flex;align-items:center;justify-content:space-between">
                            <span>🎣 Hook</span>
                            <button class="copy-hook-btn" data-copy="${gap.hook.replace(/"/g, "&quot;")}" title="Copy hook" style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);color:#818cf8;font-size:9px;padding:2px 6px;border-radius:5px;cursor:pointer;font-family:monospace">📋 Copy</button>
                        </div>
                        <div class="hook-text">"${gap.hook}"</div>
                    </div>
                    <div class="gap-meta-grid">
                        <div class="gap-meta-item">
                            <div class="gap-meta-label">📹 Format</div>
                            <div class="gap-meta-value">${gap.format}</div>
                        </div>
                        <div class="gap-meta-item">
                            <div class="gap-meta-label">💰 Monetization</div>
                            <div class="gap-meta-value">${gap.monetizationAngle}</div>
                        </div>
                        ${gap.targetAudience ? `
                        <div class="gap-meta-item" style="grid-column:1/-1">
                            <div class="gap-meta-label">👥 Target Audience</div>
                            <div class="gap-meta-value">${gap.targetAudience}</div>
                        </div>` : ""}
                    </div>
                    ${gap.suggestedTitle ? `
                    <div style="background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.15);border-radius:6px;padding:6px 8px;margin-top:6px;margin-bottom:6px">
                        <div style="font-size:9px;color:#34d399;font-weight:700;text-transform:uppercase;margin-bottom:2px">💡 Suggested Title</div>
                        <div style="font-size:11px;color:#f4f4f5;font-weight:600">"${gap.suggestedTitle}"</div>
                    </div>` : ""}
                    <div style="font-size:10px;color:#475569;margin-top:5px">${gap.reasoning}</div>
                    <button class="save-idea-btn" data-gap-idx="${i}" style="margin-top:8px;width:100%;padding:5px 0;border:1px solid rgba(16,185,129,0.25);background:rgba(16,185,129,0.06);border-radius:6px;color:#34d399;font-size:10px;font-weight:700;cursor:pointer;transition:all 0.2s;letter-spacing:0.04em;font-family:monospace;text-transform:uppercase">💾 Save Idea to Dashboard</button>
                </div>
            </div>`).join("")}



        <div style="font-size:10px;color:#475569;text-align:center;margin-top:8px">
            ${meta.videoCount} videos · ${meta.commentCount} comments · ${meta.candidatesEvaluated} candidates evaluated
        </div>
        <div style="display:flex;gap:6px;margin-top:8px">
            <button id="exportGapCsv" title="Download results as CSV" style="flex:1;padding:6px 0;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);border-radius:7px;color:#818cf8;font-size:10px;font-weight:700;cursor:pointer;font-family:monospace;letter-spacing:0.04em">💾 Export CSV</button>
            <button id="exportGapMd" title="Copy as Markdown for Notion" style="flex:1;padding:6px 0;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);border-radius:7px;color:#818cf8;font-size:10px;font-weight:700;cursor:pointer;font-family:monospace;letter-spacing:0.04em">📋 Copy Markdown</button>
        </div>
        <button id="trackKeywordBtn" class="track-btn" data-kw="${data.keyword.replace(/"/g, "&quot;")}" data-score="${topGap.gapScore}">
            📡 Track This Keyword
        </button>
        <a href="${API_URL}/dashboard" target="_blank" class="view-all">View Full Dashboard →</a>
    `;
  const currentKeyword = data.keyword;
  gapResult.querySelectorAll(".save-idea-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.gapIdx ?? "0");
      const gap = gaps[idx];
      if (!gap) return;
      btn.disabled = true;
      btn.textContent = "Saving...";
      await saveIdeaToVault(gap, currentKeyword);
      btn.textContent = "✅ Saved to Vault";
      btn.style.borderColor = "rgba(16,185,129,0.5)";
      btn.style.background = "rgba(16,185,129,0.15)";
      btn.style.color = "#34d399";
    });
  });
  const wireCopyBtn = (selector) => {
    gapResult.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const text = btn.dataset.copy ?? "";
        try {
          await navigator.clipboard.writeText(text);
          const orig = btn.textContent;
          btn.textContent = "✅ Copied!";
          btn.style.color = "#34d399";
          setTimeout(() => {
            btn.textContent = orig;
            btn.style.color = "";
          }, 1800);
        } catch {
          btn.textContent = "❌ Failed";
          setTimeout(() => {
            btn.textContent = "📋 Copy";
            btn.style.color = "";
          }, 1800);
        }
      });
    });
  };
  wireCopyBtn(".copy-title-btn");
  wireCopyBtn(".copy-hook-btn");
  const trackBtn = document.getElementById("trackKeywordBtn");
  if (trackBtn) {
    trackBtn.addEventListener("click", async () => {
      const kw = trackBtn.dataset.kw ?? data.keyword;
      const score = parseFloat(trackBtn.dataset.score ?? "5");
      await trackKeyword(kw, score);
      trackBtn.textContent = "✅ Tracking! View in History tab.";
      trackBtn.classList.add("tracked");
      trackBtn.disabled = true;
    });
  }
  document.getElementById("exportGapCsv")?.addEventListener("click", () => {
    const header = ["#", "Title", "Gap Score", "Hook", "Format", "Monetization", "Target Audience", "Reasoning"];
    const rows = gaps.map((g, i) => [
      String(i + 1),
      `"${(g.title ?? "").replace(/"/g, "'")}"`,
      String(g.gapScore),
      `"${(g.hook ?? "").replace(/"/g, "'")}"`,
      `"${(g.format ?? "").replace(/"/g, "'")}"`,
      `"${(g.monetizationAngle ?? "").replace(/"/g, "'")}"`,
      `"${(g.targetAudience ?? "").replace(/"/g, "'")}"`,
      `"${(g.reasoning ?? "").replace(/"/g, "'")}"`
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gaptuber-gaps-${data.keyword.replace(/\s+/g, "-").toLowerCase().slice(0, 40)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById("exportGapMd")?.addEventListener("click", async () => {
    const kw = data.keyword;
    const lines = [
      `# 🎯 Gap Scan: ${kw}`,
      ``,
      `> Generated by GapTuber · ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`,
      ``,
      ...gaps.flatMap((g, i) => [
        `## Gap #${i + 1} — ${g.title}`,
        `**Score:** ${g.gapScore}/10`,
        ``,
        `**Hook:** *"${g.hook}"*`,
        ``,
        `| Field | Value |`,
        `|---|---|`,
        `| Format | ${g.format} |`,
        `| Monetization | ${g.monetizationAngle} |`,
        `| Target Audience | ${g.targetAudience ?? "—"} |`,
        ``,
        `**Why this gap exists:** ${g.reasoning}`,
        ``,
        `---`,
        ``
      ])
    ].join("\n");
    const mdBtn = document.getElementById("exportGapMd");
    try {
      await navigator.clipboard.writeText(lines);
      if (mdBtn) {
        mdBtn.textContent = "✅ Copied!";
        mdBtn.style.color = "#34d399";
      }
      setTimeout(() => {
        if (mdBtn) {
          mdBtn.textContent = "📋 Copy Markdown";
          mdBtn.style.color = "";
        }
      }, 2e3);
    } catch {
      if (mdBtn) {
        mdBtn.textContent = "❌ Failed";
      }
      setTimeout(() => {
        if (mdBtn) {
          mdBtn.textContent = "📋 Copy Markdown";
        }
      }, 1800);
    }
  });
}
async function runSeoAudit() {
  const titleVal = seoTitle.value.trim();
  const kwVal = seoKeyword.value.trim();
  const descVal = seoDescription.value.trim();
  const tagsVal = seoTags.value.trim();
  if (!titleVal || !kwVal) {
    showError(seoResult, "Please enter a Video Title and a Primary Keyword.");
    return;
  }
  showLoading(seoResult, "Auditing SEO...", "Analyzing metadata & querying AI recommendations", [
    "Analyzing Title relevance",
    "Evaluating Description density",
    "Checking Tag discoverability",
    "Generating optimization suggestions"
  ]);
  const sessionToken = await getSessionToken();
  try {
    const payload = {
      title: titleVal,
      keyword: kwVal,
      description: descVal || void 0,
      tags: tagsVal ? tagsVal.split(",").map((t) => t.trim()).filter(Boolean) : void 0
    };
    const res = await fetch(`${API_URL}/api/seo-audit`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...sessionToken ? { "X-Session-Token": sessionToken } : {}
      },
      body: JSON.stringify(payload)
    });
    if (res.status === 401) {
      const signInDomain = API_URL === LOCAL_URL ? "localhost:3000" : "gaptuber.app";
      showError(seoResult, `Unauthorized. Please sign in at <a href="${API_URL}" target="_blank" style="color:#fbbf24;text-decoration:underline">${signInDomain}</a> to use the SEO Auditor.`);
      return;
    }
    if (!res.ok) {
      const err = await res.json();
      showError(seoResult, err.error ?? err.message ?? "SEO Audit failed.");
      return;
    }
    const data = await res.json();
    if (!data.success) {
      showError(seoResult, "SEO Audit failed to return valid data.");
      return;
    }
    renderSeoResult(data);
  } catch (err) {
    console.error("[SEO Audit]", err);
    showError(seoResult, "Could not connect to the server. Make sure the backend is running.");
  }
}
function renderSeoResult(r) {
  const { scores, issues, suggestions, improvements } = r;
  const scoreColorClass = (score) => {
    if (score >= 80) return "fill-emerald";
    if (score >= 50) return "fill-amber";
    return "fill-red";
  };
  const overallColor = scores.overall >= 80 ? "#34d399" : scores.overall >= 50 ? "#fbbf24" : "#f87171";
  const currentTitle = document.getElementById("seoTitle")?.value?.trim() ?? "";
  scores.title;
  const improvedScore = Math.min(100, scores.title + Math.round((100 - scores.title) * 0.55));
  seoResult.innerHTML = `
        <!-- Circular Score Gauge -->
        <div style="text-align:center;margin-top:10px;margin-bottom:12px">
            <div class="seo-score-ring" style="border-color:${overallColor}">
                <div class="seo-score-value" style="color:${overallColor}">${scores.overall}</div>
            </div>
            <div class="seo-score-label">Overall SEO Score</div>
        </div>

        <!-- A/B Title Comparison -->
        ${currentTitle && improvements.improvedTitle ? `
        <div class="section-divider">🧪 Title A/B Comparison</div>
        <div class="card" style="padding:0;overflow:hidden">
            <table class="ab-table">
                <thead><tr><th>Version</th><th>Title</th><th>Est. Score</th></tr></thead>
                <tbody>
                    <tr>
                        <td>Current</td>
                        <td style="color:#a1a1aa">${currentTitle}</td>
                        <td style="color:${scores.title >= 70 ? "#34d399" : scores.title >= 40 ? "#fbbf24" : "#f87171"};font-weight:700;font-family:monospace">${scores.title}%</td>
                    </tr>
                    <tr class="ab-winner">
                        <td style="color:#34d399">✨ AI</td>
                        <td style="color:#f4f4f5;font-weight:600">${improvements.improvedTitle}</td>
                        <td style="color:#34d399;font-weight:700;font-family:monospace">${improvedScore}% <span style="font-size:8px">(+${improvedScore - scores.title})</span></td>
                    </tr>
                </tbody>
            </table>
        </div>` : ""}

        <!-- Score Components -->
        <div class="card">
            <div class="card-title" style="margin-bottom:8px">📊 Score Breakdown</div>
            ${scoreBar("Title", scores.title, scoreColorClass(scores.title))}
            ${scoreBar("Description", scores.description, scoreColorClass(scores.description))}
            ${scoreBar("Tags", scores.tags, scoreColorClass(scores.tags))}
        </div>

        <!-- AI Optimizations -->
        <div class="section-divider">💡 AI Recommendations</div>
        <div class="card" style="padding:10px">
            <div style="font-size:9px;color:#34d399;font-weight:700;text-transform:uppercase;margin-bottom:4px;font-family:monospace">✨ Optimized Title (Click to copy)</div>
            <div class="kw-card" id="seoCopyTitleBtn" style="margin-bottom:8px;padding:8px 10px;border-color:rgba(52,211,153,0.2)" data-clipboard="${improvements.improvedTitle.replace(/"/g, "&quot;")}">
                <div style="font-size:11.5px;font-weight:600;color:#fff;line-height:1.4">${improvements.improvedTitle}</div>
            </div>

            <div style="font-size:9px;color:#34d399;font-weight:700;text-transform:uppercase;margin-bottom:4px;font-family:monospace">✍️ Optimized Description Opening</div>
            <div class="card" style="margin-bottom:8px;background:#18181b;padding:8px 10px;font-size:11px;color:#a1a1aa;line-height:1.45">
                ${improvements.improvedDescription}
            </div>

            ${improvements.additionalTags && improvements.additionalTags.length ? `
                <div style="font-size:9px;color:#34d399;font-weight:700;text-transform:uppercase;margin-bottom:4px;font-family:monospace">🏷️ Suggested Tag Additions (Click to copy)</div>
                <div class="tags-container" id="seoTagsContainer">
                    ${improvements.additionalTags.map((tag) => `
                        <span class="tag-chip" data-tag="${tag.replace(/"/g, "&quot;")}">${tag}</span>`).join("")}
                </div>
            ` : ""}
        </div>

        <!-- Issues list -->
        ${issues.length ? `
            <div class="section-divider">⚠️ Issues Detected (${issues.length})</div>
            <div class="card" style="padding:6px 10px">
                ${issues.map((issue) => `
                    <div class="issue-item">
                        <span style="color:#f87171;font-weight:700;flex-shrink:0">❌</span>
                        <span style="color:#f4f4f5;line-height:1.4">${issue.message} <span style="font-size:8px;color:#52525b;font-family:monospace;text-transform:uppercase">(${issue.type})</span></span>
                    </div>
                `).join("")}
            </div>
        ` : ""}

        <!-- Suggestions list -->
        ${suggestions.length ? `
            <div class="section-divider">🎯 Actions to Improve</div>
            <div class="card" style="padding:6px 10px">
                ${suggestions.map((sug) => `
                    <div class="suggestion-item">
                        <span style="color:#fbbf24;font-weight:700;flex-shrink:0">⚡</span>
                        <span style="color:#a1a1aa;line-height:1.4">${sug.message} <span style="font-size:8px;color:#52525b;font-family:monospace;text-transform:uppercase">(${sug.type})</span></span>
                    </div>
                `).join("")}
            </div>
        ` : ""}
    `;
  const titleCopyBtn = document.getElementById("seoCopyTitleBtn");
  if (titleCopyBtn) {
    titleCopyBtn.addEventListener("click", async () => {
      const val = titleCopyBtn.dataset.clipboard ?? "";
      await navigator.clipboard.writeText(val);
      const originalHtml = titleCopyBtn.innerHTML;
      titleCopyBtn.style.borderColor = "#34d399";
      titleCopyBtn.innerHTML = `<div style="font-size:11.5px;font-weight:600;color:#34d399;">✓ Copied to clipboard!</div>`;
      setTimeout(() => {
        titleCopyBtn.style.borderColor = "rgba(52,211,153,0.2)";
        titleCopyBtn.innerHTML = originalHtml;
      }, 1500);
    });
  }
  const tagsContainer = document.getElementById("seoTagsContainer");
  if (tagsContainer) {
    tagsContainer.querySelectorAll(".tag-chip").forEach((chip) => {
      chip.addEventListener("click", async () => {
        const tag = chip.dataset.tag ?? "";
        await navigator.clipboard.writeText(tag);
        chip.classList.add("copied");
        chip.textContent = "✓ Copied";
        setTimeout(() => {
          chip.classList.remove("copied");
          chip.textContent = tag;
        }, 1500);
      });
    });
  }
}
async function runTagGenerator() {
  const kwVal = tagKeyword.value.trim();
  const nicheVal = tagNiche.value.trim();
  if (!kwVal) {
    showError(tagResult, "Please enter a Topic or Keyword.");
    return;
  }
  showLoading(tagResult, "Generating tags...", "Scanning relevant search volume and intent metrics", [
    "Analyzing search patterns",
    "Extracting competitor tags",
    "Calling AI tag expansion",
    "Structuring tag priorities"
  ]);
  const sessionToken = await getSessionToken();
  try {
    const payload = {
      keyword: kwVal,
      niche: nicheVal || void 0
    };
    const res = await fetch(`${API_URL}/api/tag-generator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...sessionToken ? { "X-Session-Token": sessionToken } : {}
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      showError(tagResult, err.error ?? err.message ?? "Tag generation failed.");
      return;
    }
    const data = await res.json();
    if (!data.success) {
      showError(tagResult, "Tag generator failed to return valid data.");
      return;
    }
    renderTagResult(data);
  } catch (err) {
    console.error("[Tag Generator]", err);
    showError(tagResult, "Could not connect to the server. Make sure the backend is running.");
  }
}
function renderTagResult(r) {
  const { tags, recommendation } = r;
  tagResult.innerHTML = `
        <div class="channel-summary" style="margin-top:10px;margin-bottom:10px;font-style:italic">
            💡 ${recommendation}
        </div>

        <div class="section-divider">🏷️ Generated Tags (${tags.length})</div>
        <div class="card" style="padding:10px">
            <div style="font-size:9px;color:#52525b;font-weight:700;text-transform:uppercase;margin-bottom:8px;font-family:monospace">Click individual tag to copy</div>
            <div class="tags-container" id="generatorTagsContainer">
                ${tags.map((tag) => `
                    <span class="tag-chip" data-tag="${tag.replace(/"/g, "&quot;")}">${tag}</span>
                `).join("")}
            </div>
            <button class="btn-primary" id="copyAllTagsBtn" style="margin-top:12px;font-family:monospace;font-size:11px">
                📋 Copy All Tags (CSV)
            </button>
        </div>
    `;
  const tagsContainer = document.getElementById("generatorTagsContainer");
  if (tagsContainer) {
    tagsContainer.querySelectorAll(".tag-chip").forEach((chip) => {
      chip.addEventListener("click", async () => {
        const tag = chip.dataset.tag ?? "";
        await navigator.clipboard.writeText(tag);
        chip.classList.add("copied");
        chip.textContent = "✓ Copied";
        setTimeout(() => {
          chip.classList.remove("copied");
          chip.textContent = tag;
        }, 1500);
      });
    });
  }
  const copyAllBtn = document.getElementById("copyAllTagsBtn");
  if (copyAllBtn) {
    copyAllBtn.addEventListener("click", async () => {
      const csv = tags.join(", ");
      await navigator.clipboard.writeText(csv);
      const originalText = copyAllBtn.textContent;
      copyAllBtn.textContent = "✓ Copied All to Clipboard!";
      copyAllBtn.style.background = "linear-gradient(135deg,#047857,#059669)";
      setTimeout(() => {
        copyAllBtn.textContent = originalText;
        copyAllBtn.style.background = "";
      }, 1800);
    });
  }
}
document.getElementById("analyzeChannelBtn")?.addEventListener("click", () => {
  runChannelAnalysis();
});
document.getElementById("runGapScanBtn")?.addEventListener("click", () => runGapScan());
document.getElementById("runSeoBtn")?.addEventListener("click", () => runSeoAudit());
document.getElementById("runTagBtn")?.addEventListener("click", () => runTagGenerator());
async function init() {
  await resolveApiUrl();
  const dashboardLink = document.getElementById("dashboardLink");
  if (dashboardLink) {
    dashboardLink.href = PROD_URL;
    dashboardLink.onclick = (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: PROD_URL });
    };
  }
  const detectedUrl = await detectCurrentChannel();
  if (detectedUrl) {
    runChannelAnalysis();
  } else {
    channelResult.innerHTML = `
            <div style="text-align:center;padding:20px 0;color:#475569;font-size:11.5px;line-height:1.7">
                📡 Navigate to a <strong style="color:#818cf8">YouTube channel page</strong> to auto-detect it.<br>
                Or enter a channel URL above and click <strong style="color:#818cf8">Analyze Channel</strong>.
            </div>`;
  }
}
init();
