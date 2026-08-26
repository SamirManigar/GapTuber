// GapTuber Content Script v2.0
// Enhanced data extraction with likes, comments, tags, duration, and engagement metrics

interface VideoData {
    title: string;
    views: number;
    likes: number;
    comments: number;
    uploadDate: string;
    url: string;
    channel: string;
    duration?: string;
    tags?: string[];
    description?: string;
}

interface CommentData {
    text: string;
    videoUrl?: string;
    likeCount?: number;
    authorName?: string;
}

interface SearchResult {
    title: string;
    channel: string;
    views: number;
    likes: number;
    uploadDate: string;
    subscriberCount?: number;
}


// ─── Helpers ────────────────────────────────────────────────────────────────

function parseViews(text: string): number {
    if (!text) return 0;
    const clean = text.toLowerCase().replace(/,/g, "").replace(/views?/i, "").trim();
    if (clean.includes("k")) return Math.round(parseFloat(clean) * 1000);
    if (clean.includes("m")) return Math.round(parseFloat(clean) * 1_000_000);
    if (clean.includes("b")) return Math.round(parseFloat(clean) * 1_000_000_000);
    return parseInt(clean) || 0;
}

function parseLikes(text: string): number {
    if (!text) return 0;
    const clean = text.toLowerCase().replace(/,/g, "").replace(/likes?/i, "").trim();
    if (clean.includes("k")) return Math.round(parseFloat(clean) * 1000);
    if (clean.includes("m")) return Math.round(parseFloat(clean) * 1_000_000);
    return parseInt(clean) || 0;
}

