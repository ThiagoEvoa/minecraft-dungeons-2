import { normalizeCatalogue, type Catalogue, type RawCatalogue } from "./catalogue";
// Single source of truth at repo root (ADR-0001). Read at build time only;
// the runtime never fetches this.
import raw from "../../items.json";

/**
 * Build-time entry point: read + normalize the raw `items.json` catalogue into
 * the UI-consumable shape. No network, no runtime dependency.
 */
export function loadCatalogue(): Catalogue {
  return normalizeCatalogue(raw as RawCatalogue);
}

export const catalogue: Catalogue = loadCatalogue();
