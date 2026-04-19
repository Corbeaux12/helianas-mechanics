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
      switchPath:      CraftingApp.#switchPath,
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

  /** @type {"manufacturing"|"cooking"|"forge"} */
  _activeTab = "manufacturing";
  /** @type {string|null} "${journalId}.${pageId}" */
  _selectedId = null;
  /** @type {"enchanting"|"forging"} */
  _activePath = "enchanting";
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

  async _prepareContext(options) {
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
      detail: selectedRecipe ? await this._buildDetail(selectedRecipe, inventoryActor) : null,
    };
  }

  _recipeKey(recipe) {
    return `${recipe.page.parent?.id ?? "j"}.${recipe.page.id}`;
  }

  async _buildDetail(recipe, inventoryActor) {
    const type       = recipe.recipeType;
    const isForge    = type === "forge";
    const isCooking  = type === "cooking";
    const selections = this._componentSelections[this._selectedId] ?? {};

    // Forge recipes need their linked base manufacturing recipe to supply either
    // the base item (enchanting path) or the raw materials (forging path).
    let baseRecipe = null;
    let missingBaseRecipe = false;
    if (isForge) {
      baseRecipe = await recipe.resolveBaseRecipe();
      if (!baseRecipe) missingBaseRecipe = true;
    }

    const path = isForge ? this._activePath : null;
    const effectiveList = isForge
      ? recipe.effectiveIngredients(path, baseRecipe)
      : recipe.ingredients;

    const evaluated = recipe.evaluateList(effectiveList, inventoryActor, selections);

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

    const allAvailable = !missingBaseRecipe && evaluated.every(e => {
      const sel = e.components.find(c => c.id === e.selectedId);
      return sel && sel.inventoryQuantity >= sel.quantity;
    });

    const essenceRequired = isForge;

    const maxBoons = this._slottedEssence
      ? (ESSENCE_TIERS[this._slottedEssence.tier]?.maxBoons ?? 0)
      : 0;

    // Path-specific DC / time / formulas / labels for forge recipes.
    let dc, timeHours, toolLabel, abilityLabel, rollFormula, actionLabel;
    let mfgStats = null, encStats = null;

    if (isForge) {
      const mfgDc     = baseRecipe?.dc ?? recipe.dc;
      const mfgTime   = baseRecipe?.timeHours ?? recipe.timeHours;
      const mfgTool   = TOOLS[baseRecipe?.toolKey];
      const mfgAbil   = ABILITY_LABELS[baseRecipe?.toolAbility]
        ?? (baseRecipe?.toolAbility ?? "").toUpperCase();
      const mfgToolLabel = mfgTool?.label ?? baseRecipe?.toolKey ?? "";

      const encDc   = recipe.enchantingDc;
      const encTime = recipe.enchantingTimeHours;
      const encFormula = this._enchantingFormula(recipe);
      const mfgFormula = this._manufacturingFormula(baseRecipe);

      mfgStats = { dc: mfgDc, timeHours: mfgTime, toolLabel: mfgToolLabel, abilityLabel: mfgAbil, formula: mfgFormula };
      encStats = { dc: encDc, timeHours: encTime, formula: encFormula };

      if (path === "enchanting") {
        dc           = encDc;
        timeHours    = encTime;
        toolLabel    = "";
        abilityLabel = "";
        rollFormula  = encFormula;
        actionLabel  = game.i18n.localize("HELIANAS.EnchantItem");
      } else {
        dc           = mfgDc;
        timeHours    = Math.max(mfgTime, encTime);
        toolLabel    = mfgToolLabel;
        abilityLabel = mfgAbil;
        rollFormula  = this._forgeFormula(recipe, baseRecipe);
        actionLabel  = game.i18n.localize("HELIANAS.ForgeItem");
      }
    } else {
      const toolEntry = TOOLS[recipe.toolKey];
      dc           = recipe.dc;
      timeHours    = recipe.timeHours;
      toolLabel    = toolEntry?.label ?? recipe.toolKey;
      abilityLabel = ABILITY_LABELS[recipe.toolAbility] ?? (recipe.toolAbility ?? "").toUpperCase();
      rollFormula  = this._rollFormula(recipe);
      actionLabel  = this._actionLabel(type);
    }

    return {
      type,
      isForge,
      isCooking,
      activePath:       path,
      isEnchantingPath: isForge && path === "enchanting",
      isForgingPath:    isForge && path === "forging",
      missingBaseRecipe,
      actionLabel,
      name:           recipe.name,
      img:            recipe.img,
      dc,
      timeHours,
      toolLabel,
      abilityLabel,
      rollFormula,
      mfgStats,
      encStats,
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
      case "forge":   return game.i18n.localize("HELIANAS.ForgeItem");
      case "cooking": return game.i18n.localize("HELIANAS.CookMeal");
      default:        return game.i18n.localize("HELIANAS.CraftItem");
    }
  }

  _rollFormula(recipe) {
    // manufacturing / cooking — single tool-ability check.
    return this._manufacturingFormula(recipe);
  }

  _manufacturingFormula(recipe) {
    if (!recipe) return "";
    const ability = ABILITY_LABELS[recipe.toolAbility] ?? "MOD";
    const tool    = TOOLS[recipe.toolKey]?.label ?? recipe.toolKey ?? "Tool";
    return `1d20 + ${ability} mod + Prof (${tool})`;
  }

  _enchantingFormula(recipe) {
    const skill        = CREATURE_TYPE_SKILLS[recipe.componentCreatureType?.toLowerCase()] ?? "Skill";
    const creatureType = recipe.componentCreatureType ?? "";
    return `1d20 + Spellcasting mod + ${skill}${creatureType ? ` (${creatureType})` : ""}`;
  }

  _forgeFormula(recipe, baseRecipe) {
    const ability = ABILITY_LABELS[baseRecipe?.toolAbility] ?? "MOD";
    const tool    = TOOLS[baseRecipe?.toolKey]?.label ?? baseRecipe?.toolKey ?? "Tool";
    const skill        = CREATURE_TYPE_SKILLS[recipe.componentCreatureType?.toLowerCase()] ?? "Skill";
    const creatureType = recipe.componentCreatureType ?? "";
    return `1d20 + ${ability} mod + Prof (${tool}) + Spellcasting mod + ${skill}${creatureType ? ` (${creatureType})` : ""}`;
  }

  // ------------------------------------------------------------------ actions

  static #selectRecipe(event, target) {
    const id = target.closest("[data-recipe-id]")?.dataset.recipeId ?? target.dataset.recipeId;
    this._selectedId     = id === this._selectedId ? null : id;
    this._slottedEssence = null;
    this._activePath     = "enchanting";
    this.render();
  }

  static #switchTab(event, target) {
    this._activeTab      = target.dataset.tab;
    this._selectedId     = null;
    this._slottedEssence = null;
    this._activePath     = "enchanting";
    this.render();
  }

  static #switchPath(event, target) {
    const path = target.dataset.path;
    if (path !== "enchanting" && path !== "forging") return;
    this._activePath = path;
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

    const isForge = recipe.recipeType === "forge";
    let baseRecipe = null;
    if (isForge) {
      baseRecipe = await recipe.resolveBaseRecipe();
      if (!baseRecipe) {
        ui.notifications.warn(game.i18n.localize("HELIANAS.ForgeMissingBase"));
        return;
      }
    }

    const path = isForge ? this._activePath : null;
    const effectiveList = isForge
      ? recipe.effectiveIngredients(path, baseRecipe)
      : recipe.ingredients;

    const selections  = this._componentSelections[this._selectedId] ?? {};
    const essenceTier = this._slottedEssence?.tier ?? null;
    // Quirk table: forge recipes pick the table by path; others use recipeType.
    const quirkType = isForge
      ? (path === "enchanting" ? "enchanting" : "forging")
      : (recipe.recipeType ?? this._activeTab);
    // DC used for the quirk delta — the relevant check for the selected path.
    const effectiveDc = isForge
      ? (path === "enchanting" ? recipe.enchantingDc : (baseRecipe?.dc ?? recipe.dc))
      : recipe.dc;
    const quirks = QuirkEngine.calculateQuirks(rollResult, effectiveDc, essenceTier, quirkType);

    if (quirks.destroyed) {
      // Destroyed on catastrophic failure — still consume materials
      await recipe.consumeFromList(effectiveList, inventoryActor, selections);
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

    const warnings = await recipe.consumeFromList(effectiveList, inventoryActor, selections);

    // Build a text summary of consumed components for chat
    const consumedText = effectiveList.map(ing => {
      const c = ing.getComponent(selections[ing.id]) ?? ing.components[0];
      return c ? `${c.name} ×${c.quantity}` : ing.name;
    }).join(", ") || "—";

    const totalHours = isForge
      ? (path === "enchanting"
          ? recipe.enchantingTimeHours
          : Math.max(baseRecipe?.timeHours ?? 0, recipe.enchantingTimeHours))
      : recipe.timeHours;

    const crafts = game.settings.get(MODULE_ID, "activeCrafts") ?? [];
    crafts.push({
      id:             foundry.utils.randomID(),
      userId:         game.user.id,
      actorId:        inventoryActor.id,
      recipeName:     recipe.name,
      recipeType:     recipe.recipeType ?? this._activeTab,
      forgePath:      path,
      resultItemData: {
        name: recipe.name,
        img:  recipe.img,
        type: "equipment",
      },
      quirks:          quirks.flaws,
      boons:           quirks.boons,
      totalHours,
      completedHours:  0,
    });
    await game.settings.set(MODULE_ID, "activeCrafts", crafts);

    const delta       = rollResult - effectiveDc;
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
         <p><strong>Roll:</strong> ${rollResult} · <strong>DC:</strong> ${effectiveDc} · <strong>Δ:</strong> ${sign}${delta}</p>
         <p><strong>${game.i18n.localize("HELIANAS.TimeRequired")}:</strong> ${totalHours} ${game.i18n.localize("HELIANAS.Hours")}</p>
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
