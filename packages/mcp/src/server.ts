/**
 * Creator DNA MCP server.
 *
 * Exposes 3 intent-shaped tools over stdio:
 *   - analyze_export       parse + aggregate a TikTok export (no LLM)
 *   - get_analysis_prompts return the 3 prompts + schemas the client's agent runs
 *   - validate_analysis    Zod-validate the agent's structured LLM responses
 *
 * The server holds NO LLM credentials. Inference happens on the agent side
 * (Claude Desktop, Cursor, Codex, etc.). This is the "bring your own agent"
 * (BYOA) pattern that turns Creator DNA into a tool surface any MCP client
 * can call through their own subscription.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  analyzeExport,
  analyzeExportInput,
  getAnalysisPrompts,
  getAnalysisPromptsInput,
  validateAnalysis,
  validateAnalysisInput,
} from './tools.js';

const TOOLS: Tool[] = [
  {
    name: 'analyze_export',
    description:
      'Parse and aggregate a TikTok data export from a path on the user machine. Returns a privacy-safe ~2KB summary plus a deterministic posting schedule. No LLM call. Always run this first.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Absolute path to the TikTok export. Accepts a .zip from Takeout, the unzipped folder, or a direct user_data_tiktok.json file.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_analysis_prompts',
    description:
      'Return the prompts the calling agent should run with its own LLM. Call once with just the summary to get the clustering prompt; call again with the resulting niches to get the qualification + content-ideas prompts. The MCP server itself never makes an LLM call.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          description: 'The CreatorDNASummary returned by analyze_export.',
        },
        niches: {
          type: 'array',
          description:
            'Optional. The niches array from running the clustering prompt. Pass it back to get the qualification + content-ideas prompts.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              confidence: { type: 'number' },
              evidence: { type: 'array', items: { type: 'string' } },
            },
            required: ['name', 'confidence', 'evidence'],
          },
        },
      },
      required: ['summary'],
    },
  },
  {
    name: 'validate_analysis',
    description:
      'Validate an LLM response against the matching Zod schema. Use after running each prompt to confirm the structured output is well-formed before continuing the pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        schema: {
          type: 'string',
          enum: ['niche', 'qualification', 'content_ideas'],
          description: 'Which schema to validate against.',
        },
        response: {
          type: 'object',
          description: 'The structured object returned by the LLM.',
        },
      },
      required: ['schema', 'response'],
    },
  },
];

const server = new Server(
  {
    name: 'creator-dna',
    version: '0.1.0',
  },
  {
    capabilities: { tools: {} },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'analyze_export': {
        const parsed = analyzeExportInput.parse(args);
        const result = await analyzeExport(parsed);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }
      case 'get_analysis_prompts': {
        const parsed = getAnalysisPromptsInput.parse(args);
        const result = getAnalysisPrompts(parsed);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }
      case 'validate_analysis': {
        const parsed = validateAnalysisInput.parse(args);
        const result = validateAnalysis(parsed);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: 'text', text: `Error: ${message}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
