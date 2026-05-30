// Advanced Deterministic Scoring Engine v2.0
// Real statistical algorithms for YouTube content gap detection

export interface VideoData {
    title: string;
    views: number;
    likes: number;
    comments: number;
    uploadDate: string;
    url: string;
    channel: string;
    subscriberCount?: number; // Tier 1A: for virality ratio
    duration?: string;
    tags?: string[];
    description?: string;
}

export interface CommentData {
    text: string;
    videoUrl?: string;
    likeCount?: number;
    authorName?: string;
}

export interface SearchResult {
    title: string;
    channel: string;
    views: number;
    likes: number;
    uploadDate: string;
    subscriberCount?: number;
}

export interface ScoringInput {
    keyword: string;
    videos: VideoData[];
    comments: CommentData[];
    searchResults: SearchResult[];
}

export interface ScoreBreakdown {
    velocityScore: number;
    saturationScore: number;
    frustrationScore: number;
    abandonmentScore: number;
    engagementScore: number;
    trendMomentum: number;
    competitionScore: number;
    compositeScore: number;
    confidence: number;
}

export interface GapCandidate {
    title: string;
    angle: string;
    scores: ScoreBreakdown;
    topFrustrationKeywords: string[];
    velocityInsight: string;
    saturationInsight: string;
    trendInsight: string;
    competitionInsight: string;
    suggestedTags: string[];
    estimatedViews: { low: number; mid: number; high: number };
    bestUploadDay: string;
    bestUploadHour: number;
}

// ─── Statistical Utilities ───────────────────────────────────────────────────

const STOP_WORDS = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "this", "that", "these", "those", "it", "its",
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "they", "their",
    "what", "which", "who", "how", "when", "where", "why", "just", "very",
    "so", "if", "not", "no", "can", "get", "got", "like", "also", "more",
]);

const FRUSTRATION_PHRASES = [
    "doesn't work", "not working", "broken", "outdated", "old tutorial",
    "deprecated", "confused", "confusing", "unclear", "explain", "please explain",
    "what about", "why doesn't", "why isn't", "still doesn't", "tried everything",
    "nobody explains", "can't find", "need help", "lost", "stuck", "beginner",
    "for beginners", "too complex", "too complicated", "simplified", "simpler version",
    "update", "updated version", "2025", "2026", "latest", "current",
    "alternative", "better way", "easier way", "without", "error", "fix",
    "waste of time", "misleading", "clickbait", "didn't help", "useless",
    "wrong", "incorrect", "mistake", "bug", "issue", "problem",
    "how do i", "how can i", "help me", "please help", "anyone know",
];

/** Wilson score lower bound for engagement reliability */
function wilsonScoreLowerBound(positives: number, total: number, confidence = 1.96): number {
    if (total === 0) return 0;
    const p = positives / total;
    const z = confidence;
    const denominator = 1 + z * z / total;
    const center = p + z * z / (2 * total);
    const spread = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total);
    return (center - spread) / denominator;
}

/** Exponential decay weight: recent data matters more */
function exponentialDecayWeight(daysAgo: number, halfLife = 30): number {
    return Math.exp(-0.693 * daysAgo / halfLife);
}

