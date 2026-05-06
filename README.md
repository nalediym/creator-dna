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

The most sensitive part of TikTok's export is the *raw watch history*. Creator DNA never sends it anywhere.

- **Parsing happens in your browser** via a Web Worker (no main-thread blocking, no upload).
- **Aggregation is the privacy boundary.** Only the summary leaves the browser — search-term clusters, engagement ratios, creator categories. Never the per-video records.
- **Three Claude calls** receive the aggregated summary, not the raw export. Sequential-then-parallel: clustering first, then qualification + content-ideas in parallel.
- **Schedule computation is deterministic** — no LLM call needed.

If your laptop crashes mid-analysis, nothing was uploaded. There is nothing to leak.

## Architecture

Monorepo workspace:

```
packages/
  core/        Parser + aggregator + Zod schemas + prompts (TypeScript, no Next dep)
  cli/         Local pipeline runner for development
  web/         Next.js 16 App Router app, deployed to Vercel
```

**Stack:** Next.js 16 · React 19 · AI SDK v6 (`generateObject`) · Anthropic Claude · Zod · Tailwind · shadcn · Web Worker + Comlink · fflate (zip parsing) · Turnstile + global rate limit (5/IP/day, 50/day cap).

## Quickstart (developer)

```bash
git clone https://github.com/nalediym/creator-dna && cd creator-dna
npm install
cp packages/web/.env.example packages/web/.env.local  # add your ANTHROPIC_API_KEY

# Dev
cd packages/web && npm run dev

# Tests (the privacy-sensitive code paths)
npm test                    # parser, aggregator, schedule

# Build
npm run build
```

To use the app:

1. Get your TikTok export at [TikTok's Data & Privacy settings](https://www.tiktok.com/privacy/data) → "Download your data" → JSON format. Wait for the email (usually a few hours).
2. Open the running app at `http://localhost:3000`.
3. Drop your `user_data_tiktok.json` (or the unzipped folder) onto the page.
4. Watch the report stream in section by section as each Claude call completes.

## Code highlights

| File | What's interesting |
|---|---|
| [`packages/core/src/parser.ts`](packages/core/src/parser.ts) | Reads TikTok's specific JSON paths (Watch History, Likes, Favorites, Searches, Shares, Following) with explicit comments listing what's intentionally excluded for privacy/low-signal (DMs, login history, shop browsing). |
| [`packages/core/src/aggregator.ts`](packages/core/src/aggregator.ts) | The privacy boundary. Comment header literally says *"only the summary leaves the browser"*. Builds search-term clusters and engagement-ratio stats. |
| [`packages/core/src/prompts.ts`](packages/core/src/prompts.ts) | Three Zod schemas validating Claude responses + three prompt builders. Sequential-then-parallel orchestration is documented inline. |
| [`packages/core/src/schedule.ts`](packages/core/src/schedule.ts) | Deterministic schedule computation — no LLM call, just rules. |

## Status

`v0.1-alpha`. Web app is deployed; the CLI runner works locally for development; an MCP server is on the roadmap so external agents (Claude Code, Cursor, Claude Desktop) can run the analysis on a Takeout export they have access to.

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
