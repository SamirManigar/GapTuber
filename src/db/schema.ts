import { pgTable, uuid, text, timestamp, jsonb, index, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").unique().notNull(),
    name: text("name"),
    image: text("image"),
    credits: integer("credits").default(20).notNull(),
    tier: text("tier").default("free").notNull(),
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

export interface VideoIdeaDB {
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
}

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Scan = typeof scans.$inferSelect;
export type NewScan = typeof scans.$inferInsert;

export interface ScanResult {
    gaps: GapItem[];
    overallOpportunity?: string;
    recommendedNiche?: string;
}

export interface GapItem {
    title: string;
    gapScore: number;
    reasoning: string;
    hook: string;
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
}

// ─── AuraBot Schema ──────────────────────────────────────────────────────────

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
    
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    index("vault_channel_idx").on(table.channelId),
    index("vault_status_idx").on(table.status),
    index("vault_source_idx").on(table.source)
]);

export type IdeaVault = typeof ideaVault.$inferSelect;
export type NewIdeaVault = typeof ideaVault.$inferInsert;
