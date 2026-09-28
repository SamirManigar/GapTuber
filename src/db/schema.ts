import { pgTable, uuid, text, timestamp, jsonb, index, integer, real, uniqueIndex, unique, bigint, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").unique().notNull(),
    name: text("name"),
    image: text("image"),
    credits: integer("credits").default(20).notNull(),
    tier: text("tier").default("free").notNull(),
    lsCustomerId: text("ls_customer_id"),
    lsSubscriptionId: text("ls_subscription_id"),
    lsOrderId: text("ls_order_id"),
    razorpayCustomerId: text("razorpay_customer_id"),
    razorpaySubscriptionId: text("razorpay_subscription_id"),
    razorpayOrderId: text("razorpay_order_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const creditHistory = pgTable("credit_history", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    action: text("action").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const channels = pgTable("channels", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").$type<"new_tuber" | "existing_tuber">().notNull(),
    category: text("category"),
    topic: text("topic"),
    brandingData: jsonb("branding_data"),
    youtubeChannelId: text("youtube_channel_id"),
    youtubeAccessToken: text("youtube_access_token"),
    youtubeRefreshToken: text("youtube_refresh_token"),
    youtubeTokenExpiresAt: timestamp("youtube_token_expires_at"),
    contentStrategy: text("content_strategy"),
    marketSnapshot: jsonb("market_snapshot").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    index("channel_user_idx").on(table.userId)
]);

