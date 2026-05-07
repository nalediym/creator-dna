#!/usr/bin/env npx tsx
/**
 * Generate a Creator DNA report using codex exec (uses your existing subscription).
 *
 * Usage:
 *   npx tsx packages/cli/generate-report.ts /path/to/user_data_tiktok.json
 *   npx tsx packages/cli/generate-report.ts /path/to/TikTok_Data_*.zip
 *
 * Output: writes report JSON to packages/web/public/sample-report.json
 * The web app can load this as a demo report or for local testing.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  parseTikTokExport,
  aggregate,
  checkDataSufficiency,
  computeSchedule,
  buildClusteringPrompt,
  buildQualificationPrompt,
  buildContentGapPrompt,
} from "../core/src/index";
import type { NicheResponse, QualificationResponse, ContentIdeasResponse } from "../core/src/index";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: npx tsx packages/cli/generate-report.ts <tiktok-export.json|.zip>");
  process.exit(1);
}

// Step 1: Load and parse
console.log("Loading export...");
let jsonText: string;

if (inputPath.endsWith(".zip")) {
  // Unzip using the system unzip command, read the JSON inside
  const tmpDir = execSync("mktemp -d").toString().trim();
  execSync(`unzip -o "${inputPath}" -d "${tmpDir}"`, { stdio: "pipe" });
  const jsonFile = fs.readdirSync(tmpDir).find((f) => f.endsWith(".json"));
  if (!jsonFile) {
    console.error("No JSON file found inside the ZIP.");
    process.exit(1);
  }
  jsonText = fs.readFileSync(path.join(tmpDir, jsonFile), "utf8");
  execSync(`rm -rf "${tmpDir}"`);
} else {
  jsonText = fs.readFileSync(inputPath, "utf8");
}

const raw = JSON.parse(jsonText);
const result = parseTikTokExport(raw);
if (!result.ok) {
  console.error("Parse error:", result.error);
  process.exit(1);
}

console.log(`Parsed: ${result.data.watchHistory.length} watches, ${result.data.likes.length} likes, ${result.data.searches.length} searches`);

// Step 2: Aggregate
const summary = aggregate(result.data);
const insufficiency = checkDataSufficiency(summary);
if (insufficiency) {
  console.error(insufficiency);
  process.exit(1);
}

// Trim search clusters for prompt context
summary.searchClusters = summary.searchClusters.slice(0, 50);

// Step 3: Compute schedule (deterministic, no LLM needed)
const schedule = computeSchedule(summary);
console.log(`Schedule: best hours ${schedule.bestHours}, best days ${schedule.bestDays.join(", ")}`);

// Step 4: Run prompts through codex exec
function runPrompt(name: string, prompt: string, schemaHint: string): string {
  console.log(`Running ${name}...`);
  const promptFile = `/tmp/creator-dna-${name}.txt`;
  fs.writeFileSync(promptFile, `${prompt}\n\nRespond with ONLY valid JSON matching this schema (no markdown, no code fences):\n${schemaHint}`);

  try {
    const output = execSync(
      `codex exec "$(cat ${promptFile})" -s read-only -c 'model_reasoning_effort="high"'`,
      { encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 120_000 },
    );
    fs.unlinkSync(promptFile);
    // Extract JSON from the output (codex may include extra text)
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`${name}: No JSON found in response`);
      return "null";
    }
    // Validate it parses
    JSON.parse(jsonMatch[0]);
    return jsonMatch[0];
  } catch (e) {
    console.error(`${name} failed, trying claude CLI fallback...`);
    // Fallback: pipe through claude CLI
    try {
      const output = execSync(
        `cat ${promptFile} | claude --print`,
        { encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 120_000 },
      );
      fs.unlinkSync(promptFile);
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return "null";
      JSON.parse(jsonMatch[0]);
      return jsonMatch[0];
    } catch {
      console.error(`${name} failed on both codex and claude CLI`);
      fs.unlinkSync(promptFile);
      return "null";
    }
  }
}

const nicheSchema = '{ "niches": [{ "name": "string", "confidence": 0-100, "evidence": ["string"] }] }';
const qualSchema = '{ "qualifications": [{ "niche": "string", "narrative": "string", "stats": ["string"] }] }';
const ideasSchema = '{ "ideas": [{ "title": "string", "hook": "string", "format": "string", "niche": "string" }] }';

// Step 4a: Prompt 1 — Interest Clustering (must run first)
const nichesJson = runPrompt("clustering", buildClusteringPrompt(summary), nicheSchema);
let niches: NicheResponse | null = null;
try {
  niches = JSON.parse(nichesJson);
} catch {
  console.error("Failed to parse niches response");
}

// Step 4b: Prompts 2+3 (depend on niches)
let qualification: QualificationResponse | null = null;
let contentIdeas: ContentIdeasResponse | null = null;

if (niches?.niches) {
  const qualJson = runPrompt("qualification", buildQualificationPrompt(niches.niches), qualSchema);
  try { qualification = JSON.parse(qualJson); } catch { /* skip */ }

  const ideasJson = runPrompt("content-gaps", buildContentGapPrompt(niches.niches), ideasSchema);
  try { contentIdeas = JSON.parse(ideasJson); } catch { /* skip */ }
}

// Step 5: Assemble and save report
const report = {
  niches,
  qualification,
  contentIdeas,
  schedule,
  summary,
  errors: {
    qualification: qualification ? null : "Failed to generate qualification evidence.",
    contentIdeas: contentIdeas ? null : "Failed to generate content ideas.",
  },
};

const outPath = path.resolve(__dirname, "../web/public/sample-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nReport saved to ${outPath}`);
console.log(`\nNiches found: ${niches?.niches?.length ?? 0}`);
niches?.niches?.forEach((n) => console.log(`  ${n.name} (${n.confidence}%)`));
console.log(`\nVideo ideas: ${contentIdeas?.ideas?.length ?? 0}`);
console.log(`\nOpen http://localhost:3333/report to view (start dev server first)`);
