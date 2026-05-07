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
      maxItems: 5,
      items: {
        type: "object",
        required: ["name", "confidence", "evidence"],
        properties: {
          name: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
          evidence: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: { type: "string" },
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
      items: {
        type: "object",
        required: ["niche", "narrative", "stats"],
        properties: {
          niche: { type: "string" },
          narrative: { type: "string" },
          stats: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string" },
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
      maxItems: 10,
      items: {
        type: "object",
        required: ["title", "hook", "format", "niche"],
        properties: {
          title: { type: "string" },
          hook: { type: "string" },
          format: { type: "string" },
          niche: { type: "string" },
        },
      },
    },
  },
} as const;
