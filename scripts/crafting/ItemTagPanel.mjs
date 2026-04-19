import { MODULE_ID, INGREDIENT_TAGS } from "./constants.mjs";

const { DialogV2 } = foundry.applications.api;

// Common English filler words that would add noise if included as tags.
const STOP_WORDS = new Set([
  "a", "an", "the", "of", "and", "or", "to", "in", "on", "for", "with",
]);

/**
 * Splits an item name into lowercase alphanumeric tokens suitable for use as
 * crafting tags. Drops very short fragments and common English filler words.
 */
export function deriveTagsFromName(name) {
  if (!name) return [];
  return [...new Set(
    String(name)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length >= 2 && !STOP_WORDS.has(w)),
  )];
}

/** Stored tags only (what lives in flags, minus any runtime derivation). */
export function readStoredTags(item) {
  const raw = item?.flags?.[MODULE_ID]?.tags;
  let list;
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") list = raw.split(",");
  else list = [];
  return [...new Set(list.map(t => String(t).trim()).filter(Boolean))];
}

/**
 * Effective tag set for the item: stored tags merged with tokens derived from
 * the item's current name. Used for display, recipe matching and filtering so
 * existing items get name-derived tags without requiring a data migration.
 */
export function readItemTags(item) {
  if (!item) return [];
  return [...new Set([
    ...readStoredTags(item),
    ...deriveTagsFromName(item.name),
  ])];
}

/**
 * Adds a tag-management button to the item sheet's window header. Clicking it
 * opens a DialogV2 where the user can add or remove tags.
 */
export function attachItemTagControl(app, html) {
  const item = app.document ?? app.object;
  if (!item || !item.isOwner) return;

  // Prefer the full application element (covers AppV2 where the render hook
  // only hands us the inner content). Walk up from html as a fallback for
  // legacy AppV1 sheets that pass a form/jQuery element.
  const appEl = app.element instanceof HTMLElement ? app.element : app.element?.[0];
  let root = appEl;
  if (!root) {
    const el = html instanceof HTMLElement ? html : html?.[0];
    root = el?.closest(".application")
        ?? el?.closest(".window-app")
        ?? el?.closest(".app")
        ?? el
        ?? null;
  }
  if (!root) return;

  const header = root.querySelector(".window-header");
  if (!header || header.querySelector(".hm-tag-header-btn")) return;

  const label = game.i18n.localize("HELIANAS.ManageTagsTooltip");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "header-control icon fa-solid fa-tags hm-tag-header-btn";
  btn.dataset.tooltip = label;
  btn.setAttribute("aria-label", label);
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    openItemTagsDialog(item);
  });

  const closeBtn = header.querySelector("[data-action='close']");
  if (closeBtn) closeBtn.before(btn);
  else header.appendChild(btn);
}

/** Opens the tag editor dialog for a single item. */
export async function openItemTagsDialog(item) {
  if (!item?.isOwner) return;

  const datalistId = `hm-tag-suggestions-${item.id}`;
  const suggestions = Array.from(new Set([
    ...INGREDIENT_TAGS,
    ...collectWorldTags(),
  ])).sort();

  const content = `
    <div class="hm-tag-dialog">
      <div class="hm-tag-chips" data-hm-chips></div>
      <div class="hm-tag-add">
        <input type="text" class="hm-tag-add__input" list="${datalistId}"
               placeholder="${escapeAttr(game.i18n.localize("HELIANAS.AddTagPlaceholder"))}">
        <datalist id="${datalistId}">
          ${suggestions.map(t => `<option value="${escapeAttr(t)}"></option>`).join("")}
        </datalist>
        <button type="button" class="hm-btn-sm" data-action="hm-add-tag">
          <i class="fa-solid fa-plus"></i> ${game.i18n.localize("HELIANAS.AddTag")}
        </button>
      </div>
      <div class="hm-tag-actions">
        <button type="button" class="hm-btn-sm" data-action="hm-apply-name-tags">
          <i class="fa-solid fa-wand-sparkles"></i> ${game.i18n.localize("HELIANAS.ApplyNameTags")}
        </button>
      </div>
      <p class="hint">${game.i18n.localize("HELIANAS.ItemTagsHint")}</p>
    </div>
  `;

  const dialog = new DialogV2({
    window: { title: game.i18n.format("HELIANAS.ManageTagsFor", { name: item.name }) },
    content,
    buttons: [{
      action: "close",
      label: game.i18n.localize("HELIANAS.Close"),
      default: true,
    }],
    rejectClose: false,
  });

  await dialog.render({ force: true });
  const root = dialog.element;
  if (!root) return;

  const chipsEl = root.querySelector("[data-hm-chips]");
  const inputEl = root.querySelector(".hm-tag-add__input");

  const refresh = () => {
    const tags = readStoredTags(item);
    chipsEl.innerHTML = tags.length
      ? tags.map(t => `
          <span class="hm-tag-chip" data-tag="${escapeAttr(t)}">
            ${escapeHtml(t)}
            <button type="button" class="hm-tag-chip__remove"
                    data-action="hm-remove-tag" data-tag="${escapeAttr(t)}"
                    title="${escapeAttr(game.i18n.localize("HELIANAS.RemoveTag"))}">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </span>`).join("")
      : `<span class="hm-tag-empty">${game.i18n.localize("HELIANAS.NoTagsYet")}</span>`;

    for (const removeBtn of chipsEl.querySelectorAll("[data-action='hm-remove-tag']")) {
      removeBtn.addEventListener("click", async () => {
        const tag = removeBtn.dataset.tag;
        await persistTags(item, readStoredTags(item).filter(t => t !== tag));
        refresh();
      });
    }
  };

  const commitAdd = async () => {
    const raw = String(inputEl?.value ?? "").trim();
    if (!raw) return;
    const incoming = raw.split(",").map(t => t.trim()).filter(Boolean);
    const next = [...new Set([...readStoredTags(item), ...incoming])];
    await persistTags(item, next);
    inputEl.value = "";
    refresh();
  };

  root.querySelector("[data-action='hm-add-tag']")
    ?.addEventListener("click", commitAdd);
  root.querySelector("[data-action='hm-apply-name-tags']")
    ?.addEventListener("click", async () => {
      const next = [...new Set([
        ...readStoredTags(item),
        ...deriveTagsFromName(item.name),
      ])];
      await persistTags(item, next);
      refresh();
    });
  inputEl?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); commitAdd(); }
  });

  refresh();
}

async function persistTags(item, tags) {
  const clean = [...new Set(tags.map(t => String(t).trim()).filter(Boolean))];
  if (clean.length) await item.setFlag(MODULE_ID, "tags", clean);
  else              await item.unsetFlag(MODULE_ID, "tags");
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
