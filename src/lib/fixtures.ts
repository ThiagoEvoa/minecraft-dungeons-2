import { normalizeCatalogue, type RawCatalogue } from "./catalogue";

/**
 * Fixtures derived from real `items.json` slices — cover the invariants the
 * Catalogue module owns: rarity ordering, variant coercion, missing fields,
 * search index, and empty-result handling.
 */

export const sampleRaw: RawCatalogue = {
  sections: [
    {
      category: "Melee weapons",
      description: "Melee weapons are enchantable close-ranged gear.",
      items: [
        {
          name: "Battle Hammer",
          image: "https://minecraft.wiki/images/BattleHammer.png",
          description: "A heavy melee weapon.",
          type: "Melee Weapon",
          rarity: ["COMMON", "RARE", "SPECIAL"],
          effects: ["Attacks deal 10% extra damage."],
          compatible_effects: [
            {
              name: "Bounty Hunter",
              description: "Deal X% more damage to wounded enemies.",
              percentage_range: "20%–30%",
            },
          ],
          variants: "Greataxe",
          codename: "Hammer",
        },
        {
          name: "Awesomeaxe",
          image: "https://minecraft.wiki/images/Awesomeaxe.png",
          description: "A unique melee weapon that grants strength on impact.",
          type: "Melee Weapon",
          rarity: ["UNIQUE"],
          effects: ["Attacks have a 70% chance to grant the Strength status."],
          compatible_effects: [],
        },
      ],
    },
    {
      category: "Armor",
      description: "Armor reduces incoming damage.",
      items: [
        // Missing: image, description, type, rarity, effects, variants.
        { name: "Mystery Plate" },
      ],
    },
    {
      category: "Empty section",
      description: "A section with no items.",
      items: [],
    },
  ],
};

export const sampleCatalogue = normalizeCatalogue(sampleRaw);

/** A minimal catalogue with a single searchable item, for query tests. */
export const singleItemRaw: RawCatalogue = {
  sections: [
    {
      category: "Artifacts",
      description: "Reusable utility items.",
      items: [
        {
          name: "Golden Apple",
          image: "x",
          description: "Restores health when consumed.",
          type: "Artifact",
          rarity: ["COMMON"],
          effects: ["Heals 4 health."],
          compatible_effects: [],
          variants: ["Enchanted Golden Apple"],
        },
      ],
    },
  ],
};
