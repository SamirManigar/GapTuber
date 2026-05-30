import type { GapCandidate } from "./scoring";

// Rotate format examples so the AI never anchors to one template
const FORMAT_POOL = [
    'EXPERIMENT: "I [Did X] For [N] Days \u2014 Here\'s What Nobody Expected" (honest, raw, no predicted outcome in title)',
    'EXPOSE/TRUTH: "The [Industry] Secret Nobody Is Talking About" or "Why [Common Belief] Is Dead Wrong"',
    'BREAKDOWN/AUTOPSY: "Why [Famous Creator/Strategy] Actually [Succeeded/Failed] (Real Numbers)"',
    'CONTRARIAN: "Everyone Does [X] \u2014 I Did The Opposite For [Duration] (Results Inside)"',
    'WARNING/MISTAKE: "Stop [Common Mistake] Before It Destroys Your [Outcome]"',
    'CHALLENGE: "[Starting Point] To [Dramatic Result] In [Specific Timeframe] (No Shortcuts)"',
    'INVESTIGATION: "I Spent [Duration] Researching [Topic] \u2014 The Truth Is Surprising"',
    'COMPARISON: "[Method A] vs [Method B]: I Tested Both For [Duration] (Data-Backed)"',
];

// Rotate opening hooks so every run uses a different starter
const HOOK_POOL = [
    '"I Tested"', '"Stop"', '"The Brutal Truth About"', '"Nobody Tells You"',
    '"Why I Quit"', '"The Real Reason"', '"I Spent"', '"Unpopular Opinion:"',
    '"Most Creators Get"', '"This Changed Everything About"',
];

// Rotate monetization angles so we never get stuck on "SaaS tools affiliate"
const MONETIZATION_POOL = [
    "course upsell", "SaaS tools affiliate", "productized service offer",
    "brand sponsorship (relevant tools)", "community/membership pitch",
    "digital product / template sale", "consulting CTA", "merch / creator economy",
    "YouTube Premium revenue", "newsletter subscriber CTA",
];

function pickN<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}

/**
 * Builds a powerful, dynamic prompt for YouTube content gap analysis.
 *
 * @param keyword          - The focus keyword
 * @param candidates       - Scored gap candidates from scoring engine
 * @param competitorTitles - Actual existing titles in this niche
 * @param verbatimPainPoints - Literal high-liked audience questions
 */