function parseDate(text: string): string {
    if (!text) return new Date().toISOString();
    const now = new Date();
    const t = text.toLowerCase();

    // Sub-day precision: spread within the correct window instead of all getting exact `now`
    // (prevents zero-gap duplicates that destroy consistency score)
    if (t.includes("second")) {
        const d = new Date(now.getTime() - Math.random() * 60_000);
        return d.toISOString();
    }
    if (t.includes("minute")) {
        const mins = parseInt(t.match(/(\d+)/)?.[1] ?? "30");
        const d = new Date(now.getTime() - (mins * 60_000 + Math.random() * 60_000));
        return d.toISOString();
    }
    if (t.includes("hour")) {
        const hrs = parseInt(t.match(/(\d+)/)?.[1] ?? "6");
        const d = new Date(now.getTime() - (hrs * 3_600_000 + Math.random() * 3_600_000));
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
    // Try absolute date strings
    try {
        const parsed = new Date(text);
        if (!isNaN(parsed.getTime())) return parsed.toISOString();
    } catch { /* ignore */ }
    return now.toISOString();
}

function parseSubscribers(text: string): number {
    if (!text) return 0;
    const clean = text.toLowerCase().replace(/subscribers?/i, "").replace(/,/g, "").trim();
    if (clean.includes("k")) return Math.round(parseFloat(clean) * 1000);
    if (clean.includes("m")) return Math.round(parseFloat(clean) * 1_000_000);
    if (clean.includes("b")) return Math.round(parseFloat(clean) * 1_000_000_000);
    return parseInt(clean) || 0;
}

// ─── Enhanced Video Data Scraping ────────────────────────────────────────────

function scrapeVideoData(channels: string[]): VideoData[] {
    const videos: VideoData[] = [];
    const seen = new Set<string>();
    const pageChannelHandle = window.location.pathname.match(/\/@([^/]+)/)?.[1] ?? "";

    // YouTube uses different tags depending on the page (Channel, Home, Search)
    const renderers = document.querySelectorAll(
        "ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-rich-grid-media"
    );

    for (const el of renderers) {
        const allLinks = Array.from(el.querySelectorAll("a[href^='/watch?v=']"));
        
        // Remove links that are clearly thumbnails
        const validLinks = allLinks.filter(a => a.id !== "thumbnail" && !a.classList.contains("ytd-thumbnail") && !a.querySelector("yt-image"));

        // Strategy 1: Find the title link via ID
        let titleLink = validLinks.find(a => a.id === "video-title-link" || a.id === "video-title" || a.classList.contains("ytd-channel-video-player-renderer"));
        
        // Strategy 2: If no title link found by ID, find the anchor with an aria-label that contains "views"
        if (!titleLink) {
            titleLink = validLinks.find(a => a.getAttribute("aria-label")?.toLowerCase().includes("views")) || undefined;
        }

        // Strategy 3: Just grab any link that has text content longer than 10 chars (avoids "8:09" duration)
        if (!titleLink) {
            titleLink = validLinks.find(a => {
                const txt = a.textContent?.trim() || "";
                return txt.length > 10 && !/^\d+:\d+/.test(txt);
            }) || undefined;
        }

        if (!titleLink) continue;

        const url = titleLink.getAttribute("href");
        if (!url || seen.has(url)) continue;
        seen.add(url);

        let title = titleLink.getAttribute("title")?.trim() || titleLink.textContent?.trim() || "";
        
        // Sometimes the title is inside a yt-formatted-string child
        const formattedString = titleLink.querySelector("yt-formatted-string");
        if (formattedString) {
            title = formattedString.textContent?.trim() || title;
        }

        if (!title || title.length < 3) continue;

        const ariaLabel = titleLink.getAttribute("aria-label") || "";
        const metaText = el.textContent || "";

        // Extract Views
        let views = 0;
        const ariaViewMatch = ariaLabel.match(/([\d,]+)\s*views/i);
        if (ariaViewMatch) {
            views = parseViews(ariaViewMatch[1]);
        } else {
            const metaViewMatch = metaText.match(/(\d[\d,\.]*\s*[KMB]?\s*views?)/i);
            if (metaViewMatch) views = parseViews(metaViewMatch[1]);
        }

        // Extract Date
        let dateStr = "";
        const ariaDateMatch = ariaLabel.match(/(\d+\s*(hour|day|week|month|year)s?\s*ago)/i);
        if (ariaDateMatch) {
            dateStr = ariaDateMatch[1];
        } else {
            const metaDateMatch = metaText.match(/(\d+\s*(hour|day|week|month|year)s?\s*ago)/i);
            if (metaDateMatch) dateStr = metaDateMatch[1];
        }

        // Extract Duration
        const durationEl = el.querySelector("ytd-thumbnail-overlay-time-status-renderer span, .ytd-thumbnail-overlay-time-status-renderer badge-shape");
        const durationText = durationEl?.textContent?.trim() || undefined;

        // Extract Date — prefer the exact <time datetime='...'> attribute if available
        // (much more accurate than regex-parsing '3 months ago' style strings)
        const timeEl = el.querySelector("time[datetime]");
        const exactDatetime = (timeEl as HTMLTimeElement | null)?.dateTime;
        if (exactDatetime && !dateStr) {
            dateStr = exactDatetime;
        }

        // Extract Channel
        const channelEl = el.querySelector("ytd-channel-name a, #channel-name a, .ytd-channel-name a");
        const channelName = channelEl?.textContent?.trim() || pageChannelHandle;

        videos.push({
            title,
            views,
            likes: 0,
            comments: 0,
            uploadDate: dateStr ? parseDate(dateStr) : new Date().toISOString(),
            url: url.startsWith("http") ? url : `https://www.youtube.com${url}`,
            channel: channelName,
            duration: durationText,
        });

        if (videos.length >= 100) break;
    }

    // Indestructible Fallback
    if (videos.length === 0) {
        const fallbackLinks = Array.from(document.querySelectorAll("a[href^='/watch?v=']"));
        for (const link of fallbackLinks) {
            const url = link.getAttribute("href");
            if (!url || seen.has(url)) continue;
            
            // Heuristic: Avoid grabbing tiny thumbnail links (like "8:09")
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
                uploadDate: dateMatch ? parseDate(dateMatch[1]) : new Date().toISOString(),
                url: url.startsWith("http") ? url : `https://www.youtube.com${url}`,
                channel: pageChannelHandle,
            });
        }
    }

    return videos;
}

// ─── Enhanced Comment Scraping ────────────────────────────────────────────────

function scrapeComments(): CommentData[] {
    const comments: CommentData[] = [];
    const seen = new Set<string>();

    // Main comment text
    const commentEls = document.querySelectorAll("#content-text, ytd-comment-renderer #content-text");
    for (const el of commentEls) {
        const text = el.textContent?.trim();
        if (!text || text.length < 10 || seen.has(text)) continue;
        seen.add(text);

        // Try to get like count for this comment
        const commentRenderer = el.closest("ytd-comment-renderer, ytd-comment-thread-renderer");
        const likeEl = commentRenderer?.querySelector("#vote-count-middle, .ytd-comment-action-buttons-renderer span");
        const likeText = likeEl?.textContent?.trim() ?? "0";
        const likeCount = parseLikes(likeText);

        const authorEl = commentRenderer?.querySelector("#author-text, .ytd-comment-renderer #author-text");
        const authorName = authorEl?.textContent?.trim() ?? undefined;

        comments.push({
            text: text.slice(0, 500),
            videoUrl: window.location.href,
            likeCount: likeCount > 0 ? likeCount : undefined,
            authorName,
        });

        if (comments.length >= 200) break;
    }

    return comments;
}

// ─── Enhanced Search Results Scraping ────────────────────────────────────────

