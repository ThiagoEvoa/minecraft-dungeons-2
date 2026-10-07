#!/usr/bin/env python3
"""Scrape Minecraft Dungeons II gear and talisman pages into JSON."""

import argparse
import json
import re
import time
from urllib.parse import urljoin
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

BASE = "https://minecraft.wiki"
URL = f"{BASE}/w/Dungeons_II:Item"
EFFECT_URL = f"{BASE}/w/Dungeons_II:Effect"
HEADERS = {"User-Agent": "MinecraftItemDataBot/1.0 (personal use)"}

# Top-level (h2) index sections to scrape. Sub-sections (h3) are included when
# their owning h2 is listed here. Wiki nav/gallery panels are excluded.
TARGET_SECTIONS = {"Gear", "Talismans"}


def fetch(url):
    request = Request(url, headers=HEADERS)
    with urlopen(request, timeout=30) as response:
        return BeautifulSoup(response.read(), "html.parser")


def clean_text(node):
    return " ".join(node.get_text(" ", strip=True).split())


def build_effect_index(soup):
    """Map each effect to its description template from the #Effect table.

    The Effect page lists every status/attack effect as a table row:
     ``Effect | Description | I | II | III | Unique | ...``. The description
    cell is a template containing an ``X%`` placeholder, e.g.
     ``"Increases the area of all positive status effects by X%."``. Both the
    effect's fragment id (``#Totem_Radius``) and its plain name (``Totem
    Radius``) are keyed so lookups work by either. Fetched once and reused for
    every armor piece.
    """
    index = {}
    content = soup.select_one("#mw-content-text .mw-parser-output")
    if not content:
        return index
    for table in content.select("table.wikitable"):
        for row in table.select("tr"):
            cells = row.find_all(["td", "th"], recursive=False)
            if len(cells) < 2:
                continue
            name = clean_text(cells[0])
            template = clean_text(cells[1])
            if not name or name.lower() in {"effect", "description"}:
                continue
            index[name] = template
            if row.get("id"):
                index[row.get("id")] = template
    return index


def split_rarity(value):
    """Split a rarity string like ``"COMMON / RARE / SPECIAL"`` into a list.

    Returns ``["COMMON", "RARE", "SPECIAL"]`` (whitespace-trimmed, empty parts
    dropped) or ``None`` when the value is absent, keeping ``rarity: null`` for
    items that carry no rarity row.
    """
    if not value:
        return None
    return [part.strip() for part in value.split("/") if part.strip()]


def _extract_modifier(cell):
    """Pull the parenthesized value from a cell like ``Totem Radius (55%)``.

    Returns ``"55%"`` (no parens) or ``None`` when no parenthesized value is
    present. This value is the effect's tier/Unique percentage that fills the
    template's ``X%`` placeholder.
    """
    match = re.search(r"\(([^)]+)\)", clean_text(cell))
    return match.group(1) if match else None


def resolve_unique_effect(cell, effect_index):
    """Resolve an armor-set effect cell to its full description text.

    The cell renders ``"Totem Radius (55%)"`` where ``Totem Radius`` links to
     ``Dungeons_II:Effect#Totem_Radius``. That page's row holds the
    description template (``...by X%.``); substituting the cell's modifier
     (``55%``) for ``X%`` yields
     ``"Increases the area of all positive status effects by 55%."``.
    Falls back to the raw cell text when there is no effect link, no matching
    template, or no placeholder to substitute.
    """
    raw = clean_text(cell)
    link = cell.find("a", href=True)
    if link and "Dungeons_II:Effect" in link.get("href", ""):
        href = link.get("href", "")
        fragment = href.split("#", 1)[1] if "#" in href else None
        template = effect_index.get(fragment) if fragment else None
        if template is None:
            template = effect_index.get(clean_text(link))
        if template:
            modifier = _extract_modifier(cell)
            if modifier and "X%" in template:
                return template.replace("X%", modifier)
            return template if not modifier else raw
    return raw


def _extract_percentage_range(text):
    """Pull percentages like ``10%`` out of effect text.

    Returns a single value (``"10%"``), a min–max span (``"10%–35%"``) when the
    text carries more than one percentage, or ``None`` when it carries none.
    """
    matches = re.findall(r"\d+(?:\.\d+)?%", text)
    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]
    numbers = sorted(float(value.rstrip("%")) for value in matches)
    return f"{numbers[0]:g}%–{numbers[-1]:g}%"


