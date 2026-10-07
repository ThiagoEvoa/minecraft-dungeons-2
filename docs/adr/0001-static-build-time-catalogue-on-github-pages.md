# 1. Static build-time catalogue deployed to GitHub Pages

Date: 2025-07-07
Status: Accepted

## Context & Problem Statement
The site must present a *Minecraft Dungeons 2* item catalogue (currently 178 items across 6 Sections)
in the style of the official "About Dungeons II" marketing page. The catalogue lives in a single
`items.json` file already present in the repository. Two coupled decisions were required:

1. **Where/How is the site hosted?** The user requested GitHub Pages, which serves a *project* site under
   a repository-specific URL prefix.
2. **How is catalogue data loaded?** At build time (embedded into generated pages) or at runtime (fetched
   over the network)?

## Considered Options
- **Option A — Static build-time embed + GitHub Pages:** Catalogue is read and inlined at build time; the
  site is served as pre-rendered static HTML under `/minecraft-dungeons-2/`.
  - Pros: zero runtime data dependency, fast, SEO-friendly, no CORS/host coupling, works fully offline.
  - Cons: data updates require a rebuild; large inlining if the catalogue grows very large.
- **Option B — Runtime fetch + client rendering:** Catalogue fetched at runtime from a JSON endpoint.
  - Pros: live updates without rebuild.
  - Cons: slower, needs a host with CORS, degrades offline/SEO, extra failure modes.
- **Option C — User/org GitHub Pages (root URL):** Serves at domain root, no prefix.
  - Pros: clean base URL.
  - Cons: unavailable for a personal project without a dedicated custom domain.

## Decision Outcome
Chosen: **Option A** — static build-time embed deployed to a GitHub *project* site.
The build must configure the **Base Path** to `/minecraft-dungeons-2/` and prefix all internal links and
asset references accordingly. This is the load-bearing constraint that makes static hosting work on
GitHub project pages.

### Positive Consequences
- No runtime data dependency; fast loads, good SEO, no CORS.
- Catalogue in-repo stays the single source of truth; rebuild = publish.
- Simple, low-cost hosting via GitHub's native Pages.

### Negative Consequences / Trade-offs
- Data refreshes require a rebuild + push (acceptable; the catalogue updates via a scraper run).
- Base-path prefix must be respected everywhere; a missed prefix breaks links/assets on the live site.
- Very large future catalogues could bloat inlined output (mitigation: code-split / paginate later).

## Invariants & Rules
- All internal navigation links and asset URLs **must** be Base-Path aware.
- The Catalogue is embedded at build time; the runtime must **not** depend on fetching `items.json`.
- The deployment target is a GitHub **project** site; the base URL carries the repository name prefix.
- Any future move to a custom-domain/user page requires revisiting this ADR (the prefix changes).
