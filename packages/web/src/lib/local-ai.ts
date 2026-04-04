/**
 * Local AI analysis using Chrome's built-in Gemini Nano.
 *
 * Privacy: EVERYTHING stays in the browser. No server calls.
 * Cost: $0. The model runs on-device.
 *
 * Fallback chain:
 *   1. Chrome Prompt API (Gemini Nano) — free, instant
 *   2. Server API route (/api/analyze) — needs API key
 */

import type {
  CreatorDNASummary,
  NicheResponse,
  QualificationResponse,
  ContentIdeasResponse,
} from "@creator-dna/core";
import {
  buildClusteringPrompt,
  buildQualificationPrompt,
  buildContentGapPrompt,
} from "@creator-dna/core";

// Chrome's LanguageModel API types
declare global {
  const LanguageModel: {
    availability(): Promise<"available" | "downloading" | "downloadable" | "unavailable">;
    create(options?: {
      systemPrompt?: string;
      temperature?: number;
      topK?: number;
    }): Promise<LanguageModelSession>;
  } | undefined;
}

interface LanguageModelSession {
  prompt(input: string): Promise<string>;
  promptStreaming(input: string): ReadableStream<string>;
  destroy(): void;
}

/**
 * Check if Chrome's built-in AI is available.
 */
export async function isLocalAIAvailable(): Promise<boolean> {
  try {
    if (typeof LanguageModel === "undefined") return false;
    const status = await LanguageModel.availability();
    return status === "available" || status === "downloading" || status === "downloadable";
  } catch {
    return false;
  }
}

/**
 * Extract JSON from a model response that might include markdown fences or extra text.
 */
function extractJson(text: string): string {
  // Try to find JSON in code fences first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return text;
}

/**
 * Run a prompt through Gemini Nano and parse the JSON response.
 */
async function runLocalPrompt<T>(
  prompt: string,
  schemaHint: string,
): Promise<T | null> {
  if (typeof LanguageModel === "undefined") return null;

  const session = await LanguageModel.create({
    systemPrompt:
      "You are a data analyst. Respond with ONLY valid JSON. No markdown, no explanation, no code fences. Just the JSON object.",
    temperature: 0.3,
    topK: 5,
  });

  try {
    const fullPrompt = `${prompt}\n\nRespond with ONLY valid JSON matching this schema:\n${schemaHint}`;
    const response = await session.prompt(fullPrompt);
    const json = extractJson(response);
    return JSON.parse(json) as T;
  } catch (e) {
    console.error("Local AI prompt failed:", e);
    return null;
  } finally {
    session.destroy();
  }
}

/**
 * Run the full Creator DNA analysis locally using Gemini Nano.
 * Same 3-prompt sequential-then-parallel pattern as the server route.
 */
export async function analyzeLocally(
  summary: CreatorDNASummary,
): Promise<{
  niches: NicheResponse | null;
  qualification: QualificationResponse | null;
  contentIdeas: ContentIdeasResponse | null;
  errors: { qualification: string | null; contentIdeas: string | null };
}> {
  const nicheSchema =
    '{ "niches": [{ "name": "string", "confidence": 0-100, "evidence": ["string"] }] }';
  const qualSchema =
    '{ "qualifications": [{ "niche": "string", "narrative": "string", "stats": ["string"] }] }';
  const ideasSchema =
    '{ "ideas": [{ "title": "string", "hook": "string", "format": "string", "niche": "string" }] }';

  // Step 1: Interest clustering (must complete first)
  const niches = await runLocalPrompt<NicheResponse>(
    buildClusteringPrompt(summary),
    nicheSchema,
  );

  if (!niches?.niches) {
    return {
      niches: null,
      qualification: null,
      contentIdeas: null,
      errors: {
        qualification: "Local AI couldn't identify niches.",
        contentIdeas: "Local AI couldn't identify niches.",
      },
    };
  }

  // Step 2: Qualification + Content Gaps (parallel, using niches)
  const [qualification, contentIdeas] = await Promise.all([
    runLocalPrompt<QualificationResponse>(
      buildQualificationPrompt(summary, niches.niches),
      qualSchema,
    ),
    runLocalPrompt<ContentIdeasResponse>(
      buildContentGapPrompt(summary, niches.niches),
      ideasSchema,
    ),
  ]);

  return {
    niches,
    qualification,
    contentIdeas,
    errors: {
      qualification: qualification
        ? null
        : "Local AI couldn't generate qualification evidence.",
      contentIdeas: contentIdeas
        ? null
        : "Local AI couldn't generate content ideas.",
    },
  };
}
