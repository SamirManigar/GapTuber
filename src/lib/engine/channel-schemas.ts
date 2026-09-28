import { z } from "zod";

// ─── Keyword Opportunity ──────────────────────────────────────────────────────

export const KeywordOpportunitySchema = z.object({
    keyword: z.string().min(2).max(100),
    // seoScore, growthScore, gapScore, uniquenessScore are all computed
    // deterministically by the engine AFTER the AI responds — not from AI output.
    seoScore: z.number().min(0).max(100).optional().default(0),
    growthScore: z.number().min(0).max(100).optional().default(0),
    gapScore: z.number().min(0).max(100).optional().default(0),
    uniquenessScore: z.number().min(0).max(100).optional().default(0),
    competition: z.enum(["Low", "Medium", "High"]).optional().default("Medium"),
    reasoning: z.string().min(5).optional().default("Opportunity identified."),
    hook: z.string().min(5).optional().default("Create engaging content around this topic."),
    estimatedMonthlySearches: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val).optional(),
    difficulty: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val).optional(),
});

export type KeywordOpportunity = z.infer<typeof KeywordOpportunitySchema>;

// ─── Competitor ───────────────────────────────────────────────────────────────

export const CompetitorSchema = z.object({
    handle: z.string().min(2).transform((h) => h.startsWith("@") ? h : `@${h}`),
    name: z.string().min(1),
    reason: z.string().min(5),
    topicOverlap: z.number().min(0).max(100).optional().default(50),
    strengths: z.string().optional(),
    weaknesses: z.string().optional(),
});

export type Competitor = z.infer<typeof CompetitorSchema>;

// ─── Content Opportunity Gap Index ───────────────────────────────────────────

export const ContentClusterSchema = z.object({
    clusterName: z.string().min(2),
    channelPresence: z.number().min(0).max(100).optional().default(0),
    trendingAcceleration: z.number().min(0).max(100).optional().default(0),
    opportunityIndex: z.number().min(0).max(100).optional().default(0),
    insight: z.string().min(5).optional().default("Emerging opportunity in this cluster."),
    suggestedVideoIdeas: z.array(z.string()).max(3).optional(),
});

export type ContentCluster = z.infer<typeof ContentClusterSchema>;

// ─── Full Channel Analysis ────────────────────────────────────────────────────

export const ChannelAnalysisSchema = z.object({
    niche: z.string().min(2),
    summary: z.string().min(10),
    keywords: z.array(KeywordOpportunitySchema).min(1).max(10),
    competitors: z.array(CompetitorSchema).min(0).max(8),
    topPatterns: z.array(z.string()).min(0).max(6),
    contentOpportunityGaps: z.array(ContentClusterSchema).min(0).max(5),
    growthActions: z.array(z.string()).min(0).max(5).optional(),
});

export type ChannelAnalysis = z.infer<typeof ChannelAnalysisSchema>;
