# @creator-dna/mcp

**MCP server for Creator DNA — bring your own agent.**

Three intent-shaped tools that let any [Model Context Protocol](https://modelcontextprotocol.io) client (Claude Desktop, Claude Code, Cursor, Codex) run Creator DNA's TikTok-export analysis on the user's machine, using the agent's own LLM subscription. **The server holds zero LLM credentials.**

## Why this exists

The web app (`@creator-dna/web`) runs the analysis on Chrome's built-in Gemini Nano. Users without Chrome+Nano can still get the full Creator DNA report by:

1. Pointing their Claude Desktop / Cursor / Codex at this MCP server.
2. The agent calls `analyze_export(path)` — gets back a privacy-safe ~2KB aggregated summary.
3. The agent calls `get_analysis_prompts(summary)` — gets back the clustering prompt the calling LLM should run.
4. The agent runs the prompt with its own LLM, then calls `get_analysis_prompts(summary, niches)` to get qualification + content-ideas prompts.
5. The agent calls `validate_analysis(...)` to schema-check each LLM response before assembling the report.

Every LLM call happens inside the calling agent. **The MCP server never sees a model.**

## The three tools

| Tool | Stage | What it does |
|------|-------|--------------|
| `analyze_export` | 1 (always first) | Parse + aggregate a TikTok export from a local path. Returns the summary, posting schedule, and section-coverage report. No LLM. |
| `get_analysis_prompts` | 2 + 3 | Return the prompt(s) the calling agent should run with its own LLM. Stage 2 (no `niches`): the clustering prompt. Stage 3 (with `niches`): the qualification + content-ideas prompts to run in parallel. |
| `validate_analysis` | After every LLM call | Zod-validate the LLM response against the right schema. Returns either parsed data or a structured error report. |

## Install

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "creator-dna": {
      "command": "bun",
      "args": ["/absolute/path/to/creator-dna/packages/mcp/src/bin.ts"]
    }
  }
}
```

Restart Claude Desktop. The three tools will be available in any new conversation.

### Claude Code / Cursor / Codex

Same config shape, in each client's MCP settings. Standard stdio transport.

## Workflow (what the agent does)

```
User: "Analyze my TikTok export at ~/Downloads/user_data_tiktok-2026-05-01.json"

Agent:
  1. analyze_export(path="...") → returns summary + schedule
  2. get_analysis_prompts(summary) → returns clustering prompt
  3. [agent runs the clustering prompt with its own LLM] → niches[]
  4. validate_analysis(schema="niche", response={niches}) → ok
  5. get_analysis_prompts(summary, niches) → returns qualification + ideas prompts
  6. [agent runs both prompts in parallel] → qualifications + ideas
  7. validate_analysis(...) twice → ok
  8. Assembles the full Creator DNA report and shows it to the user
```

## Why this matters

This is the *bring your own agent* (BYOA) pattern that became standard after Apr 2026: third-party tools expose MCP surfaces, users keep control of their own auth + their own usage costs. The Creator DNA web app needs no API keys; this server needs no API keys; the user's existing Claude Desktop subscription powers the analysis.

## License

Apache-2.0. See repository root [LICENSE](../../LICENSE).
