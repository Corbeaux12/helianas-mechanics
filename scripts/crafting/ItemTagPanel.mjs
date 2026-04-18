import { MODULE_ID, INGREDIENT_TAGS } from "./constants.mjs";

/**
 * Reads the current tag list from an item's module flag. Accepts either a
 * string array or a comma-separated string (the legacy shape from older
 * macros) and returns a clean array of non-empty unique strings.
 */
export function readItemTags(item) {
  const raw = item?.flags?.[MODULE_ID]?.tags;
  let list;
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") list = raw.split(",");
  else list = [];
  return [...new Set(list.map(t => String(t).trim()).filter(Boolean))];
}

/**
 * Injects a tag-management panel into every item sheet. Renders the current
 * tags as chips, provides an input with a datalist of known tags (combines
 * the project starter vocabulary with any tag already used on items in the
 * current world), and persists changes via setFlag/unsetFlag.
 */
export function renderItemTagPanel(app, html, _data) {
  const item = app.document ?? app.object;
  if (!item) return;

  // Render on every sheet, but only when the user can edit.
  if (!item.isOwner) return;

  const tags = readItemTags(item);
  const suggestions = Array.from(new Set([
    ...INGREDIENT_TAGS,
    ...collectWorldTags(),
  ])).sort();

  const datalistId = `hm-tag-suggestions-${item.id}`;
  const chipHtml = tags.length
    ? tags.map(t =>
        `<span class="hm-tag-chip" data-tag="${escapeAttr(t)}">
          ${escapeHtml(t)}
          <button type="button" class="hm-tag-chip__remove"
                  data-action="hm-remove-tag" data-tag="${escapeAttr(t)}"
                  title="${game.i18n.localize("HELIANAS.RemoveTag")}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </span>`).join("")
    : `<span class="hm-tag-empty">${game.i18n.localize("HELIANAS.NoTagsYet")}</span>`;

  const panel = document.createElement("div");
  panel.className = "hm-item-tags";
  panel.innerHTML = `
    <header class="hm-item-tags__header">
      <i class="fa-solid fa-tags"></i>
      <strong>${game.i18n.localize("HELIANAS.ItemTagsTitle")}</strong>
    </header>
    <div class="hm-tag-chips">${chipHtml}</div>
    <div class="hm-tag-add">
      <input type="text" class="hm-tag-add__input"
             list="${datalistId}"
             placeholder="${game.i18n.localize("HELIANAS.AddTagPlaceholder")}">
      <datalist id="${datalistId}">
        ${suggestions.map(t => `<option value="${escapeAttr(t)}"></option>`).join("")}
      </datalist>
      <button type="button" class="hm-btn-sm" data-action="hm-add-tag">
        <i class="fa-solid fa-plus"></i> ${game.i18n.localize("HELIANAS.AddTag")}
      </button>
    </div>
    <p class="hint hm-item-tags__hint">${game.i18n.localize("HELIANAS.ItemTagsHint")}</p>
  `;

  const el = html instanceof HTMLElement ? html : html[0];
  const target = el.querySelector(".tab[data-tab='description']")
    ?? el.querySelector(".sheet-body")
    ?? el;
  target.prepend(panel);

  panel.querySelector("[data-action='hm-add-tag']")
    ?.addEventListener("click", () => commitAdd());
  panel.querySelector(".hm-tag-add__input")
    ?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); commitAdd(); }
    });
  for (const btn of panel.querySelectorAll("[data-action='hm-remove-tag']")) {
    btn.addEventListener("click", async () => {
      const tag = btn.dataset.tag;
      const next = readItemTags(item).filter(t => t !== tag);
      await persistTags(item, next);
    });
  }

  async function commitAdd() {
    const input = panel.querySelector(".hm-tag-add__input");
    const raw = String(input?.value ?? "").trim();
    if (!raw) return;
    // Allow pasting multiple comma-separated tags at once
    const incoming = raw.split(",").map(t => t.trim()).filter(Boolean);
    const next = [...new Set([...readItemTags(item), ...incoming])];
    await persistTags(item, next);
  }
}

async function persistTags(item, tags) {
  const clean = [...new Set(tags.map(t => String(t).trim()).filter(Boolean))];
  if (clean.length) {
    await item.setFlag(MODULE_ID, "tags", clean);
  } else {
    await item.unsetFlag(MODULE_ID, "tags");
  }
}

function collectWorldTags() {
  const seen = new Set();
  const collect = (collection) => {
    for (const it of collection ?? []) {
      const raw = it.flags?.[MODULE_ID]?.tags;
      const list = Array.isArray(raw) ? raw
                 : typeof raw === "string" ? raw.split(",") : [];
      for (const t of list) {
        const trimmed = String(t).trim();
        if (trimmed) seen.add(trimmed);
      }
    }
  };
  if (game?.items?.contents) collect(game.items.contents);
  for (const actor of game?.actors?.contents ?? []) {
    collect(actor.items?.contents);
  }
  return [...seen];
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
function escapeAttr(str) { return escapeHtml(str); }
