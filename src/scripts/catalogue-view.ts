/**
 * Client view — the single small island of interactivity for the catalogue.
 * Pure DOM wiring over server-rendered HTML (progressive enhancement): search,
 * rarity filter, modal open/close, empty-state. No data is fetched; the full
 * catalogue + per-item search index are read from an embedded JSON script tag.
 */

interface ClientEffect {
  name: string;
  description?: string;
  range?: string;
}
interface ClientItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: string;
  rarity: string[];
  effects: string[];
  compatibleEffects: ClientEffect[];
  variants: string[];
  searchIndex: string;
}

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='120' height='120' fill='#14171f'/><path d='M60 28 L88 60 L60 92 L32 60 Z' fill='none' stroke='#363d4d' stroke-width='3'/></svg>`,
  );

function esc(s: string): string {
  const el = document.createElement("span");
  el.textContent = s;
  return el.innerHTML;
}

export function initCatalogueView(): void {
  const root = document.querySelector<HTMLElement>(".catalogue-wrap");
  if (!root) return;

  const dataTag = root.querySelector<HTMLScriptElement>("script[data-catalogue]");
  if (!dataTag) return;
  let data: { sections: { category: string; items: ClientItem[] }[] };
  try {
    data = JSON.parse(dataTag.textContent ?? "");
  } catch {
    return;
  }

  // id → item lookup for the modal.
  const byId = new Map<string, ClientItem>();
  for (const section of data.sections) {
    for (const item of section.items) byId.set(item.id, item);
  }

  const searchInput = root.querySelector<HTMLInputElement>("#catalogue-search");
  const rarityButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>(".rarity-filter button"),
  );
  const cards = Array.from(root.querySelectorAll<HTMLElement>(".item-card"));
  const sections = Array.from(
    root.querySelectorAll<HTMLElement>(".catalogue-section"),
  );
  const emptyState = root.querySelector<HTMLElement>("[data-empty]");
  const overlay = root.querySelector<HTMLElement>("[data-modal-overlay]");
  const modalBody = root.querySelector<HTMLElement>("[data-modal-body]");
  const closeBtn = root.querySelector<HTMLButtonElement>("[data-modal-close]");

  let activeRarity = "all";

  function matches(card: HTMLElement, query: string): boolean {
    const rarityOk =
      activeRarity === "all" ||
      card.dataset.rarity?.split(/\s+/).includes(activeRarity);
    if (!rarityOk) return false;
    if (!query) return true;
    const item = byId.get(card.dataset.id ?? "");
    if (!item) return false;
    return item.searchIndex.includes(query);
  }

  function apply(): void {
    const query = (searchInput?.value ?? "").trim().toLowerCase();
    let visible = 0;
    for (const card of cards) {
      const ok = matches(card, query);
      card.hidden = !ok;
      if (ok) visible++;
    }
    for (const section of sections) {
      const grid = section.querySelector<HTMLElement>("[data-section-grid]");
      const anyVisible = grid
        ? Array.from(grid.querySelectorAll<HTMLElement>(".item-card")).some(
            (c) => !c.hidden,
          )
        : false;
      section.hidden = !anyVisible;
    }
    if (emptyState) emptyState.hidden = visible !== 0;
  }

  searchInput?.addEventListener("input", apply);

  for (const btn of rarityButtons) {
    btn.addEventListener("click", () => {
      activeRarity = btn.dataset.rarity ?? "all";
      for (const b of rarityButtons) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      }
      apply();
    });
  }

  /* ---- Modal ---- */
  let lastFocused: HTMLElement | null = null;

  function buildDetail(item: ClientItem): string {
    const pips = item.rarity
      .map(
        (r) =>
          `<span class="pip ${esc(r.toLowerCase())}">${esc(r)}</span>`,
      )
      .join("");

    const effects = item.effects.length
      ? `<h4>Effects</h4><ul>${item.effects
          .map((e) => `<li>${esc(e)}</li>`)
          .join("")}</ul>`
      : "";

    const cEs = item.compatibleEffects.length
      ? `<h4>Compatible effects</h4>${item.compatibleEffects
          .map(
            (ce) =>
              `<div class="ce"><span class="ce-name">${esc(ce.name)}</span>` +
              (ce.range ? `<span class="ce-range">${esc(ce.range)}</span>` : "") +
              (ce.description ? `<div class="ce-desc">${esc(ce.description)}</div>` : "") +
              `</div>`,
          )
          .join("")}`
      : "";

    const variants = item.variants.length
      ? `<h4>Variants</h4><ul class="variant-list">${item.variants
          .map((v) => `<li>${esc(v)}</li>`)
          .join("")}</ul>`
      : "";

    const desc = item.description
      ? `<p style="color:var(--text-dim)">${esc(item.description)}</p>`
      : "";

    return `
      <div class="modal-head">
        <div class="icon-wrap">
          <img class="icon" src="${esc(item.icon || PLACEHOLDER)}" alt="${esc(item.name)}"
            onerror="this.onerror=null;this.src=${JSON.stringify(PLACEHOLDER)};this.classList.add('is-fallback');"/>
        </div>
        <div>
          <h2 id="modal-title">${esc(item.name)}</h2>
          ${item.type ? `<p class="item-type">${esc(item.type)}</p>` : ""}
          <div class="rarity">${pips || `<span class="pip common">—</span>`}</div>
        </div>
      </div>
      ${desc}
      ${effects}
      ${cEs}
      ${variants}
    `;
  }

  function openModal(item: ClientItem): void {
    if (!modalBody || !overlay) return;
    lastFocused = document.activeElement as HTMLElement | null;
    modalBody.innerHTML = buildDetail(item);
    overlay.hidden = false;
    closeBtn?.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function closeModal(): void {
    if (!overlay) return;
    overlay.hidden = true;
    document.removeEventListener("keydown", onKeydown);
    lastFocused?.focus();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
    }
  }

  for (const card of cards) {
    card.addEventListener("click", () => {
      const item = byId.get(card.dataset.id ?? "");
      if (item) openModal(item);
    });
  }

  closeBtn?.addEventListener("click", closeModal);
  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(); // click on backdrop closes
  });

  apply();
}
