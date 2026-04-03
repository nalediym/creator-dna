# Design System — Creator DNA

## Product Context
- **What this is:** A free tool that analyzes TikTok consumption data and reveals what content you should create. The data is the permission slip.
- **Who it's for:** Heavy TikTok consumers (20K+ videos watched) who want to become creators but are blocked by niche uncertainty + imposter syndrome + no strategy.
- **Space/industry:** Personal insight reveal (peers: Spotify Wrapped, 23andMe results, personality tests). NOT analytics dashboards (Pentos, Exolyt).
- **Project type:** Web app (Next.js) + CLI. Single-column editorial report as the core experience.

## Aesthetic Direction
- **Direction:** Luxury/Organic hybrid
- **Decoration level:** Intentional (subtle grain texture on backgrounds, warm gradients on surfaces, no decorative shapes or blobs)
- **Mood:** Intimate, warm, confident, precious. Like receiving a personal letter from a mentor who believes in you. NOT corporate, NOT dashboard-y, NOT generic SaaS. The product reveals something valuable about the user, so the design should feel valuable.
- **Anti-patterns:** No purple gradients. No 3-column feature grids. No icons in colored circles. No centered everything. No generic hero copy ("Unlock the power of..."). No bubbly uniform border-radius. No decorative blobs.
- **Reference:** Spotify Wrapped's emotional reveal structure, 23andMe's bold-but-approachable data presentation. The deliberately anti-AI aesthetic of Wrapped 2025 (texture, grain, analog feel vs. polished AI slop).

## Typography
- **Display/Hero:** Instrument Serif (400 weight). Warm, refined, personal. The serif says "this is a letter, not a dashboard." Distinctive in a category that defaults to sans-serif.
- **Body:** DM Sans (300-600 weight range). Clean, warm x-height, excellent readability on dark backgrounds. Optical sizing 9-40.
- **UI/Labels:** JetBrains Mono (300-500 weight). Section labels, data counts, badges, percentages. Uppercase with 0.15em letter-spacing for section markers.
- **Data/Tables:** JetBrains Mono (300 weight, tabular-nums for alignment).
- **Code:** JetBrains Mono.
- **Loading:** Google Fonts CDN. Preconnect to fonts.googleapis.com and fonts.gstatic.com. Display: swap.
- **Scale:**
  - Hero: 48px / Instrument Serif / 400
  - H1: 36px / Instrument Serif / 400
  - H2: 24px / Instrument Serif / 400
  - H3: 20px / Instrument Serif / 400
  - Body: 16px / DM Sans / 400
  - Body small: 14px / DM Sans / 400
  - Caption: 13px / DM Sans / 400
  - Label: 11px / JetBrains Mono / 500 / uppercase / 0.15em spacing
  - Data large: 32-48px / JetBrains Mono / 300
  - Badge: 12px / JetBrains Mono / 400

## Color
- **Approach:** Restrained. Gold is the ONLY accent. Every other data product defaults to blue. Gold says "precious, earned, yours." One accent color forces discipline.
- **CSS custom properties (use these, not hex values in code):**

```css
:root {
  --bg: #0a0a0a;
  --surface: #13110e;
  --surface-raised: #1a1714;
  --border: #2a2520;
  --border-subtle: #1f1c18;
  --text-primary: #f5ede3;
  --text-secondary: #b5a999;
  --text-muted: #6b6058;
  --text-faint: #4a4338;
  --accent: #c79253;
  --accent-dim: rgba(199, 146, 83, 0.15);
  --accent-glow: rgba(199, 146, 83, 0.08);
  --success: #5ba67a;
  --warning: #e8a87c;
  --error: #d4665a;
  --info: #7a9ec7;
}
```

