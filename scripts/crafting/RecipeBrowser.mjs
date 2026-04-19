import { MODULE_ID } from "./constants.mjs";
import { parseCatalogueMarkdown, buildRecipeSystem, RecipeImporter } from "./RecipeImporter.mjs";
import { RECIPE_PAGE_TYPE } from "./Recipe.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-facing browser for the bundled catalogue markdown. Lets the GM filter by
 * section, search by name, multi-select rows, and import the selection into a
 * chosen journal. Resolution of result items to compendium UUIDs happens at
 * import time (same path as the /helianas-import chat command).
 */
export class RecipeBrowser extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "helianas-recipe-browser",
    position: { width: 900, height: 640 },
    window: { title: "HELIANAS.RecipeBrowserTitle", resizable: true, icon: "fa-solid fa-book-open" },
    actions: {
      selectAll:       RecipeBrowser.#selectAll,
      selectNone:      RecipeBrowser.#selectNone,
      invertSelection: RecipeBrowser.#invertSelection,
      toggleRow:       RecipeBrowser.#toggleRow,
      importSelected:  RecipeBrowser.#importSelected,
    },
  };

  static PARTS = {
    main: { template: "modules/helianas-mechanics/templates/crafting/recipe-browser.hbs" },
  };

  // Singleton
  static #instance = null;
  static get instance() {
    if (!RecipeBrowser.#instance) RecipeBrowser.#instance = new RecipeBrowser();
    return RecipeBrowser.#instance;
  }
  static open() {
    RecipeBrowser.instance._loadIfNeeded();
    RecipeBrowser.instance.render({ force: true });
  }

  /** @type {Array<{ key: string, section: string, name: string, rarity: string, type: string, component: string, att?: string }>} */
  _rows = [];
  _selected = new Set();
  _selectedSection = "";
  _searchQuery = "";
  _selectedJournalId = "";
  /** @type {Map<string, boolean>} key → was resolved last time we tried (lazy cache) */
  _resolvedHints = new Map();

  async _loadIfNeeded() {
    if (this._rows.length) return;
    try {
      const res  = await fetch(`modules/${MODULE_ID}/crafting_catalogue_foundry_reference.md`);
      const text = await res.text();
      this._rows = parseCatalogueMarkdown(text).map((row, idx) => ({
        ...row,
        key: `${idx}-${row.name}`,
      }));
      this.render();
    } catch (err) {
      console.error(MODULE_ID, err);
      ui.notifications.error(String(err));
    }
  }

  _visibleRows() {
    const q = this._searchQuery.trim().toLowerCase();
    return this._rows.filter(r => {
      if (this._selectedSection && r.section !== this._selectedSection) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  _prepareContext() {
    const sections = [...new Set(this._rows.map(r => r.section).filter(Boolean))].sort();
    const journals = (game.journal?.contents ?? [])
      .filter(j => j.isOwner)
      .map(j => ({ id: j.id, name: j.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!this._selectedJournalId && journals.length) {
      this._selectedJournalId = journals[0].id;
    }

    const visible = this._visibleRows();
    return {
      sections,
      journals,
      selectedJournalId: this._selectedJournalId,
      selectedSection:   this._selectedSection,
      searchQuery:       this._searchQuery,
      visibleRows:       visible.map(r => ({
        ...r,
        selected: this._selected.has(r.key),
        resolved: this._resolvedHints.get(r.key) ?? false,
      })),
      visibleCount:      visible.length,
      selectedCount:     [...this._selected].filter(key =>
        visible.some(r => r.key === key)).length,
    };
  }

  _onRender(_context, _options) {
    const root = this.element;
    root.querySelector(".hm-rb-search")?.addEventListener("input", (ev) => {
      this._searchQuery = ev.currentTarget.value ?? "";
      this.render();
    });
    root.querySelector(".hm-rb-section")?.addEventListener("change", (ev) => {
      this._selectedSection = ev.currentTarget.value ?? "";
      this.render();
    });
    root.querySelector(".hm-rb-journal")?.addEventListener("change", (ev) => {
      this._selectedJournalId = ev.currentTarget.value ?? "";
    });
  }

  // ------------------------------------------------------------------ actions

  static #selectAll() {
    for (const r of this._visibleRows()) this._selected.add(r.key);
    this.render();
  }

  static #selectNone() {
    for (const r of this._visibleRows()) this._selected.delete(r.key);
    this.render();
  }

  static #invertSelection() {
    for (const r of this._visibleRows()) {
      if (this._selected.has(r.key)) this._selected.delete(r.key);
      else this._selected.add(r.key);
    }
    this.render();
  }

  static #toggleRow(event, target) {
    const key = target.dataset.rowKey;
    if (!key) return;
    if (this._selected.has(key)) this._selected.delete(key);
    else this._selected.add(key);
    // No full re-render on every click — just update row highlight for responsiveness
    target.closest("tr")?.classList.toggle("hm-rb-row--selected", this._selected.has(key));
    const counter = this.element.querySelector(".hm-rb-counter");
    if (counter) {
      const visible = this._visibleRows();
      const selectedVisible = [...this._selected].filter(k => visible.some(r => r.key === k)).length;
      counter.textContent = `${selectedVisible} / ${visible.length} ${game.i18n.localize("HELIANAS.RecipeBrowserSelected")}`;
    }
    const importBtn = this.element.querySelector('[data-action="importSelected"]');
    if (importBtn) importBtn.disabled = this._selected.size === 0;
  }

  static async #importSelected() {
    if (!this._selected.size) return;
    const journal = game.journal.get(this._selectedJournalId);
    if (!journal) {
      ui.notifications.warn(game.i18n.localize("HELIANAS.RecipeBrowserNoJournal"));
      return;
    }

    const rows = this._rows.filter(r => this._selected.has(r.key));
    ui.notifications.info(game.i18n.format("HELIANAS.ImporterStarted", { count: rows.length }));

    const { created, skipped } = await RecipeImporter.importRows(journal, rows, { max: rows.length });

    // Remember which rows resolved so the user can retarget and re-scan
    for (const row of rows) {
      this._resolvedHints.set(row.key, !skipped.includes(row.name));
    }
    this._selected.clear();
    this.render();

    ui.notifications.info(game.i18n.format("HELIANAS.ImporterDone", { created, skipped: skipped.length }));
  }
}

// Re-export the builder so callers that already imported just this file can
// inspect / preview the mapping without a second import.
export { buildRecipeSystem, RECIPE_PAGE_TYPE };