function scrapeSearchResults(): SearchResult[] {
    const results: SearchResult[] = [];
    const renderers = document.querySelectorAll("ytd-video-renderer");

    for (const el of renderers) {
        const title = el.querySelector("#video-title")?.textContent?.trim();
        const channelEl = el.querySelector("ytd-channel-name a");
        const channel = channelEl?.textContent?.trim();
        const metaItems = el.querySelectorAll("#metadata-line span");
        const viewText = Array.from(metaItems).find(s => s.textContent?.match(/view|K|M/i))?.textContent ?? "0";
        const dateText = Array.from(metaItems).find(s => s.textContent?.match(/ago|yesterday/i))?.textContent ?? "";

        // Try to get subscriber count from channel info
        const subscriberEl = el.querySelector(".ytd-channel-renderer #subscribers, .ytd-video-owner-renderer #owner-sub-count");
        const subscriberText = subscriberEl?.textContent?.trim() ?? "";

        if (!title || !channel) continue;
        results.push({
            title,
            channel,
            views: parseViews(viewText),
            likes: 0, // Not available in search results
            uploadDate: parseDate(dateText),
            subscriberCount: subscriberText ? parseSubscribers(subscriberText) : undefined,
        });
        if (results.length >= 30) break;
    }

    return results;
}

// ─── Video Page Data Extraction ───────────────────────────────────────────────

function scrapeCurrentVideoData(): Partial<VideoData> | null {
    const isVideoPage = window.location.pathname === "/watch";
    if (!isVideoPage) return null;

    const title = document.querySelector("h1.ytd-video-primary-info-renderer, yt-formatted-string.ytd-video-primary-info-renderer")?.textContent?.trim();
    if (!title) return null;

    // Views
    const viewEl = document.querySelector(".view-count, ytd-video-view-count-renderer .view-count, #count .view-count");
    const viewText = viewEl?.textContent?.trim() ?? "0";

    // Likes
    const likeEl = document.querySelector("ytd-toggle-button-renderer:first-child #text, .ytd-segmented-like-dislike-button-renderer #text");
    const likeText = likeEl?.textContent?.trim() ?? "0";

    // Channel
    const channelEl = document.querySelector("ytd-channel-name a, #channel-name a");
    const channelName = channelEl?.textContent?.trim() ?? "";

    // Tags from meta
    const tagMeta = document.querySelector('meta[name="keywords"]');
    const tags = tagMeta?.getAttribute("content")?.split(",").map(t => t.trim()).filter(Boolean) ?? [];

    // Description
    const descEl = document.querySelector("#description-text, ytd-text-inline-expander #content");
    const description = descEl?.textContent?.trim()?.slice(0, 1000) ?? "";

    return {
        title,
        views: parseViews(viewText),
        likes: parseLikes(likeText),
        comments: 0,
        uploadDate: new Date().toISOString(),
        url: window.location.href,
        channel: channelName,
        tags: tags.slice(0, 30),
        description,
    };
}

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "SCRAPE_DATA") {
        const { keyword, channels } = message;
        try {
            const videos = scrapeVideoData(channels);
            const comments = scrapeComments();
            const searchResults = scrapeSearchResults();

            // Also try to get current video data if on a video page
            const currentVideo = scrapeCurrentVideoData();
            if (currentVideo && currentVideo.title && !videos.find(v => v.url === currentVideo.url)) {
                videos.unshift(currentVideo as VideoData);
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

// ─── Auto-Scrape on Channel Page ──────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes (channel stats don't change meaningfully faster)

function isChannelPage(): string | null {
    const path = window.location.pathname;
    const handleMatch = path.match(/^\/@([A-Za-z0-9_.\-]+)/);
    if (handleMatch) return handleMatch[1];
    const channelMatch = path.match(/^\/channel\/([A-Za-z0-9_\-]+)/);
    if (channelMatch) return channelMatch[1];
    return null;
}

function scrapeSubscriberCount(): string {
    const el = document.querySelector(
        "#subscriber-count, yt-formatted-string#subscribers-count, " +
        ".ytd-channel-renderer #subscribers, #channel-header-container #subscriber-count"
    );
    return el?.textContent?.trim() ?? "";
}

function getChannelName(): string {
    const el = document.querySelector(
        "yt-formatted-string#channel-name, #channel-name .ytd-channel-name, " +
        ".ytd-channel-name yt-formatted-string, #top-row #channel-name, " +
        "ytd-channel-name yt-formatted-string"
    );
    return el?.textContent?.trim() ?? document.title.replace("- YouTube", "").trim();
}

let _scrapeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
function autoScrapeChannel(handle: string) {
    if (_scrapeDebounceTimer) clearTimeout(_scrapeDebounceTimer);
    _scrapeDebounceTimer = setTimeout(() => {
        const videos = scrapeVideoData([]);
        if (videos.length < 10) return;

        const channelData = {
            url: `https://www.youtube.com/@${handle}`,
            handle,
            channelName: getChannelName(),
            subscriberCount: parseSubscribers(scrapeSubscriberCount()),
            videos,
            scrapedAt: Date.now(),
        };

        chrome.storage.local.set({ channelData }, () => {
            console.log(`[GapTuber] Cached ${videos.length} videos for @${handle}`);
        });
    }, 1000);
}

// Auto-scrape with smart retry
const channelHandle = isChannelPage();
if (channelHandle) {
    setTimeout(() => autoScrapeChannel(channelHandle), 2000);

    // Only auto-scroll if the page doesn't already have enough videos painted.
    // Avoids jarring page jumps for users on channels with plenty of visible videos.
    const visibleVideoCount = document.querySelectorAll("ytd-rich-item-renderer, ytd-grid-video-renderer").length;
    if (visibleVideoCount < 20) {
        setTimeout(() => {
            const scrollSteps = [600, 1200, 2000];
            scrollSteps.forEach((y, i) => {
                setTimeout(() => window.scrollTo({ top: y, behavior: "smooth" }), i * 500);
            });
        }, 3500);

        // Second attempt after scroll
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: "instant" });
            autoScrapeChannel(channelHandle);
        }, 6000);
    }
}

