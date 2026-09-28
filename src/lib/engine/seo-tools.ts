import { generateOptimalTags, type SearchResult, type VideoData } from "./scoring";

export interface SeoAuditInput {
    title: string;
    keyword: string;
    description?: string;
    tags?: string[];
}

const STOP_WORDS = new Set([
    "the", "a", "an", "and", "or", "to", "for", "of", "in", "on", "with",
    "is", "are", "how", "what", "why", "your", "you", "this", "that",
]);

function normalize(value: string): string {
    return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function tokens(value: string): string[] {
    return normalize(value)
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

function clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(values: string[]): string[] {
    return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

export function auditVideoSeo(input: SeoAuditInput) {
    const title = input.title.replace(/\s+/g, " ").trim();
    const keyword = input.keyword.replace(/\s+/g, " ").trim();
    const description = (input.description ?? "").trim();
    const tags = unique(input.tags ?? []).slice(0, 30);
    const normalizedTitle = normalize(title);
    const normalizedKeyword = normalize(keyword);
    const normalizedDescription = normalize(description);
    const keywordTokens = tokens(keyword);

    const exactTitlePosition = normalizedTitle.indexOf(normalizedKeyword);
    const titleTokenCoverage = keywordTokens.length
        ? keywordTokens.filter(token => normalizedTitle.includes(token)).length / keywordTokens.length
        : 0;
    const titleLengthScore = title.length >= 35 && title.length <= 65
        ? 25
        : title.length >= 20 && title.length <= 75
            ? 15
            : 5;
    const titleScore = clampScore(
        (exactTitlePosition === 0 ? 45 : exactTitlePosition > 0 ? 35 : titleTokenCoverage * 30) +
        titleLengthScore +
        (title.split(/\s+/).length >= 4 ? 20 : 8) +
        (/\d/.test(title) ? 10 : 5)
    );

    const descriptionOccurrences = normalizedKeyword
        ? normalizedDescription.split(normalizedKeyword).length - 1
        : 0;
    const descriptionScore = description
        ? clampScore(
            (normalizedDescription.slice(0, 160).includes(normalizedKeyword) ? 35 : normalizedDescription.includes(normalizedKeyword) ? 22 : 0) +
            (descriptionOccurrences >= 1 && descriptionOccurrences <= 4 ? 20 : descriptionOccurrences > 4 ? 10 : 0) +
            (description.length >= 200 ? 25 : description.length >= 80 ? 15 : 5) +
            (/https?:\/\//i.test(description) ? 10 : 0) +
            (/\b(?:subscribe|comment|watch|learn|download|try)\b/i.test(description) ? 10 : 0)
        )
        : 0;

    const normalizedTags = tags.map(normalize);
    const exactTag = normalizedTags.includes(normalizedKeyword);
    const tagTokenCoverage = keywordTokens.length && normalizedTags.length
        ? normalizedTags.reduce((sum, tag) => sum + keywordTokens.filter(token => tag.includes(token)).length / keywordTokens.length, 0) / normalizedTags.length
        : 0;
    const tagScore = tags.length
        ? clampScore(
            (exactTag ? 35 : 0) +
            (tags.length >= 5 && tags.length <= 15 ? 30 : tags.length < 5 ? tags.length * 5 : 20) +
            tagTokenCoverage * 25 +
            (new Set(normalizedTags).size === normalizedTags.length ? 10 : 0)
        )
        : 0;

    const overall = clampScore(titleScore * 0.5 + descriptionScore * 0.3 + tagScore * 0.2);
    const issues: Array<{ type: string; message: string }> = [];
    const suggestions: Array<{ type: string; message: string }> = [];

    if (exactTitlePosition < 0) issues.push({ type: "title", message: "The exact primary keyword is missing from the title." });
    if (title.length < 35 || title.length > 65) suggestions.push({ type: "title", message: "Aim for a clear title around 35–65 characters so the main idea survives truncation." });
    if (!description) issues.push({ type: "description", message: "The description is empty." });
    else if (!normalizedDescription.slice(0, 160).includes(normalizedKeyword)) suggestions.push({ type: "description", message: "Use the primary keyword naturally in the opening 160 characters." });
    if (!tags.length) issues.push({ type: "tags", message: "No tags were supplied." });
    else if (!exactTag) suggestions.push({ type: "tags", message: "Add the exact primary keyword as a tag." });
    if (descriptionOccurrences > 4) issues.push({ type: "description", message: "The primary keyword appears too often; rewrite for people instead of repeating it." });

    const improvedTitle = normalize(title).includes(normalizedKeyword)
        ? title.slice(0, 70)
        : `${keyword}: ${title}`.slice(0, 70).replace(/[\s:–—-]+$/, "");
    const improvedDescription = description
        ? `${keyword} — ${description}`.slice(0, 320)
        : `Learn ${keyword} with a practical, step-by-step walkthrough. You will see the process, common mistakes, and the next action to take.`;
    const additionalTags = unique([
        keyword,
        `${keyword} tutorial`,
        `${keyword} guide`,
        `${keyword} for beginners`,
        `how to ${keyword}`,
        ...keywordTokens.map(token => `${keyword} ${token}`),
    ]).filter(tag => !normalizedTags.includes(normalize(tag))).slice(0, 10);

    return {
        success: true,
        keyword,
        scores: { overall, title: titleScore, description: descriptionScore, tags: tagScore },
        issues,
        suggestions,
        improvements: { improvedTitle, improvedDescription, additionalTags },
        tagCount: tags.length,
        methodology: "Deterministic metadata audit. Scores describe on-page coverage and structure, not YouTube ranking probability.",
    };
}

export function buildTagSuggestions(keyword: string, niche: string | undefined, searchResults: SearchResult[]) {
    const videos: VideoData[] = searchResults.map(result => ({
        title: result.title,
        views: result.views,
        likes: result.likes,
        comments: 0,
        uploadDate: result.uploadDate,
        url: result.videoId ? `https://www.youtube.com/watch?v=${result.videoId}` : "",
        channel: result.channel,
        subscriberCount: result.subscriberCount,
    }));
    const commonTerms = tokens(searchResults.map(result => result.title).join(" "))
        .reduce<Map<string, number>>((counts, token) => counts.set(token, (counts.get(token) ?? 0) + 1), new Map());
    const topTerms = [...commonTerms.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([term]) => term);

    const generated = generateOptimalTags(keyword, videos, topTerms);
    const allTags = unique([
        keyword,
        ...(niche ? [`${keyword} ${niche}`, niche] : []),
        ...generated,
    ]).slice(0, 25);
    const keywordTokens = tokens(keyword);
    const scoredTags = allTags.map(tag => {
        const normalizedTag = normalize(tag);
        const tokenCoverage = keywordTokens.length
            ? keywordTokens.filter(token => normalizedTag.includes(token)).length / keywordTokens.length
            : 0;
        const matchingResults = searchResults.filter(result => normalize(result.title).includes(normalizedTag)).length;
        return {
            tag,
            relevance: clampScore(55 * tokenCoverage + 45 * (matchingResults / Math.max(searchResults.length, 1))),
        };
    }).sort((a, b) => b.relevance - a.relevance);
    const tags = scoredTags.map(item => item.tag);

    return {
        success: true,
        keyword,
        tags,
        scoredTags,
        categories: {
            primary: tags.filter(tag => normalize(tag) === normalize(keyword) || normalize(tag).startsWith(`${normalize(keyword)} `)).slice(0, 8),
            intent: tags.filter(tag => /\b(?:how to|tutorial|guide|beginners|learn)\b/i.test(tag)),
            related: tags.filter(tag => !normalize(tag).startsWith(normalize(keyword))).slice(0, 8),
        },
        totalCount: tags.length,
        recommendation: searchResults.length
            ? `Suggestions use language found across ${searchResults.length} current YouTube search results. They are metadata ideas, not search-volume estimates.`
            : "Suggestions are structural keyword variations because current YouTube search evidence was unavailable.",
        evidence: { sampleSize: searchResults.length, collectedAt: new Date().toISOString() },
    };
}
