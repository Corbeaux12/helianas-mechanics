import { MODULE_ID } from "./constants.mjs";
import { deriveTagsFromName, readStoredTags } from "./ItemTagPanel.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only bulk tag editor. Lets the GM pick a source (world Items directory or
 * any Item compendium pack) and apply tag operations to a selected set of
 * items at once.
 *
 * Operations:
 *   - Add tags (comma-separated)
 *   - Remove tags (comma-separated)
 *   - Apply name-derived tags (merge deriveTagsFromName(item.name) into stored)
 *   - Clear all stored tags
 *
 * Compendium packs are unlocked for the duration of the update and then
 * re-locked to their original state.
 */
export class BulkTagger extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "helianas-bulk-tagger",
    classes: ["helianas-mechanics", "hm-bulk-tagger"],
    position: { width: 960, height: 680 },
    window: {
      title: "HELIANAS.BulkTaggerTitle",
      resizable: true,
      icon: "fa-solid fa-tags",
    },
    actions: {
      selectAll:       BulkTagger.#selectAll,
      selectNone:      BulkTagger.#selectNone,
      invertSelection: BulkTagger.#invertSelection,
      toggleRow:       BulkTagger.#toggleRow,
      addTags:         BulkTagger.#addTags,
      removeTags:      BulkTagger.#removeTags,
      applyNameTags:   BulkTagger.#applyNameTags,
      clearTags:       BulkTagger.#clearTags,
      refresh:         BulkTagger.#refresh,
    },
  };

  static PARTS = {
    main: { template: "modules/helianas-mechanics/templates/crafting/bulk-tagger.hbs" },
  };

  static #instance = null;
  static get instance() {
    if (!BulkTagger.#instance) BulkTagger.#instance = new BulkTagger();
    return BulkTagger.#instance;
  }
  static open() {
    if (!game.user?.isGM) {
      ui.notifications?.warn(game.i18n.localize("HELIANAS.ImporterGMOnly"));
      return;
    }
    BulkTagger.instance.render({ force: true });
  }

  /** Source id: "world" or a compendium collection id (e.g. "dnd5e.items"). */
  _source = "world";
  /** Last source we loaded rows for — used to avoid redundant fetches. */
  _loadedSource = null;
  /** Cached rows pulled from the current source. */
  _rows = [];
  _selected = new Set();
  _search = "";
  _tagFilter = "";
  _busy = false;

  async _prepareContext() {
    const sources = this._collectSources();
    if (!sources.some(s => s.id === this._source)) this._source = "world";

    if (this._loadedSource !== this._source) await this._reload();

    const visible = this._visibleRows();

    return {
      sources,
      selectedSource: this._source,
      search:         this._search,
      tagFilter:      this._tagFilter,
      rows:           visible,
      totalRows:      this._rows.length,
      visibleCount:   visible.length,
      selectedCount:  [...this._selected].filter(id => visible.some(r => r.id === id)).length,
      busy:           this._busy,
    };
  }

  _onRender(_ctx, _opts) {
    const root = this.element;
    root.querySelector(".hm-bt-source")?.addEventListener("change", async (ev) => {
      this._source = ev.currentTarget.value || "world";
      this._selected.clear();
      await this._reload();
      this.render();
    });
    root.querySelector(".hm-bt-search")?.addEventListener("input", (ev) => {
      this._search = ev.currentTarget.value ?? "";
      this.render();
    });
    root.querySelector(".hm-bt-tag-filter")?.addEventListener("input", (ev) => {
      this._tagFilter = ev.currentTarget.value ?? "";
      this.render();
    });
  }

  // ------------------------------------------------------------------ sources

  _collectSources() {
    const itemPacks = [...(game.packs ?? [])]
      .filter(p => p.documentName === "Item")
      .map(p => ({ id: p.collection, label: `${p.metadata.label} (${p.collection})` }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [
      { id: "world", label: game.i18n.localize("HELIANAS.BulkTaggerWorldItems") },
      ...itemPacks,
    ];
  }

  async _reload() {
    if (this._source === "world") {
      this._rows = (game.items?.contents ?? []).map(it => this._rowForItem(it));
    } else {
      const pack = game.packs.get(this._source);
      if (!pack) { this._rows = []; this._loadedSource = this._source; return; }
      const docs = await pack.getDocuments();
      this._rows = docs.map(it => this._rowForItem(it));
    }
    this._rows.sort((a, b) => a.name.localeCompare(b.name));
    this._loadedSource = this._source;
  }

  _rowForItem(item) {
    const stored = readStoredTags(item);
    return {
      id:     item.uuid,
      name:   item.name,
      img:    item.img,
      type:   item.type,
      tags:   stored,
      tagStr: stored.join(", "),
    };
  }

  _visibleRows() {
    const q = this._search.trim().toLowerCase();
    const tagQ = this._tagFilter.trim().toLowerCase();
    return this._rows
      .filter(r => !q || r.name.toLowerCase().includes(q))
      .filter(r => !tagQ || r.tags.some(t => t.toLowerCase().includes(tagQ)))
      .map(r => ({ ...r, selected: this._selected.has(r.id) }));
  }

  _readInput(selector) {
    const el = this.element?.querySelector(selector);
    if (!el) return [];
    return String(el.value ?? "")
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
  }

  // ------------------------------------------------------------------ bulk actions

  async _applyToSelected(mutator, { requireTagInput } = {}) {
    if (this._busy) return;
    if (!this._selected.size) {
      ui.notifications.warn(game.i18n.localize("HELIANAS.BulkTaggerNoSelection"));
      return;
    }
    if (requireTagInput?.length === 0) {
      ui.notifications.warn(game.i18n.localize("HELIANAS.BulkTaggerNoTags"));
      return;
    }

    const uuids = [...this._selected];
    const pack  = this._source === "world" ? null : game.packs.get(this._source);
    const wasLocked = pack?.locked ?? false;
    this._busy = true;
    this.render();

    try {
      if (pack && wasLocked) await pack.configure({ locked: false });

      let changed = 0;
      let failed = 0;
      for (const uuid of uuids) {
        const item = await fromUuid(uuid);
        if (!item) continue;
        const current = readStoredTags(item);
        const next = mutator(current, item);
        if (sameTags(current, next)) continue;
        try {
          if (next.length) await item.setFlag(MODULE_ID, "tags", next);
          else             await item.unsetFlag(MODULE_ID, "tags");
          changed++;
        } catch (err) {
          console.error(`${MODULE_ID} | BulkTagger update failed for ${uuid}`, err);
          failed++;
        }
      }

      ui.notifications.info(
        game.i18n.format("HELIANAS.BulkTaggerApplied", { count: changed }),
      );
      if (failed) {
        ui.notifications.warn(
          game.i18n.format("HELIANAS.BulkTaggerFailed", { count: failed }),
        );
      }
    } finally {
      if (pack && wasLocked) await pack.configure({ locked: true });
      this._busy = false;
      await this._reload();
      this.render();
    }
  }

  // ------------------------------------------------------------------ static action handlers

  static #selectAll() {
    for (const r of this._visibleRows()) this._selected.add(r.id);
    this.render();
  }

  static #selectNone() {
    for (const r of this._visibleRows()) this._selected.delete(r.id);
    this.render();
  }

  static #invertSelection() {
    for (const r of this._visibleRows()) {
      if (this._selected.has(r.id)) this._selected.delete(r.id);
      else this._selected.add(r.id);
    }
    this.render();
  }

  static #toggleRow(_event, target) {
    const id = target.dataset.rowId;
    if (!id) return;
    if (this._selected.has(id)) this._selected.delete(id);
    else this._selected.add(id);
    target.closest("tr")?.classList.toggle("hm-bt-row--selected", this._selected.has(id));
    const counter = this.element.querySelector(".hm-bt-counter");
    if (counter) {
      const visible = this._visibleRows();
      const n = [...this._selected].filter(id => visible.some(r => r.id === id)).length;
      counter.textContent = `${n} / ${visible.length}`;
    }
  }

  static async #addTags() {
    const toAdd = this._readInput(".hm-bt-add-input");
    await this._applyToSelected(
      (current) => [...new Set([...current, ...toAdd])],
      { requireTagInput: toAdd },
    );
  }

  static async #removeTags() {
    const toRemove = new Set(this._readInput(".hm-bt-remove-input").map(t => t.toLowerCase()));
    if (!toRemove.size) {
      ui.notifications.warn(game.i18n.localize("HELIANAS.BulkTaggerNoTags"));
      return;
    }
    await this._applyToSelected((current) =>
      current.filter(t => !toRemove.has(t.toLowerCase())));
  }

  static async #applyNameTags() {
    await this._applyToSelected((current, item) =>
      [...new Set([...current, ...deriveTagsFromName(item.name)])]);
  }

  static async #clearTags() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("HELIANAS.BulkTaggerClearTitle") },
      content: `<p>${game.i18n.localize("HELIANAS.BulkTaggerClearConfirm")}</p>`,
    });
    if (!confirmed) return;
    await this._applyToSelected(() => []);
  }

  static async #refresh() {
    await this._reload();
    this.render();
  }
}

function sameTags(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((t, i) => t === sb[i]);
}