def parse_tiers(content):
    """Parse the talisman #Tiers table (Tier | Effect) into effect entries.

    Each tier row yields an entry with the effect's ``description`` (the effect
    text, which bakes in that tier's percentage) and ``percentage_range`` (the
    percentage(s) parsed out of that text). Talismans source their effects here
    rather than from a #Compatible_effects table.
    """
    effects = []
    heading = content.select_one("#Tiers")
    if not heading:
        return effects
    table = heading.find_parent().find_next_sibling("table", class_="wikitable")
    if not table:
        return effects
    for row in table.select("tr")[1:]:       # skip header row
        cells = row.find_all(["td", "th"], recursive=False)
        if len(cells) < 2:
            continue
        description = clean_text(cells[1])
        if not description:
            continue
        effects.append({
            "description": description,
            "percentage_range": _extract_percentage_range(description),
        })
    return effects


def parse_unique_effects(content, effect_index):
    """Parse the armor-set #Unique_effects table (Item | Unique effect).

    The wiki maps each sub-item (piece: top hat, overcoat, trousers, loafers)
    to its fixed, non-rerollable effect. Each effect is resolved to its full
    description (see ``resolve_unique_effect``) so the consumer gets readable
    text like ``"Increases the area of all positive status effects by 55%.```
    """
    unique_effects = []
    heading = content.select_one("#Unique_effects")
    if not heading:
        return unique_effects
    table = heading.find_parent().find_next_sibling("table", class_="wikitable")
    if not table:
        return unique_effects
    for row in table.select("tr")[1:]:      # skip header row
        cells = row.find_all(["td", "th"], recursive=False)
        if len(cells) < 2:
            continue
        piece = clean_text(cells[0])
        effect = resolve_unique_effect(cells[1], effect_index)
        if not piece or not effect:
            continue
        unique_effects.append({"item": piece, "effect": effect})
    return unique_effects


def scrape_item(url, effect_index=None):
    effect_index = effect_index or {}
    soup = fetch(url)
    content = soup.select_one("#mw-content-text .mw-parser-output")
    if not content:
        return {
            "image": None,
            "description": None,
            "type": None,
            "rarity": None,
            "effects": [],
            "compatible_effects": [],
        }

    image_node = content.select_one(".infobox-imagearea img")
    image_url = urljoin(BASE, image_node.get("src", "")) if image_node and image_node.get("src") else None
    paragraphs = [clean_text(p) for p in content.find_all("p", recursive=False)]
    paragraphs = [p for p in paragraphs if p]
    details = {}
    infobox = content.select_one(".infobox-rows")
    if infobox:
        for row in infobox.select("tr"):
            heading = row.find("th", recursive=False)
            value_cell = row.find("td", recursive=False)
            if heading and value_cell:
                key = clean_text(heading)
                value = clean_text(value_cell)
                if key in {"Effects", "Type", "Rarity"} and value:
                    details[key] = value

    item_type = details.get("Type")

    if item_type == "Talisman":
         # Talismans source their effects from the #Tiers table and carry no
         # compatible-effects table, so compatible_effects is omitted.
        effects = parse_tiers(content)
    else:
        compatible_heading = content.select_one("#Compatible_effects")
        compatible_effects = []
        if compatible_heading:
            table = compatible_heading.find_parent().find_next("table", class_="wikitable")
            if table:
                for row in table.select("tr"):
                    cells = row.find_all(["th", "td"], recursive=False)
                    if len(cells) < 2:
                        continue
                    name = clean_text(cells[0])
                    if not name or name.lower() in {"effect", "effects"}:
                        continue
                    values = [clean_text(cell) for cell in cells[2:]]
                    values = [value for value in values if value]
                    percentage_range = None
                    if values:
                        percentage_range = values[0] if len(values) == 1 else f"{values[0]}–{values[-1]}"
                    compatible_effects.append({
                         "name": name,
                         "description": clean_text(cells[1]),
                         "percentage_range": percentage_range,
                     })

        # Armor sets: the #Unique_effects table (Item | Unique effect)
        # is broken down to per-piece entries and filled into effects.
        effects = [details["Effects"]] if details.get("Effects") else []
        effects.extend(parse_unique_effects(content, effect_index))

    result = {
        "image": image_url,
        "description": paragraphs[0] if paragraphs else None,
        "type": item_type,
        "rarity": split_rarity(details.get("Rarity")),
        "effects": effects,
    }
    if item_type != "Talisman":
        result["compatible_effects"] = compatible_effects
    return result

