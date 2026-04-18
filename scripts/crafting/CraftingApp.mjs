import { MODULE_ID, TOOLS, ESSENCE_TIERS, ABILITY_LABELS, CREATURE_TYPE_SKILLS } from "./constants.mjs";
import { RecipeManager } from "./RecipeManager.mjs";
import { QuirkEngine } from "./QuirkEngine.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CraftingApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "helianas-crafting-workshop",
    position: { width: 820, height: 620 },
    window: { title: "HELIANAS.CraftingWorkshop", resizable: true, icon: "fa-solid fa-anvil" },
    actions: {
      selectRecipe:    CraftingApp.#selectRecipe,
      switchTab:       CraftingApp.#switchTab,
      selectComponent: CraftingApp.#selectComponent,
      clearEssence:    CraftingApp.#clearEssence,
      craftItem:       CraftingApp.#craftItem,
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

  /** @type {"manufacturing"|"enchanting"|"forging"|"cooking"} */
  _activeTab = "manufacturing";
  /** @type {string|null} "${journalId}.${pageId}" */
  _selectedId = null;
  _searchQuery = "";
  /** @type {{ name: string, tier: string, uuid: string }|null} */
  _slottedEssence = null;
  /** @type {Record<string, Record<string,string>>} recipeId → ingredientId → componentId */
  _componentSelections = {};

  // ------------------------------------------------------------------ actor pickers

  _eligibleActors() {
    return game.actors.filter(a => a.isOwner);
  }

  _craftingActor() {
    const id = game.settings.get(MODULE_ID, "craftingActorId");
    return game.actors.get(id) ?? game.user.character ?? this._eligibleActors()[0] ?? null;
  }

  _inventoryActor() {
    const id = game.settings.get(MODULE_ID, "inventoryActorId");
    return game.actors.get(id) ?? this._craftingActor();
  }

  // ------------------------------------------------------------------ context

  _prepareContext(options) {
    const allRecipes = RecipeManager.getUnlockedRecipes();
    const tabRecipes = allRecipes[this._activeTab] ?? [];

    const q = this._searchQuery.toLowerCase();
    const filtered = q
      ? tabRecipes.filter(r => r.name.toLowerCase().includes(q))
      : tabRecipes;

    const selectedRecipe = this._selectedId
      ? filtered.find(r => this._recipeKey(r) === this._selectedId)
      : null;

    const actors = this._eligibleActors().map(a => ({ id: a.id, name: a.name }));
    const craftingActor  = this._craftingActor();
    const inventoryActor = this._inventoryActor();

    return {
      activeTab:   this._activeTab,
      searchQuery: this._searchQuery,
      recipes: filtered.map(r => ({
        id:       this._recipeKey(r),
        name:     r.name,
        img:      r.img,
        selected: this._recipeKey(r) === this._selectedId,
      })),
      recipeCount: filtered.length,
      actors,
      craftingActorId:  craftingActor?.id ?? "",
      inventoryActorId: inventoryActor?.id ?? "",
      detail: selectedRecipe ? this._buildDetail(selectedRecipe, inventoryActor) : null,
    };
  }

  _recipeKey(recipe) {
    return `${recipe.page.parent?.id ?? "j"}.${recipe.page.id}`;
  }

  _buildDetail(recipe, inventoryActor) {
    const type         = recipe.recipeType;
    const isEnchanting = type === "enchanting";
    const isForging    = type === "forging";
    const isCooking    = type === "cooking";
    // Enchanting and forging both require an essence (forging = tool + spellcasting).
    const essenceRequired = isEnchanting || isForging;
    const toolEntry    = TOOLS[recipe.toolKey];
    const selections   = this._componentSelections[this._selectedId] ?? {};

    const evaluated = recipe.evaluate(inventoryActor, selections);

    const ingredients = evaluated.map(({ ingredient, components, selectedId }) => ({
      id:         ingredient.id,
      name:       ingredient.name,
      selectedId,
      components: components.map(c => ({
        id:            c.id,
        name:          c.name,
        img:           c.img || "icons/svg/item-bag.svg",
        quantity:      c.quantity,
        tags:          c.tags,
        resourcePath:  c.resourcePath,
        inventoryQty:  c.inventoryQuantity,
        available:     c.inventoryQuantity >= c.quantity,
        selected:      c.selected,
      })),
    }));

    const allAvailable = evaluated.every(e => {
      const sel = e.components.find(c => c.id === e.selectedId);
      return sel && sel.inventoryQuantity >= sel.quantity;
    });

    const maxBoons = this._slottedEssence
      ? (ESSENCE_TIERS[this._slottedEssence.tier]?.maxBoons ?? 0)
      : 0;

    return {
      type,
      isEnchanting,
      isForging,
      isCooking,
      actionLabel:    this._actionLabel(type),
      name:           recipe.name,
      img:            recipe.img,
      dc:             recipe.dc,
      timeHours:      recipe.timeHours,
      toolLabel:      toolEntry?.label ?? recipe.toolKey,
      abilityLabel:   ABILITY_LABELS[recipe.toolAbility] ?? (recipe.toolAbility ?? "").toUpperCase(),
      rollFormula:    this._rollFormula(recipe),
      ingredients,
      allAvailable,
      rarity:         recipe.rarity,
      attunement:     recipe.attunement,
      essenceRequired,
      maxBoons,
      slottedEssence: this._slottedEssence,
    };
  }

  _actionLabel(type) {
    switch (type) {
      case "enchanting": return game.i18n.localize("HELIANAS.EnchantItem");
      case "forging":    return game.i18n.localize("HELIANAS.ForgeItem");
      case "cooking":    return game.i18n.localize("HELIANAS.CookMeal");
      default:           return game.i18n.localize("HELIANAS.CraftItem");
    }
  }

  _rollFormula(recipe) {
    const ability = ABILITY_LABELS[recipe.toolAbility] ?? "MOD";
    const tool    = TOOLS[recipe.toolKey]?.label ?? recipe.toolKey ?? "Tool";

    if (recipe.recipeType === "enchanting") {
      const skill        = CREATURE_TYPE_SKILLS[recipe.componentCreatureType?.toLowerCase()] ?? "Skill";
      const creatureType = recipe.componentCreatureType ?? "";
      return `1d20 + Spellcasting mod + ${skill}${creatureType ? ` (${creatureType})` : ""}`;
    }

    if (recipe.recipeType === "forging") {
      const skill        = CREATURE_TYPE_SKILLS[recipe.componentCreatureType?.toLowerCase()] ?? "Skill";
      const creatureType = recipe.componentCreatureType ?? "";
      return `1d20 + ${ability} mod + Prof (${tool}) + Spellcasting mod + ${skill}${creatureType ? ` (${creatureType})` : ""}`;
    }

    // manufacturing / cooking both resolve as a single tool-ability check.
    return `1d20 + ${ability} mod + Prof (${tool})`;
  }

  // ------------------------------------------------------------------ actions

  static #selectRecipe(event, target) {
    const id = target.closest("[data-recipe-id]")?.dataset.recipeId ?? target.dataset.recipeId;
    this._selectedId     = id === this._selectedId ? null : id;
    this._slottedEssence = null;
    this.render();
  }

  static #switchTab(event, target) {
    this._activeTab      = target.dataset.tab;
    this._selectedId     = null;
    this._slottedEssence = null;
    this.render();
  }

  static #selectComponent(event, target) {
    const ingredientId = target.closest("[data-ingredient-id]")?.dataset.ingredientId;
    const componentId  = target.closest("[data-component-id]")?.dataset.componentId;
    if (!this._selectedId || !ingredientId || !componentId) return;
    const sel = (this._componentSelections[this._selectedId] ??= {});
    sel[ingredientId] = componentId;
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

    const craftingActor  = this._craftingActor();
    const inventoryActor = this._inventoryActor();
    if (!craftingActor || !inventoryActor) {
      ui.notifications.warn(game.i18n.localize("HELIANAS.NoActorSelected"));
      return;
    }

    const allRecipes = RecipeManager.getUnlockedRecipes();
    const recipe = (allRecipes[this._activeTab] ?? [])
      .find(r => this._recipeKey(r) === this._selectedId);
    if (!recipe) return;

    const selections  = this._componentSelections[this._selectedId] ?? {};
    const essenceTier = this._slottedEssence?.tier ?? null;
    const quirks      = QuirkEngine.calculateQuirks(rollResult, recipe.dc, essenceTier);

    if (quirks.destroyed) {
      // Destroyed on catastrophic failure — still consume materials
      await recipe.consumeIngredients(inventoryActor, selections);
      ChatMessage.create({
        content: CraftingApp._chatHtml(
          `⚒ ${recipe.name} — ${game.i18n.localize("HELIANAS.ItemDestroyed")}`,
          `<p>${game.i18n.localize("HELIANAS.ItemDestroyedDesc")}</p>`
        ),
        speaker: ChatMessage.getSpeaker({ actor: craftingActor }),
      });
      this._selectedId     = null;
      this._slottedEssence = null;
      this.render();
      return;
    }

    const warnings = await recipe.consumeIngredients(inventoryActor, selections);

    // Build a text summary of consumed components for chat
    const consumedText = recipe.ingredients.map(ing => {
      const c = ing.getComponent(selections[ing.id]) ?? ing.components[0];
      return c ? `${c.name} ×${c.quantity}` : ing.name;
    }).join(", ") || "—";

    const crafts = game.settings.get(MODULE_ID, "activeCrafts") ?? [];
    crafts.push({
      id:             foundry.utils.randomID(),
      userId:         game.user.id,
      actorId:        inventoryActor.id,
      recipeName:     recipe.name,
      resultItemData: {
        name: recipe.name,
        img:  recipe.img,
        type: "equipment",
      },
      quirks:          quirks.flaws,
      boons:           quirks.boons,
      totalHours:      recipe.timeHours,
      completedHours:  0,
    });
    await game.settings.set(MODULE_ID, "activeCrafts", crafts);

    const delta       = rollResult - recipe.dc;
    const sign        = delta >= 0 ? "+" : "";
    const flawList    = quirks.flaws.length
      ? quirks.flaws.map(f => `<li><strong>${f.name}:</strong> ${f.effect}</li>`).join("")
      : `<li>${game.i18n.localize("HELIANAS.NoFlaws")}</li>`;
    const boonList    = quirks.boons.length
      ? quirks.boons.map(b => `<li><strong>${b.name}:</strong> ${b.effect}</li>`).join("")
      : `<li>${game.i18n.localize("HELIANAS.NoBoons")}</li>`;
    const warnHtml    = warnings.length
      ? `<p class="hm-warning">⚠ ${game.i18n.format("HELIANAS.MaterialWarning", { items: warnings.join(", ") })}</p>`
      : "";
    const actorsLine  = craftingActor.id === inventoryActor.id
      ? ""
      : `<p><em>${game.i18n.format("HELIANAS.ActorsLine", { crafter: craftingActor.name, holder: inventoryActor.name })}</em></p>`;

    ChatMessage.create({
      content: CraftingApp._chatHtml(
        `⚒ ${recipe.name} — ${game.i18n.localize("HELIANAS.CraftStarted")}`,
        `${actorsLine}
         <p><strong>Roll:</strong> ${rollResult} · <strong>DC:</strong> ${recipe.dc} · <strong>Δ:</strong> ${sign}${delta}</p>
         <p><strong>${game.i18n.localize("HELIANAS.TimeRequired")}:</strong> ${recipe.timeHours} ${game.i18n.localize("HELIANAS.Hours")}</p>
         <p><strong>${game.i18n.localize("HELIANAS.Flaws")}:</strong></p><ul>${flawList}</ul>
         <p><strong>${game.i18n.localize("HELIANAS.Boons")}:</strong></p><ul>${boonList}</ul>
         <hr><p><strong>${game.i18n.localize("HELIANAS.MaterialsConsumed")}:</strong> ${consumedText}</p>
         ${warnHtml}`
      ),
      speaker: ChatMessage.getSpeaker({ actor: craftingActor }),
    });

    this._selectedId     = null;
    this._slottedEssence = null;
    this.render();

    Hooks.callAll("helianas:craftStarted");
  }

  static _chatHtml(title, body) {
    return `<div class="hm-chat-message"><h3>${title}</h3>${body}</div>`;
  }

  // ------------------------------------------------------------------ render hooks

  _onRender(context, options) {
    const el = this.element;

    el.querySelector(".hm-search-input")?.addEventListener("input",
      foundry.utils.debounce(e => {
        this._searchQuery = e.target.value;
        this.render();
      }, 250)
    );

    el.querySelector(".hm-actor-select-crafter")?.addEventListener("change", async e => {
      await game.settings.set(MODULE_ID, "craftingActorId", e.target.value);
      this.render();
    });
    el.querySelector(".hm-actor-select-inventory")?.addEventListener("change", async e => {
      await game.settings.set(MODULE_ID, "inventoryActorId", e.target.value);
      this.render();
    });

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
