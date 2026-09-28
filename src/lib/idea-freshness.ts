const YEAR_PATTERN = /\b(20\d{2})\b/g;

export type FreshnessCandidate = {
    title?: string | null;
    hook?: string | null;
};

/**
 * Current recommendations must not silently present another year as current.
 * Historical analysis belongs in evidence, not in a forward-looking idea title/hook.
 */
export function hasNonCurrentYear(
    candidate: FreshnessCandidate,
    currentYear = new Date().getUTCFullYear(),
): boolean {
    const text = `${candidate.title ?? ""}\n${candidate.hook ?? ""}`;
    const years = [...text.matchAll(YEAR_PATTERN)].map(match => Number(match[1]));
    return years.some(year => year !== currentYear);
}

