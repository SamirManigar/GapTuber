import { z } from "zod";

// Input validation schema for the /api/analyze route
export const AnalyzeRequestSchema = z.object({
    keyword: z.string().min(2).max(100).trim(),
    competitors: z.array(z.string().url()).min(1).max(3),
    videos: z.array(
        z.object({
            title: z.string(),
            views: z.number().nonnegative(),
            likes: z.number().nonnegative().default(0),
            comments: z.number().nonnegative().default(0),
            uploadDate: z.string(),
            url: z.string(),
            channel: z.string(),
            duration: z.string().optional(),
            tags: z.array(z.string()).optional(),
            description: z.string().optional(),
        })
    ).max(100).optional(),
    comments: z.array(
        z.object({
            text: z.string().max(500),
            videoUrl: z.string().optional(),
            likeCount: z.number().optional(),
            authorName: z.string().optional(),
        })
    ).max(200).optional(),
    searchResults: z.array(
        z.object({
            title: z.string(),
            channel: z.string(),
            views: z.number().nonnegative(),
            likes: z.number().nonnegative().default(0),
            uploadDate: z.string(),
            subscriberCount: z.number().optional(),
        })
    ).max(30).optional(),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// Enhanced AI output schema
export const GapItemSchema = z.object({
    title: z.string().min(5).max(300),
    gapScore: z.number().min(0).max(10),
    reasoning: z.string().min(10).max(1500),
    hook: z.string().min(5).max(500),
    suggestedTitle: z.string().min(5).max(200).optional(),
    format: z.string().min(3).max(300),
    monetizationAngle: z.string().min(5).max(500),
    targetAudience: z.string().min(5).max(300).optional(),
});

export const GapOutputSchema = z.object({
    gaps: z.array(GapItemSchema).min(1).max(3),
    overallOpportunity: z.string().max(500).optional(),
    recommendedNiche: z.string().max(200).optional(),
});

export type GapItem = z.infer<typeof GapItemSchema>;
export type GapOutput = z.infer<typeof GapOutputSchema>;