/** Exponential Moving Average for trend detection */
function computeEMA(values: number[], period: number): number[] {
    if (values.length === 0) return [];
    const k = 2 / (period + 1);
    const ema: number[] = [values[0]];
    for (let i = 1; i < values.length; i++) {
        ema.push(values[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
}

/** TF-IDF score for keyword relevance in a corpus of titles */
function computeTFIDF(keyword: string, titles: string[]): number {
    const kwWords = keyword.toLowerCase().split(/\s+/).filter(w => !STOP_WORDS.has(w));
    if (kwWords.length === 0 || titles.length === 0) return 0;

    let totalScore = 0;
    for (const word of kwWords) {
        const tf = titles.filter(t => t.toLowerCase().includes(word)).length / titles.length;
        const idf = Math.log(titles.length / Math.max(1, titles.filter(t => t.toLowerCase().includes(word)).length));
        totalScore += tf * (1 + idf);
    }
    return totalScore / kwWords.length;
}

/** Days since a date string */
function daysSince(dateStr: string): number {
    const uploaded = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - uploaded.getTime();
    return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/** Parse ISO 8601 duration to seconds */
function parseDurationToSeconds(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] ?? "0");
    const minutes = parseInt(match[2] ?? "0");
    const seconds = parseInt(match[3] ?? "0");
    return hours * 3600 + minutes * 60 + seconds;
}

// ─── Core Scoring Functions ──────────────────────────────────────────────────

/**
 * Velocity Score using exponential decay weighting
 * Recent views count more than old views
 * Score 0-10: higher = faster growing content
 */
export function computeVelocityScore(videos: VideoData[]): {
    score: number;
    insight: string;
    topVideos: VideoData[];
    weeklyGrowthRate: number;
    avgViralityRatio: number;
} {
    if (videos.length === 0) return { score: 0, insight: "No videos found", topVideos: [], weeklyGrowthRate: 0, avgViralityRatio: 0 };

    const withDecayedVelocity = videos.map(v => {
        const days = daysSince(v.uploadDate);
        const rawVelocity = v.views / days;
        const decayWeight = exponentialDecayWeight(days, 60);
        // Tier 1A: subscriber-normalised virality ratio
        const viralityRatio = v.subscriberCount && v.subscriberCount > 0
            ? v.views / v.subscriberCount
            : 0;
        return { ...v, velocity: rawVelocity, decayedVelocity: rawVelocity * decayWeight, days, viralityRatio };
    });

    withDecayedVelocity.sort((a, b) => b.decayedVelocity - a.decayedVelocity);

    const maxDecayedVelocity = withDecayedVelocity[0].decayedVelocity;
    const avgVelocity = withDecayedVelocity.reduce((s, v) => s + v.velocity, 0) / withDecayedVelocity.length;

    // Tier 1A: average virality ratio across all videos
    const avgViralityRatio = withDecayedVelocity.reduce((s, v) => s + v.viralityRatio, 0) / withDecayedVelocity.length;
    // Boost score for outlier content (videos outperforming their subscriber base)
    // ratio > 3 = video got 3x more views than subscribers = algo-pushed outlier
    const viralityBonus = Math.min(2.5, avgViralityRatio / 2);

    // Compute weekly growth rate using EMA on sorted-by-date views
    const sortedByDate = [...withDecayedVelocity].sort((a, b) =>
        new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
    );
    const viewsOverTime = sortedByDate.map(v => v.views);
    const ema7 = computeEMA(viewsOverTime, 7);
    const ema30 = computeEMA(viewsOverTime, 30);
    const lastEma7 = ema7[ema7.length - 1] ?? 0;
    const lastEma30 = ema30[ema30.length - 1] ?? 1;
    const weeklyGrowthRate = lastEma30 > 0 ? ((lastEma7 - lastEma30) / lastEma30) * 100 : 0;

    // Normalize: benchmark is 10K views/day = score 5, 100K views/day = score 8, 1M+/day → ~10
    // Previous: log10(x)*2.5 → popular channels always hit 10 (log10(1M)*2.5=15 → capped)
    // New: log10(x)*1.8 → 1M/day gives log10(1M)*1.8=10.8→capped at 10 (much less saturating)
    const baseScore = Math.min(10, Math.log10(Math.max(1, maxDecayedVelocity)) * 1.8);
    const score = Math.min(10, baseScore + viralityBonus);

    const topVideos = withDecayedVelocity.slice(0, 5);
    const viralNote = avgViralityRatio > 3 ? ` 🔥 Outlier signal: avg ${avgViralityRatio.toFixed(1)}x views/subscribers.` : "";
    const insight = `Top video: ${Math.round(withDecayedVelocity[0].velocity).toLocaleString()} views/day. Avg: ${Math.round(avgVelocity).toLocaleString()} views/day. Weekly trend: ${weeklyGrowthRate > 0 ? "+" : ""}${weeklyGrowthRate.toFixed(1)}%.${viralNote}`;

    return { score, insight, topVideos, weeklyGrowthRate, avgViralityRatio };
}

/**
 * Saturation Score using competition density analysis
 * Analyzes: upload frequency, channel diversity, view distribution
 * Score 0-10: higher = less saturated = more opportunity
 */
export function computeSaturationScore(searchResults: SearchResult[]): {
    score: number;
    insight: string;
    competitionLevel: "Low" | "Medium" | "High" | "Very High";
} {
    if (searchResults.length === 0) {
        return { score: 10, insight: "No results found — extremely low saturation.", competitionLevel: "Low" };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentUploads = searchResults.filter(r => {
        const d = new Date(r.uploadDate);
        return !isNaN(d.getTime()) && d >= thirtyDaysAgo;
    });

    const last90Days = searchResults.filter(r => {
        const d = new Date(r.uploadDate);
        return !isNaN(d.getTime()) && d >= ninetyDaysAgo;
    });

    // Channel diversity: fewer unique channels = less competition
    const uniqueChannels = new Set(searchResults.map(r => r.channel)).size;
    const channelDiversityRatio = uniqueChannels / searchResults.length;

    // View concentration: if top 3 videos have >80% of views, market is dominated
    const totalViews = searchResults.reduce((s, r) => s + r.views, 0);
    const sortedByViews = [...searchResults].sort((a, b) => b.views - a.views);
    const top3Views = sortedByViews.slice(0, 3).reduce((s, r) => s + r.views, 0);
    const viewConcentration = totalViews > 0 ? top3Views / totalViews : 0;

    // Subscriber power: high-sub channels dominate
    const avgSubscribers = searchResults.reduce((s, r) => s + (r.subscriberCount ?? 0), 0) / searchResults.length;

    // Composite saturation — log-based penalty (gentle at low values, firm at high)
    let score = 10;
    // log(1 + n) grows slowly: 1 upload → -1.2, 5 → -2.6, 20 → -4.5
    score -= Math.log1p(recentUploads.length) * 1.8;
    score -= Math.log1p(last90Days.length) * 0.6;
    score -= channelDiversityRatio * 3;
    score -= viewConcentration * 2;
    if (avgSubscribers > 1_000_000) score -= 2;
    else if (avgSubscribers > 100_000) score -= 1;

    score = Math.min(10, Math.max(1, score));

    const competitionLevel: "Low" | "Medium" | "High" | "Very High" =
        score >= 7 ? "Low" : score >= 5 ? "Medium" : score >= 3 ? "High" : "Very High";

    const insight = `${recentUploads.length} uploads in 30 days, ${uniqueChannels} unique channels competing. View concentration: ${(viewConcentration * 100).toFixed(0)}% in top 3 videos.`;

    return { score, insight, competitionLevel };
}

/**
 * Frustration Score using NLP-based sentiment analysis
 * Detects: pain points, unmet needs, content gaps from comments
 * Score 0-10: higher = more audience frustration = more opportunity
 */
export function computeFrustrationScore(comments: CommentData[]): {
    score: number;
    topKeywords: string[];
    painPoints: string[];
    verbatimQuestions: string[]; // Tier 1B: high-liked unanswered questions
    sentimentBreakdown: { frustrated: number; neutral: number; positive: number };
} {
    if (comments.length === 0) {
        return { score: 0, topKeywords: [], painPoints: [], verbatimQuestions: [], sentimentBreakdown: { frustrated: 0, neutral: 0, positive: 0 } };
    }

    const wordFreq = new Map<string, number>();
    let frustrationHits = 0;
    let positiveHits = 0;
    const painPointsMap = new Map<string, number>();

    const POSITIVE_PHRASES = ["great", "amazing", "perfect", "excellent", "helpful", "thanks", "love", "best"];

    // Tier 1B: implicit frustration signals
    const shortComments = comments.filter(c => c.text.trim().split(/\s+/).length <= 5);
    const questionComments = comments.filter(c => c.text.includes("?"));

    // Lower threshold for small comment sets: >=2 likes or any question on <30 comments
    const likeThreshold = comments.length < 30 ? 2 : 5;
    const highLikedQuestions = questionComments
        .filter(c => (c.likeCount ?? 0) >= likeThreshold)
        .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0));

    // verbatimQuestions: short phrase extractions only — never full raw comments as pain point tags
    // Extract the first question clause (up to first "?") trimmed to 60 chars max
    const verbatimQuestions = highLikedQuestions
        .slice(0, 5)
        .map(c => {
            const raw = c.text.trim();
            const questionEnd = raw.indexOf("?");
            const clause = questionEnd !== -1 ? raw.substring(0, questionEnd + 1) : raw;
            // Strip to core phrase — remove leading filler words and cap at 60 chars
            return clause.replace(/^(hi|hey|hello|please|can you|could you|would you)[,\s]*/i, "").substring(0, 60).trim();
        })
        .filter(q => q.length > 5); // drop empty extractions

    // Implicit frustration boost: many short/question comments = disengagement signal
    const shortRatio = comments.length > 0 ? shortComments.length / comments.length : 0;
    // Scale implicit boost for small datasets (< 30 comments) but cap the multiplier
    // at 1.3× (was 1.8×) to prevent overcorrection to 10/10
    const dataScaleMultiplier = comments.length < 30 ? 1.3 : 1.0;
    // Hard cap implicitBoost at 1.5 so it can't dominate the final score alone
    const implicitBoost = Math.min(1.5, ((shortRatio * 2) + (highLikedQuestions.length * 0.5)) * dataScaleMultiplier);

    for (const comment of comments) {
        const text = comment.text.toLowerCase();
        const weight = comment.likeCount ? Math.log(1 + comment.likeCount) : 1;

        let matchedFrustration = false;
        for (const phrase of FRUSTRATION_PHRASES) {
            if (text.includes(phrase)) {
                if (!matchedFrustration) {
                    frustrationHits += weight;
                    matchedFrustration = true;
                }
                painPointsMap.set(phrase, (painPointsMap.get(phrase) ?? 0) + weight);
            }
        }

        for (const phrase of POSITIVE_PHRASES) {
            if (text.includes(phrase)) {
                positiveHits += weight;
                break;
            }
        }


        const words = text
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(w => w.length > 3 && !STOP_WORDS.has(w));

        for (const word of words) {
            wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
        }
    }

    const sorted = [...wordFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([word]) => word);

    // Pain points: ONLY matched FRUSTRATION_PHRASES (short phrase keys), no raw verbatim text
    const topPainPoints = [...painPointsMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([phrase]) => phrase);

    // Count matched comments (unweighted) — used for the small-set formula
    // CRITICAL: frustrationHits is weighted by likes, so 1 viral comment with 500 likes
    // contributes 6.2× as much. Dividing by total comments inflates the ratio badly.
    // Solution: count distinct matched comments (boolean, not weighted) for small sets.
    let matchedCommentCount = 0;
    for (const comment of comments) {
        const text = comment.text.toLowerCase();
        if (FRUSTRATION_PHRASES.some(p => text.includes(p))) matchedCommentCount++;
    }

    const total = comments.length;
    const totalWeight = comments.reduce((s, c) => s + (c.likeCount ? Math.log(1 + c.likeCount) : 1), 0);
    const frustrationRatio = totalWeight > 0 ? frustrationHits / totalWeight : 0;
    const positiveRatio = totalWeight > 0 ? positiveHits / totalWeight : 0;

    // For small sets: use UNWEIGHTED match rate (matched comments / total comments)
    // This prevents 1 viral comment from inflating score to 10/10
    const reliableScore = comments.length < 30
        ? (matchedCommentCount / Math.max(total, 1)) * 10   // unweighted: e.g. 4/29*10 = 1.38
        : wilsonScoreLowerBound(Math.round(frustrationHits), Math.max(total, 1)) * 10;
    // Use frustrationRatio × 1.5 for small sets (reduced from × 2) to further prevent ceiling lock
    const frustrationRatioMultiplier = comments.length < 30 ? 1.5 : 5;
    const score = Math.min(10, Math.max(0, reliableScore + frustrationRatio * frustrationRatioMultiplier + implicitBoost));

    return {
        score,
        topKeywords: sorted,
        painPoints: topPainPoints,
        verbatimQuestions,
        sentimentBreakdown: {
            frustrated: Math.round(frustrationRatio * 100),
            neutral: Math.round(Math.max(0, 1 - frustrationRatio - positiveRatio) * 100),
            positive: Math.round(positiveRatio * 100),
        },
    };
}

/**
 * Abandonment Score: detects topics with high demand but no recent supply
 * Uses: view-to-recency ratio, upload gap analysis
 */
export function computeAbandonmentScore(videos: VideoData[]): {
    score: number;
    insight: string;
} {
    if (videos.length === 0) return { score: 0, insight: "No data" };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const highPerformingVideos = videos.filter(v => v.views > 50000);
    const recentVideos = videos.filter(v => {
        const d = new Date(v.uploadDate);
        return !isNaN(d.getTime()) && d >= thirtyDaysAgo;
    });
    const last90Videos = videos.filter(v => {
        const d = new Date(v.uploadDate);
        return !isNaN(d.getTime()) && d >= ninetyDaysAgo;
    });

    // Compute upload gap: days between most recent and second most recent
    const sortedByDate = [...videos].sort((a, b) =>
        new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );
    const uploadGap = sortedByDate.length >= 2
        ? daysSince(sortedByDate[1].uploadDate) - daysSince(sortedByDate[0].uploadDate)
        : 0;

    let score = 0;
    let insight = "";

    if (highPerformingVideos.length >= 3 && recentVideos.length === 0) {
        score = 10;
        insight = `${highPerformingVideos.length} high-performing videos (50K+ views) with NO recent uploads — prime abandoned niche`;
    } else if (highPerformingVideos.length >= 2 && recentVideos.length === 0) {
        score = 8.5;
        insight = `${highPerformingVideos.length} viral videos but no uploads in 30 days — strong abandonment signal`;
    } else if (highPerformingVideos.length >= 2 && last90Videos.length <= 1) {
        score = 7;
        insight = `High-performing content exists but upload frequency dropped significantly`;
    } else if (uploadGap > 60) {
        score = 5;
        insight = `${uploadGap}-day gap between recent uploads — inconsistent coverage`;
    } else if (recentVideos.length === 0) {
        score = 4;
        insight = "No recent uploads in this topic area";
    } else {
        score = 1;
        insight = "Active content creation in this space";
    }

    return { score, insight };
}

/**
 * Engagement Score using Wilson score interval
 * More reliable than raw like/view ratio
 */
export function computeEngagementScore(videos: VideoData[]): {
    score: number;
    avgLikeRate: number;
    avgCommentRate: number;
    insight: string;
} {
    if (videos.length === 0) return { score: 5, avgLikeRate: 0, avgCommentRate: 0, insight: "No data" };

    const videosWithData = videos.filter(v => v.views > 0);
    if (videosWithData.length === 0) return { score: 5, avgLikeRate: 0, avgCommentRate: 0, insight: "No view data" };

    const likeRates = videosWithData.map(v => v.likes / v.views);
    const commentRates = videosWithData.map(v => v.comments / v.views);

    const avgLikeRate = likeRates.reduce((s, r) => s + r, 0) / likeRates.length;
    const avgCommentRate = commentRates.reduce((s, r) => s + r, 0) / commentRates.length;

    // Industry benchmarks: like rate 2-5% = average, 5%+ = excellent
    // Comment rate 0.1-0.5% = average, 0.5%+ = excellent
    const likeNorm = Math.min(100, (avgLikeRate / 0.05) * 100);
    const commentNorm = Math.min(100, (avgCommentRate / 0.005) * 100);

    // Wilson score for reliability
    const totalLikes = videosWithData.reduce((s, v) => s + v.likes, 0);
    const totalViews = videosWithData.reduce((s, v) => s + v.views, 0);
    const wilsonLike = wilsonScoreLowerBound(totalLikes, totalViews) * 100;

    const rawScore = likeNorm * 0.5 + commentNorm * 0.3 + wilsonLike * 0.2;
    const score = Math.min(10, rawScore / 10);

    const insight = `Avg like rate: ${(avgLikeRate * 100).toFixed(2)}%, comment rate: ${(avgCommentRate * 100).toFixed(3)}%`;

    return { score, avgLikeRate, avgCommentRate, insight };
}

/**
 * Trend Momentum Score using EMA crossover
 * Detects accelerating vs decelerating trends
 */
export function computeTrendMomentum(videos: VideoData[]): {
    score: number;
    trend: "accelerating" | "stable" | "decelerating";
    insight: string;
} {
    if (videos.length < 5) return { score: 4, trend: "stable", insight: "Too few videos to detect a reliable trend — interpret with caution." };

    const sortedByDate = [...videos].sort((a, b) =>
        new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
    );

    const viewsPerDay = sortedByDate.map(v => v.views / daysSince(v.uploadDate));
    const ema7 = computeEMA(viewsPerDay, Math.min(7, viewsPerDay.length));
    const ema21 = computeEMA(viewsPerDay, Math.min(21, viewsPerDay.length));

    const lastEma7 = ema7[ema7.length - 1] ?? 0;
    const lastEma21 = ema21[ema21.length - 1] ?? 1;

    const crossoverRatio = lastEma21 > 0 ? lastEma7 / lastEma21 : 1;

    let trend: "accelerating" | "stable" | "decelerating";
    let score: number;

    if (crossoverRatio > 1.2) {
        trend = "accelerating";
        score = Math.min(10, 5 + (crossoverRatio - 1) * 10);
    } else if (crossoverRatio > 0.8) {
        trend = "stable";
        score = 5;
    } else {
        trend = "decelerating";
        score = Math.max(0, 5 - (1 - crossoverRatio) * 10);
    }

    const insight = `EMA7/EMA21 ratio: ${crossoverRatio.toFixed(2)}. Trend is ${trend}. ${trend === "accelerating" ? "Content demand is rising fast." : trend === "decelerating" ? "Interest may be waning." : "Steady demand."}`;

    return { score, trend, insight };
}

/**
 * Competition Score: how hard is it to rank?
 * Analyzes: top channel subscriber counts, view dominance, content quality signals
 */
export function computeCompetitionScore(searchResults: SearchResult[]): {
    score: number;
    insight: string;
    difficulty: "Easy" | "Moderate" | "Hard" | "Very Hard";
} {
    if (searchResults.length === 0) return { score: 10, insight: "No competition found", difficulty: "Easy" };

    const avgSubscribers = searchResults.reduce((s, r) => s + (r.subscriberCount ?? 0), 0) / searchResults.length;
    const maxViews = Math.max(...searchResults.map(r => r.views));
    const avgViews = searchResults.reduce((s, r) => s + r.views, 0) / searchResults.length;

    // Engagement quality of competitors
    const avgLikeRate = searchResults.reduce((s, r) => s + (r.likes / Math.max(r.views, 1)), 0) / searchResults.length;

    let score = 10;

    // Subscriber penalty
    if (avgSubscribers > 5_000_000) score -= 4;
    else if (avgSubscribers > 1_000_000) score -= 3;
    else if (avgSubscribers > 100_000) score -= 2;
    else if (avgSubscribers > 10_000) score -= 1;

    // View dominance penalty
    if (maxViews > 10_000_000) score -= 2;
    else if (maxViews > 1_000_000) score -= 1;

    // High engagement = quality content = harder to beat
    if (avgLikeRate > 0.05) score -= 1.5;
    else if (avgLikeRate > 0.02) score -= 0.5;

    // Many results = more competition
    if (searchResults.length >= 15) score -= 1;

    score = Math.min(10, Math.max(0, score));

    const difficulty: "Easy" | "Moderate" | "Hard" | "Very Hard" =
        score >= 7 ? "Easy" : score >= 5 ? "Moderate" : score >= 3 ? "Hard" : "Very Hard";

    const insight = `Avg competitor: ${(avgSubscribers / 1000).toFixed(0)}K subs, ${(avgViews / 1000).toFixed(0)}K avg views. Difficulty: ${difficulty}`;

    return { score, insight, difficulty };
}

// ─── Tag Generator ───────────────────────────────────────────────────────────

export function generateOptimalTags(keyword: string, videos: VideoData[], topKeywords: string[]): string[] {
    const tags = new Set<string>();
    const kw = keyword.toLowerCase().trim();

    // Primary keyword variations
    tags.add(kw);
    tags.add(`${kw} tutorial`);
    tags.add(`${kw} guide`);
    tags.add(`${kw} 2025`);
    tags.add(`${kw} 2026`);
    tags.add(`how to ${kw}`);
    tags.add(`${kw} for beginners`);
    tags.add(`learn ${kw}`);

    // Extract high-frequency words from top video titles
    const titleWords = new Map<string, number>();
    for (const video of videos.slice(0, 20)) {
        const words = video.title.toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(w => w.length > 3 && !STOP_WORDS.has(w));
        for (const word of words) {
            titleWords.set(word, (titleWords.get(word) ?? 0) + 1);
        }
    }

    const topTitleWords = [...titleWords.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([w]) => w);

    for (const word of topTitleWords) {
        if (!kw.includes(word)) {
            tags.add(`${kw} ${word}`);
        }
    }

    // Add frustration keywords as tags (high search intent)
    for (const kw2 of topKeywords.slice(0, 5)) {
        tags.add(kw2);
    }

    return [...tags].slice(0, 30);
}

// ─── Upload Schedule Optimizer ───────────────────────────────────────────────

export function computeOptimalUploadSchedule(videos: VideoData[]): {
    bestDay: string;
    bestHour: number;
    dayDistribution: Record<string, number>;
    hourDistribution: Record<number, number>;
    insight: string;
} {
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayViews: Record<string, number> = {};
    const hourViews: Record<number, number> = {};
    const dayCounts: Record<string, number> = {};
    const hourCounts: Record<number, number> = {};

    for (const video of videos) {
        const date = new Date(video.uploadDate);
        const day = DAYS[date.getDay()];
        const hour = date.getHours();

        dayViews[day] = (dayViews[day] ?? 0) + video.views;
        dayCounts[day] = (dayCounts[day] ?? 0) + 1;
        hourViews[hour] = (hourViews[hour] ?? 0) + video.views;
        hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
    }

    // Average views per upload day/hour
    const dayAvg: Record<string, number> = {};
    for (const day of DAYS) {
        dayAvg[day] = dayCounts[day] ? (dayViews[day] ?? 0) / dayCounts[day] : 0;
    }

    const hourAvg: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
        hourAvg[h] = hourCounts[h] ? (hourViews[h] ?? 0) / hourCounts[h] : 0;
    }

    const bestDay = Object.entries(dayAvg).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Tuesday";
    const bestHour = Object.entries(hourAvg).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "14";

    const insight = `Best upload day: ${bestDay} (avg ${(dayAvg[bestDay] / 1000).toFixed(1)}K views). Best hour: ${bestHour}:00 UTC.`;

    return {
        bestDay,
        bestHour: parseInt(String(bestHour)),
        dayDistribution: dayAvg,
        hourDistribution: hourAvg,
        insight,
    };
}