// ─── Comment Scraping ────────────────────────────────────────────────────────

async function scrapeTopComments(limit = 40): Promise<CommentData[]> {
    return new Promise((resolve) => {
        // Scroll down to trigger YouTube's lazy-loaded comments
        window.scrollBy(0, 800);

        setTimeout(() => {
            const commentEls = document.querySelectorAll("ytd-comment-thread-renderer");
            const comments: CommentData[] = [];

            commentEls.forEach((el, i) => {
                if (i >= limit) return;
                const textEl = el.querySelector("#content-text");
                const likesEl = el.querySelector("#vote-count-middle");
                const authorEl = el.querySelector("#author-text");
                if (textEl?.textContent?.trim()) {
                    comments.push({
                        text: textEl.textContent.trim(),
                        likeCount: parseViews(likesEl?.textContent?.trim() ?? "0"),
                        authorName: authorEl?.textContent?.trim() ?? undefined,
                        videoUrl: window.location.href,
                    });
                }
            });

            resolve(comments);
        }, 1800); // Wait 1.8s for YouTube comment DOM to render
    });
}

// ─── Cache Management ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_CACHED_CHANNEL") {
        chrome.storage.local.get("channelData", (result) => {
            const data = result.channelData as { scrapedAt: number; handle: string;[key: string]: unknown } | undefined;
            if (!data) { sendResponse({ success: false, reason: "no_cache" }); return; }
            const age = Date.now() - data.scrapedAt;
            if (age > CACHE_TTL_MS) { sendResponse({ success: false, reason: "expired" }); return; }
            sendResponse({ success: true, data });
        });
        return true;
    }

    if (message.type === "RESCRAPE_NOW") {
        try {
            const handle = isChannelPage();
            if (!handle) { sendResponse({ success: false, reason: "not_channel_page" }); return; }
            const videos = scrapeVideoData([]);
            const channelData = {
                url: `https://www.youtube.com/@${handle}`,
                handle,
                channelName: getChannelName(),
                subscriberCount: parseSubscribers(scrapeSubscriberCount()),
                videos,
                scrapedAt: Date.now(),
            };
            if (videos.length >= 5) chrome.storage.local.set({ channelData });
            sendResponse({ success: true, data: channelData });
        } catch (err) {
            sendResponse({ success: false, reason: String(err) });
        }
        return true;
    }

    if (message.type === "SCRAPE_VIDEO_COMMENTS") {
        // Scrape comments on the currently open YouTube video page
        const isVideoPage = window.location.pathname === "/watch";
        if (!isVideoPage) {
            sendResponse({ success: false, reason: "not_video_page" });
            return true;
        }

        // Get video metadata from the page
        const videoTitle =
            (document.querySelector("ytd-watch-metadata h1 yt-formatted-string") as HTMLElement | null)?.textContent?.trim() ??
            (document.querySelector("yt-formatted-string.ytd-watch-metadata") as HTMLElement | null)?.textContent?.trim() ??
            document.title.replace(" - YouTube", "").trim();

        scrapeTopComments(40).then((comments) => {
            sendResponse({
                success: true,
                comments,
                videoTitle,
                videoUrl: window.location.href,
            });
        });

        return true; // Keep message channel open for async response
    }

    // Liveness check — sidebar sends PING before scraping to detect orphaned/missing scripts
    if (message.type === "PING") {
        sendResponse({ pong: true });
        return false;
    }
});


// End of content script

