# Minecraft Dungeons 2 — Items Showcase

A fast, dark, cinematic **Astro** website that renders the `items.json` item
catalogue (weapons, armor, artifacts, talismans) in the style of the official
"About Dungeons II" marketing page. Deployed as a GitHub Pages *project* site.

> **Fan-made, unofficial.** Not affiliated with or endorsed by Mojang /
> Microsoft. Item data and icons are sourced from the third-party Minecraft
> Wiki.

## Features

- Cinematic hero landing.
- Items grouped by section, as a responsive card grid.
- Card shows icon, name, type, and rarity pips.
- Click a card → detail modal: description, effects, compatible effects (with
  % ranges), and variants.
- Full-text search (name / description / effects / variants).
- Rarity filter (Common / Rare / Special / Unique).
- Empty state when nothing matches.
- Accessible, keyboard-navigable modal (overlay click, `Esc`, close button).
- Broken/missing icons degrade to a placeholder; missing optional fields render
  gracefully.

## Architecture

- **Stack:** Astro (static output) + TypeScript, dark theme via CSS custom
  properties. No Tailwind.
- **Catalogue seam:** `src/lib/catalogue.ts` — a pure, UI-free module that
  normalizes the raw `items.json` into UI shapes (rarity ordering, variant
  coercion, search index, filter/search/sort predicates). Fully unit-tested.
- **Build-time data:** `src/lib/load.ts` reads + normalizes `items.json` at
  build time. **No runtime data fetch** (ADR-0001).
- **Client view:** `src/scripts/catalogue-view.ts` — a single small island that
  wires search, rarity filter, modal, and empty-state over the server-rendered
  HTML (progressive enhancement). The full catalogue + per-item search index are
  embedded as an in-page JSON blob.
- **Base path:** `/minecraft-dungeons-2/` — all internal links/assets are
  prefixed for the GitHub Pages project-site URL.

## Data model (invariants, see `CONTEXT.md`)

`Item { name, icon, description, type, rarity[], effects[], compatibleEffects[],
variants: string[] }` · `Section { category, description, items[] }`.
Rarity tiers order `Common < Rare < Special < Unique`. Optional fields are
tolerated; a single `variants` string is coerced to a one-element array.

## Develop

```sh
npm install
npm run dev       # local dev server
npm test          # Vitest (pure catalogue module + client-view behavior)
npm run typecheck # astro check
npm run build     # static output → dist/
npm run preview   # serve dist/
```

## Deploy

`.github/workflows/deploy.yml` builds on `main` and publishes `dist/` to GitHub
Pages. In the repo Settings → Pages, use the **GitHub Actions** deployment
source (the workflow uploads `dist` and deploys it).
