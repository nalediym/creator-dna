/**
 * JSON Schemas matching @creator-dna/core's Zod schemas, formatted for the
 * Chrome Prompt API's `responseConstraint`.
 *
 * Forcing schema-constrained generation eliminates parse failures (the model
 * can't emit invalid JSON), drops the need for a "respond with ONLY JSON"
 * system prompt, and tends to be faster (no wasted tokens on preamble).
 */

export const nicheJsonSchema = {
  type: "object",
  required: ["niches"],
  properties: {
    niches: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        required: ["name", "confidence", "evidence", "stats"],
        properties: {
          name: { type: "string", maxLength: 120 },
          confidence: { type: "number", minimum: 0, maximum: 100 },
          evidence: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string", maxLength: 140 },
          },
          stats: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string", maxLength: 80 },
          },
          creatorExamples: {
            type: "array",
            maxItems: 3,
            items: { type: "string", maxLength: 40 },
          },
        },
      },
    },
  },
} as const;

export const qualificationJsonSchema = {
  type: "object",
  required: ["qualifications"],
  properties: {
    qualifications: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        required: ["niche", "narrative", "stats"],
        properties: {
          niche: { type: "string", maxLength: 120 },
          narrative: { type: "string", maxLength: 600 },
          stats: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string", maxLength: 80 },
          },
        },
      },
    },
  },
} as const;

export const contentIdeasJsonSchema = {
  type: "object",
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: {
        type: "object",
        required: ["title", "hook", "format", "niche"],
        properties: {
          title: { type: "string", maxLength: 80 },
          hook: { type: "string", maxLength: 200 },
          format: { type: "string", maxLength: 60 },
          niche: { type: "string", maxLength: 120 },
        },
      },
    },
  },
} as const;
