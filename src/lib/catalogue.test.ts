import { describe, it, expect } from "vitest";
import {
  normalizeCatalogue,
  canonicalizeRarity,
  coerceVariants,
  filterByRarity,
  searchCatalogue,
  sortByCatalogue,
  flattenItems,
  buildSearchIndex,
  pruneEmptySections,
  countItems,
  applyQuery,
  RARITY_ORDER,
  type RawCatalogue,
} from "./catalogue";
import {
  sampleCatalogue,
  singleItemRaw,
} from "./fixtures";

describe("canonicalizeRarity", () => {
  it("orders tiers ascending Common < Rare < Special < Unique", () => {
    expect(canonicalizeRarity(["SPECIAL", "COMMON", "UNIQUE"])).toEqual([
      "Common",
      "Special",
      "Unique",
    ]);
  });

  it("de-duplicates tiers", () => {
    expect(canonicalizeRarity(["RARE", "RARE", "COMMON"])).toEqual([
      "Common",
      "Rare",
    ]);
  });

  it("returns [] for missing or empty rarity (graceful degradation)", () => {
    expect(canonicalizeRarity(undefined)).toEqual([]);
    expect(canonicalizeRarity([])).toEqual([]);
  });

  it("tolerates unknown tiers by falling back to Common", () => {
    expect(canonicalizeRarity(["MYTHIC"])).toEqual(["Common"]);
  });

  it("canonical order matches CONTEXT.md", () => {
    expect(RARITY_ORDER).toEqual(["Common", "Rare", "Special", "Unique"]);
  });
});

describe("coerceVariants", () => {
  it("coerces a single string to a one-element array", () => {
    expect(coerceVariants("Greataxe")).toEqual(["Greataxe"]);
  });

  it("passes a string array through, trimming empties", () => {
    expect(coerceVariants(["A", "  ", "B"])).toEqual(["A", "B"]);
  });

  it("returns [] for absent variants", () => {
    expect(coerceVariants(undefined)).toEqual([]);
    expect(coerceVariants("")).toEqual([]);
  });
});

describe("normalizeCatalogue", () => {
  it("normalizes the sample catalogue shape", () => {
    const cats = sampleCatalogue;
    expect(cats.sections[0].items[0].rarity).toEqual([
      "Common",
      "Rare",
      "Special",
    ]);
    expect(cats.sections[0].items[0].variants).toEqual(["Greataxe"]);
    expect(cats.sections[0].items[1].variants).toEqual([]);
    expect(cats.sections[0].items[0].id).toBe("melee-weapons-battle-hammer");
  });

  it("tolerates items missing every optional field", () => {
    const mystery = sampleCatalogue.sections[1].items[0];
    expect(mystery).toMatchObject({
      name: "Mystery Plate",
      icon: "",
      description: "",
      type: "",
      rarity: [],
      effects: [],
      compatibleEffects: [],
      variants: [],
    });
  });

  it("normalizes compatible effects with range + description", () => {
    const ce = sampleCatalogue.sections[0].items[0].compatibleEffects[0];
    expect(ce).toEqual({
      name: "Bounty Hunter",
      description: "Deal X% more damage to wounded enemies.",
      range: "20%–30%",
    });
  });

  it("returns an empty catalogue for malformed input", () => {
    expect(normalizeCatalogue({} as RawCatalogue).sections).toEqual([]);
    expect(normalizeCatalogue(undefined as unknown as RawCatalogue)).toEqual({
      sections: [],
    });
  });
});

describe("pruneEmptySections", () => {
  it("drops sections with zero items", () => {
    const pruned = pruneEmptySections(sampleCatalogue);
    expect(pruned.sections.map((s) => s.category)).toEqual([
      "Melee weapons",
      "Armor",
    ]);
  });
});

describe("filterByRarity", () => {
  it("keeps items that include the requested tier", () => {
    const unique = filterByRarity(sampleCatalogue, "Unique");
    expect(unique.sections.map((s) => s.category)).toEqual(["Melee weapons"]);
    expect(unique.sections[0].items.map((i) => i.name)).toEqual([
      "Awesomeaxe",
    ]);
  });

  it("prunes sections that no longer match and excludes items with no rarity", () => {
    const common = filterByRarity(sampleCatalogue, "Common");
    // Battle Hammer (COMMON..SPECIAL) matches; Mystery Plate (no rarity) does not;
    // the Armor section is pruned entirely.
    expect(common.sections.map((s) => s.category)).toEqual(["Melee weapons"]);
    expect(common.sections[0].items.map((i) => i.name)).toEqual(["Battle Hammer"]);
  });

  it("excludes items with no rarity tier", () => {
    const common = filterByRarity(sampleCatalogue, "Common");
    // Battle Hammer (COMMON..SPECIAL) matches; Mystery Plate (no rarity) does not.
    expect(common.sections[0].items.map((i) => i.name)).toEqual([
      "Battle Hammer",
    ]);
  });
});

describe("searchCatalogue", () => {
  it("matches on name, description, effects, and variants (case-insensitive)", () => {
    expect(
      countItems(searchCatalogue(sampleCatalogue, "greataxe")),
    ).toBe(1);
    expect(
      countItems(searchCatalogue(sampleCatalogue, "strength status")),
    ).toBe(1);
    expect(
      countItems(searchCatalogue(sampleCatalogue, "HEAVY MELEE")),
    ).toBe(1);
  });

  it("returns the catalogue unchanged for an empty query", () => {
    const all = searchCatalogue(sampleCatalogue, "   ");
    expect(countItems(all)).toBe(3);
  });

  it("yields an empty catalogue (empty-state) when nothing matches", () => {
    const none = searchCatalogue(sampleCatalogue, "nonexistent-zzz");
    expect(countItems(none)).toBe(0);
    expect(none.sections).toEqual([]);
  });
});

describe("buildSearchIndex", () => {
  it("includes name, description, effects, compatible effects, and variants", () => {
    const [apple] = normalizeCatalogue(singleItemRaw).sections[0].items;
    const idx = buildSearchIndex(apple);
    expect(idx).toContain("golden apple");
    expect(idx).toContain("enchanted golden apple");
    expect(idx).toContain("heals 4 health");
  });
});

describe("sortByCatalogue", () => {
  it("preserves catalogue order", () => {
    const sorted = sortByCatalogue(sampleCatalogue);
    expect(
      sorted.sections.flatMap((s) => s.items.map((i) => i.name)),
    ).toEqual(
      flattenItems(sampleCatalogue).map((i) => i.name),
    );
  });
});

describe("applyQuery", () => {
  it("combines rarity filter and search, in catalogue order", () => {
    const result = applyQuery(sampleCatalogue, {
      rarity: "Unique",
      query: "awesome",
    });
    expect(result.sections[0].items.map((i) => i.name)).toEqual(["Awesomeaxe"]);
  });

  it("returns empty-state when combined query matches nothing", () => {
    const result = applyQuery(sampleCatalogue, {
      rarity: "Unique",
      query: "nonexistent",
    });
    expect(countItems(result)).toBe(0);
  });
});
