import { MODULE_ID, TOOLS, ESSENCE_TIERS, ESSENCE_TIER_ORDER, ABILITY_LABELS, CREATURE_TYPE_SKILLS } from "./constants.mjs";
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
      const mfgDc        = baseRecipe?.dc ?? recipe.dc;
      const mfgTime      = baseRecipe?.timeHours ?? recipe.timeHours;
      const mfgTool      = TOOLS[baseRecipe?.toolKey];
      const mfgAbil      = this._toolAbilitiesLabel(baseRecipe?.toolKey);
      const mfgToolLabel = mfgTool?.label ?? baseRecipe?.toolKey ?? "";

      const encDc      = recipe.enchantingDc;
      const encTime    = recipe.enchantingTimeHours;
      // Pure enchanting path uses spellcasting; forging-path "enchanting" check
      // uses the same tool ability + prof as the manufacturing check.
      const pureEncFormula    = this._enchantingFormula(recipe);
      const forgingEncFormula = this._forgingEnchantingFormula(recipe, baseRecipe);
      const mfgFormula        = this._manufacturingFormula(baseRecipe);

      mfgStats = { dc: mfgDc, timeHours: mfgTime, toolLabel: mfgToolLabel, abilityLabel: mfgAbil, formula: mfgFormula };
      encStats = {
        dc:        encDc,
        timeHours: encTime,
        formula:   path === "forging" ? forgingEncFormula : pureEncFormula,
      };

      if (path === "enchanting") {
        dc           = encDc;
        timeHours    = encTime;
        toolLabel    = "";
        abilityLabel = "";
        rollFormula  = pureEncFormula;
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
      abilityLabel = this._toolAbilitiesLabel(recipe.toolKey);
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
      slottedEssence:    this._slottedEssence,
      essenceOptions:    this._collectEssenceOptions(inventoryActor, recipe.essenceTierRequired),
      requiredTierLabel: ESSENCE_TIERS[recipe.essenceTierRequired]?.label ?? "",
    };
  }

  /**
   * Build a select-friendly list of essences in an actor's inventory. An item
   * counts as an essence when it has flags["helianas-mechanics"].isEssence or
   * carries the "essence" crafting tag. Tier (and a max-boons hint) is read
   * from flags["helianas-mechanics"].essenceTier when present.
   *
   * When `minTier` is set, essences whose tier ranks below it are filtered out
   * so the player can only pick something at or above the recipe's minimum.
   */
  _collectEssenceOptions(actor, minTier = "") {
    if (!actor?.items) return [];
    const items = actor.items.contents ?? Array.from(actor.items);
    const minRank = ESSENCE_TIER_ORDER[minTier] ?? 0;
    const out = [];
    for (const item of items) {
      const flags = item.flags?.[MODULE_ID] ?? {};
      const tags  = Array.isArray(flags.tags) ? flags.tags : [];
      const isEssence = flags.isEssence === true || tags.includes("essence");
      if (!isEssence) continue;
      const tier      = typeof flags.essenceTier === "string" ? flags.essenceTier : "";
      const rank      = ESSENCE_TIER_ORDER[tier] ?? 0;
      if (rank < minRank) continue;
      const tierLabel = ESSENCE_TIERS[tier]?.label ?? "";
      const qty       = Number(item.system?.quantity ?? 1);
      const suffix    = [tierLabel, qty > 1 ? `×${qty}` : null].filter(Boolean).join(" · ");
      out.push({
        uuid:  item.uuid,
        name:  item.name,
        tier,
        label: suffix ? `${item.name} (${suffix})` : item.name,
      });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
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

  /**
   * Joined ability label for a tool, e.g. "STR or DEX". Falls back to the
   * generic "MOD" placeholder when the tool key is empty/unknown.
   */
  _toolAbilitiesLabel(toolKey) {
    const abilities = TOOLS[toolKey]?.abilities;
    if (!abilities?.length) return "MOD";
    return abilities.map(a => ABILITY_LABELS[a] ?? a.toUpperCase()).join(" or ");
  }

  _manufacturingFormula(recipe) {
    if (!recipe) return "";
    const ability = this._toolAbilitiesLabel(recipe.toolKey);
    const tool    = TOOLS[recipe.toolKey]?.label ?? recipe.toolKey ?? "Tool";
    return `1d20 + ${ability} mod + Prof (${tool})`;
  }

  _enchantingFormula(recipe) {
    const skill        = CREATURE_TYPE_SKILLS[recipe.componentCreatureType?.toLowerCase()] ?? "Skill";
    const creatureType = recipe.componentCreatureType ?? "";
    return `1d20 + Spellcasting mod + ${skill}${creatureType ? ` (${creatureType})` : ""}`;
  }

  /**
   * Forging path "enchanting" check: spellcasters and non-spellcasters alike
   * roll the tool's ability + proficiency, plus the creature-type skill.
   */
  _forgingEnchantingFormula(recipe, baseRecipe) {
    if (!baseRecipe) return "";
    const ability      = this._toolAbilitiesLabel(baseRecipe.toolKey);
    const tool         = TOOLS[baseRecipe.toolKey]?.label ?? baseRecipe.toolKey ?? "Tool";
    const skill        = CREATURE_TYPE_SKILLS[recipe.componentCreatureType?.toLowerCase()] ?? "Skill";
    const creatureType = recipe.componentCreatureType ?? "";
    return `1d20 + ${ability} mod + Prof (${tool}) + ${skill}${creatureType ? ` (${creatureType})` : ""}`;
  }

  _forgeFormula(recipe, baseRecipe) {
    return this._forgingEnchantingFormula(recipe, baseRecipe);
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

  static async #craftItem() {
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
    const isForgingPath = isForge && path === "forging";

    // Forging path runs two checks (manufacturing + enchanting); every other
    // path is a single check. Each entry: { label, dc, roll, quirkType }.
    const checks = isForgingPath
      ? [
          { label: game.i18n.localize("HELIANAS.Manufacturing"),
            dc:    baseRecipe?.dc ?? recipe.dc,
            roll:  this._readRollInput(".hm-roll-input--mfg"),
            quirkType: "manufacturing" },
          { label: game.i18n.localize("HELIANAS.Enchanting"),
            dc:    recipe.enchantingDc,
            roll:  this._readRollInput(".hm-roll-input--enc"),
            quirkType: "enchanting" },
        ]
      : [
          { label: "",
            dc:    isForge ? recipe.enchantingDc : recipe.dc,
            roll:  this._readRollInput(".hm-roll-input"),
            quirkType: isForge ? "enchanting" : (recipe.recipeType ?? this._activeTab) },
        ];

    if (checks.some(c => c.roll === null)) {
      ui.notifications.warn(game.i18n.localize("HELIANAS.EnterRollFirst"));
      return;
    }

    const effectiveList = isForge
      ? recipe.effectiveIngredients(path, baseRecipe)
      : recipe.ingredients;
    const selections  = this._componentSelections[this._selectedId] ?? {};
    const essenceTier = this._slottedEssence?.tier ?? null;

    const results = checks.map(c => ({
      ...c,
      delta:  c.roll - c.dc,
      quirks: QuirkEngine.calculateQuirks(c.roll, c.dc, essenceTier, c.quirkType),
    }));

    if (results.some(r => r.quirks.destroyed)) {
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

    const consumedText = effectiveList.map(ing => {
      const c = ing.getComponent(selections[ing.id]) ?? ing.components[0];
      return c ? `${c.name} ×${c.quantity}` : ing.name;
    }).join(", ") || "—";

    const totalHours = isForge
      ? (path === "enchanting"
          ? recipe.enchantingTimeHours
          : Math.max(baseRecipe?.timeHours ?? 0, recipe.enchantingTimeHours))
      : recipe.timeHours;

    const allFlaws = results.flatMap(r => r.quirks.flaws);
    const allBoons = results.flatMap(r => r.quirks.boons);

    const crafts = game.settings.get(MODULE_ID, "activeCrafts") ?? [];
    crafts.push({
      id:             foundry.utils.randomID(),
      userId:         game.user.id,
      actorId:        inventoryActor.id,
      recipeName:     recipe.name,
      recipeType:     recipe.recipeType ?? this._activeTab,
      forgePath:      path,
      resultItemData: { name: recipe.name, img: recipe.img, type: "equipment" },
      quirks:          allFlaws,
      boons:           allBoons,
      totalHours,
      completedHours:  0,
    });
    await game.settings.set(MODULE_ID, "activeCrafts", crafts);

    const checkLines = results.map(r => {
      const sign = r.delta >= 0 ? "+" : "";
      const head = r.label ? `<strong>${r.label}</strong> · ` : "";
      return `<p>${head}<strong>Roll:</strong> ${r.roll} · <strong>DC:</strong> ${r.dc} · <strong>Δ:</strong> ${sign}${r.delta}</p>`;
    }).join("");

    const renderQuirkList = (entries, emptyKey) => entries.length
      ? entries.map(e => `<li><strong>${e.name}:</strong> ${e.effect}</li>`).join("")
      : `<li>${game.i18n.localize(emptyKey)}</li>`;

    const flawList = renderQuirkList(allFlaws, "HELIANAS.NoFlaws");
    const boonList = renderQuirkList(allBoons, "HELIANAS.NoBoons");
    const warnHtml = warnings.length
      ? `<p class="hm-warning">⚠ ${game.i18n.format("HELIANAS.MaterialWarning", { items: warnings.join(", ") })}</p>`
      : "";
    const actorsLine = craftingActor.id === inventoryActor.id
      ? ""
      : `<p><em>${game.i18n.format("HELIANAS.ActorsLine", { crafter: craftingActor.name, holder: inventoryActor.name })}</em></p>`;

    ChatMessage.create({
      content: CraftingApp._chatHtml(
        `⚒ ${recipe.name} — ${game.i18n.localize("HELIANAS.CraftStarted")}`,
        `${actorsLine}
         ${checkLines}
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

  /** Returns the parsed roll value for a selector, or null when blank/invalid. */
  _readRollInput(selector) {
    const raw = this.element.querySelector(selector)?.value;
    if (raw === undefined || raw === null || raw === "") return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
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

    el.querySelector(".hm-essence-select")?.addEventListener("change", e => {
      this._onSelectEssence(e.target.value);
    });
  }

  async _onSelectEssence(uuid) {
    if (!uuid) {
      this._slottedEssence = null;
      this.render();
      return;
    }
    const item = await fromUuid(uuid);
    if (!item) {
      this._slottedEssence = null;
      this.render();
      return;
    }
    const flags = item.flags?.[MODULE_ID] ?? {};
    this._slottedEssence = { name: item.name, tier: flags.essenceTier ?? "", uuid };
    this.render();
  }
}