// ─── Revenue Estimator ───────────────────────────────────────────────────────

export function estimateRevenue(views: number, niche: string): {
    low: number;
    mid: number;
    high: number;
    cpmRange: { low: number; high: number };
    insight: string;
} {
    // CPM benchmarks by niche (USD per 1000 views)
    const CPM_RANGES: Record<string, { low: number; high: number }> = {
        finance: { low: 12, high: 45 },
        tech: { low: 8, high: 25 },
        ai: { low: 10, high: 30 },
        programming: { low: 8, high: 22 },
        gaming: { low: 2, high: 8 },
        education: { low: 5, high: 18 },
        business: { low: 10, high: 35 },
        health: { low: 6, high: 20 },
        default: { low: 3, high: 12 },
    };

    const nicheKey = Object.keys(CPM_RANGES).find(k => niche.toLowerCase().includes(k)) ?? "default";
    const cpmRange = CPM_RANGES[nicheKey];

    // YouTube pays ~55% of ad revenue to creators
    const creatorShare = 0.55;
    const monetizedViewRate = 0.45; // ~45% of views are monetized

    const monetizedViews = views * monetizedViewRate;
    const low = (monetizedViews / 1000) * cpmRange.low * creatorShare;
    const mid = (monetizedViews / 1000) * ((cpmRange.low + cpmRange.high) / 2) * creatorShare;
    const high = (monetizedViews / 1000) * cpmRange.high * creatorShare;

    const insight = `Estimated CPM: $${cpmRange.low}-$${cpmRange.high} for ${nicheKey} niche. Based on ${(monetizedViewRate * 100).toFixed(0)}% monetized views.`;

    return { low: Math.round(low), mid: Math.round(mid), high: Math.round(high), cpmRange, insight };
}

