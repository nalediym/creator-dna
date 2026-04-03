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

export const nicheSchema = z.object({
  niches: z.array(
    z.object({
      name: z.string().describe("Specific niche intersection name, e.g. '4C Natural Hair Care + Product Formulation'"),
      confidence: z.number().min(0).max(100).describe("Confidence score 0-100 based on depth of engagement"),
      evidence: z.array(z.string()).describe("2-4 specific evidence points from the data"),
    }),
  ).min(1).max(5),
});

export const qualificationSchema = z.object({
  qualifications: z.array(
    z.object({
      niche: z.string().describe("Which niche this qualification is for"),
      narrative: z.string().describe("A confidence-building paragraph using specific numbers. Write as if you're a mentor who believes in this person."),
      stats: z.array(z.string()).describe("2-3 specific data points that prove expertise, e.g. '77 searches on Cecred'"),
    }),
  ),
});

export const contentIdeasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string().describe("Video title — specific, not generic"),
      hook: z.string().describe("Opening line the creator can literally read into a camera"),
      format: z.string().describe("Format + duration, e.g. 'Tutorial · 60-90s'"),
      niche: z.string().describe("Which niche intersection this targets"),
    }),
  ).min(5).max(10),
});

// ── Prompt Builders ─────────────────────────────────────────

export function buildClusteringPrompt(summary: CreatorDNASummary): string {
  const topSearches = summary.searchClusters.slice(0, 40);
  const categories = summary.creatorCategories.slice(0, 15);

  return `You are analyzing a TikTok user's consumption data to identify their genuine content niches.

This person watched ${summary.stats.videosWatched.toLocaleString()} videos, liked ${summary.stats.videosLiked.toLocaleString()}, favorited ${summary.stats.videosFavorited.toLocaleString()}, and made ${summary.stats.searchesCount.toLocaleString()} searches over the period ${summary.stats.dateRange.start} to ${summary.stats.dateRange.end}.

Their like-to-watch ratio is ${(summary.likeToWatchRatio * 100).toFixed(1)}%. Their favorite-to-like ratio is ${(summary.favoriteToLikeRatio * 100).toFixed(1)}%.

TOP SEARCH TERMS (ranked by frequency):
${topSearches.map((s) => `  "${s.term}" — searched ${s.count} times (${s.firstSeen} to ${s.lastSeen})`).join("\n")}

CREATOR CATEGORIES FOLLOWED:
${categories.map((c) => `  ${c.category}: ${c.count} creators (e.g. ${c.sampleUsernames.join(", ")})`).join("\n")}

Identify 3-5 SPECIFIC niche intersections. Not broad categories like "beauty" — specific intersections like "4C natural hair care + DIY product formulation" or "bakhoor fragrance culture + artisanal scent making."

Rank by confidence: search frequency × engagement depth × specificity. A niche with 77 specific searches scores higher than one with 200 generic watches.

Look for INTERSECTIONS — where two or more interest areas overlap is where this person's unique positioning lives.`;
}

export function buildQualificationPrompt(
  summary: CreatorDNASummary,
  niches: Niche[],
): string {
  const nicheList = niches
    .map((n) => `  - ${n.name} (${n.confidence}% confidence)`)
    .join("\n");

  return `You are writing confidence-building qualification evidence for an aspiring TikTok creator.

This person has NEVER posted content. They have ${summary.stats.videosWatched.toLocaleString()} videos watched, ${summary.stats.videosLiked.toLocaleString()} liked, ${summary.stats.videosFavorited.toLocaleString()} favorited, and ${summary.stats.searchesCount.toLocaleString()} searches.

Their identified niches are:
${nicheList}

For each niche, write a qualification narrative that:
1. Uses SPECIFIC numbers from the data (searches, likes, creators followed)
2. Frames their consumption as expertise ("You didn't just watch 77 videos about this — you researched it")
3. Compares them favorably to the average person ("Most creators in this space haven't done this much research")
4. Builds genuine confidence without being cheesy or hollow

The tone is: a mentor who has seen the data and genuinely believes this person knows more than they think. Not corporate encouragement. Real talk backed by real numbers.

Available data:
- Total videos watched: ${summary.stats.videosWatched.toLocaleString()}
- Total likes: ${summary.stats.videosLiked.toLocaleString()}
- Total favorites: ${summary.stats.videosFavorited.toLocaleString()}
- Total searches: ${summary.stats.searchesCount.toLocaleString()}
- Accounts followed: ${summary.stats.accountsFollowed.toLocaleString()}
- Top search terms: ${summary.searchClusters.slice(0, 20).map((s) => `"${s.term}" (${s.count}x)`).join(", ")}`;
}

export function buildContentGapPrompt(
  summary: CreatorDNASummary,
  niches: Niche[],
): string {
  const nicheList = niches.map((n) => n.name).join(", ");
  const topSearches = summary.searchClusters.slice(0, 30);

  return `You are identifying content gaps for an aspiring TikTok creator.

Their niche intersections are: ${nicheList}

Their top search terms (what they actively looked for):
${topSearches.map((s) => `  "${s.term}" — ${s.count} searches`).join("\n")}

Generate 10 specific video ideas that:
1. Sit at the INTERSECTION of their niches (not just one niche)
2. Address things they searched for repeatedly (high-frequency search terms = unmet demand)
3. Would be unique — content that doesn't exist yet at these intersections
4. Have specific, compelling hooks they can literally read into a camera
5. Include a format and approximate duration

For each idea, the hook should be a complete opening sentence. Not "talk about X" but the actual words: "I've been testing [specific thing] for 3 months and here's what nobody tells you..."

Make Video 1 the EASIEST win — low production value, just talking to camera, under 60 seconds. Each subsequent video can be slightly more ambitious.

The first 5 are "Your First 5 Videos" — ordered from easiest to most ambitious.
The remaining 5 are bonus ideas for week 2+.`;
}
