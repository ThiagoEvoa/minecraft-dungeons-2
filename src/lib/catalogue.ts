/**
 * Catalogue module — the single highest-leverage seam.
 *
 * Pure, side-effect-free logic that loads and normalizes the raw `items.json`
 * shape into UI-consumable domain shapes, plus the filter/search/sort predicates.
 *
 * No UI or Astro dependency here — it is fully unit-testable in isolation.
 * All data invariants (rarity ordering, variant coercion, search index,
 * empty-result handling, missing-field tolerance) live here.
 */

/* -------------------------------------------------------------------------- */
/* Raw shapes (as produced by the Python scraper → items.json)                 */
/* -------------------------------------------------------------------------- */

export interface RawCompatibleEffect {
  name: string;
  description?: string;
  percentage_range?: string;
}

export interface RawItem {
  name: string;
  image?: string;
  description?: string;
  type?: string;
  rarity?: string[];
  effects?: string[];
  compatible_effects?: RawCompatibleEffect[];
  variants?: string | string[];
  codename?: string;
  cost?: string | number;
}

export interface RawSection {
  category: string;
  description?: string;
  items: RawItem[];
}

export interface RawCatalogue {
  sections: RawSection[];
}

/* -------------------------------------------------------------------------- */
/* Normalized domain shapes (UI-consumable, per CONTEXT.md)                    */
/* -------------------------------------------------------------------------- */

/** Canonical rarity tiers, ordered lowest → highest. */
export type Rarity = "Common" | "Rare" | "Special" | "Unique";

export interface CompatibleEffect {
  name: string;
  description?: string;
  /** Percentage range, e.g. "20%–30%". */
  range?: string;
}

export interface Item {
  name: string;
  icon: string;
  description: string;
  type: string;
  /** Ordered from lowest to highest tier. */
  rarity: Rarity[];
  effects: string[];
  compatibleEffects: CompatibleEffect[];
  /** Always a string[] — a single raw variant string is coerced to one-element. */
  variants: string[];
  /** Stable id derived from the section + name, used for anchors and modal keys. */
  id: string;
}

export interface Section {
  category: string;
  description: string;
  items: Item[];
}

