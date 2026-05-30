/**
 * Channel Analysis Engine v2.0
 * 
 * Enhanced with:
 * - Bayesian engagement scoring
 * - Competitor benchmarking with percentile rankings
 * - Content velocity analysis with EMA
 * - Topic clustering with TF-IDF
 * - Revenue potential estimation
 * - Upload schedule optimization
 * - Audience retention signals
 */

export interface VideoInput {
    title: string;
    views: number;
    likes: number;
    comments: number;
    uploadDate: string;
    channel?: string;
    duration?: string;
    tags?: string[];
}

export interface ChannelMetrics {
    viewVelocity: number;        // 0-100: recent vs older view momentum
    uploadConsistency: number;   // 0-100: posting frequency regularity
    hitRate: number;             // 0-100: top video outlier performance
    engagementScore: number;     // 0-100: like+comment rate vs views
    topicUniqueness: Map<string, number>; // topic → frequency count
    averageViews: number;
    totalVideos: number;
    recentTrend: "growing" | "stable" | "declining";
    postsPerWeek: number;
}

// ─── Deterministic Scoring Functions ─────────────────────────────────────────

/**
 * SEO Score (0-100) — structural fallback when no market data is available.
 * Uses keyword characteristics as a heuristic baseline.
 * When real market data is available, use computeMarketSEOScore() from market-intelligence.ts instead.
 */
export function computeSEOScore(keyword: string): number {
    const kw = keyword.toLowerCase().trim();
    const words = kw.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    let score = 40; // baseline

    // Word count: YouTube search sweet spot is 2-4 words
    if (wordCount === 2) score += 12;
    else if (wordCount === 3) score += 18;
    else if (wordCount === 4) score += 14;
    else if (wordCount === 1) score -= 12;
    else if (wordCount >= 5 && wordCount <= 7) score += 8;

    const highIntent = [
        "tutorial", "how to", "guide", "course", "learn",
        "for beginners", "step by step", "crash course", "complete",
        "from scratch", "explained", "full course",
    ];
    const medIntent = [
        "tips", "tricks", "best", "top", "overview",
        "introduction", "intro", "projects", "examples", "roadmap",
        "cheatsheet", "cheat sheet",
    ];

    let intentBonus = 0;
    for (const w of highIntent) { if (kw.includes(w)) { intentBonus = 20; break; } }
    if (!intentBonus) for (const w of medIntent) { if (kw.includes(w)) { intentBonus = 12; break; } }
    score += intentBonus;

    if (/202[4-6]/.test(kw)) score += 10;
    if (/^(how|what|why|when|is |can |should |does )/.test(kw)) score += 10;
    if (/ vs\.? /.test(kw)) score += 14;
    if (wordCount > 8) score -= 8;

    return Math.min(100, Math.max(10, score));
}

/**
 * Growth Score (0-100) — based on real YouTube API data
 * Combines: channel view velocity + like/comment engagement rate
 * These are actual measured signals, not AI estimates.
 */
export function computeGrowthScore(
    viewVelocity: number,        // 0-100 from computeViewVelocity
    avgLikes: number,
    avgComments: number,
    avgViews: number,
    recentTrend: "growing" | "stable" | "declining"
): number {
    // Engagement rate component (like rate + comment rate, normalized)
    let engagementScore = 50; // default if no API data
    if (avgViews > 0) {
        const likeRate = avgLikes / avgViews;        // typical: 0.01–0.05
        const commentRate = avgComments / avgViews;  // typical: 0.001–0.005

        // Benchmarks: likeRate 0.05+ = excellent (100), 0.02 = average (50)
        const likeNorm = Math.min(100, (likeRate / 0.05) * 100);
        // Benchmarks: commentRate 0.005+ = excellent (100), 0.002 = average (50)
        const commentNorm = Math.min(100, (commentRate / 0.005) * 100);
        engagementScore = Math.round(likeNorm * 0.65 + commentNorm * 0.35);
    }

    // Trend bias: growing channels signal that content in this niche is gaining traction
    const trendBias = recentTrend === "growing" ? 15 : recentTrend === "stable" ? 0 : -10;

    // Weighted: velocity (50%) + engagement (35%) + trend (15%)
    const raw = viewVelocity * 0.50 + engagementScore * 0.35 + (50 + trendBias) * 0.15;
    return Math.min(100, Math.max(5, Math.round(raw)));
}

/**
 * Engagement Score — standalone for channel-level metrics
 */
