// @vitest-environment happy-dom
/**
 * Secondary seam — lightweight behavioral verification of the client view.
 * Builds a minimal DOM mirroring the server-rendered catalogue markup, runs
 * `initCatalogueView`, and asserts on observable outcomes: filtering, search,
 * empty-state, and modal open/close.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { initCatalogueView } from "./catalogue-view";

function buildDom(data: unknown): Document {
  const root = document.createElement("div");
  root.className = "catalogue-wrap";
  root.id = "catalogue";

  // search input + rarity filter buttons
  const search = document.createElement("input");
  search.id = "catalogue-search";
  search.type = "search";
  root.appendChild(search);
  for (const tier of ["all", "common", "unique"]) {
    const b = document.createElement("button");
    b.dataset.rarity = tier;
    b.setAttribute("aria-pressed", tier === "all" ? "true" : "false");
    const group = document.createElement("div");
    group.className = "rarity-filter";
    group.appendChild(b);
    root.appendChild(group);
  }

  // one section with two cards
  const section = document.createElement("section");
  section.className = "catalogue-section";
  const grid = document.createElement("div");
  grid.dataset.sectionGrid = "";
  for (const [id, rarity] of [
    ["melee-weapons-battle-hammer", "common rare special"],
    ["melee-weapons-awesomeaxe", "unique"],
  ] as const) {
    const card = document.createElement("button");
    card.className = "item-card";
    card.dataset.id = id;
    card.dataset.rarity = rarity;
    grid.appendChild(card);
  }
  section.appendChild(grid);
  root.appendChild(section);

  // empty state + modal skeleton
  const empty = document.createElement("div");
  empty.dataset.empty = "";
  empty.hidden = true;
  root.appendChild(empty);

  const overlay = document.createElement("div");
  overlay.dataset.modalOverlay = "";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  const body = document.createElement("div");
  body.dataset.modalBody = "";
  const close = document.createElement("button");
  close.dataset.modalClose = "";
  overlay.append(close, body);
  root.appendChild(overlay);

  const script = document.createElement("script");
  script.dataset.catalogue = "";
  script.textContent = JSON.stringify(data);
  root.appendChild(script);

  document.body.appendChild(root);
  return document;
}

const DATA = {
  sections: [
    {
      category: "Melee weapons",
      items: [
        {
          id: "melee-weapons-battle-hammer",
          name: "Battle Hammer",
          icon: "x",
          description: "A heavy melee weapon.",
          type: "Melee Weapon",
          rarity: ["Common", "Rare", "Special"],
          effects: ["Deals 10% extra damage."],
          compatibleEffects: [
            { name: "Bounty Hunter", range: "20%–30%", description: "Hit wounded." },
          ],
          variants: ["Greataxe"],
          searchIndex: "battle hammer a heavy melee weapon deals 10% extra damage. bounty hunter 20%–30% hit wounded greataxe",
        },
        {
          id: "melee-weapons-awesomeaxe",
          name: "Awesomeaxe",
          icon: "y",
          description: "Grants strength on impact.",
          type: "Melee Weapon",
          rarity: ["Unique"],
          effects: ["70% chance of Strength."],
          compatibleEffects: [],
          variants: [],
          searchIndex: "awesomeaxe grants strength on impact 70% chance of strength.",
        },
      ],
    },
  ],
};

function visibleCards(doc: Document): string[] {
  return Array.from(doc.querySelectorAll<HTMLElement>(".item-card"))
    .filter((c) => !c.hidden)
    .map((c) => c.dataset.id ?? "") ;
}

describe("initCatalogueView", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders all cards visible by default", () => {
    const doc = buildDom(DATA);
    initCatalogueView();
    expect(visibleCards(doc).sort()).toEqual([
      "melee-weapons-awesomeaxe",
      "melee-weapons-battle-hammer",
    ]);
  });

  it("filters by rarity (Unique shows only the unique item)", () => {
    const doc = buildDom(DATA);
    initCatalogueView();
    const uniqueBtn = Array.from(
      doc.querySelectorAll<HTMLButtonElement>(".rarity-filter button"),
    ).find((b) => b.dataset.rarity === "unique")!;
    uniqueBtn.click();
    expect(visibleCards(doc)).toEqual(["melee-weapons-awesomeaxe"]);
    expect(uniqueBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("searches across the search index", () => {
    const doc = buildDom(DATA);
    initCatalogueView();
    const input = doc.querySelector<HTMLInputElement>("#catalogue-search")!;
    input.value = "greataxe";
    input.dispatchEvent(new Event("input"));
    expect(visibleCards(doc)).toEqual(["melee-weapons-battle-hammer"]);
  });

  it("shows the empty state and hides the section when nothing matches", () => {
    const doc = buildDom(DATA);
    initCatalogueView();
    const input = doc.querySelector<HTMLInputElement>("#catalogue-search")!;
    input.value = "zzzz-not-a-real-item";
    input.dispatchEvent(new Event("input"));
    expect(visibleCards(doc)).toEqual([]);
    const empty = doc.querySelector<HTMLElement>("[data-empty]")!;
    expect(empty.hidden).toBe(false);
    const section = doc.querySelector<HTMLElement>(".catalogue-section")!;
    expect(section.hidden).toBe(true);
  });

  it("opens the modal on card click and closes on Esc", () => {
    const doc = buildDom(DATA);
    initCatalogueView();
    const card = doc.querySelector<HTMLElement>(
      '.item-card[data-id="melee-weapons-awesomeaxe"]',
    )!;
    const overlay = doc.querySelector<HTMLElement>("[data-modal-overlay]")!;
    card.click();
    expect(overlay.hidden).toBe(false);
    expect(
      doc.querySelector<HTMLElement>("[data-modal-body]")!.innerHTML,
    ).toContain("Awesomeaxe");
    expect(
      doc.querySelector<HTMLElement>("[data-modal-body]")!.innerHTML,
    ).toContain("70% chance of Strength");

    // Esc closes and restores focus.
    const keydown = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(keydown);
    expect(overlay.hidden).toBe(true);
  });

  it("closes the modal on backdrop click", () => {
    const doc = buildDom(DATA);
    initCatalogueView();
    const overlay = doc.querySelector<HTMLElement>("[data-modal-overlay]")!;
    overlay.hidden = false;
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(overlay.hidden).toBe(true);
  });
});
