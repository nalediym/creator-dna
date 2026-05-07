/**
 * Claude API prompt templates and Zod schemas for Creator DNA analysis.
 *
 * 3 prompts, executed sequential-then-parallel:
 *   Step 1: Prompt 1 (Interest Clustering) — produces niches
 *   Step 2: Prompt 2 (Qualification) + Prompt 3 (Content Gaps) — in parallel, using niches from Step 1
 *
 * Schedule is computed deterministically (schedule.ts), no LLM call.
 */

import { z } from "zod";
import type { CreatorDNASummary, Niche } from "./types";

// ── Zod Schemas (runtime validation of Claude responses) ────

// Schemas are kept lean: descriptions are stripped (they bloat the JSON Schema
// sent to small models via responseConstraint), and array/string bounds are
// explicit so the model can't run away. Each niche carries enough self-contained
// context that downstream prompts (qualification, content ideas) can run from
// just the niche objects — no need to re-send the raw summary.
export const nicheSchema = z.object({
  niches: z.array(
    z.object({
      name: z.string().max(120),
      confidence: z.number().min(0).max(100),
      evidence: z.array(z.string().max(140)).min(1).max(3),
      stats: z.array(z.string().max(80)).min(1).max(3),
      creatorExamples: z.array(z.string().max(40)).max(3),
    }),
  ).min(1).max(3),
});

export const qualificationSchema = z.object({
  qualifications: z.array(
    z.object({
      niche: z.string().max(120),
      narrative: z.string().max(600),
      stats: z.array(z.string().max(80)).min(1).max(3),
    }),
  ).min(1).max(3),
});

export const contentIdeasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string().max(80),
      hook: z.string().max(200),
      format: z.string().max(60),
      niche: z.string().max(120),
    }),
  ).min(5).max(8),
});

// ── Prompt Builders ─────────────────────────────────────────

export function buildClusteringPrompt(summary: CreatorDNASummary): string {
  // Cap input aggressively — the schema constraints downstream want richer
  // per-niche output, so we trade input breadth for output depth.
  const topSearches = summary.searchClusters.slice(0, 25);
  const categories = summary.creatorCategories.slice(0, 10);

  return `Analyze a TikTok user's consumption to identify their content niches.

Stats: ${summary.stats.videosWatched.toLocaleString()} watched, ${summary.stats.videosLiked.toLocaleString()} liked, ${summary.stats.videosFavorited.toLocaleString()} favorited, ${summary.stats.searchesCount.toLocaleString()} searches. Like rate ${(summary.likeToWatchRatio * 100).toFixed(0)}%, favorite rate ${(summary.favoriteToLikeRatio * 100).toFixed(0)}%.

TOP SEARCHES:
${topSearches.map((s) => `  "${s.term}" (${s.count}x)`).join("\n")}

CREATORS FOLLOWED BY CATEGORY:
${categories.map((c) => `  ${c.category}: ${c.count}${c.sampleUsernames.length ? ` (e.g. ${c.sampleUsernames.slice(0, 2).join(", ")})` : ""}`).join("\n")}

Identify up to 3 SPECIFIC niche intersections (not broad categories — "4C natural hair + occasion styling," not "beauty"). Look for where two or more interest areas overlap.

For each niche, populate ALL fields:
- name: specific intersection
- confidence: 0-100 (search frequency × engagement depth × specificity)
- evidence: 2-3 short observations about their behavior in this niche
- stats: 2-3 concrete data points like "cecred searched 8x" or "19 hair-care creators followed" — these get reused in later prompts so they must be self-contained
- creatorExamples: up to 3 follower handles or category labels associated with this niche`;
}

export function buildQualificationPrompt(niches: Niche[]): string {
  // RAPTOR / Claude-Code pattern: this prompt sees ONLY the distilled niches
  // from prompt 1, never the raw aggregator summary. Each niche already
  // carries its own stats array — that's what the narrative cites.
  return `Write confidence-building qualification evidence for an aspiring TikTok creator who has never posted.

Their niches (each comes with stats you should weave into the narrative):
${niches
  .map(
    (n) =>
      `\n- ${n.name} (${n.confidence}% confidence)\n  evidence: ${n.evidence.join("; ")}\n  stats: ${n.stats?.join("; ") ?? ""}`,
  )
  .join("\n")}

For each niche, write a qualification narrative that:
1. Cites the specific stats above as proof of expertise
2. Frames their consumption as research, not just watching
3. Builds genuine confidence — mentor voice, not corporate encouragement

The "stats" array in your output should restate 2-3 of the supplied stats verbatim or near-verbatim (so the UI can render them as evidence chips).`;
}

export function buildContentGapPrompt(niches: Niche[]): string {
  // Same RAPTOR pattern — only niches, no raw summary.
  return `Generate 5-8 specific TikTok video ideas for a new creator whose identified niches are:
${niches
  .map(
    (n) =>
      `\n- ${n.name}\n  evidence: ${n.evidence.join("; ")}\n  stats: ${n.stats?.join("; ") ?? ""}`,
  )
  .join("\n")}

Each idea must:
1. Sit at the INTERSECTION of two or more of their niches
2. Be motivated by something in the evidence/stats above (use the specifics — searches, creators, ratios)
3. Have a hook that's a complete opening sentence the creator could literally say to a camera
4. Specify a format + duration ("Talking to camera · 45-60s", "Split-screen demo · 60-90s")

Order from EASIEST to most ambitious: idea 1 is talking to camera under 60s, no production. Each subsequent idea can be slightly more ambitious.

The first 5 are "Your First 5 Videos." Any extras (up to 8 total) are bonus ideas for week 2+.`;
}
