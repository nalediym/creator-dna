/**
 * Creator DNA MCP tools.
 *
 * Three intent-shaped tools that let an external agent (Claude Desktop,
 * Cursor, Codex) run the Creator DNA analysis on a TikTok export — using
 * the agent's own LLM subscription. The MCP server holds zero LLM credentials.
 *
 * Pattern: bring your own agent (BYOA) via MCP.
 *   1. analyze_export       — parse + aggregate (no LLM)
 *   2. get_analysis_prompts — return the 3 prompts + schemas the agent runs
 *   3. validate_analysis    — Zod-validate the agent's LLM responses
 */

import { promises as fs } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import {
  parseTikTokExport,
  aggregate,
  computeSchedule,
  checkDataSufficiency,
  nicheSchema,
  qualificationSchema,
  contentIdeasSchema,
  buildClusteringPrompt,
  buildQualificationPrompt,
  buildContentGapPrompt,
  type CreatorDNASummary,
  type Niche,
} from '@creator-dna/core';
import { z } from 'zod';

// ── Tool 1: analyze_export ──────────────────────────────────────────────

export const analyzeExportInput = z.object({
  path: z.string().describe(
    'Absolute path to a TikTok data export. Either a .zip from takeout, the unzipped folder, or a direct user_data_tiktok.json file.',
  ),
});

export async function analyzeExport(args: z.infer<typeof analyzeExportInput>) {
  const { path } = args;

  // Read the file or directory
  const stat = await fs.stat(path);
  let raw: unknown;

  if (stat.isDirectory()) {
    // Look for user_data_tiktok.json inside
    const dirContents = await fs.readdir(path);
    const jsonFile = dirContents.find((f) => f.endsWith('.json') && f.toLowerCase().includes('user_data_tiktok'));
    if (!jsonFile) {
      throw new Error(
        `No user_data_tiktok*.json found in ${path}. Pass the JSON file directly, or a .zip of the export.`,
      );
    }
    const content = await fs.readFile(`${path}/${jsonFile}`, 'utf-8');
    raw = JSON.parse(content);
  } else if (path.endsWith('.zip')) {
    const buf = await fs.readFile(path);
    const unzipped = unzipSync(new Uint8Array(buf));
    const jsonEntry = Object.keys(unzipped).find((k) =>
      k.toLowerCase().includes('user_data_tiktok') && k.endsWith('.json'),
    );
    if (!jsonEntry) {
      throw new Error(`No user_data_tiktok*.json inside ${path}`);
    }
    raw = JSON.parse(strFromU8(unzipped[jsonEntry]!));
  } else if (path.endsWith('.json')) {
    const content = await fs.readFile(path, 'utf-8');
    raw = JSON.parse(content);
  } else {
    throw new Error(`Unsupported input: ${path}. Pass .zip, .json, or a directory.`);
  }

  // Parse + aggregate (no LLM, all deterministic)
  const parseResult = parseTikTokExport(raw);
  if (!parseResult.ok) {
    throw new Error(`Parse failed: ${parseResult.errors.join('; ')}`);
  }
  const parsed = parseResult.export;
  const summary = aggregate(parsed);
  const schedule = computeSchedule(parsed);
  const sufficiency = checkDataSufficiency(summary);

  return {
    ok: true as const,
    summary,
    schedule,
    sufficiency,
    sectionsFound: parseResult.sectionsFound,
    sectionsTotal: parseResult.sectionsTotal,
    sectionDetails: parseResult.sectionDetails,
    note:
      'Privacy-safe summary built. Raw export was parsed locally; only this aggregated summary needs to flow into the analysis prompts. Call get_analysis_prompts next.',
  };
}

// ── Tool 2: get_analysis_prompts ────────────────────────────────────────

export const getAnalysisPromptsInput = z.object({
  summary: z.unknown().describe('CreatorDNASummary returned by analyze_export.'),
  niches: z
    .array(
      z.object({
        name: z.string(),
        confidence: z.number(),
        evidence: z.array(z.string()),
      }),
    )
    .optional()
    .describe(
      'Optional. Pass the niches output from running the clustering prompt to get back the qualification + content-ideas prompts (which need niche context).',
    ),
});

export function getAnalysisPrompts(args: z.infer<typeof getAnalysisPromptsInput>) {
  const summary = args.summary as CreatorDNASummary;

  if (!args.niches) {
    // Stage 1: clustering only
    return {
      stage: 'clustering' as const,
      prompt: buildClusteringPrompt(summary),
      response_schema: nicheSchemaJson(),
      next_step:
        'Run this prompt with your LLM. Validate the response with validate_analysis (schema: "niche"). Then call get_analysis_prompts again with the niches array to get the next two prompts.',
    };
  }

  // Stage 2: qualification + content-ideas (run in parallel)
  return {
    stage: 'qualification_and_ideas' as const,
    qualification_prompt: buildQualificationPrompt(args.niches as Niche[]),
    qualification_schema: qualificationSchemaJson(),
    content_ideas_prompt: buildContentGapPrompt(args.niches as Niche[]),
    content_ideas_schema: contentIdeasSchemaJson(),
    next_step:
      'Run both prompts in parallel with your LLM. Validate each response with validate_analysis (schemas: "qualification" and "content_ideas"). Combine all four pieces (niches, qualifications, content ideas, schedule) into the final report.',
  };
}

// ── Tool 3: validate_analysis ───────────────────────────────────────────

export const validateAnalysisInput = z.object({
  schema: z
    .enum(['niche', 'qualification', 'content_ideas'])
    .describe('Which response schema to validate against.'),
  response: z
    .unknown()
    .describe('The structured response from the LLM. Should be a JSON object matching the schema.'),
});

export function validateAnalysis(args: z.infer<typeof validateAnalysisInput>) {
  const schemas = {
    niche: nicheSchema,
    qualification: qualificationSchema,
    content_ideas: contentIdeasSchema,
  };
  const result = schemas[args.schema].safeParse(args.response);
  if (result.success) {
    return { valid: true as const, data: result.data };
  }
  return {
    valid: false as const,
    errors: result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
      code: i.code,
    })),
    hint:
      'The LLM produced output that does not match the expected schema. Common fixes: (1) re-run with the schema description in the system prompt, (2) ask the LLM to fix its previous response.',
  };
}

// ── Helpers: Zod → JSON-schema-like representation for the agent ────────
// Returns a simplified JSON-schema sketch so the agent can format its
// LLM call with structured-output / tool-use semantics.

function nicheSchemaJson() {
  return {
    type: 'object',
    properties: {
      niches: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Specific niche-intersection name' },
            confidence: { type: 'number', minimum: 0, maximum: 100 },
            evidence: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
          },
          required: ['name', 'confidence', 'evidence'],
        },
      },
    },
    required: ['niches'],
  };
}

function qualificationSchemaJson() {
  return {
    type: 'object',
    properties: {
      qualifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            niche: { type: 'string' },
            narrative: { type: 'string', description: 'Confidence-building paragraph' },
            stats: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
          },
          required: ['niche', 'narrative', 'stats'],
        },
      },
    },
    required: ['qualifications'],
  };
}

function contentIdeasSchemaJson() {
  return {
    type: 'object',
    properties: {
      ideas: {
        type: 'array',
        minItems: 5,
        maxItems: 10,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            hook: { type: 'string', description: 'Opening line readable to camera' },
            format: { type: 'string', description: "e.g. 'Tutorial · 60-90s'" },
            niche: { type: 'string' },
          },
          required: ['title', 'hook', 'format', 'niche'],
        },
      },
    },
    required: ['ideas'],
  };
}
