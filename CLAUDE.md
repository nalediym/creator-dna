# CLAUDE.md

## Project Overview

Creator DNA is a free tool that analyzes TikTok consumption data and reveals what content you should create. Upload your TikTok data export, get a personalized Creator DNA Report with niche intersections, confidence evidence, content ideas, schedule, and your first 5 videos.

Core insight: "The data is the permission slip." The blocker for aspiring creators is compound (niche + confidence + strategy). This product addresses all three using personal consumption data as evidence.

## Architecture

Monorepo: packages/core (parser, aggregator, prompts), packages/cli, packages/web.

- Web: Next.js 15 App Router on Vercel (Hobby plan)
- Client-side TikTok JSON parsing via Web Worker + Comlink
- 3 Claude API calls via AI SDK v6 generateObject with Zod schemas
- Prompt execution: Sequential-then-parallel (Prompt 1 → Prompts 2+3)
- Schedule section is deterministic (no LLM call)
- Progressive streaming: sections render as each prompt completes
- Privacy: raw data never leaves browser, only aggregated stats sent to API
- Rate limiting: 5/IP/day + Turnstile CAPTCHA + global budget cap (50 reports/day)

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Commands

```bash
# Dev
cd packages/web && npm run dev

# Tests
npm test                    # All tests
npm run test:eval           # Claude prompt eval tests (requires API key)

# Deploy
vercel deploy               # Preview
vercel deploy --prod        # Production
```

## Key Files

- `packages/core/parser.ts` — Port of build_db.py, parses TikTok JSON
- `packages/core/prompts.ts` — 3 Claude prompt templates + Zod schemas
- `packages/core/aggregator.ts` — CreatorDNASummary builder
- `packages/web/app/api/analyze/route.ts` — API route, sequential-then-parallel prompts
- `DESIGN.md` — Complete design system (colors, typography, spacing, motion)

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.

Key routing rules:
- Product ideas, brainstorming → invoke office-hours
- Bugs, errors, "why is this broken" → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