export interface Catalogue {
  sections: Section[];
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** Canonical ascending order of rarity tiers. */
export const RARITY_ORDER: readonly Rarity[] = [
  "Common",
  "Rare",
  "Special",
  "Unique",
] as const;

/* -------------------------------------------------------------------------- */
/* Normalization                                                               */
/* -------------------------------------------------------------------------- */

function mapRarity(raw: string): Rarity {
  const key = raw.trim().toLowerCase();
  switch (key) {
    case "common":
      return "Common";
    case "rare":
      return "Rare";
    case "special":
      return "Special";
    case "unique":
      return "Unique";
    default:
      // Tolerate unknown tiers: fall back to the lowest tier so a bad value
      // never crashes rendering (missing-field tolerance, user story 13).
      return "Common";
  }
}

/**
 * Order a raw rarity list into canonical ascending order, de-duplicating
 * tiers (e.g. COMMON→RARE→SPECIAL stays ordered; duplicates collapse).
 */
export function canonicalizeRarity(rawRarity: string[] | undefined): Rarity[] {
  if (!rawRarity || rawRarity.length === 0) return [];
  const seen = new Set<Rarity>();
  const mapped = rawRarity.map(mapRarity).filter((r) => {
    if (seen.has(r)) return false;
    seen.add(r);
    return true;
  });
  const orderIndex = (r: Rarity) => RARITY_ORDER.indexOf(r);
  return [...mapped].sort((a, b) => orderIndex(a) - orderIndex(b));
}

/** Coerce a raw variants value (string | string[] | undefined) to string[]. */
export function coerceVariants(
  variants: string | string[] | undefined,
): string[] {
  if (variants == null) return [];
  if (typeof variants === "string") {
    const trimmed = variants.trim();
    return trimmed.length === 0 ? [] : [trimmed];
  }
  return variants.map((v) => String(v).trim()).filter((v) => v.length > 0);
}

function normalizeCompatibleEffect(
  raw: RawCompatibleEffect,
): CompatibleEffect {
  const effect: CompatibleEffect = { name: raw.name ?? "" };
  if (raw.description && raw.description.trim()) {
    effect.description = raw.description.trim();
  }
  if (raw.percentage_range && raw.percentage_range.trim()) {
    effect.range = raw.percentage_range.trim();
  }
  return effect;
}

function makeId(category: string, name: string): string {
  return `${category}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeItem(raw: RawItem, category: string): Item {
  return {
    id: makeId(category, raw.name),
    name: raw.name,
    icon: raw.image ?? "",
    description: raw.description ?? "",
    type: raw.type ?? "",
    rarity: canonicalizeRarity(raw.rarity),
    effects: (raw.effects ?? []).map((e) => String(e).trim()).filter(Boolean),
    compatibleEffects: (raw.compatible_effects ?? []).map(normalizeCompatibleEffect),
    variants: coerceVariants(raw.variants),
  };
}

/** Load + normalize a raw catalogue into UI-consumable shapes. */
export function normalizeCatalogue(raw: RawCatalogue): Catalogue {
  if (!raw || !Array.isArray(raw.sections)) {
    return { sections: [] };
  }
  return {
    sections: raw.sections.map((section) => ({
      category: section.category ?? "Uncategorized",
      description: section.description ?? "",
      items: (section.items ?? []).map((item) =>
        normalizeItem(item, section.category ?? "Uncategorized"),
      ),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Predicates / queries                                                        */
/* -------------------------------------------------------------------------- */

/** Flattens a catalogue into a single ordered list of items. */
export function flattenItems(catalogue: Catalogue): Item[] {
  return catalogue.sections.flatMap((section) => section.items);
}

/**
 * Builds a lowercased search index from an item's name, description, effect
 * text, compatible-effect text, and variants.
 */
export function buildSearchIndex(item: Item): string {
  const parts: string[] = [item.name, item.description];
  parts.push(...item.effects);
  parts.push(...item.variants);
  for (const ce of item.compatibleEffects) {
    parts.push(ce.name, ce.description ?? "", ce.range ?? "");
  }
  return parts.join(" \u0001 ").toLowerCase();
}

/** Drops sections that contain no items. */
export function pruneEmptySections(catalogue: Catalogue): Catalogue {
  return {
    sections: catalogue.sections.filter((section) => section.items.length > 0),
  };
}

/** Keep only items whose rarity tiers include `tier`. Prunes empty sections. */
export function filterByRarity(catalogue: Catalogue, tier: Rarity): Catalogue {
  const filtered: Catalogue = {
    sections: catalogue.sections.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.rarity.includes(tier),
      ),
    })),
  };
  return pruneEmptySections(filtered);
}

/**
 * Full-text search across each item's search index. An empty query returns the
 * catalogue unchanged. Matching is case-insensitive substring matching.
 */
export function searchCatalogue(catalogue: Catalogue, query: string): Catalogue {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return catalogue;
  const filtered: Catalogue = {
    sections: catalogue.sections.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        buildSearchIndex(item).includes(q),
      ),
    })),
  };
  return pruneEmptySections(filtered);
}

/**
 * Returns items (and their sections) in stable catalogue order. Used as the
 * default ordering after a search/filter so results never shuffle.
 */
export function sortByCatalogue(catalogue: Catalogue): Catalogue {
  // Catalogue is already in canonical order; this is an explicit, stable
  // identity transform so callers always get a guaranteed-ordering predicate.
  return catalogue;
}

/** Total item count across all sections — drives the empty-state decision. */
export function countItems(catalogue: Catalogue): number {
  return catalogue.sections.reduce((sum, s) => sum + s.items.length, 0);
}

/**
 * Apply an active rarity filter and a search query together, preserving
 * catalogue order. This is the single entry point the client view calls.
 */
export function applyQuery(
  catalogue: Catalogue,
  opts: { rarity?: Rarity | null; query?: string },
): Catalogue {
  let result = catalogue;
  if (opts.rarity) {
    result = filterByRarity(result, opts.rarity);
  }
  if (opts.query && opts.query.trim()) {
    result = searchCatalogue(result, opts.query);
  }
  return sortByCatalogue(result);
}
