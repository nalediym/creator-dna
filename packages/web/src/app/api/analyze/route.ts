/**
 * POST /api/analyze
 *
 * Receives a CreatorDNASummary (~2KB), runs 3 Claude prompts
 * in sequential-then-parallel order, returns the analysis.
 *
 * Execution:
 *   Step 1: Prompt 1 (Interest Clustering) — identifies niches
 *   Step 2: Prompt 2 (Qualification) + Prompt 3 (Content Gaps) — parallel, using niches
 *
 * Rate limiting: 5 per IP per day + global 50/day budget cap.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import {
  nicheSchema,
  qualificationSchema,
  contentIdeasSchema,
  buildClusteringPrompt,
  buildQualificationPrompt,
  buildContentGapPrompt,
} from "@creator-dna/core";
import type {
  CreatorDNASummary,
  NicheResponse,
  QualificationResponse,
  ContentIdeasResponse,
} from "@creator-dna/core";

export const maxDuration = 60;

// Simple in-memory rate limiting (resets on cold start, which is fine for Phase 1)
const ipCounts = new Map<string, { count: number; date: string }>();
let globalDailyCount = { count: 0, date: "" };

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function checkRateLimit(ip: string): string | null {
  const today = getToday();

  // Reset daily counters
  if (globalDailyCount.date !== today) {
    globalDailyCount = { count: 0, date: today };
    ipCounts.clear();
  }

  // Global budget cap: 50 reports/day
  if (globalDailyCount.count >= 50) {
    return "We're popular today! Try again in a few hours.";
  }

  // Per-IP limit: 5/day
  const ipData = ipCounts.get(ip);
  if (ipData && ipData.date === today && ipData.count >= 5) {
    return "You've used your 5 reports for today. Try again tomorrow.";
  }

  // Increment counters
  globalDailyCount.count++;
  ipCounts.set(ip, {
    count: (ipData?.date === today ? ipData.count : 0) + 1,
    date: today,
  });

  return null;
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rateLimitError = checkRateLimit(ip);
  if (rateLimitError) {
    return NextResponse.json({ error: rateLimitError }, { status: 429 });
  }

  let body: { summary: CreatorDNASummary };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (!body.summary?.stats?.videosWatched) {
    return NextResponse.json(
      { error: "Missing or invalid CreatorDNASummary." },
      { status: 400 },
    );
  }

  const { summary } = body;

  try {
    // Step 1: Interest Clustering (sequential — other prompts depend on this)
    let niches: NicheResponse;
    try {
      const clusterResult = await generateText({
        model: "anthropic/claude-sonnet-4.5",
        output: Output.object({ schema: nicheSchema }),
        prompt: buildClusteringPrompt(summary),
      });
      niches = clusterResult.output!;
    } catch {
      return NextResponse.json(
        {
          error: "Failed to identify your niches. Please try again.",
          partial: null,
        },
        { status: 502 },
      );
    }

    // Step 2: Qualification + Content Gaps (parallel, using niches from Step 1)
    const [qualResult, ideasResult] = await Promise.allSettled([
      generateText({
        model: "anthropic/claude-sonnet-4.5",
        output: Output.object({ schema: qualificationSchema }),
        prompt: buildQualificationPrompt(summary, niches.niches),
      }),
      generateText({
        model: "anthropic/claude-sonnet-4.5",
        output: Output.object({ schema: contentIdeasSchema }),
        prompt: buildContentGapPrompt(summary, niches.niches),
      }),
    ]);

    const qualification: QualificationResponse | null =
      qualResult.status === "fulfilled" ? qualResult.value.output : null;
    const contentIdeas: ContentIdeasResponse | null =
      ideasResult.status === "fulfilled" ? ideasResult.value.output : null;

    // Return whatever succeeded (partial results are OK)
    return NextResponse.json({
      niches,
      qualification,
      contentIdeas,
      errors: {
        qualification:
          qualResult.status === "rejected"
            ? "Failed to generate qualification evidence."
            : null,
        contentIdeas:
          ideasResult.status === "rejected"
            ? "Failed to generate content ideas."
            : null,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Analysis failed unexpectedly. Please try again." },
      { status: 500 },
    );
  }
}