- **Contrast ratios (WCAG AA):** --text-primary on --bg = 15.4:1 (AAA). --text-secondary on --bg = 7.2:1 (AAA). --accent on --bg = 5.8:1 (AA).
- **Dark mode:** This IS dark mode. No light mode in Phase 1. If added later: invert surfaces to warm whites (#faf7f2 bg, #13110e text), desaturate accent by 10%.
- **Background texture:** Subtle SVG grain noise at 3% opacity over --bg. Creates warmth and avoids flat black.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable (this is a reading experience, not a dashboard)
- **Scale:**
  - 2xs: 2px
  - xs: 4px
  - sm: 8px
  - md: 16px
  - lg: 24px
  - xl: 32px
  - 2xl: 48px
  - 3xl: 64px
- **Section spacing:** 64px between report sections. 32px internal padding.
- **Content max-width:** 680px (reading column). Centered with auto margins.

## Layout
- **Approach:** Single-column editorial. No sidebar. No grid of cards. The page scrolls like reading a personal letter.
- **Grid:** Single column, 680px max-width. Full-bleed for landing hero.
- **Max content width:** 680px for report, 500px for upload zone.
- **Border radius:**
  - sm: 4px (small UI elements)
  - md: 8px (buttons, inputs, alerts)
  - lg: 12px (niche cards, report sections)
  - xl: 16px (upload zone, share card)
  - full: 9999px (badges, pills)
- **Shadows:** NONE. No decorative shadows anywhere. Trust comes from contrast and hierarchy, not depth simulation.

## Motion
- **Approach:** Intentional. The streaming reveal is the signature animation.
- **Easing:**
  - Enter: ease-out (decelerate into rest)
  - Exit: ease-in (accelerate out)
  - Move: ease-in-out (smooth transitions)
- **Duration:**
  - Micro: 100-150ms (hover states, focus rings)
  - Short: 200-250ms (button presses, input focus)
  - Medium: 300-400ms (section entrance, card reveal)
  - Long: 500-700ms (confidence bar fill, number count-up)
- **Signature animations:**
  - Report sections: fade-in + translateY(16px) on entrance, ease-out 300ms
  - Confidence bars: width from 0% to value, ease-out 700ms, staggered 100ms
  - Data numbers: count from 0 to value, 500ms
  - Skeleton shimmer: gradient sweep, 1.5s infinite
- **Reduced motion:** If prefers-reduced-motion, disable all animations. Show content immediately. No shimmer.

## Component Patterns

### Upload Zone
- Dashed border (2px dashed --border), 16px radius
- Hover: border-color transitions to --accent, background gets --accent-glow
- Icon + primary text + hint text
- Accepts .json files only

### Niche Card
- No background box. Separated by bottom border (--border-subtle)
- Name in Instrument Serif 20px
- Confidence bar: 3px height, --border track, --accent fill
- Evidence text: 13px, --text-muted, strong tags for numbers

### Qualification Block
- Left border: 3px solid --accent
- Background: gradient from --surface-raised to --surface
- Stat number: JetBrains Mono 32px, --accent
- Supporting text: 14px, --text-secondary

### Video Idea Card
- Background: --surface, border: 1px solid --border, 12px radius
- Title: 16px --text-primary
- Hook: 14px --text-secondary, italic
- Format badge: 11px --text-muted, --surface-raised background

### Share Card (1080x1080 + 1080x1920)
- Background: --bg with radial accent glow
- Border: 1px solid --border, 12px radius
- Content: section label, niche name (Instrument Serif), confidence score (JetBrains Mono 48px --accent), CTA URL
- Feels like an achievement badge, not a screenshot

### Alerts
- Left border: 3px solid semantic color
- Background: semantic color at 10% opacity
- Text: semantic color

### Buttons
- Primary: --accent bg, #0a0a0a text, 8px radius. Hover: brightness 1.1
- Secondary: transparent bg, --text-primary text, 1px --border. Hover: border lightens
- Ghost: transparent, --accent text, no border. Hover: text lightens

## Trust Signals
- Green dot (--success, 6px circle) + privacy message
- "See exactly what we send" link to /privacy page
- "Your data never leaves your browser" messaging consistent everywhere

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-03 | Initial design system | Created by /design-consultation. Research: Spotify Wrapped, 23andMe, personality tests. Direction: luxury/organic hybrid, dark+gold, editorial layout. |
| 2026-04-03 | Instrument Serif for display | Deliberate risk: serif in a sans-serif category. Says "personal letter" not "SaaS dashboard." |
| 2026-04-03 | Gold-only accent | Deliberate risk: single accent color. Gold = precious, earned. Every competitor uses blue. |
| 2026-04-03 | No card containers | Deliberate risk: sections separated by dividers, not boxes. Document feel, not dashboard feel. |