// ─── View Estimator ──────────────────────────────────────────────────────────

export function estimateVideoViews(
    velocityScore: number,
    saturationScore: number,
    competitionScore: number,
    avgChannelViews: number
): { low: number; mid: number; high: number } {
    const opportunityMultiplier = (velocityScore * 0.4 + saturationScore * 0.3 + competitionScore * 0.3) / 10;
    const base = avgChannelViews > 0 ? avgChannelViews : 10000;

    return {
        low: Math.round(base * opportunityMultiplier * 0.5),
        mid: Math.round(base * opportunityMultiplier * 1.5),
        high: Math.round(base * opportunityMultiplier * 4),
    };
}

// ─── Main Gap Builder ────────────────────────────────────────────────────────

export function buildGapCandidates(input: ScoringInput): GapCandidate[] {
    const velocity = computeVelocityScore(input.videos);
    const saturation = computeSaturationScore(input.searchResults);
    const frustration = computeFrustrationScore(input.comments);
    const abandonment = computeAbandonmentScore(input.videos);
    const engagement = computeEngagementScore(input.videos);
    const trendMomentum = computeTrendMomentum(input.videos);
    const competition = computeCompetitionScore(input.searchResults);
    const schedule = computeOptimalUploadSchedule(input.videos);

    // Confidence based on data volume — penalise thin data harder
    const videoConf = input.videos.length < 5
        ? (input.videos.length / 5) * 0.3   // heavy penalty for <5 videos
        : Math.min(input.videos.length / 30, 1) * 0.4;
    const commentConf = input.comments.length === 0
        ? 0
        : Math.min(input.comments.length / 50, 1) * 0.3;
    const searchConf = Math.min(input.searchResults.length / 15, 1) * 0.3;
    const confidence = Math.min(1, videoConf + commentConf + searchConf);

    // Dynamically boost abandonment when it fires strongly
    const isStrongAbandonment = abandonment.score >= 7;
    const compositeScore = isStrongAbandonment
        ? velocity.score * 0.20 +
          frustration.score * 0.20 +
          saturation.score * 0.18 +
          trendMomentum.score * 0.12 +
          competition.score * 0.10 +
          abandonment.score * 0.20
        : velocity.score * 0.25 +
          frustration.score * 0.20 +
          saturation.score * 0.20 +
          trendMomentum.score * 0.15 +
          competition.score * 0.10 +
          abandonment.score * 0.10;

    const roundedComposite = Math.round(compositeScore * 10) / 10;
    const keyword = input.keyword;
    const topFrustrations = frustration.topKeywords.slice(0, 8);
    const suggestedTags = generateOptimalTags(keyword, input.videos, topFrustrations);
    const avgViews = input.videos.length > 0
        ? input.videos.reduce((s, v) => s + v.views, 0) / input.videos.length
        : 10000;
    const estimatedViews = estimateVideoViews(velocity.score, saturation.score, competition.score, avgViews);

    const baseScores: ScoreBreakdown = {
        velocityScore: velocity.score,
        saturationScore: saturation.score,
        frustrationScore: frustration.score,
        abandonmentScore: abandonment.score,
        engagementScore: engagement.score,
        trendMomentum: trendMomentum.score,
        competitionScore: competition.score,
        compositeScore: roundedComposite,
        confidence,
    };

    // Tier 1C: Score-driven dynamic angle selection with per-candidate signal weighting
    // Each angle has signal bonuses so scores genuinely differ based on which signals fired
    type AngleConfig = {
        title: string;
        angle: string;
        // Per-signal weight overrides for this angle's composite calculation
        // Angles that match the dominant signal get a higher composite
        signalWeights: {
            velocity: number; frustration: number; saturation: number;
            trend: number; competition: number; abandonment: number;
        };
    };

    const ALL_ANGLES: AngleConfig[] = [];

    // Abandoned niche revival — best when supply gap is the key signal
    if (baseScores.abandonmentScore >= 6) {
        ALL_ANGLES.push({
            title: `The ${keyword} Guide Nobody Is Making in 2026 (Finally Updated)`,
            angle: "abandoned_niche_revival",
            signalWeights: { velocity: 0.15, frustration: 0.15, saturation: 0.15, trend: 0.15, competition: 0.10, abandonment: 0.30 },
        });
    }

    // Problem-solution — best when frustration is the key signal
    if (baseScores.frustrationScore >= 3) {
        ALL_ANGLES.push({
            title: `Stop Struggling With ${keyword}: The Fix That Actually Works`,
            angle: "problem_solution",
            signalWeights: { velocity: 0.15, frustration: 0.35, saturation: 0.15, trend: 0.10, competition: 0.10, abandonment: 0.15 },
        });
        ALL_ANGLES.push({
            title: `Everyone Gets ${keyword} Wrong — Here's What They Miss`,
            angle: "contrarian_correction",
            signalWeights: { velocity: 0.20, frustration: 0.25, saturation: 0.20, trend: 0.10, competition: 0.15, abandonment: 0.10 },
        });
    }

    // Trend capitalizer — best when velocity + momentum are the key signals
    if (baseScores.velocityScore >= 6 || baseScores.trendMomentum >= 6) {
        ALL_ANGLES.push({
            title: `Why Everyone Is Suddenly Talking About ${keyword} (Full Breakdown)`,
            angle: "trend_capitalizer",
            signalWeights: { velocity: 0.35, frustration: 0.10, saturation: 0.10, trend: 0.30, competition: 0.10, abandonment: 0.05 },
        });
    }

    // Accelerating trend explainer
    if (trendMomentum.trend === "accelerating") {
        ALL_ANGLES.push({
            title: `The Real Reason ${keyword} Is Exploding Right Now`,
            angle: "trend_explainer",
            signalWeights: { velocity: 0.25, frustration: 0.10, saturation: 0.15, trend: 0.35, competition: 0.10, abandonment: 0.05 },
        });
    }

    // Easy win — best when competition is low (high competition score = easy)
    if (baseScores.competitionScore >= 7) {
        ALL_ANGLES.push({
            title: `${keyword} for Complete Beginners: Zero to Confident in One Video`,
            angle: "underserved_beginner",
            signalWeights: { velocity: 0.20, frustration: 0.10, saturation: 0.10, trend: 0.10, competition: 0.40, abandonment: 0.10 },
        });
    }

    // Exhaustive test — best when market is saturated (low saturation score = hard market)
    if (baseScores.saturationScore <= 4) {
        ALL_ANGLES.push({
            title: `I Tested Every ${keyword} Method So You Don't Have To`,
            angle: "exhaustive_test",
            signalWeights: { velocity: 0.20, frustration: 0.20, saturation: 0.35, trend: 0.10, competition: 0.10, abandonment: 0.05 },
        });
    }

    // Always include comparison + mistakes + beginner fallbacks
    ALL_ANGLES.push({
        title: `${keyword} vs The Alternatives: Honest 2026 Comparison`,
        angle: "comparison",
        signalWeights: { velocity: 0.20, frustration: 0.15, saturation: 0.25, trend: 0.15, competition: 0.15, abandonment: 0.10 },
    });
    ALL_ANGLES.push({
        title: `The ${keyword} Mistakes Nobody Warns You About (With Real Data)`,
        angle: "mistakes_avoidance",
        signalWeights: { velocity: 0.20, frustration: 0.30, saturation: 0.15, trend: 0.10, competition: 0.15, abandonment: 0.10 },
    });
    ALL_ANGLES.push({
        title: `Complete ${keyword} Roadmap for Beginners (Step by Step, 2026)`,
        angle: "beginner_explainer",
        signalWeights: { velocity: 0.25, frustration: 0.15, saturation: 0.20, trend: 0.15, competition: 0.15, abandonment: 0.10 },
    });

    // Compute per-candidate composite scores using their signal weights
    // This ensures genuinely different scores based on which signal each angle amplifies
    const scoredAngles = ALL_ANGLES.map(a => {
        const w = a.signalWeights;
        const perAngleComposite =
            velocity.score       * w.velocity +
            frustration.score    * w.frustration +
            saturation.score     * w.saturation +
            trendMomentum.score  * w.trend +
            competition.score    * w.competition +
            abandonment.score    * w.abandonment;
        return { ...a, perAngleComposite: Math.round(perAngleComposite * 10) / 10 };
    });

    // Sort by per-angle composite DESC so the best matching angle is always Gap #1
    scoredAngles.sort((a, b) => b.perAngleComposite - a.perAngleComposite);

    const candidates: GapCandidate[] = scoredAngles.slice(0, 5).map(a => ({
        title: a.title,
        angle: a.angle,
        scores: {
            ...baseScores,
            compositeScore: Math.min(10, Math.max(0, a.perAngleComposite)),
        },
        topFrustrationKeywords: topFrustrations,
        velocityInsight: velocity.insight,
        saturationInsight: saturation.insight,
        trendInsight: trendMomentum.insight,
        competitionInsight: competition.insight,
        suggestedTags,
        estimatedViews,
        bestUploadDay: schedule.bestDay,
        bestUploadHour: schedule.bestHour,
    }));

    return candidates;
}