export const scans = pgTable("scans", {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
        .notNull()
        .references(() => channels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    competitors: jsonb("competitors").notNull().$type<string[]>(),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>(),
    result: jsonb("result").$type<ScanResult>(),
    analytics: jsonb("analytics").$type<ScanAnalytics>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    index("scan_channel_idx").on(table.channelId),
    index("scan_user_idx").on(table.userId)
]);

export const outlierDetections = pgTable("outlier_detections", {
    id: uuid("id").primaryKey().defaultRandom(),
    searchRunId: uuid("search_run_id").references(() => scans.id),
    videoId: varchar("video_id", { length: 255 }).notNull(),
    keyword: varchar("keyword", { length: 255 }).notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
    relevanceScore: real("relevance_score").notNull(),
    pacePercentile: real("pace_percentile").notNull(),
    channelLift: real("channel_lift").notNull(),
    classification: varchar("classification", { length: 50 }).notNull(),
    engineVersion: varchar("engine_version", { length: 50 }).notNull(),
}, (table) => [
    index("detection_video_idx").on(table.videoId),
    index("detection_search_idx").on(table.searchRunId)
]);

export const trackedVideos = pgTable("tracked_videos", {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: varchar("video_id", { length: 255 }).notNull().unique(),
    firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }).notNull(),
    trackingStartedAt: timestamp("tracking_started_at", { withTimezone: true }).notNull(),
    trackingExpiresAt: timestamp("tracking_expires_at", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    priority: varchar("priority", { length: 50 }).notNull(),
    lastSnapshotAt: timestamp("last_snapshot_at", { withTimezone: true }),
    nextSnapshotAt: timestamp("next_snapshot_at", { withTimezone: true }),
    detectionReason: varchar("detection_reason", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const videoMetricSnapshots = pgTable("video_metric_snapshots", {
    id: uuid("id").primaryKey().defaultRandom(),
    trackingId: uuid("tracking_id").notNull().references(() => trackedVideos.id),
    videoId: varchar("video_id", { length: 255 }).notNull(),
    targetOffsetHours: real("target_offset_hours").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    views: bigint("views", { mode: "number" }).notNull(),
    likes: bigint("likes", { mode: "number" }),
    comments: bigint("comments", { mode: "number" }),
    captureTrigger: varchar("capture_trigger", { length: 50 }),
    collectorVersion: varchar("collector_version", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    unique("snapshot_tracking_offset_idx").on(table.trackingId, table.targetOffsetHours),
    index("snapshot_video_idx").on(table.videoId),
    index("snapshot_time_idx").on(table.capturedAt)
]);

export interface VideoIdeaDB {
    id?: string;
    title: string;
    hook: string;
    format: string;
    whyItWorks: string;
    estimatedViewPotential: "high" | "medium" | "low";
    targetAudience: string;
    script?: string;
    description?: string;
    tags?: string[];
    signalSource?: string;
    status?: string;
    youtubeVideoId?: string | null;
    outcomeMultipliers?: {
        day1?: number;
        day7?: number;
        day30?: number;
    } | null;
    recommendedAt?: string;
    confidenceAtRecommendation?: number | null;
    recommendationSignals?: Record<string, unknown> | null;
    opportunityScoreAtRecommendation?: number | null;
}

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Scan = typeof scans.$inferSelect;
export type NewScan = typeof scans.$inferInsert;
export type TrackedVideo = typeof trackedVideos.$inferSelect;
export type NewTrackedVideo = typeof trackedVideos.$inferInsert;
export type VideoMetricSnapshot = typeof videoMetricSnapshots.$inferSelect;
export type NewVideoMetricSnapshot = typeof videoMetricSnapshots.$inferInsert;
export type OutlierDetection = typeof outlierDetections.$inferSelect;
export type NewOutlierDetection = typeof outlierDetections.$inferInsert;

export interface ScanResult {
    gaps: GapItem[];
    overallOpportunity?: string;
    recommendedNiche?: string;
}

export interface GapItem {
    id?: string;
    scanId?: string;
    title: string;
    gapScore: number;
    confidence?: number;
    reasoning: string;
    classification?: "BREAKOUT" | "EMERGING" | "EVERGREEN" | "WATCH";
    scoringVersion?: string;
    scoreReasons?: string[];
    evidenceOutliers?: { channelName: string; normalMedian: number; candidateViews: number; lift: number; ageHours: number; }[];
    whyNow?: string;
    quantitativeReasons?: { type: string; label: string; value: string; source?: string }[];
    evidenceComments?: { commentId: string; text?: string; likes?: number }[];
    hook: string;
    suggestedTitle?: string;
    psychologicalTrigger?: string;
    titleVariants?: string[];
    format: string;
    monetizationAngle: string;
    targetAudience?: string;
    contentOutline?: string[];
    seoTips?: string[];
    competitorWeakness?: string;
}

export interface ScanAnalytics {
    velocity: { score: number; insight: string; weeklyGrowthRate: number };
    saturation: { score: number; insight: string; competitionLevel: string };
    frustration: { score: number; topKeywords: string[]; painPoints: string[] };
    engagement: { score: number; avgLikeRate: number; avgCommentRate: number };
    trend: { score: number; trend: string; insight: string };
    competition: { score: number; difficulty: string; insight: string };
    uploadSchedule: { bestDay: string; bestHour: number; insight: string };
    revenueEstimate: { low: number; mid: number; high: number };
    suggestedTags: string[];
    provenance?: {
        source: "YouTube Data API v3" | "YouTube Data API v3 + extension-collected public page data";
        generatedAt: string;
        cacheMaxAgeMinutes: number;
        scoringVersion: string;
        dataConfidence: number;
        sample: {
            competitorsRequested: number;
            competitorsResolved: number;
            videos: number;
            comments: number;
            searchResults: number;
        };
        aiRole: string;
        limitations: string[];
    };
}

// ─── AuraBot Schema ──────────────────────────────────────────────────────────

// Foundation for true velocity acceleration tracking (v2.1)
export const metricSnapshots = pgTable("metric_snapshots", {
    id: text("id").primaryKey(),
    videoId: text("video_id").notNull(),
    views: integer("views").notNull(),
    likes: integer("likes").notNull(),
    comments: integer("comments").notNull(),
    capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

export const botChats = pgTable("bot_chats", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
        .references(() => channels.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New Chat"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    index("bot_chat_user_idx").on(table.userId),
    index("bot_chat_channel_idx").on(table.channelId)
]);

export const botMessages = pgTable("bot_messages", {
    id: uuid("id").defaultRandom().primaryKey(),
    chatId: uuid("chat_id")
        .notNull()
        .references(() => botChats.id, { onDelete: "cascade" }),
    sender: text("sender").$type<"user" | "ai">().notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    index("bot_msg_chat_idx").on(table.chatId)
]);

export type BotChat = typeof botChats.$inferSelect;
export type NewBotChat = typeof botChats.$inferInsert;
export type BotMessage = typeof botMessages.$inferSelect;
export type NewBotMessage = typeof botMessages.$inferInsert;

// ─── Competitor Watchtower Schema ─────────────────────────────────────────────
export const competitorMonitors = pgTable("competitor_monitors", {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
        .notNull()
        .references(() => channels.id, { onDelete: "cascade" }),
    competitorChannelId: text("competitor_channel_id").notNull(),
    competitorName: text("competitor_name").notNull(),
    competitorHandle: text("competitor_handle").notNull(),
    competitorImage: text("competitor_image"),
    lastScannedAt: timestamp("last_scanned_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    index("comp_monitor_channel_idx").on(table.channelId)
]);

export const competitorInsights = pgTable("competitor_insights", {
    id: uuid("id").defaultRandom().primaryKey(),
    monitorId: uuid("monitor_id")
        .notNull()
        .references(() => competitorMonitors.id, { onDelete: "cascade" }),
    videoId: text("video_id").notNull(),
    title: text("title").notNull(),
    thumbnail: text("thumbnail"),
    views: text("views").notNull(),
    publishedAt: timestamp("published_at").notNull(),
    analysis: jsonb("analysis").$type<{
        whyItWorked: string;
        theGap: string;
        suggestedHook: string;
        viralityScore: number;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    index("comp_insight_monitor_idx").on(table.monitorId)
]);

export type CompetitorMonitor = typeof competitorMonitors.$inferSelect;
export type NewCompetitorMonitor = typeof competitorMonitors.$inferInsert;
export type CompetitorInsight = typeof competitorInsights.$inferSelect;
export type NewCompetitorInsight = typeof competitorInsights.$inferInsert;

// ─── Idea Vault Schema ────────────────────────────────────────────────────────
export const ideaVault = pgTable("idea_vault", {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
        .notNull()
        .references(() => channels.id, { onDelete: "cascade" }),
    
    // Core Idea Data
    title: text("title").notNull(),
    hook: text("hook"),
    format: text("format"),
    targetAudience: text("target_audience"),
    
    // Status & Tracking
    status: text("status").$type<"backlog" | "scripting" | "filming" | "production" | "launched">().default("backlog").notNull(),
    estimatedViewPotential: text("estimated_view_potential").$type<"high" | "medium" | "low">(),
    
    // Origin Tracking
    source: text("source").$type<"extension" | "gapscan" | "watchtower" | "ai_studio" | "manual" | "system" | "comment_mining">().notNull(),
    referenceId: text("reference_id"),
    
    // Dynamic/Rich Content
    whyItWorks: text("why_it_works"),
    script: text("script"),
    description: text("description"),
    tags: jsonb("tags").$type<string[]>(),

    // ─── Frozen Recommendation Snapshot ───
    opportunityScoreAtRecommendation: real("opportunity_score_at_recommendation"),
    confidenceAtRecommendation: real("confidence_at_recommendation"),
    recommendationSignals: jsonb("recommendation_signals").$type<Record<string, unknown>>(),
    recommendedAt: timestamp("recommended_at"),
    scoringVersion: text("scoring_version"),

    // Linked YouTube Data (Outcome Tracking)
    youtubeVideoId: text("youtube_video_id"), // Linked when creator publishes
    publishedAt: timestamp("published_at"),
    outcomeMultipliers: jsonb("outcome_multipliers").$type<{
        day1?: number;
        day7?: number;
        day30?: number;
    }>(),
    
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    index("vault_channel_idx").on(table.channelId),
    index("vault_status_idx").on(table.status),
    index("vault_source_idx").on(table.source),
    index("vault_yt_id_idx").on(table.youtubeVideoId)
]);

export type IdeaVault = typeof ideaVault.$inferSelect;
export type NewIdeaVault = typeof ideaVault.$inferInsert;

// ─── Outcome Tracking & Analytics Schema ──────────────────────────────────────

export const baselinePerformance = pgTable("baseline_performance", {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
    vaultIdeaId: uuid("vault_idea_id").references(() => ideaVault.id, { onDelete: "cascade" }),
    targetVideoId: text("target_video_id"),
    computedAt: timestamp("computed_at").defaultNow().notNull(),

    // Baseline metrics derived from up to 15 prior comparable videos
    day1MedianViews: integer("day1_median_views"),
    day7MedianViews: integer("day7_median_views"),
    day30MedianViews: integer("day30_median_views"),

    sampleSize: integer("sample_size").notNull(),
    baselineVideoIds: jsonb("baseline_video_ids").$type<string[]>(), // The exact 15 videos used
    confidence: text("confidence").$type<"high" | "low">().notNull() // low if < 5 videos
}, (table) => [
    index("baseline_channel_idx").on(table.channelId),
    uniqueIndex("unique_baseline_vault_target").on(table.vaultIdeaId, table.targetVideoId)
]);

export const videoPerformanceSnapshots = pgTable("video_performance_snapshots", {
    id: uuid("id").defaultRandom().primaryKey(),
    vaultIdeaId: uuid("vault_idea_id").notNull().references(() => ideaVault.id, { onDelete: "cascade" }),
    youtubeVideoId: text("youtube_video_id").notNull(), // Denormalized for easier querying

    snapshotType: text("snapshot_type").$type<"day1" | "day7" | "day30">().notNull(),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
    actualViews: integer("actual_views").notNull(),
    baselineViewsAtTime: integer("baseline_views_at_time"), // Frozen snapshot of what baseline was
    performanceMultiplier: real("performance_multiplier"), // actual / baseline
}, (table) => [
    index("snapshot_vault_idx").on(table.vaultIdeaId),
    index("snapshot_yt_id_idx").on(table.youtubeVideoId),
    uniqueIndex("unique_video_snapshot_idx").on(table.youtubeVideoId, table.snapshotType)
]);

export type BaselinePerformance = typeof baselinePerformance.$inferSelect;
export type VideoPerformanceSnapshot = typeof videoPerformanceSnapshots.$inferSelect;
