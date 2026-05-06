<div align="center">

# Creator DNA

**Upload your TikTok data export. AI tells you what content to create.**

The data is the permission slip.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](LICENSE)
![Status: Alpha](https://img.shields.io/badge/status-alpha-yellow)
![Stack: Next.js 16 + AI SDK v6](https://img.shields.io/badge/stack-Next.js%2016%20%2B%20AI%20SDK%20v6-black)

</div>

---

## What it does

Heavy TikTok consumers know their taste. They just don't know what their taste *says about them as a creator*. Creator DNA reads your `user_data_tiktok.json` export, finds the niche intersections you've been quietly building expertise in, and gives you back a personalized strategy: confidence evidence, content ideas, a posting schedule, and your first 5 video drafts.

This is not an analytics dashboard. It's an **insight reveal** — closer to Spotify Wrapped or 23andMe results than Pentos or Exolyt.

```
TikTok JSON → Parse → Aggregate → 3 Claude calls → Editorial report
   ~50MB        in browser    privacy boundary       cited insights
```

## Privacy by architecture

Creator DNA is **local-only by design**. Nothing about your TikTok export ever leaves your laptop &mdash; including the aggregated summary.

- **Parsing happens in your browser** via a Web Worker (no main-thread blocking, no upload).
- **Aggregation is the privacy boundary.** A small summary (~2KB: search-term clusters, engagement ratios, creator categories) is built in-browser. Per-video records never leave.
- **Analysis runs on Chrome's built-in Gemini Nano** &mdash; on-device, no API key, no network call. Three structured prompts via Chrome's Prompt API, with Zod schemas validating each response.
- **Schedule computation is deterministic** &mdash; no LLM call needed.
- **No server fallback.** If on-device AI isn't available, the app says so and stops, rather than silently shipping your data anywhere.

If your laptop crashes mid-analysis, nothing was uploaded. There is nothing to leak.

## Architecture

Monorepo workspace:

```
packages/
  core/        Parser + aggregator + Zod schemas + prompts (TypeScript, no Next dep)
  cli/         Local pipeline runner for development
  web/         Next.js 16 App Router app, deployed to Vercel
```

**Stack:** Next.js 16 · React 19 · Chrome Prompt API (Gemini Nano) · Zod · Tailwind · shadcn · Web Worker + Comlink · fflate (zip parsing).

## Quickstart (developer)

```bash
git clone https://github.com/nalediym/creator-dna && cd creator-dna
npm install

# Dev
cd packages/web && npm run dev

# Tests (the privacy-sensitive code paths)
npm test                    # parser, aggregator, schedule

# Build
npm run build
```

No API keys. No `.env`. The app uses Chrome's built-in Gemini Nano on-device.

To use the app:

1. Get your TikTok export at [TikTok's Data & Privacy settings](https://www.tiktok.com/privacy/data) &rarr; *Download your data* &rarr; JSON format. Wait for the email (usually a few hours).
2. Open the running app at `http://localhost:3000` **in Chrome 127+ with [`chrome://flags/#prompt-api-for-gemini-nano`](chrome://flags/#prompt-api-for-gemini-nano) enabled.**
3. Drop your `user_data_tiktok.json` (or the unzipped folder) onto the page.
4. Watch the report stream in section by section as each on-device prompt completes.

If you're not on Chrome with Nano, the app will tell you. We made that choice on purpose &mdash; no silent server fallback.

## Code highlights

| File | What's interesting |
|---|---|
| [`packages/core/src/parser.ts`](packages/core/src/parser.ts) | Reads TikTok's specific JSON paths (Watch History, Likes, Favorites, Searches, Shares, Following) with explicit comments listing what's intentionally excluded for privacy/low-signal (DMs, login history, shop browsing). |
| [`packages/core/src/aggregator.ts`](packages/core/src/aggregator.ts) | The privacy boundary. Comment header literally says *"only the summary leaves the browser"*. Builds search-term clusters and engagement-ratio stats. |
| [`packages/core/src/prompts.ts`](packages/core/src/prompts.ts) | Three Zod schemas validating Claude responses + three prompt builders. Sequential-then-parallel orchestration is documented inline. |
| [`packages/core/src/schedule.ts`](packages/core/src/schedule.ts) | Deterministic schedule computation — no LLM call, just rules. |

## Bring your own agent (MCP)

If you don't run Chrome with Nano, point your existing Claude Desktop / Claude Code / Cursor / Codex at Creator DNA's MCP server. Three tools, **zero LLM credentials on the server**:

| Tool | Stage | What |
|------|-------|------|
| `analyze_export(path)` | 1 (always first) | Parse + aggregate a TikTok export from a local path. Returns the ~2KB summary, posting schedule, section coverage. No LLM. |
| `get_analysis_prompts(summary, niches?)` | 2 + 3 | Returns the prompts your agent should run with its own LLM. Stage 2 (no `niches`): clustering prompt. Stage 3 (with `niches`): qualification + content-ideas prompts to run in parallel. |
| `validate_analysis(schema, response)` | After every LLM call | Zod-validates the structured response so the agent self-checks before continuing. |

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

Full docs: [`packages/mcp/README.md`](packages/mcp/README.md).

## Status

`v0.1-alpha`. Local-only architecture &mdash; no LLM keys required at any layer. The web app runs analysis in Chrome with on-device Gemini Nano; the MCP server lets any other agent run the same pipeline using its own subscription. The CLI runner works locally for development.

## Why this exists

Three blockers stop most aspiring creators:

1. **Niche uncertainty** — "what's *my* angle?"
2. **Imposter syndrome** — "do I even know enough to talk about this?"
3. **No strategy** — "what do I actually post?"

The bet: your consumption data already answers all three. You've been building expertise for years. You just haven't seen it back.

## License

Apache-2.0. See [LICENSE](LICENSE).

## Author

Built by [@nalediym](https://github.com/nalediym) ([@naledicodes](https://x.com/naledicodes) on X).
