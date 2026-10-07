# Domain Context & Glossary

Ubiquitous language for the **Minecraft Dungeons 2 — Items Showcase** website.
This file is a glossary only: no implementation details, file paths, or framework references.

## Item
A piece of equipable game content (weapon, armor, artifact, or talisman) from *Minecraft Dungeons 2*.
Each Item has a Name, an Icon image, a Description, a Type, one or more Rarity tiers, a list of Effects,
a list of Compatible Effects, and optionally a list of Variants.
- **Invariants:**
  - Every Item belongs to exactly one Section.
  - Every Item has a Name, an Icon URL, a Type, and at least one Rarity tier.
  - Variants are optional; when absent, an Item has no Variants.

## Section
A top-level grouping of Items by content family, each with its own title and a short Description.
The catalogue currently comprises six Sections: Melee weapons, Ranged weapons, Unavailable content,
Armor, Artifacts, Talismans.
- **Invariants:**
  - A Section contains zero or more Items.
  - Sections and their Items are presented in catalogue order.

## Rarity
The quality tier(s) of an Item. An Item's rarity is an **ordered list of rarity tiers**, not a single value.
Tiers are ordered from lowest to highest: **Common < Rare < Special < Unique**.
- **Invariants:**
  - A tier is present when it appears in the Item's rarity list.
  - `Unique` denotes a singular, one-of-a-kind Item.
  - Multi-tier lists (e.g. Common→Rare→Special) represent an Item whose tier scales with game progress.

## Type
A finer classification of an Item within a Section (e.g. "Melee Weapon", "Ranged Weapon").
Type is a display label, not a filter dimension by default.

## Effect
A guaranteed gameplay property of an Item (its baseline behavior), expressed as free text.
An Item may have zero or more Effects.

## Compatible Effect
An optional, equippable modifier an Item can be enhanced with. Each has a Name, a Description, and a
percentage Range (e.g. "20%–30%"). An Item may have zero or more Compatible Effects.
- **Invariants:**
  - A Compatible Effect carries a percentage Range, not a fixed value.

## Variant
An alternate version of an Item. Variants may be recorded either as a single value or as a collection;
the domain treats them uniformly as a **list of strings**.

## Catalogue
The complete, versioned collection of Sections and Items rendered by the site. It is the single source of
truth consumed by the site at build time.

## Icon
The rendered image of an Item, sourced from an external wiki host. Icons are referenced by absolute URL,
not bundled locally.

## Base Path
The URL prefix under which the site is served. On a GitHub *project* site the Catalogue lives under
`/<repository-name>/`; all internal links and assets must be prefixed accordingly.

## Disclaimer
A notice stating the site is a fan-made, unofficial project not affiliated with the rights holders, and that
content/icons are sourced from third-party wikis.
