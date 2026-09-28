import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitorInsights, ideaVault } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { insights } = await req.json();
        if (!insights || !Array.isArray(insights) || insights.length === 0) {
            return NextResponse.json({ error: "Missing or empty insights array" }, { status: 400 });
        }

        const groqKeys = [
            process.env.GROQ_API_KEY,
            process.env.GROQ_API_KEY_2,
            process.env.GROQ_API_KEY_3,
        ].filter(Boolean) as string[];

        if (groqKeys.length === 0) {
            return NextResponse.json({ error: "API keys not configured" }, { status: 503 });
        }

        const combinedData = insights.map(i => {
            const a = i.analysis as any;
            return `
Title: "${i.title}"
Views: ${i.views}
Why It Worked: ${a.whyItWorked || ""}
The Gap: ${a.theGap || ""}
Target Keywords: ${a.targetKeywords || ""}
            `.trim();
        }).join("\n\n");

        const prompt = `You are an elite YouTube growth strategist.
I am providing you with the recent top-performing videos from a specific competitor, along with an analysis of their gaps and why they worked.

COMPETITOR VIDEOS ANALYSIS:
${combinedData}

Your task is to SYNTHESIZE all of this data to create ONE ultimate, innovative video concept. Do not just pick the best video; find the overarching meta-gap or combine their proven concepts into a superior, fresh angle.

Provide a rich, actionable analysis as JSON with EXACTLY these fields:
{
  "whyItWorked": "Explain the combined meta-trend or pattern you observed across these videos.",
  "theGap": "The ultimate synthesis gap: what is this competitor broadly failing to provide across their channel that you will capitalize on?",
  "suggestedHook": "A specific 10-second opening script (verbatim, ready to record) for this master idea.",
  "counterTitle": "An irresistible, highly innovative YouTube title for this synthesized idea.",
  "targetKeywords": "3-5 comma-separated high-value search keywords.",
  "contentAngle": "The unique narrative angle (e.g., Ultimate Masterclass, Combined Challenge, Contrarian Deep-Dive).",
  "estimatedProductionTime": 15
}

Return ONLY the raw JSON object. No markdown. No explanation.`;

        const groqProvider = createGroq({ apiKey: groqKeys[Math.floor(Math.random() * groqKeys.length)] });
        const groqModel = groqProvider("llama3-70b-8192");

        const { text } = await generateText({ model: groqModel, prompt });
        
        let cleaned = text.trim();
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
            cleaned = cleaned.slice(start, end + 1);
        } else {
            cleaned = cleaned.replace(/```json|```/g, "").trim();
        }
        
        const synthesis = JSON.parse(cleaned);

        return NextResponse.json({ synthesis });

    } catch (e) {
        console.error("Watchtower Synthesize Error:", e);
        return NextResponse.json({ error: "Failed to synthesize insights" }, { status: 500 });
    }
}