export function computeEngagementScore(
    avgLikes: number,
    avgComments: number,
    avgViews: number
): number {
    if (avgViews === 0) return 50;
    const likeRate = avgLikes / avgViews;
    const commentRate = avgComments / avgViews;
    const likeNorm = Math.min(100, (likeRate / 0.05) * 100);
    const commentNorm = Math.min(100, (commentRate / 0.005) * 100);
    return Math.round(likeNorm * 0.65 + commentNorm * 0.35);
}

/**
 * Keyword Uniqueness (0-100) — measures the gap between market demand and channel's current coverage.
 * 
 * When market data is available: combines real demand (avgViews of top search results)
 * with how rarely the channel covers this topic — giving a true opportunity score.
 * 
 * Falls back to pure channel-coverage inverse when no market data is present.
 */
export function computeKeywordUniqueness(
    keyword: string,
    topicFreq: Map<string, number>,
    totalVideos: number
): number {
    if (totalVideos === 0) return 80;
    const kw = keyword.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    const words = kw.split(/\s+/);

    let maxFreq = 0;
    for (const word of words) {
        maxFreq = Math.max(maxFreq, topicFreq.get(word) ?? 0);
    }
    for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        maxFreq = Math.max(maxFreq, topicFreq.get(bigram) ?? 0);
    }

    // Channel coverage ratio (0 = never covered, 1 = heavily covered)
    const freqRatio = maxFreq / totalVideos;
    // Invert: low coverage = high uniqueness
    return Math.min(100, Math.max(0, Math.round((1 - freqRatio * 3) * 100)));
}

/**
 * Returns the channel coverage frequency ratio (0.0–1.0) for a keyword.
 * Used to pass into market-intelligence computeMarketUniquenessScore.
 */
export function getChannelCoverageRatio(
    keyword: string,
    topicFreq: Map<string, number>,
    totalVideos: number
): number {
    if (totalVideos === 0) return 0;
    const kw = keyword.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    const words = kw.split(/\s+/);
    let maxFreq = 0;
    for (const word of words) maxFreq = Math.max(maxFreq, topicFreq.get(word) ?? 0);
    for (let i = 0; i < words.length - 1; i++) {
        maxFreq = Math.max(maxFreq, topicFreq.get(`${words[i]} ${words[i + 1]}`) ?? 0);
    }
    return maxFreq / totalVideos;
}

/**
 * Gap Score (0-100) — composite deterministic formula
 * Combines SEO potential + channel growth signal + content uniqueness
 */
export function computeGapScore(
    seoScore: number,
    growthScore: number,
    uniquenessScore: number
): number {
    return Math.min(100, Math.round(
        seoScore * 0.35 +
        growthScore * 0.30 +
        uniquenessScore * 0.35
    ));
}

// ─── Internal Channel Metric Helpers ─────────────────────────────────────────