// ─── Market Intelligence Engine ──────────────────────────────────────────────

export interface MarketIntelligence {
    demandScore: number;           // 0-100: overall demand in this topic
    saturationLevel: "Low" | "Medium" | "High" | "Very High";
    growthTrajectory: "accelerating" | "stable" | "decelerating";
    difficultyRating: "Easy" | "Moderate" | "Hard" | "Very Hard";
    estimatedFirstYearViews: { low: number; mid: number; high: number };
    topCompetitorChannels: number;
    avgCompetitorViews: number;
    avgCompetitorSubs: number;
    contentGapCount: number;
    bestSubNiches: string[];
    audiencePainPoints: string[];
    trendingKeywords: string[];
    uploadFrequencyBenchmark: number; // videos per week in this niche
    revenueEstimate: { low: number; mid: number; high: number };
    velocityInsight: string;
    saturationInsight: string;
    trendInsight: string;
    competitionInsight: string;
    overallVerdict: string;
    outlierVideos: SearchResult[]; // "Virality Gaps": small channels with massive views
    optimalUploadSchedule: { bestDay: string; bestHour: number; insight: string };
}

/**
 * Comprehensive market intelligence for a topic/niche.
 * Combines all scoring algorithms to provide data-driven channel creation advice.
 */
export function computeMarketIntelligence(
    topic: string,
    videos: VideoData[],
    searchResults: SearchResult[],
    comments: CommentData[] = []
): MarketIntelligence {
    const velocity = computeVelocityScore(videos);
    const saturation = computeSaturationScore(searchResults);
    const frustration = computeFrustrationScore(comments);
    const engagement = computeEngagementScore(videos);
    const trend = computeTrendMomentum(videos);
    const competition = computeCompetitionScore(searchResults);
    const schedule = computeOptimalUploadSchedule(videos);

    // Demand = weighted combination of velocity + engagement + trend momentum
    const demandScore = Math.min(100, Math.round(
        velocity.score * 3 +      // 30% weight (how many views/day)
        engagement.score * 2 +     // 20% weight (audience engagement)
        trend.score * 2.5 +        // 25% weight (is demand growing?)
        frustration.score * 1.5 +  // 15% weight (unmet needs = demand signal)
        (10 - saturation.score) * 1 // 10% weight (inverse: less saturation = more room)
    ));

    // Content gap count estimation
    const contentGapCount = frustration.painPoints.length + 
        (saturation.score > 6 ? 3 : saturation.score > 3 ? 5 : 8);

    // Competitor metrics
    const topCompetitorChannels = new Set(searchResults.map(r => r.channel)).size;
    const avgCompetitorViews = searchResults.length > 0
        ? Math.round(searchResults.reduce((s, r) => s + r.views, 0) / searchResults.length)
        : 0;
    const avgCompetitorSubs = searchResults.length > 0
        ? Math.round(searchResults.reduce((s, r) => s + (r.subscriberCount ?? 0), 0) / searchResults.length)
        : 0;

    // Upload frequency benchmark from existing videos
    const uploadDates = videos.map(v => new Date(v.uploadDate).getTime()).filter(d => !isNaN(d));
    let uploadFrequencyBenchmark = 2; // default
    if (uploadDates.length >= 2) {
        const span = (Math.max(...uploadDates) - Math.min(...uploadDates)) / (1000 * 60 * 60 * 24);
        if (span > 0) {
            uploadFrequencyBenchmark = Math.round((videos.length / span) * 7 * 10) / 10;
        }
    }

    // Estimated first year views based on market conditions
    const baseMonthlyViews = avgCompetitorViews * 0.1; // new channel gets ~10% of avg competitor
    const growthMultiplier = trend.trend === "accelerating" ? 2.5 : trend.trend === "stable" ? 1.5 : 0.8;
    const competitionFactor = competition.score / 10; // higher = less competition = easier
    const yearlyBase = baseMonthlyViews * 12 * growthMultiplier * competitionFactor;
    const estimatedFirstYearViews = {
        low: Math.max(1000, Math.round(yearlyBase * 0.3)),
        mid: Math.max(5000, Math.round(yearlyBase)),
        high: Math.max(20000, Math.round(yearlyBase * 3)),
    };

    // Revenue estimation using the topic as niche
    const nicheRevenue = estimateRevenue(estimatedFirstYearViews.mid / 12, topic);

    // Trending keywords: extract from top-performing video titles
    const titleWordFreq = new Map<string, number>();
    for (const v of videos.filter(v => v.views > avgCompetitorViews * 0.5)) {
        const words = v.title.toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(w => w.length > 3 && !STOP_WORDS.has(w));
        for (const word of words) {
            titleWordFreq.set(word, (titleWordFreq.get(word) ?? 0) + 1);
        }
    }
    const trendingKeywords = [...titleWordFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([w]) => w);

    // Best sub-niches: combine trending keywords into 2-word phrases
    const bestSubNiches: string[] = [];
    const topicWords = topic.toLowerCase().split(/\s+/);
    for (const kw of trendingKeywords.slice(0, 5)) {
        if (!topicWords.includes(kw)) {
            bestSubNiches.push(`${topic} ${kw}`);
        }
    }
    if (bestSubNiches.length === 0) bestSubNiches.push(topic);

    // Overall verdict
    let overallVerdict: string;
    if (demandScore >= 70 && competition.score >= 6) {
        overallVerdict = `🟢 Excellent opportunity. High demand (${demandScore}/100) with manageable competition. This niche has strong growth potential for new creators.`;
    } else if (demandScore >= 50 && competition.score >= 4) {
        overallVerdict = `🟡 Good opportunity with moderate competition. Demand is solid (${demandScore}/100). Focus on underserved sub-niches to differentiate.`;
    } else if (demandScore >= 50 && competition.score < 4) {
        overallVerdict = `🟠 High demand but very competitive. You'll need strong differentiation and consistent uploads to break through.`;
    } else if (demandScore < 50 && competition.score >= 6) {
        overallVerdict = `🔵 Low competition but limited demand. Could work as a niche authority play with patience.`;
    } else {
        overallVerdict = `🔴 Challenging market. Consider pivoting to a trending sub-niche or combining with adjacent topics for better results.`;
    }

    return {
        demandScore,
        saturationLevel: saturation.competitionLevel,
        growthTrajectory: trend.trend,
        difficultyRating: competition.difficulty,
        estimatedFirstYearViews,
        topCompetitorChannels,
        avgCompetitorViews,
        avgCompetitorSubs,
        contentGapCount,
        bestSubNiches: bestSubNiches.slice(0, 5),
        audiencePainPoints: frustration.painPoints,
        trendingKeywords,
        uploadFrequencyBenchmark,
        revenueEstimate: {
            low: nicheRevenue.low * 12,
            mid: nicheRevenue.mid * 12,
            high: nicheRevenue.high * 12,
        },
        velocityInsight: velocity.insight,
        saturationInsight: saturation.insight,
        trendInsight: trend.insight,
        competitionInsight: competition.insight,
        overallVerdict,
        outlierVideos: searchResults.filter(r => 
            r.subscriberCount && r.subscriberCount < 100000 && r.views > r.subscriberCount * 5
        ).sort((a, b) => (b.views / (b.subscriberCount || 1)) - (a.views / (a.subscriberCount || 1))).slice(0, 5),
        optimalUploadSchedule: schedule,
    };
}
