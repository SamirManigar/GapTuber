/**
 * AI Grounding Utilities
 * - buildScriptGroundingRules(): factual integrity rules injected into all LLM prompts
 * - groundWithExa(): optional neural web search to validate gap ideas against current web trends
 */

// ─── Factual Integrity Rules ──────────────────────────────────────────────────

export function buildScriptGroundingRules(now = new Date()): string {
    return `FACTUAL INTEGRITY RULES (mandatory):
- Current UTC date: ${now.toISOString()}. Treat model training knowledge as background only, never as proof that something is current.
- Never invent a person, account, follower count, product/model name, training dataset, price, free trial, sponsor, link, test result, score, view count, quote, or statistic.
- Use a factual claim only when it appears in the user's message or supplied channel/evidence context. Do not upgrade an estimate or AI score into an observed fact.
- If the video is an experiment that has not been run, write it as a shoot-ready experiment plan. Use explicit placeholders such as [INSERT VERIFIED RESULT], [CREATOR NAME], and [TOOL ACTUALLY USED] for facts that will only exist after filming.
- Never narrate a winner or outcome before real results are supplied. Provide conditional branches for each possible outcome when helpful.
- Do not call a sound, tool, feature, price, or topic "trending", "latest", "free", or "new" without dated evidence in the supplied context.
- Do not add promotional offers, downloads, affiliate links, or brand claims unless the user supplied them.
- Clearly label hypothetical examples. If evidence is missing, say what must be verified instead of filling the gap with plausible-sounding details.`;
}

// ─── Exa Neural Search Grounding ─────────────────────────────────────────────

interface ExaSearchResult {
    title?: string;
    url?: string;
    publishedDate?: string;
    text?: string;
    highlights?: string[];
}

interface ExaResponse {
    results?: ExaSearchResult[];
}

/**
 * Queries Exa's neural search API for current web mentions of a keyword.
 * Returns a formatted context string for injection into the LLM prompt.
 * Returns "" gracefully when EXA_API_KEY is not set or on any error.
 *
 * @see https://docs.exa.ai/reference/search
 */
export async function groundWithExa(keyword: string): Promise<string> {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) return "";

    try {
        const res = await fetch("https://api.exa.ai/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
            },
            body: JSON.stringify({
                query: keyword,
                numResults: 5,
                useAutoprompt: true,
                type: "neural",
                contents: {
                    text: { maxCharacters: 300 },
                    highlights: { numSentences: 2, highlightsPerUrl: 1 },
                },
                // Only return recent results (last 90 days)
                startPublishedDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            }),
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) return "";

        const data = await res.json() as ExaResponse;
        const results = data.results ?? [];
        if (results.length === 0) return "";

        const lines = results.map((r, i) => {
            const date = r.publishedDate ? ` (${r.publishedDate.split("T")[0]})` : "";
            const snippet = (r.highlights?.[0] ?? r.text ?? "").slice(0, 250).replace(/\n/g, " ");
            return `  ${i + 1}. "${r.title ?? "Untitled"}"${date} — ${snippet}`;
        });

        return `\nCURRENT WEB CONTEXT (from Exa neural search — recent web pages mentioning "${keyword}"):\n${lines.join("\n")}\nUse this as dated evidence when explaining why a gap is timely. Do not invent additional web sources beyond those listed.`;
    } catch {
        // Silently return empty — Exa is optional enrichment
        return "";
    }
}