export function buildAnalysisPrompt(
  keyword: string,
  candidates: GapCandidate[],
  competitorTitles: string[] = [],
  verbatimPainPoints: string[] = []
): string {
  // Pick 3 different formats and 3 different hooks for this run — forces variety
  const sessionFormats = pickN(FORMAT_POOL, 3);
  const sessionHooks = pickN(HOOK_POOL, 4);
  const sessionMonetization = pickN(MONETIZATION_POOL, 3);

  // Pick a random specific number (NOT 7, NOT 14 to avoid template lock)
  const specificNumbers = ["11", "21", "30", "48 hours", "3 weeks", "6 months", "$237", "91%", "2 years", "18 months", "$0", "63%"];
  const exampleNumber = specificNumbers[Math.floor(Math.random() * specificNumbers.length)];

  const candidatesSummary = candidates
    .map(
      (c, i) =>
        `${i + 1}. Angle: "${c.angle}"
   Composite Score: ${c.scores.compositeScore}/10 (confidence: ${(c.scores.confidence * 100).toFixed(0)}%)
   Velocity: ${c.scores.velocityScore.toFixed(1)}/10 \u2014 ${c.velocityInsight}
   Saturation: ${c.scores.saturationScore.toFixed(1)}/10 \u2014 ${c.saturationInsight}
   Frustration Signals: ${c.scores.frustrationScore.toFixed(1)}/10
   Abandonment: ${c.scores.abandonmentScore.toFixed(1)}/10
   Trend Momentum: ${c.scores.trendMomentum.toFixed(1)}/10 \u2014 ${c.trendInsight}
   Competition Difficulty: ${c.scores.competitionScore.toFixed(1)}/10 \u2014 ${c.competitionInsight}
   Top Audience Pain Keywords: ${c.topFrustrationKeywords.slice(0, 6).join(", ")}
   Estimated Views Range: ${c.estimatedViews.low.toLocaleString()}\u2013${c.estimatedViews.high.toLocaleString()}
   Best Upload Window: ${c.bestUploadDay} at ${c.bestUploadHour}:00 UTC`
    )
    .join("\n\n");

  const competitorBlock = competitorTitles.length > 0
    ? `\n\u2501\u2501\u2501 EXISTING COMPETITOR CONTENT (You MUST differentiate from ALL of these \u2014 different angle, different hook, different format) \u2501\u2501\u2501\n${competitorTitles.slice(0, 12).map((t, i) => `  ${i + 1}. "${t}"`).join("\n")}\n`
    : "";

  const painPointsBlock = verbatimPainPoints.length > 0
    ? `\n\u2501\u2501\u2501 REAL AUDIENCE FRUSTRATIONS (High-liked comments \u2014 address these directly) \u2501\u2501\u2501\n${verbatimPainPoints.slice(0, 5).map((p, i) => `  ${i + 1}. "${p}"`).join("\n")}\n`
    : "";

  return `You are an elite YouTube strategist who has grown 50+ channels past 100K subscribers. You think like a viewer first, an algorithm second.

\u2501\u2501\u2501 YOUR MISSION \u2501\u2501\u2501
Keyword under analysis: "${keyword}"
Analyze the ${candidates.length} data-backed gap candidates below. Select and develop the TOP 3 highest-opportunity video concepts. These must be immediately filmable, highly differentiated, and completely different from each other.

\u2501\u2501\u2501 GAP CANDIDATE DATA \u2501\u2501\u2501
${candidatesSummary}
${competitorBlock}${painPointsBlock}
\u2501\u2501\u2501━━━ MANDATORY CREATIVE RULES ━━━

RULE 0 — KEYWORD ANCHORING (MOST IMPORTANT RULE — CHECKED SERVER-SIDE):
  EVERY gap title MUST contain at least 2 consecutive words from the target keyword phrase.
  The keyword is: "${keyword}"
  Required words (use at least 2 consecutive ones): ${keyword.split(" ").filter((w: string) => w.length > 2).join(", ")}
  ❌ INVALID: "I Tested AI Web Dev" — too short (19 chars), fails length requirement
  ❌ INVALID: "The Brutal Truth About AI" — only 1 keyword word, "web development" missing
  ❌ INVALID: "Stop Doing AI This Way" — missing "web development" or "AI development"
  ✅ VALID: "I Tested AI Tools in Web Development — Shocking Results"
  ✅ VALID: "The Brutal Truth About AI in Web Development 2026"
  ✅ VALID: "Stop Using AI for Web Dev Until You Watch This"
  TITLE LENGTH: MUST be between 38 and 70 characters. Shorter = automatic fail.

RULE 1 — YOU MUST USE EXACTLY THESE 3 FORMATS (one per gap, in this order):
  Gap 1 MUST use: ${sessionFormats[0]}
  Gap 2 MUST use: ${sessionFormats[1]}
  Gap 3 MUST use: ${sessionFormats[2]}

  CRITICAL: Do NOT use "experiment vlog" unless it appears in the format assigned above.
  CRITICAL: Do NOT use "18-min" as the video length \u2014 pick a length that matches the actual content depth.

RULE 2 — NUMBERS MUST BE CONTEXTUALLY SPECIFIC:
  ABSOLUTELY BANNED \u2192 7, 10, 14 (overused templates the algorithm has seen a million times)
  THIS SESSION EXAMPLE NUMBER \u2192 ${exampleNumber} (use numbers like this: specific, surprising, believable)
  Each gap must use a DIFFERENT number if numbers appear.

RULE 3 — OPENING HOOK WORDS (use one per gap, all different, rotate from this session list):
  ${sessionHooks.join(" / ")}
  Each gap MUST start with a DIFFERENT hook word.

RULE 4 — TITLE LENGTH & STRUCTURE:
  \u2192 45\u201368 characters ONLY (counts including spaces)
  \u2192 Format: [HOOK] + [SPECIFIC ANGLE around "${keyword.split(" ").slice(0, 3).join(" ")}"] + [IMPLIED PAYOFF]
  \u2192 NEVER start with "How to", "Top", "Best", or a generic number

RULE 5 — TOTAL ORIGINALITY:
  \u2192 Each gap title MUST be completely different in angle, format AND hook from:
     a) Every competitor title listed above
     b) Each other (no shared patterns)
  \u2192 If you produce two gaps that feel similar, you have FAILED this rule.

RULE 6 — MONETIZATION ROTATION:
  Gap 1 monetization: ${sessionMonetization[0]}
  Gap 2 monetization: ${sessionMonetization[1]}
  Gap 3 monetization: ${sessionMonetization[2]}

\u2501\u2501\u2501 QUALITY BAR \u2014 EXAMPLES \u2501\u2501\u2501
\u2705 STRONG: "I Quit ${keyword} For ${exampleNumber}. Nobody Expected This"
\u2705 STRONG: "The Real Reason Your ${keyword} Results Are Plateauing"  
\u2705 STRONG: "Unpopular Opinion: Stop Doing ${keyword} This Way"
\u274c WEAK: "7 ${keyword} Tools You Need In 2026"
\u274c WEAK: "${keyword} for Beginners (Complete Guide)"
\u274c WEAK: "I Tested ${keyword} for 14 Days" (overused template \u2014 banned this session)

\u2501\u2501\u2501 OUTPUT FIELD REQUIREMENTS \u2501\u2501\u2501
- title: The primary video title (follow all 6 rules above)
- gapScore: Use the composite score from candidate data (do not artificially inflate above 9.5)
- reasoning: 1 punchy sentence explaining WHY this specific gap exists in this niche right now. Cite the most relevant audience pain point or competitor weakness \u2014 NOT generic velocity/trend metrics.
- hook: 2\u20133 sentence video OPENING that would stop a viewer from scrolling. Raw, personal, pattern-interrupting \u2014 not corporate.
- psychologicalTrigger: EXACTLY one of: curiosity | fear_of_missing_out | authority | social_proof | urgency
- titleVariants: 3 alternatives \u2014 each using a DIFFERENT format from Rule #1, different hook word. None should sound similar to the main title.
- format: The specific video structure (e.g., "23-min investigative breakdown with screen recording", "9-min talking head + live data analysis"). Do NOT copy the format from the examples above.
- monetizationAngle: Exactly what was assigned in Rule 6 for this gap
- targetAudience: Specific viewer persona in 6 words max \u2014 must be unique per gap
- contentOutline: 4\u20135 section titles, each max 4 words, that build narrative tension specific to this concept
- seoTips: 2\u20133 specific tag strings or metadata tips (not generic advice)
- competitorWeakness: ONE specific sentence identifying the exact gap in what top-ranking videos are NOT covering

Respond with ONLY valid JSON matching this exact schema. No markdown fences, no explanation text:
{
  "gaps": [
    {
      "title": "string",
      "gapScore": number,
      "reasoning": "string",
      "hook": "string",
      "psychologicalTrigger": "string",
      "titleVariants": ["string", "string", "string"],
      "format": "string",
      "monetizationAngle": "string",
      "targetAudience": "string",
      "contentOutline": ["string", "string", "string", "string", "string"],
      "seoTips": ["string", "string", "string"],
      "competitorWeakness": "string"
    }
  ],
  "overallOpportunity": "string",
  "recommendedNiche": "string"
}`;
}