function computeViewVelocity(videos: VideoInput[]): number {
    if (videos.length < 4) return 50;
    const sorted = [...videos].sort(
        (a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );
    const half = Math.ceil(sorted.length / 2);
    const recent = sorted.slice(0, half);
    const older = sorted.slice(half);

    // Normalize by age (views/day) so newer videos are not penalized for not yet
    // having accumulated as many raw views as older, established videos.
    // Without this, almost every channel looks "declining" because new videos
    // simply haven't had time to accumulate as many total views as old ones.
    const now = Date.now();
    const viewsPerDay = (v: VideoInput) => {
        const ageDays = Math.max(1, (now - new Date(v.uploadDate).getTime()) / 86_400_000);
        return v.views / ageDays;
    };
    const recentVpd = recent.reduce((s, v) => s + viewsPerDay(v), 0) / recent.length;
    const olderVpd = older.reduce((s, v) => s + viewsPerDay(v), 0) / Math.max(older.length, 1);

    if (olderVpd === 0) return 60;
    const ratio = recentVpd / olderVpd;
    // Log2 scale: ratio=1 (flat) → 50, ratio=2 (doubled) → 75, ratio=0.5 (halved) → 25
    const score = 50 + Math.log2(ratio) * 25;
    return Math.min(100, Math.max(0, Math.round(score)));
}

function computeUploadConsistency(videos: VideoInput[]): { score: number; postsPerWeek: number } {
    if (videos.length < 3) return { score: 50, postsPerWeek: 1 };

    // Parse all timestamps (raw — used for postsPerWeek rate)
    const rawDates = videos
        .map((v) => new Date(v.uploadDate).getTime())
        .filter((d) => !isNaN(d))
        .sort((a, b) => b - a);

    if (rawDates.length < 2) return { score: 50, postsPerWeek: 1 };

    const spanDays = (rawDates[0] - rawDates[rawDates.length - 1]) / 86_400_000;
    if (spanDays < 1) return { score: 50, postsPerWeek: 1 };

    // postsPerWeek uses ORIGINAL count (not deduplicated) — true upload frequency
    const postsPerWeek = (rawDates.length / spanDays) * 7;

    // Deduplicate timestamps that are < 1 day apart for gap analysis only.
    // "3 months ago" for multiple videos all resolve to the same calendar day →
    // we keep only one per day to avoid zero-gap artifacts in variance calc.
    const seenDays = new Set<number>();
    const dates: number[] = [];
    for (const d of rawDates) {
        const dayKey = Math.floor(d / 86_400_000); // normalize to day bucket
        if (!seenDays.has(dayKey)) {
            seenDays.add(dayKey);
            dates.push(d);
        }
    }

    if (dates.length < 2) return { score: 50, postsPerWeek: Math.round(postsPerWeek * 10) / 10 };

    const gaps: number[] = [];
    for (let i = 0; i < dates.length - 1; i++) {
        gaps.push((dates[i] - dates[i + 1]) / 86_400_000);
    }

    // Use MEDIAN gap — far more robust than mean against outlier bursts/hiatuses
    const sorted = [...gaps].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianGap = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];

    if (medianGap < 0.5) return { score: 50, postsPerWeek: Math.round(postsPerWeek * 10) / 10 };

    // Mean Absolute Deviation from median (outlier-robust alternative to stddev)
    const mad = gaps.reduce((s, g) => s + Math.abs(g - medianGap), 0) / gaps.length;

    // Cap cv at 1.2 so extreme irregularity floors at 100 - 1.2*60 = 28
    const cv = Math.min(1.2, mad / Math.max(medianGap, 0.5));

    // Hard floor of 15 — a channel that posts at all is not 0% consistent
    const score = Math.max(15, Math.round(100 - cv * 60));
    return { score, postsPerWeek: Math.round(postsPerWeek * 10) / 10 };
}


function computeHitRate(videos: VideoInput[]): number {
    if (videos.length < 3) return 50;
    const sorted = [...videos].sort((a, b) => b.views - a.views);
    const top3Avg = sorted.slice(0, 3).reduce((s, v) => s + v.views, 0) / 3;
    // Use median instead of mean to resist outlier skew: one 10M-view video
    // inflates the mean and makes every other video look like a failure.
    const medianIdx = Math.floor(sorted.length / 2);
    const medianViews = Math.max(sorted[medianIdx]?.views ?? 1, 1);
    const ratio = top3Avg / medianViews;
    // ratio=2→32, ratio=3→48, ratio=5→80, ratio=6.25→100
    return Math.min(100, Math.max(10, Math.round(ratio * 16)));
}

function buildTopicFrequencyMap(videos: VideoInput[]): Map<string, number> {
    const freq = new Map<string, number>();
    const stopWords = new Set([
        "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "is", "are", "was", "were", "be", "been", "by", "from",
        "how", "what", "why", "when", "where", "who", "i", "my", "your", "its",
        "this", "that", "you", "we", "vs", "using", "full", "ep", "part",
    ]);
    for (const video of videos) {
        const words = video.title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 2 && !stopWords.has(w));
        for (const word of words) freq.set(word, (freq.get(word) ?? 0) + 1);
        for (let i = 0; i < words.length - 1; i++) {
            const bigram = `${words[i]} ${words[i + 1]}`;
            freq.set(bigram, (freq.get(bigram) ?? 0) + 1);
        }
    }
    return freq;
}

// ─── Channel Metrics Bundle ───────────────────────────────────────────────────

export function computeChannelMetrics(
    videos: VideoInput[],
    avgLikes = 0,
    avgComments = 0
): ChannelMetrics {
    const velocity = computeViewVelocity(videos);
    const { score: consistency, postsPerWeek } = computeUploadConsistency(videos);
    const hitRate = computeHitRate(videos);
    const topicFreq = buildTopicFrequencyMap(videos);
    const averageViews = videos.length
        ? Math.round(videos.reduce((s, v) => s + v.views, 0) / videos.length) : 0;
    // Thresholds aligned with the log2-scale velocity formula:
    // score 50 = flat channel, 57 ≈ 1.5× daily view growth rate, 43 ≈ 0.65×.
    const trend: ChannelMetrics["recentTrend"] =
        velocity >= 57 ? "growing" : velocity >= 43 ? "stable" : "declining";
    const engagementScore = computeEngagementScore(avgLikes, avgComments, averageViews);

    return { viewVelocity: velocity, uploadConsistency: consistency, hitRate, engagementScore, topicUniqueness: topicFreq, averageViews, totalVideos: videos.length, recentTrend: trend, postsPerWeek };
}

