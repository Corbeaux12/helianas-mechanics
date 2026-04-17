import { MODULE_ID, TOOLS, ESSENCE_TIERS, ABILITY_LABELS, CREATURE_TYPE_SKILLS } from "./constants.mjs";
import { RecipeManager } from "./RecipeManager.mjs";
import { QuirkEngine } from "./QuirkEngine.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CraftingApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "helianas-crafting-workshop",
    position: { width: 780, height: 560 },
    window: { title: "HELIANAS.CraftingWorkshop", resizable: true, icon: "fa-solid fa-anvil" },
    actions: {
      selectRecipe: CraftingApp.#selectRecipe,
      switchTab:    CraftingApp.#switchTab,
      clearEssence: CraftingApp.#clearEssence,
      craftItem:    CraftingApp.#craftItem,
    },
  };

  static PARTS = {
    main: { template: "modules/helianas-mechanics/templates/crafting/app.hbs" },
  };

  // Singleton
  static #instance = null;
  static get instance() {
    if (!CraftingApp.#instance) CraftingApp.#instance = new CraftingApp();
    return CraftingApp.#instance;
  }
  static open() { CraftingApp.instance.render({ force: true }); }

  /** @type {"manufacturing"|"enchanting"} */
  _activeTab = "manufacturing";
  /** @type {string|null} "${journalId}.${pageId}" */
  _selectedId = null;
  _searchQuery = "";
  /** @type {{ name: string, tier: string, uuid: string }|null} */
  _slottedEssence = null;

  // ------------------------------------------------------------------ context

  _prepareContext(options) {
    const allRecipes = RecipeManager.getUnlockedRecipes();
    const tabRecipes = allRecipes[this._activeTab] ?? [];

    const q = this._searchQuery.toLowerCase();
    const filtered = q
      ? tabRecipes.filter(r => r.recipe.resultItemName.toLowerCase().includes(q))
      : tabRecipes;

    const selectedEntry = this._selectedId
      ? filtered.find(r => `${r.page.parent.id}.${r.page.id}` === this._selectedId)
      : null;

    return {
      activeTab:   this._activeTab,
      searchQuery: this._searchQuery,
      recipes: filtered.map(r => ({
        id:       `${r.page.parent.id}.${r.page.id}`,
        name:     r.recipe.resultItemName,
        img:      r.recipe.resultItemImg || "icons/svg/item-bag.svg",
        selected: `${r.page.parent.id}.${r.page.id}` === this._selectedId,
      })),
      recipeCount: filtered.length,
      detail: selectedEntry ? this._buildDetail(selectedEntry) : null,
    };
  }

  _buildDetail({ recipe }) {
    const isEnchanting = recipe.type === "enchanting";
    const toolEntry    = TOOLS[recipe.toolKey];

    const materials = (recipe.materials ?? []).map(m => {
      const actor = this._actor();
      const qty   = actor
        ? actor.items.contents
            .filter(i => (m.uuid && i.uuid === m.uuid) || i.name === m.name)
            .reduce((s, i) => s + (i.system?.quantity ?? 1), 0)
        : 0;
      return { ...m, found: qty >= m.quantity };
    });

    const maxBoons = this._slottedEssence
      ? (ESSENCE_TIERS[this._slottedEssence.tier]?.maxBoons ?? 0)
      : 0;

    return {
      type:           recipe.type ?? "manufacturing",
      name:           recipe.resultItemName,
      img:            recipe.resultItemImg || "icons/svg/item-bag.svg",
      dc:             recipe.dc,
      timeHours:      recipe.timeHours,
      toolLabel:      toolEntry?.label ?? recipe.toolKey,
      abilityLabel:   ABILITY_LABELS[recipe.toolAbility] ?? (recipe.toolAbility ?? "").toUpperCase(),
      rollFormula:    this._rollFormula(recipe),
      materials:      isEnchanting ? [] : materials,
      // enchanting fields
      baseItemName:   recipe.baseItemName,
      componentName:  recipe.componentName,
      rarity:         recipe.rarity,
      attunement:     recipe.attunement,
      essenceRequired: isEnchanting,
      maxBoons,
      slottedEssence: this._slottedEssence,
    };
  }

  _rollFormula(recipe) {
    if (recipe.type === "enchanting") {
      const skill = CREATURE_TYPE_SKILLS[recipe.componentCreatureType?.toLowerCase()] ?? "Skill";
      const type  = recipe.componentCreatureType ?? "";
      return `1d20 + Spellcasting mod + ${skill}${type ? ` (${type})` : ""}`;
    }
    // manufacturing (default)
    const ability = ABILITY_LABELS[recipe.toolAbility] ?? "MOD";
    const tool    = TOOLS[recipe.toolKey]?.label ?? recipe.toolKey ?? "Tool";
    return `1d20 + ${ability} mod + Prof (${tool})`;
  }

  _actor() {
    return game.user.character ?? canvas.tokens?.controlled?.[0]?.actor ?? null;
  }

  // ------------------------------------------------------------------ actions

  static #selectRecipe(event, target) {
    const id = target.closest("[data-recipe-id]")?.dataset.recipeId ?? target.dataset.recipeId;
    this._selectedId    = id === this._selectedId ? null : id;
    this._slottedEssence = null;
    this.render();
  }

  static #switchTab(event, target) {
    this._activeTab      = target.dataset.tab;
    this._selectedId     = null;
    this._slottedEssence = null;
    this.render();
  }

  static #clearEssence() {
    this._slottedEssence = null;
    this.render();
  }

  static async #craftItem() {
    const rollInput = this.element.querySelector(".hm-roll-input");
    const rollResult = parseInt(rollInput?.value ?? "");
    if (isNaN(rollResult)) {
      ui.notifications.warn(game.i18n.localize("HELIANAS.EnterRollFirst"));
      return;
    }

    const actor = this._actor();
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("HELIANAS.NoActorSelected"));
      return;
    }

    const allRecipes = RecipeManager.getUnlockedRecipes();
    const entry = (allRecipes[this._activeTab] ?? [])
      .find(r => `${r.page.parent.id}.${r.page.id}` === this._selectedId);
    if (!entry) return;

    const { recipe } = entry;
    const essenceTier = this._slottedEssence?.tier ?? null;
    const quirks      = QuirkEngine.calculateQuirks(rollResult, recipe.dc, essenceTier);

    if (quirks.destroyed) {
      ChatMessage.create({
        content: CraftingApp._chatHtml(
          `⚒ ${recipe.resultItemName} — ${game.i18n.localize("HELIANAS.ItemDestroyed")}`,
          `<p>${game.i18n.localize("HELIANAS.ItemDestroyedDesc")}</p>`
        ),
        speaker: ChatMessage.getSpeaker({ actor }),
      });
      return;
    }

    // Consume materials
    const warnings = [];
    for (const mat of (recipe.materials ?? [])) {
      const items = actor.items.filter(i =>
        (mat.uuid && i.uuid === mat.uuid) || i.name === mat.name
      );
      let needed = mat.quantity;
      for (const item of items) {
        if (needed <= 0) break;
        const qty = item.system?.quantity ?? 1;
        if (qty <= needed) { needed -= qty; await item.delete(); }
        else { await item.update({ "system.quantity": qty - needed }); needed = 0; }
      }
      if (needed > 0) warnings.push(mat.name);
    }

    // Store active craft
    const crafts = game.settings.get(MODULE_ID, "activeCrafts") ?? [];
    crafts.push({
      id:             foundry.utils.randomID(),
      userId:         game.user.id,
      actorId:        actor.id,
      recipeName:     recipe.resultItemName,
      resultItemData: {
        name: recipe.resultItemName,
        img:  recipe.resultItemImg || "icons/svg/item-bag.svg",
        type: "equipment",
      },
      quirks:          quirks.flaws,
      boons:           quirks.boons,
      totalHours:      recipe.timeHours,
      completedHours:  0,
    });
    await game.settings.set(MODULE_ID, "activeCrafts", crafts);

    // Chat
    const delta       = rollResult - recipe.dc;
    const sign        = delta >= 0 ? "+" : "";
    const matText     = (recipe.materials ?? []).map(m => `${m.name} ×${m.quantity}`).join(", ") || "—";
    const flawList    = quirks.flaws.length
      ? quirks.flaws.map(f => `<li><strong>${f.name}:</strong> ${f.effect}</li>`).join("")
      : `<li>${game.i18n.localize("HELIANAS.NoFlaws")}</li>`;
    const boonList    = quirks.boons.length
      ? quirks.boons.map(b => `<li><strong>${b.name}:</strong> ${b.effect}</li>`).join("")
      : `<li>${game.i18n.localize("HELIANAS.NoBoons")}</li>`;
    const warnHtml    = warnings.length
      ? `<p class="hm-warning">⚠ ${game.i18n.format("HELIANAS.MaterialWarning", { items: warnings.join(", ") })}</p>`
      : "";

    ChatMessage.create({
      content: CraftingApp._chatHtml(
        `⚒ ${recipe.resultItemName} — ${game.i18n.localize("HELIANAS.CraftStarted")}`,
        `<p><strong>Roll:</strong> ${rollResult} · <strong>DC:</strong> ${recipe.dc} · <strong>Δ:</strong> ${sign}${delta}</p>
         <p><strong>${game.i18n.localize("HELIANAS.TimeRequired")}:</strong> ${recipe.timeHours} ${game.i18n.localize("HELIANAS.Hours")}</p>
         <p><strong>${game.i18n.localize("HELIANAS.Flaws")}:</strong></p><ul>${flawList}</ul>
         <p><strong>${game.i18n.localize("HELIANAS.Boons")}:</strong></p><ul>${boonList}</ul>
         <hr><p><strong>${game.i18n.localize("HELIANAS.MaterialsConsumed")}:</strong> ${matText}</p>
         ${warnHtml}`
      ),
      speaker: ChatMessage.getSpeaker({ actor }),
    });

    this._selectedId     = null;
    this._slottedEssence = null;
    this.render();

    Hooks.callAll("helianas:craftStarted");
  }

  static _chatHtml(title, body) {
    return `<div class="hm-chat-message"><h3>${title}</h3>${body}</div>`;
  }

  // ------------------------------------------------------------------ render

  _onRender(context, options) {
    const el = this.element;

    // Search input
    el.querySelector(".hm-search-input")?.addEventListener("input",
      foundry.utils.debounce(e => {
        this._searchQuery = e.target.value;
        this.render();
      }, 250)
    );

    // Essence drop zone
    const dropZone = el.querySelector(".hm-essence-drop");
    if (dropZone) {
      dropZone.addEventListener("dragover", e => e.preventDefault());
      dropZone.addEventListener("drop", e => this._onDropEssence(e));
    }
  }

  async _onDropEssence(event) {
    event.preventDefault();
    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
    if (data.type !== "Item") return;

    const item = await fromUuid(data.uuid);
    if (!item) return;

    const flags = item.flags?.[MODULE_ID];
    if (!flags?.isEssence) {
      ui.notifications.warn(game.i18n.localize("HELIANAS.NotAnEssence"));
      return;
    }
    this._slottedEssence = { name: item.name, tier: flags.essenceTier, uuid: item.uuid };
    this.render();
  }
}
