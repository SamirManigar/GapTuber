function parseViews(text) {
  if (!text) return 0;
  const clean = text.toLowerCase().replace(/,/g, "").replace(/views?/i, "").trim();
  if (clean.includes("k")) return Math.round(parseFloat(clean) * 1e3);
  if (clean.includes("m")) return Math.round(parseFloat(clean) * 1e6);
  if (clean.includes("b")) return Math.round(parseFloat(clean) * 1e9);
  return parseInt(clean) || 0;
}
function parseLikes(text) {
  if (!text) return 0;
  const clean = text.toLowerCase().replace(/,/g, "").replace(/likes?/i, "").trim();
  if (clean.includes("k")) return Math.round(parseFloat(clean) * 1e3);
  if (clean.includes("m")) return Math.round(parseFloat(clean) * 1e6);
  return parseInt(clean) || 0;
}
function parseDate(text) {
  if (!text) return (/* @__PURE__ */ new Date()).toISOString();
  const now = /* @__PURE__ */ new Date();
  const t = text.toLowerCase();
  if (t.includes("second")) {
    const d = new Date(now.getTime() - Math.random() * 6e4);
    return d.toISOString();
  }
  if (t.includes("minute")) {
    const mins = parseInt(t.match(/(\d+)/)?.[1] ?? "30");
    const d = new Date(now.getTime() - (mins * 6e4 + Math.random() * 6e4));
    return d.toISOString();
  }
  if (t.includes("hour")) {
    const hrs = parseInt(t.match(/(\d+)/)?.[1] ?? "6");
    const d = new Date(now.getTime() - (hrs * 36e5 + Math.random() * 36e5));
    return d.toISOString();
  }
  const match = t.match(/(\d+)\s*(day|week|month|year)/);
  if (match) {
    const n = parseInt(match[1]);
    const unit = match[2];
    const d = new Date(now);
    if (unit.startsWith("day")) d.setDate(d.getDate() - n);
    else if (unit.startsWith("week")) d.setDate(d.getDate() - n * 7);
    else if (unit.startsWith("month")) d.setMonth(d.getMonth() - n);
    else if (unit.startsWith("year")) d.setFullYear(d.getFullYear() - n);
    return d.toISOString();
  }
  try {
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  } catch {
  }
  return now.toISOString();
}
function parseSubscribers(text) {
  if (!text) return 0;
  const clean = text.toLowerCase().replace(/subscribers?/i, "").replace(/,/g, "").trim();
  if (clean.includes("k")) return Math.round(parseFloat(clean) * 1e3);
  if (clean.includes("m")) return Math.round(parseFloat(clean) * 1e6);
  if (clean.includes("b")) return Math.round(parseFloat(clean) * 1e9);
  return parseInt(clean) || 0;
}
function scrapeVideoData(channels) {
  const videos = [];
  const seen = /* @__PURE__ */ new Set();
  const pageChannelHandle = window.location.pathname.match(/\/@([^/]+)/)?.[1] ?? "";
  const renderers = document.querySelectorAll(
    "ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-rich-grid-media"
  );
  for (const el of renderers) {
    const allLinks = Array.from(el.querySelectorAll("a[href^='/watch?v=']"));
    const validLinks = allLinks.filter((a) => a.id !== "thumbnail" && !a.classList.contains("ytd-thumbnail") && !a.querySelector("yt-image"));
    let titleLink = validLinks.find((a) => a.id === "video-title-link" || a.id === "video-title" || a.classList.contains("ytd-channel-video-player-renderer"));
    if (!titleLink) {
      titleLink = validLinks.find((a) => a.getAttribute("aria-label")?.toLowerCase().includes("views")) || void 0;
    }
    if (!titleLink) {
      titleLink = validLinks.find((a) => {
        const txt = a.textContent?.trim() || "";
        return txt.length > 10 && !/^\d+:\d+/.test(txt);
      }) || void 0;
    }
    if (!titleLink) continue;
    const url = titleLink.getAttribute("href");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    let title = titleLink.getAttribute("title")?.trim() || titleLink.textContent?.trim() || "";
    const formattedString = titleLink.querySelector("yt-formatted-string");
    if (formattedString) {
      title = formattedString.textContent?.trim() || title;
    }
    if (!title || title.length < 3) continue;
    const ariaLabel = titleLink.getAttribute("aria-label") || "";
    const metaText = el.textContent || "";
    let views = 0;
    const ariaViewMatch = ariaLabel.match(/([\d,]+)\s*views/i);
    if (ariaViewMatch) {
      views = parseViews(ariaViewMatch[1]);
    } else {
      const metaViewMatch = metaText.match(/(\d[\d,\.]*\s*[KMB]?\s*views?)/i);
      if (metaViewMatch) views = parseViews(metaViewMatch[1]);
    }
    let dateStr = "";
    const ariaDateMatch = ariaLabel.match(/(\d+\s*(hour|day|week|month|year)s?\s*ago)/i);
    if (ariaDateMatch) {
      dateStr = ariaDateMatch[1];
    } else {
      const metaDateMatch = metaText.match(/(\d+\s*(hour|day|week|month|year)s?\s*ago)/i);
      if (metaDateMatch) dateStr = metaDateMatch[1];
    }
    const durationEl = el.querySelector("ytd-thumbnail-overlay-time-status-renderer span, .ytd-thumbnail-overlay-time-status-renderer badge-shape");
    const durationText = durationEl?.textContent?.trim() || void 0;
    const timeEl = el.querySelector("time[datetime]");
    const exactDatetime = timeEl?.dateTime;
    if (exactDatetime && !dateStr) {
      dateStr = exactDatetime;
    }
    const channelEl = el.querySelector("ytd-channel-name a, #channel-name a, .ytd-channel-name a");
    const channelName = channelEl?.textContent?.trim() || pageChannelHandle;
    videos.push({
      title,
      views,
      likes: 0,
      comments: 0,
      uploadDate: dateStr ? parseDate(dateStr) : (/* @__PURE__ */ new Date()).toISOString(),
      url: url.startsWith("http") ? url : `https://www.youtube.com${url}`,
      channel: channelName,
      duration: durationText
    });
    if (videos.length >= 100) break;
  }
  if (videos.length === 0) {
    const fallbackLinks = Array.from(document.querySelectorAll("a[href^='/watch?v=']"));
    for (const link of fallbackLinks) {
      const url = link.getAttribute("href");
      if (!url || seen.has(url)) continue;
      const titleStr = link.getAttribute("title")?.trim() || link.querySelector("yt-formatted-string")?.textContent?.trim() || link.textContent?.trim();
      if (!titleStr || titleStr.length < 8 || /^\d+:\d+/.test(titleStr)) continue;
      seen.add(url);
      const container = link.closest("ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, div#contents, div#content");
      const metaText = container?.textContent || "";
      const ariaLabel = link.getAttribute("aria-label") || "";
      const viewMatch = ariaLabel.match(/([\d,]+)\s*views/i) || metaText.match(/(\d[\d,\.]*\s*[KMB]?\s*views?)/i);
      const dateMatch = ariaLabel.match(/(\d+\s*(hour|day|week|month|year)s?\s*ago)/i) || metaText.match(/(\d+\s*(hour|day|week|month|year)s?\s*ago)/i);
      videos.push({
        title: titleStr,
        views: viewMatch ? parseViews(viewMatch[1]) : 0,
        likes: 0,
        comments: 0,
        uploadDate: dateMatch ? parseDate(dateMatch[1]) : (/* @__PURE__ */ new Date()).toISOString(),
        url: url.startsWith("http") ? url : `https://www.youtube.com${url}`,
        channel: pageChannelHandle
      });
    }
  }
  return videos;
}
function scrapeComments() {
  const comments = [];
  const seen = /* @__PURE__ */ new Set();
  const commentEls = document.querySelectorAll("#content-text, ytd-comment-renderer #content-text");
  for (const el of commentEls) {
    const text = el.textContent?.trim();
    if (!text || text.length < 10 || seen.has(text)) continue;
    seen.add(text);
    const commentRenderer = el.closest("ytd-comment-renderer, ytd-comment-thread-renderer");
    const likeEl = commentRenderer?.querySelector("#vote-count-middle, .ytd-comment-action-buttons-renderer span");
    const likeText = likeEl?.textContent?.trim() ?? "0";
    const likeCount = parseLikes(likeText);
    const authorEl = commentRenderer?.querySelector("#author-text, .ytd-comment-renderer #author-text");
    const authorName = authorEl?.textContent?.trim() ?? void 0;
    comments.push({
      text: text.slice(0, 500),
      videoUrl: window.location.href,
      likeCount: likeCount > 0 ? likeCount : void 0,
      authorName
    });
    if (comments.length >= 200) break;
  }
  return comments;
}
function scrapeSearchResults() {
  const results = [];
  const renderers = document.querySelectorAll("ytd-video-renderer");
  for (const el of renderers) {
    const title = el.querySelector("#video-title")?.textContent?.trim();
    const channelEl = el.querySelector("ytd-channel-name a");
    const channel = channelEl?.textContent?.trim();
    const metaItems = el.querySelectorAll("#metadata-line span");
    const viewText = Array.from(metaItems).find((s) => s.textContent?.match(/view|K|M/i))?.textContent ?? "0";
    const dateText = Array.from(metaItems).find((s) => s.textContent?.match(/ago|yesterday/i))?.textContent ?? "";
    const subscriberEl = el.querySelector(".ytd-channel-renderer #subscribers, .ytd-video-owner-renderer #owner-sub-count");
    const subscriberText = subscriberEl?.textContent?.trim() ?? "";
    if (!title || !channel) continue;
    results.push({
      title,
      channel,
      views: parseViews(viewText),
      likes: 0,
      // Not available in search results
      uploadDate: parseDate(dateText),
      subscriberCount: subscriberText ? parseSubscribers(subscriberText) : void 0
    });
    if (results.length >= 30) break;
  }
  return results;
}
function scrapeCurrentVideoData() {
  const isVideoPage = window.location.pathname === "/watch";
  if (!isVideoPage) return null;
  const title = document.querySelector("h1.ytd-video-primary-info-renderer, yt-formatted-string.ytd-video-primary-info-renderer")?.textContent?.trim();
  if (!title) return null;
  const viewEl = document.querySelector(".view-count, ytd-video-view-count-renderer .view-count, #count .view-count");
  const viewText = viewEl?.textContent?.trim() ?? "0";
  const likeEl = document.querySelector("ytd-toggle-button-renderer:first-child #text, .ytd-segmented-like-dislike-button-renderer #text");
  const likeText = likeEl?.textContent?.trim() ?? "0";
  const channelEl = document.querySelector("ytd-channel-name a, #channel-name a");
  const channelName = channelEl?.textContent?.trim() ?? "";
  const tagMeta = document.querySelector('meta[name="keywords"]');
  const tags = tagMeta?.getAttribute("content")?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];
  const descEl = document.querySelector("#description-text, ytd-text-inline-expander #content");
  const description = descEl?.textContent?.trim()?.slice(0, 1e3) ?? "";
  return {
    title,
    views: parseViews(viewText),
    likes: parseLikes(likeText),
    comments: 0,
    uploadDate: (/* @__PURE__ */ new Date()).toISOString(),
    url: window.location.href,
    channel: channelName,
    tags: tags.slice(0, 30),
    description
  };
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SCRAPE_DATA") {
    const { keyword, channels } = message;
    try {
      const videos = scrapeVideoData(channels);
      const comments = scrapeComments();
      const searchResults = scrapeSearchResults();
      const currentVideo = scrapeCurrentVideoData();
      if (currentVideo && currentVideo.title && !videos.find((v) => v.url === currentVideo.url)) {
        videos.unshift(currentVideo);
      }
      sendResponse({ success: true, data: { videos, comments, searchResults } });
    } catch (err) {
      sendResponse({ success: false, error: String(err) });
    }
    return true;
  }
  if (message.type === "GET_VIDEO_DATA") {
    try {
      const videoData = scrapeCurrentVideoData();
      sendResponse({ success: !!videoData, data: videoData });
    } catch (err) {
      sendResponse({ success: false, error: String(err) });
    }
    return true;
  }
});
const CACHE_TTL_MS = 60 * 60 * 1e3;
function isChannelPage() {
  const path = window.location.pathname;
  const handleMatch = path.match(/^\/@([A-Za-z0-9_.\-]+)/);
  if (handleMatch) return handleMatch[1];
  const channelMatch = path.match(/^\/channel\/([A-Za-z0-9_\-]+)/);
  if (channelMatch) return channelMatch[1];
  return null;
}
function scrapeSubscriberCount() {
  const el = document.querySelector(
    "#subscriber-count, yt-formatted-string#subscribers-count, .ytd-channel-renderer #subscribers, #channel-header-container #subscriber-count"
  );
  return el?.textContent?.trim() ?? "";
}
function getChannelName() {
  const el = document.querySelector(
    "yt-formatted-string#channel-name, #channel-name .ytd-channel-name, .ytd-channel-name yt-formatted-string, #top-row #channel-name, ytd-channel-name yt-formatted-string"
  );
  return el?.textContent?.trim() ?? document.title.replace("- YouTube", "").trim();
}
let _scrapeDebounceTimer = null;
function autoScrapeChannel(handle) {
  if (_scrapeDebounceTimer) clearTimeout(_scrapeDebounceTimer);
  _scrapeDebounceTimer = setTimeout(() => {
    const videos = scrapeVideoData();
    if (videos.length < 10) return;
    const channelData = {
      url: `https://www.youtube.com/@${handle}`,
      handle,
      channelName: getChannelName(),
      subscriberCount: parseSubscribers(scrapeSubscriberCount()),
      videos,
      scrapedAt: Date.now()
    };
    chrome.storage.local.set({ channelData }, () => {
      console.log(`[GapTuber] Cached ${videos.length} videos for @${handle}`);
    });
  }, 1e3);
}
const channelHandle = isChannelPage();
if (channelHandle) {
  setTimeout(() => autoScrapeChannel(channelHandle), 2e3);
  const visibleVideoCount = document.querySelectorAll("ytd-rich-item-renderer, ytd-grid-video-renderer").length;
  if (visibleVideoCount < 20) {
    setTimeout(() => {
      const scrollSteps = [600, 1200, 2e3];
      scrollSteps.forEach((y, i) => {
        setTimeout(() => window.scrollTo({ top: y, behavior: "smooth" }), i * 500);
      });
    }, 3500);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      autoScrapeChannel(channelHandle);
    }, 6e3);
  }
}
async function scrapeTopComments(limit = 40) {
  return new Promise((resolve) => {
    window.scrollBy(0, 800);
    setTimeout(() => {
      const commentEls = document.querySelectorAll("ytd-comment-thread-renderer");
      const comments = [];
      commentEls.forEach((el, i) => {
        if (i >= limit) return;
        const textEl = el.querySelector("#content-text");
        const likesEl = el.querySelector("#vote-count-middle");
        const authorEl = el.querySelector("#author-text");
        if (textEl?.textContent?.trim()) {
          comments.push({
            text: textEl.textContent.trim(),
            likeCount: parseViews(likesEl?.textContent?.trim() ?? "0"),
            authorName: authorEl?.textContent?.trim() ?? void 0,
            videoUrl: window.location.href
          });
        }
      });
      resolve(comments);
    }, 1800);
  });
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_CACHED_CHANNEL") {
    chrome.storage.local.get("channelData", (result) => {
      const data = result.channelData;
      if (!data) {
        sendResponse({ success: false, reason: "no_cache" });
        return;
      }
      const age = Date.now() - data.scrapedAt;
      if (age > CACHE_TTL_MS) {
        sendResponse({ success: false, reason: "expired" });
        return;
      }
      sendResponse({ success: true, data });
    });
    return true;
  }
  if (message.type === "RESCRAPE_NOW") {
    try {
      const handle = isChannelPage();
      if (!handle) {
        sendResponse({ success: false, reason: "not_channel_page" });
        return;
      }
      const videos = scrapeVideoData([]);
      const channelData = {
        url: `https://www.youtube.com/@${handle}`,
        handle,
        channelName: getChannelName(),
        subscriberCount: parseSubscribers(scrapeSubscriberCount()),
        videos,
        scrapedAt: Date.now()
      };
      if (videos.length >= 5) chrome.storage.local.set({ channelData });
      sendResponse({ success: true, data: channelData });
    } catch (err) {
      sendResponse({ success: false, reason: String(err) });
    }
    return true;
  }
  if (message.type === "SCRAPE_VIDEO_COMMENTS") {
    const isVideoPage = window.location.pathname === "/watch";
    if (!isVideoPage) {
      sendResponse({ success: false, reason: "not_video_page" });
      return true;
    }
    const videoTitle = document.querySelector("ytd-watch-metadata h1 yt-formatted-string")?.textContent?.trim() ?? document.querySelector("yt-formatted-string.ytd-watch-metadata")?.textContent?.trim() ?? document.title.replace(" - YouTube", "").trim();
    scrapeTopComments(40).then((comments) => {
      sendResponse({
        success: true,
        comments,
        videoTitle,
        videoUrl: window.location.href
      });
    });
    return true;
  }
  if (message.type === "PING") {
    sendResponse({ pong: true });
    return false;
  }
});
function calculateSearchCompanionStats(results, keyword) {
  if (results.length === 0) return null;
  let totalViews = 0;
  let highestViews = 0;
  let keywordInTitle = 0;
  let totalAgeDays = 0;
  let videosWithAge = 0;
  const channelCounts = {};
  const kwLower = keyword.toLowerCase();
  const kwTokens = kwLower.split(/\s+/).filter(Boolean);
  for (const r of results) {
    totalViews += r.views;
    if (r.views > highestViews) highestViews = r.views;
    channelCounts[r.channel] = (channelCounts[r.channel] || 0) + 1;
    const titleLower = r.title.toLowerCase();
    if (titleLower.includes(kwLower) || kwTokens.every((t) => titleLower.includes(t))) {
      keywordInTitle++;
    }
    const uploadMs = new Date(r.uploadDate).getTime();
    if (!isNaN(uploadMs)) {
      const daysOld = Math.max(1, (Date.now() - uploadMs) / (1e3 * 60 * 60 * 24));
      totalAgeDays += daysOld;
      videosWithAge++;
    }
  }
  const avgViews = Math.round(totalViews / results.length);
  const avgAgeDays = videosWithAge > 0 ? totalAgeDays / videosWithAge : 365;
  const topChannels = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
  let volumeRaw = (Math.log10(avgViews || 1) - 3) / 3;
  volumeRaw = Math.max(0, Math.min(1, volumeRaw));
  let volume = Math.round(volumeRaw * 100);
  if (highestViews > 1e6) volume = Math.max(volume, 75);
  if (highestViews > 5e6) volume = Math.max(volume, 90);
  const exactMatchRatio = keywordInTitle / results.length;
  const recentActivityFactor = Math.max(0, Math.min(1, 1 - avgAgeDays / 1e3));
  let competitionRaw = exactMatchRatio * 0.7 + recentActivityFactor * 0.3;
  let competition = Math.round(competitionRaw * 100);
  let overallScore = Math.round(50 + volume / 2 - competition / 2);
  if (avgViews < 1e3) overallScore = Math.min(overallScore, 40);
  overallScore = Math.max(0, Math.min(100, overallScore));
  return {
    keyword,
    overallScore,
    volume,
    competition,
    highestViews,
    avgViews,
    topChannels,
    exactMatchRatio: Math.round(exactMatchRatio * 100)
  };
}
function injectSearchCompanionUI(stats) {
  if (!stats) return;
  const existing = document.getElementById("gaptuber-search-companion");
  if (existing) existing.remove();
  const secondaryInner = document.querySelector("#secondary-inner") || document.querySelector("#secondary");
  if (!secondaryInner) {
    console.warn("[GapTuber] Could not find #secondary-inner to inject Search Companion.");
    return;
  }
  const formatNumber = (num) => {
    if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
    return num.toString();
  };
  const getScoreColor = (score, invert = false) => {
    const good = invert ? score < 40 : score > 60;
    const bad = invert ? score > 60 : score < 40;
    if (good) return "#10b981";
    if (bad) return "#ef4444";
    return "#f59e0b";
  };
  const overallColor = getScoreColor(stats.overallScore);
  const volumeColor = getScoreColor(stats.volume);
  const compColor = getScoreColor(stats.competition, true);
  const container = document.createElement("div");
  container.id = "gaptuber-search-companion";
  container.style.cssText = `
        background: #111113;
        border: 1px solid #2a2a30;
        border-radius: 12px;
        margin-bottom: 24px;
        padding: 20px;
        color: white;
        font-family: "Roboto", "Arial", sans-serif;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;
  container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid #2a2a30; padding-bottom: 12px;">
            <div style="background: #10b981; color: black; font-weight: 900; font-size: 14px; padding: 2px 6px; border-radius: 4px;">GT</div>
            <h2 style="font-size: 16px; font-weight: bold; margin: 0; color: #fff;">Search Companion</h2>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 12px; color: #a1a1aa; margin-bottom: 8px;">Overall Score</div>
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 100px; height: 100px; border-radius: 50%; border: 6px solid ${overallColor}; font-size: 36px; font-weight: bold; color: ${overallColor}; shadow: 0 0 15px ${overallColor}40;">
                ${stats.overallScore}
            </div>
            <div style="font-size: 13px; font-weight: bold; color: ${overallColor}; margin-top: 8px; text-transform: uppercase;">
                ${stats.overallScore > 70 ? "High Opportunity" : stats.overallScore > 40 ? "Medium" : "Low Opportunity"}
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                <span style="color: #a1a1aa;">Volume</span>
                <span style="color: ${volumeColor}; font-weight: bold;">${stats.volume}/100</span>
            </div>
            <div style="background: #2a2a30; height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 12px;">
                <div style="background: ${volumeColor}; width: ${stats.volume}%; height: 100%; border-radius: 3px;"></div>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                <span style="color: #a1a1aa;">Competition</span>
                <span style="color: ${compColor}; font-weight: bold;">${stats.competition}/100</span>
            </div>
            <div style="background: #2a2a30; height: 6px; border-radius: 3px; overflow: hidden;">
                <div style="background: ${compColor}; width: ${stats.competition}%; height: 100%; border-radius: 3px;"></div>
            </div>
        </div>

        <div style="border-top: 1px solid #2a2a30; padding-top: 16px; margin-bottom: 16px;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 12px; color: #fff;">Search Term Stats</div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="background: #1a1a1e; padding: 10px; border-radius: 8px; border: 1px solid #2a2a30;">
                    <div style="font-size: 11px; color: #a1a1aa; margin-bottom: 4px;">Highest Views</div>
                    <div style="font-size: 15px; font-weight: bold; color: #fff;">${formatNumber(stats.highestViews)}</div>
                </div>
                <div style="background: #1a1a1e; padding: 10px; border-radius: 8px; border: 1px solid #2a2a30;">
                    <div style="font-size: 11px; color: #a1a1aa; margin-bottom: 4px;">Average Views</div>
                    <div style="font-size: 15px; font-weight: bold; color: #fff;">${formatNumber(stats.avgViews)}</div>
                </div>
            </div>
        </div>

        <div style="border-top: 1px solid #2a2a30; padding-top: 16px;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 12px; color: #fff;">Top Channels</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${stats.topChannels.map((c) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                        <span style="color: #d4d4d8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${c.name}</span>
                        <span style="color: #a1a1aa; background: #2a2a30; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${c.count} videos</span>
                    </div>
                `).join("")}
            </div>
        </div>
        
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #2a2a30; text-align: center;">
            <a href="https://gaptuber.vercel.app/dashboard?keyword=${encodeURIComponent(stats.keyword)}&competitors=${encodeURIComponent(stats.topChannels.map((c) => c.name).join(","))}" target="_blank" style="color: #10b981; font-size: 12px; font-weight: bold; text-decoration: none; padding: 6px 12px; border: 1px solid #10b981; border-radius: 6px; display: inline-block; transition: all 0.2s;">
                Run Deep AI Scan
            </a>
        </div>
    `;
  secondaryInner.insertBefore(container, secondaryInner.firstChild);
}
function tryInjectSearchCompanion() {
  const isSearchPage = window.location.pathname === "/results";
  if (!isSearchPage) return;
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get("search_query");
  if (!searchQuery) return;
  let retries = 0;
  const interval = setInterval(() => {
    const results = scrapeSearchResults();
    if (results.length >= 5) {
      clearInterval(interval);
      const stats = calculateSearchCompanionStats(results, searchQuery);
      if (stats) injectSearchCompanionUI(stats);
    } else if (retries >= 10) {
      clearInterval(interval);
    }
    retries++;
  }, 1e3);
}
document.addEventListener("yt-navigate-finish", () => {
  tryInjectSearchCompanion();
});
if (document.readyState === "complete") {
  tryInjectSearchCompanion();
} else {
  window.addEventListener("load", tryInjectSearchCompanion);
}
