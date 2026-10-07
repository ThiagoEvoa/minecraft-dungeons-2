// @ts-check
import { defineConfig } from "astro/config";

// GitHub Pages *project* site: the catalogue lives under /<repo-name>/.
// Base path must be respected by every internal link/asset (ADR-0001 invariant).
export default defineConfig({
  site: "https://thiagoevoa.github.io",
  base: "/minecraft-dungeons-2",
  build: {
    // Pure static output — deployed as a GitHub Pages project site.
    // Catalogue is embedded at build time; no runtime data dependency.
  },
});