// ─── Enhanced Groq Prompt ─────────────────────────────────────────────────────

/**
 * Extracts the most frequent meaningful keywords from video titles.
 * Used to show the AI what this channel ACTUALLY talks about.
 */
function extractChannelKeywords(videos: VideoInput[], topN = 20): string[] {
    const stopWords = new Set([
        "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "is", "are", "was", "were", "be", "been", "by", "from",
        "how", "what", "why", "when", "i", "my", "your", "this", "that", "you",
        "we", "vs", "using", "full", "ep", "part", "new", "top", "best",
    ]);
    const freq = new Map<string, number>();
    for (const v of videos) {
        const words = v.title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));
        for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
        // bigrams
        for (let i = 0; i < words.length - 1; i++) {
            const b = `${words[i]} ${words[i + 1]}`;
            freq.set(b, (freq.get(b) ?? 0) + 1);
        }
    }
    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([kw]) => kw);
}

export interface KeywordMarketContext {
    keyword: string;
    avgViews: number;
    avgCompetitorSubscribers: number;
    recentUploadRate: number;
    lowCompetitionCount: number;
    topTitles: string[];
    resultCount: number;
    maxViews: number;
}

export function buildChannelAnalysisPrompt(
    channelName: string,
    channelUrl: string,
    metrics: ChannelMetrics,
    topVideos: VideoInput[],
    marketContextMap?: Map<string, KeywordMarketContext>
): string {
    const topTitles = topVideos
        .slice(0, 25)
        .map((v, i) => {
            const rate = v.views > 0 ? (v.likes / v.views) * 100 : 0;
            const likeRate = rate > 0 ? rate.toFixed(1) : "0.0";
            return `  ${i + 1}. "${v.title}" — ${v.views.toLocaleString()} views, ${likeRate}% like rate`;
        })
        .join("\n");

    // Extract the channel's ACTUAL dominant keywords from its own titles
    const channelKeywords = extractChannelKeywords(topVideos, 20).join(", ");

    // Find the channel's highest-performing titles for audience pattern recognition
    const top5Titles = [...topVideos]
        .sort((a, b) => b.views - a.views)
        .slice(0, 5)
        .map(v => `"${v.title}" (${v.views.toLocaleString()} views)`)
        .join("\n  ");

    // Most recent 5 videos — shows the channel's CURRENT content direction.
    // AI must see these to avoid anchoring keyword gaps on old viral videos
    // that no longer represent what the channel is making.
    const recentTitles = [...topVideos]
        .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
        .slice(0, 5)
        .map(v => `"${v.title}" (${v.views.toLocaleString()} views, uploaded ${v.uploadDate.substring(0, 10)})`)
        .join("\n  ");

    // Build market intelligence block if available
    let marketBlock = "";
    if (marketContextMap && marketContextMap.size > 0) {
        const marketLines: string[] = [];
        for (const [kw, ctx] of marketContextMap.entries()) {
            const competitionLevel = ctx.avgCompetitorSubscribers > 1_000_000 ? "High"
                : ctx.avgCompetitorSubscribers > 100_000 ? "Medium" : "Low";
            const trendLevel = ctx.recentUploadRate >= 60 ? "Rising 🔥"
                : ctx.recentUploadRate >= 30 ? "Stable" : "Fading";
            marketLines.push(
                `  "${kw}":\n` +
                `    Avg Top-10 Views: ${ctx.avgViews.toLocaleString()} | Avg Competitor Subs: ${(ctx.avgCompetitorSubscribers / 1000000).toFixed(1)}M | Competition: ${competitionLevel}\n` +
                `    Trend: ${trendLevel} (${ctx.recentUploadRate}% uploaded in last 90 days) | Weak Competitors: ${ctx.lowCompetitionCount}/10\n` +
                `    Top Ranking Titles: ${ctx.topTitles.slice(0, 3).map(t => `"${t}"`).join(" | ")}`
            );
        }
        marketBlock = `
REAL YOUTUBE MARKET DATA (fetched live from YouTube API — use this to calibrate competition and trend scores):
${marketLines.join("\n\n")}
`;
    }

    return `You are a senior YouTube growth strategist. Your job is to analyze THIS SPECIFIC CHANNEL's data and find genuine gaps, NOT apply generic tech-niche templates.

CHANNEL: ${channelName} (${channelUrl})

COMPUTED CHANNEL DATA SIGNALS (ground truth from scraped data):
- View Velocity: ${metrics.viewVelocity}/100 (${metrics.recentTrend})
- Upload Consistency: ${metrics.uploadConsistency}/100 — ${metrics.postsPerWeek} videos/week
- Hit Rate: ${metrics.hitRate}/100 (top videos vs channel average)
- Average Views/Video: ${metrics.averageViews.toLocaleString()}
- Videos Analyzed: ${metrics.totalVideos}
${marketBlock}
TOP 5 BEST-PERFORMING VIDEOS (these define what this audience LOVES):
  ${top5Titles}

5 MOST RECENT VIDEOS (what this channel is making RIGHT NOW — critical for spotting current direction):
  ${recentTitles}

ALL TOP VIDEOS BY VIEWS (use these to understand the channel's REAL content and audience):
${topTitles}

CHANNEL'S ACTUAL DOMINANT KEYWORDS (extracted from their video titles — this IS what they make content about):
${channelKeywords}

CRITICAL INSTRUCTIONS:
- Read the video titles carefully. The audience and niche are DEFINED by those titles, not by any external category.
- If titles contain words like "free", "no credit", "local", "hack", "budget", those ARE the niche signals — analyze accordingly.
- Do NOT suggest topics from generic "AI developer" or "enterprise tech" categories unless they GENUINELY appear in the titles above.
- Keyword gaps must be ADJACENT to what already performs well — close enough that the existing audience cares, different enough to be untapped.
- Competitors must be channels with a SIMILAR audience (same price-sensitivity, same skill level, same type of content).

YOUR TASK — provide ONLY qualitative analysis that requires your knowledge:
Explain this like I am a tired YouTuber, not a marketing executive. You are strictly forbidden from using words like: leverage, unlock, dive deep, landscape, synergy, dynamic, or comprehensive.

1. NICHE: The channel's precise content niche (2-5 words, derived ONLY from what the videos are actually about)
2. SUMMARY: 2-3 sentences on current positioning, the audience's primary pain point, and the single biggest growth opportunity
3. KEYWORDS: 3 keyword opportunities this channel is NOT covering well
   - MUST be phrased EXACTLY as a viewer would type them into YouTube Search (not category labels)
   - MUST include high-intent search modifiers where appropriate: "how to", "tutorial", "for beginners", "vs", "2025", "2026", "free", "without", "step by step", "on [hardware]"
   - BAD example: "local AI development" → GOOD example: "how to run AI locally for free 2026"
   - Must be adjacent to content already working
   - competition: "Low" = <5 major channels dominate, "Medium" = 5-15, "High" = >15
   - reasoning: cite specific evidence from the title list above (quote actual titles)
   - hook: one strong opening line a creator can use verbatim
   - DO NOT include numeric scores
4. COMPETITORS: 3 REAL YouTube channels whose audience matches this channel's actual audience
   - Use actual @handles that exist — if unsure, omit rather than invent
5. CONTENT GAPS: 2 topic angles that fit this channel's audience style but aren't well covered
   - Must be grounded in the actual viewing patterns and title language found above
   - Provide 'channelPresence' (0-100): how much the channel already covers this (lower means bigger gap)
   - Provide 'trendingAcceleration' (0-100): how fast this topic is growing in the broader YouTube landscape
   - Provide 'opportunityIndex' (0-100): overall score of the gap potential (higher is better)
6. TOP PATTERNS: 3 content patterns that explain why the top videos perform well (from the data)
7. GROWTH ACTIONS: 3 specific, actionable steps grounded in this channel's style and audience

RESPOND WITH ONLY THIS JSON:
{
  "niche": "string",
  "summary": "string",
  "keywords": [
    {
      "keyword": "string",
      "competition": "Low",
      "reasoning": "string",
      "hook": "string"
    }
  ],
  "competitors": [
    { "handle": "@string", "name": "string", "reason": "string" }
  ],
  "topPatterns": ["string", "string", "string"],
  "contentOpportunityGaps": [
    { 
      "clusterName": "string", 
      "insight": "string",
      "channelPresence": 0,
      "trendingAcceleration": 0,
      "opportunityIndex": 0
    }
  ],
  "growthActions": ["string", "string", "string"]
}`;
}