def collect_sections(content):
    """Walk the index page and group item links under their section headings.

    Each section keeps only its *direct* body (stops at the next heading of any
    level), so sub-sections (e.g. the h3 categories under "Gear") are collected
    independently and an h2 that only holds sub-sections yields no items.
    Redlink / edit-only links are filtered out before they are fetched.
    """
    headings = [
        h for h in content.find_all(["h2", "h3"])
        if h.get("id") and h.get("id") != "mw-toc-heading"
    ]
    sections = []
    for heading in headings:
        level = 2 if heading.name == "h2" else 3
        owning = heading.get("id") if level == 2 else nearest_h2_id(heading)
        if owning not in TARGET_SECTIONS:
            continue
        items, description = collect_section_body(heading)
        if not items:
            continue
        sections.append({
            "category": heading.get_text(" ", strip=True),
            "description": description,
            "items": items,
        })
    return sections


def nearest_h2_id(heading):
    """Id of the closest preceding h2 (the section's owning top-level)."""
    h2 = heading.find_previous("h2")
    if not h2 or not h2.get("id") or h2.get("id") == "mw-toc-heading":
        return None
    return h2.get("id")


def collect_section_body(heading):
    """Item links + description within a heading's direct body."""
    items = []
    description = None
    seen = set()
    for element in heading.find_all_next():
        if element.name in ("h2", "h3") and element.get("id") \
                and element.get("id") != "mw-toc-heading":
            break
        if description is None and element.name == "p":
            text = clean_text(element)
            if text and "Main article" not in text:
                description = text
        for anchor in element.find_all("a", href=True):
            href = anchor.get("href", "")
            if "redlink=1" in href or "action=edit" in href:
                continue
            label = anchor.find("span", class_="sprite-text")
            if not label or not href.startswith("/w/Dungeons_II:"):
                continue
            if "Dungeons_II:Item" in href:
                continue
            name = clean_text(label)
            if not name or name in seen:
                continue
            seen.add(name)
            items.append({"name": name, "url": f"{BASE}{href}"})
    return items, description


def main():
    parser = argparse.ArgumentParser(
        description="Scrape Minecraft Dungeons II item pages into JSON.",
    )
    parser.add_argument(
        "--output", default="items.json",
        help="Path to write JSON (default: items.json).",
    )
    parser.add_argument(
        "--delay", type=float, default=0.3,
        help="Seconds to wait between item requests (default: 0.3).",
    )
    args = parser.parse_args()

    print(f"Fetching index: {URL}")
    content = fetch(URL).select_one("#mw-content-text .mw-parser-output")
    if not content:
        print("Could not locate page content. Aborting.")
        return 1

    # Fetch the Effect page once and build a name/fragment -> description
    # template index so armor pieces can resolve their linked effects.
    effect_index = {}
    try:
        print(f"Fetching effect index: {EFFECT_URL}")
        effect_index = build_effect_index(fetch(EFFECT_URL))
        print(f"Built effect index with {len(effect_index)} entries.")
    except (HTTPError, URLError, TimeoutError) as error:
        print(f"Warning: could not build effect index ({error}); "
              "unique effects will fall back to raw text.")

    sections = collect_sections(content)
    total = sum(len(section["items"]) for section in sections)
    print(f"Found {len(sections)} sections, {total} items.\n")

    results = []
    for section in sections:
        items = section["items"]
        header = f"== {section['category']} — {len(items)} items =="
        print(header)
        scraped = []
        for index, entry in enumerate(items, start=1):
            name = entry["name"]
            data = None
            for attempt in range(3):
                try:
                    data = scrape_item(entry["url"], effect_index)
                    break
                except (HTTPError, URLError, TimeoutError) as error:
                    if attempt == 2:
                        print(f"   [{index}/{len(items)}] FAIL {name}: {error}")
                    else:
                        time.sleep(1 * (attempt + 1))
            if data is None:
                continue
            item = {
                 "name": name,
                 "image": data["image"],
                 "description": data["description"],
                 "type": data["type"],
                 "rarity": data["rarity"],
                 "effects": data["effects"],
             }
            if "compatible_effects" in data:
                item["compatible_effects"] = data["compatible_effects"]
            scraped.append(item)
            print(f"   [{index}/{len(items)}] ok   {name}")
            time.sleep(args.delay)
        results.append({
            "category": section["category"],
            "description": section["description"],
            "items": scraped,
        })

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump({"sections": results}, handle, indent=2, ensure_ascii=False)

    scraped_total = sum(len(section["items"]) for section in results)
    print(f"\nWrote {scraped_total} items across {len(results)} sections "
          f"to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
