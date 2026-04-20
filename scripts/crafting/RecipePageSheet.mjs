import { TOOLS, ESSENCE_TIERS, CREATURE_TYPE_SKILLS, ABILITY_LABELS,
         MAGIC_RARITY_TABLE, MFG_ITEM_TABLE } from "./constants.mjs";
import { editComponent } from "./ComponentEditForm.mjs";
import { RECIPE_PAGE_TYPE } from "./Recipe.mjs";

const Base = foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet;

// dnd5e weapon baseItem → forged vs carved classification for tool pick.
const METAL_WEAPON_BASES = new Set([
  "battleaxe", "greataxe", "handaxe", "dagger", "flail", "glaive", "greatsword",
  "halberd", "lance", "longsword", "mace", "maul", "morningstar", "pike", "pick",
  "rapier", "scimitar", "shortsword", "sickle", "trident", "warhammer", "warpick",
  "whip",
]);
const WOOD_WEAPON_BASES = new Set([
  "club", "greatclub", "quarterstaff", "spear", "javelin", "dart", "longbow",
  "shortbow", "blowgun", "sling", "lightcrossbow", "heavycrossbow", "handcrossbow",
  "net",
]);

export class RecipePageSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["helianas-mechanics", "recipe-page-sheet"],
    position: { width: 620, height: 780 },
    form: {
      submitOnChange: true,
      closeOnSubmit:  false,
    },
    actions: {
      addIngredient:        RecipePageSheet.#onAddIngredient,
      deleteIngredient:     RecipePageSheet.#onDeleteIngredient,
      addComponent:         RecipePageSheet.#onAddComponent,
      deleteComponent:      RecipePageSheet.#onDeleteComponent,
      editComponent:        RecipePageSheet.#onEditComponent,
      clearResult:          RecipePageSheet.#onClearResult,
      clearBaseItemRecipe:  RecipePageSheet.#onClearBaseItemRecipe,
    },
  };

  static EDIT_PARTS = {
    content: {
      template: "modules/helianas-mechanics/templates/crafting/recipe-page-edit.hbs",
      root:     true,
    },
  };

  static VIEW_PARTS = {
    content: {
      template: "modules/helianas-mechanics/templates/crafting/recipe-page-view.hbs",
      root:     true,
    },
  };

  async _prepareContext(options) {
    const ctx    = await super._prepareContext(options);
    const system = this.document.system;
    const baseRecipe = await this.#resolveLinkedBaseRecipe(system.baseItemRecipeUuid);
    const toolAbilities = TOOLS[system.toolKey]?.abilities ?? [];
    const selectedToolAbilitiesLabel = toolAbilities.length
      ? toolAbilities.map(a => ABILITY_LABELS[a] ?? a.toUpperCase()).join(" or ")
      : "";

    return Object.assign(ctx, {
      system,
      isForge:   system.recipeType === "forge",
      isCooking: system.recipeType === "cooking",
      isManufacturing: system.recipeType === "manufacturing",
      baseRecipe,
      selectedToolAbilitiesLabel,
      recipeTypeOptions: [
        { value: "manufacturing", label: game.i18n.localize("HELIANAS.Manufacturing") },
        { value: "cooking",       label: game.i18n.localize("HELIANAS.Cooking") },
        { value: "forge",         label: game.i18n.localize("HELIANAS.Forge") },
      ],
      toolOptions: [
        { value: "", label: game.i18n.localize("HELIANAS.None") },
        ...Object.entries(TOOLS).map(([key, t]) => ({
          value: key,
          label: `${t.label} (${(t.abilities ?? []).map(a => ABILITY_LABELS[a] ?? a.toUpperCase()).join(" or ")})`,
        })),
      ],
      essenceOptions: [
        { value: "", label: game.i18n.localize("HELIANAS.None") },
        ...Object.entries(ESSENCE_TIERS).map(([key, t]) => ({ value: key, label: t.label })),
      ],
      creatureTypeOptions: [
        { value: "", label: game.i18n.localize("HELIANAS.None") },
        ...Object.keys(CREATURE_TYPE_SKILLS).map(t => ({ value: t, label: t })),
      ],
      attunementOptions: ["none", "optional", "required", "required-spellcaster"]
        .map(v => ({ value: v, label: v })),
    });
  }

  /**
   * Writes rarity/attunement/tier/DC/time/tool fields onto the given update
   * patch based on the dropped item. Only overwrites fields that are still at
   * their schema defaults so we don't stomp on authored values.
   *
   * Sources:
   *   - Enchanting DC and time come from the Enchanting Rarity/DC/Time table,
   *     indexed by (rarity, item-kind) where kind is consumable/attunement/
   *     non-attunement — see `#detectItemKind`.
   *   - Manufacturing DC and time come from the Manufacturing DC & Time table,
   *     indexed by the dnd5e item sub-type — see `#detectMfgSubtype`.
   *   - Tool suggestion comes from `#detectToolKey`.
   */
  #mergeAutoFillFromItem(update, item) {
    const sys = this.document.system;

    const rarity = this.#normalizeRarity(item.system?.rarity);
    if (rarity && !sys.rarity) update["system.rarity"] = rarity;

    const attunement = this.#normalizeAttunement(item.system?.attunement);
    if (attunement && sys.attunement === "none") update["system.attunement"] = attunement;

    const kind       = this.#detectItemKind(item);           // consumable | attunement | non-attunement
    const toolKey    = this.#detectToolKey(item);            // TOOLS key or ""
    const mfgSubtype = this.#detectMfgSubtype(item);         // MFG_ITEM_TABLE key
    const magicRow   = rarity ? MAGIC_RARITY_TABLE[rarity] : null;
    const mfgRow     = MFG_ITEM_TABLE[mfgSubtype];

    const isForge         = sys.recipeType === "forge";
    const isManufacturing = sys.recipeType === "manufacturing";
    const isCooking       = sys.recipeType === "cooking";

    // Auto-fill essence tier from rarity.
    if (!sys.essenceTierRequired && magicRow?.tier) {
      update["system.essenceTierRequired"] = magicRow.tier;
    }

    // Auto-fill tool when the user hasn't picked one yet.
    // Cooking recipes always use Cook's Utensils.
    if (!sys.toolKey) {
      if (isCooking) update["system.toolKey"] = "cooks-utensils";
      else if (toolKey) update["system.toolKey"] = toolKey;
    }

    // Manufacturing recipes: DC/time come from the mundane-item table.
    if (isManufacturing && mfgRow) {
      if (sys.dc === 15)       update["system.dc"]        = mfgRow.dc;
      if (sys.timeHours === 8) update["system.timeHours"] = mfgRow.hours;
    }

    // Cooking: fall back to the manufacturing table too (most cooking results
    // are mundane food). If the item carries a rarity, the magic row instead
    // wins so exotic meals still get reasonable defaults.
    if (isCooking) {
      if (magicRow) {
        const hours = magicRow[kind];
        if (sys.dc === 15)       update["system.dc"]        = magicRow.dc;
        if (sys.timeHours === 8) update["system.timeHours"] = hours;
      } else if (mfgRow) {
        if (sys.dc === 15)       update["system.dc"]        = mfgRow.dc;
        if (sys.timeHours === 8) update["system.timeHours"] = mfgRow.hours;
      }
    }

    // Forge recipes split their values: the manufacturing-side dc/time are
    // inherited from the linked base recipe at craft time, so we only need to
    // auto-fill the enchanting-side DC/time from the magic table here.
    if (isForge && magicRow) {
      const hours = magicRow[kind];
      if (sys.enchantingDc === 15)       update["system.enchantingDc"]        = magicRow.dc;
      if (sys.enchantingTimeHours === 8) update["system.enchantingTimeHours"] = hours;
    }
  }

  /**
   * Classify a dnd5e item for the Enchanting DC/Time table. The table's three
   * time columns correspond to:
   *   - "consumable"     — single-use items (potions, scrolls, charges that
   *                        expire). dnd5e item.type === "consumable".
   *   - "attunement"     — items that require or offer attunement.
   *   - "non-attunement" — everything else (e.g. a non-attuned magic sword).
   */
  #detectItemKind(item) {
    if (item?.type === "consumable") return "consumable";
    const raw = item?.system?.attunement;
    const attun = typeof raw === "string" ? raw.toLowerCase() : raw;
    if (attun === "required" || attun === "optional" || attun === 1 || attun === 2 || attun === "1" || attun === "2") {
      return "attunement";
    }
    return "non-attunement";
  }

  /**
   * Best-guess tool key for the dnd5e item. The mapping follows the catalogue
   * reference's Tools-and-Their-Products table. Returns "" if nothing matches
   * — the user can still pick a tool manually.
   */
  #detectToolKey(item) {
    const type = item?.type;
    const sub  = item?.system?.type?.value ?? "";
    const base = String(item?.system?.type?.baseItem ?? "").toLowerCase();

    if (type === "consumable") {
      if (sub === "potion")   return "alchemists-supplies";
      if (sub === "scroll")   return "calligraphers-supplies";
      if (sub === "poison")   return "alchemists-supplies";
      if (sub === "food")     return "cooks-utensils";
      if (sub === "ammo")     return "smiths-tools";
      return "alchemists-supplies";
    }

    if (type === "weapon") {
      if (METAL_WEAPON_BASES.has(base)) return "smiths-tools";
      if (WOOD_WEAPON_BASES.has(base))  return "woodcarvers-tools";
      // Fall back by weapon category when base isn't recognised.
      if (typeof sub === "string" && sub.startsWith("martial")) return "smiths-tools";
      return "smiths-tools";
    }

    if (type === "equipment") {
      // dnd5e armour types: "light", "medium", "heavy", "shield", "clothing", "trinket".
      if (sub === "light") {
        if (base === "padded")              return "weavers-tools";
        if (base === "leather")             return "leatherworkers-tools";
        if (base === "studdedleather")      return "leatherworkers-tools";
        return "leatherworkers-tools";
      }
      if (sub === "medium") {
        if (base === "hide") return "leatherworkers-tools";
        return "smiths-tools";
      }
      if (sub === "heavy")    return "smiths-tools";
      if (sub === "shield")   return "smiths-tools";
      if (sub === "clothing") return "weavers-tools";
      if (sub === "trinket")  return "jewelers-tools";
    }

    if (type === "tool")      return "tinkers-tools";
    if (type === "loot")      return "";
    if (type === "container") return "leatherworkers-tools";

    return "";
  }

  /**
   * Map a dnd5e item to a key in MFG_ITEM_TABLE. Keeps the match reasonably
   * conservative — unknown shapes fall through to "adventuring-gear".
   */
  #detectMfgSubtype(item) {
    const type = item?.type;
    const sub  = item?.system?.type?.value ?? "";
    const base = String(item?.system?.type?.baseItem ?? "").toLowerCase();

    if (type === "consumable") {
      if (sub === "potion")   return "potion-base";
      if (sub === "scroll")   return "spell-scroll-base";
      if (sub === "ammo")     return "ammunition";
      return "adventuring-gear";
    }

    if (type === "weapon") {
      if (typeof sub === "string" && sub.startsWith("martial")) return "martial-weapon";
      return "simple-weapon";
    }

    if (type === "equipment") {
      if (sub === "light") {
        if (base === "padded")          return "padded-hide-shield";
        if (base === "leather")         return "leather-chain-ring";
        if (base === "studdedleather")  return "studded-scale";
        return "leather-chain-ring";
      }
      if (sub === "medium") {
        if (base === "hide")         return "padded-hide-shield";
        if (base === "chainshirt")   return "leather-chain-ring";
        if (base === "scalemail")    return "studded-scale";
        if (base === "breastplate")  return "breastplate-splint";
        if (base === "halfplate")    return "half-plate";
        return "leather-chain-ring";
      }
      if (sub === "heavy") {
        if (base === "ringmail")  return "leather-chain-ring";
        if (base === "chainmail") return "chain-mail";
        if (base === "splint")    return "breastplate-splint";
        if (base === "plate")     return "plate";
        return "chain-mail";
      }
      if (sub === "shield")   return "padded-hide-shield";
      if (sub === "trinket")  return "wondrous-item";
      if (sub === "clothing") return "adventuring-gear";
    }

    if (type === "tool") {
      if (/instrument/i.test(base) || /instrument/i.test(item?.name ?? "")) return "instrument";
      return "adventuring-gear";
    }

    return "adventuring-gear";
  }

  #normalizeRarity(raw) {
    if (!raw) return "";
    const s = String(raw).toLowerCase().replace(/[_\s]+/g, "");
    const map = {
      common:    "common",
      uncommon:  "uncommon",
      rare:      "rare",
      veryrare:  "very rare",
      legendary: "legendary",
      artifact:  "artifact",
    };
    return map[s] ?? "";
  }

  #normalizeAttunement(raw) {
    if (raw === 1 || raw === "1") return "required";
    if (raw === 2 || raw === "2") return "optional";
    const s = String(raw ?? "").toLowerCase();
    if (s === "required" || s === "req" || s === "req+") return "required";
    if (s === "optional" || s === "opt") return "optional";
    if (s === "required-spellcaster" || s === "req_s") return "required-spellcaster";
    return "";
  }

  async #resolveLinkedBaseRecipe(uuid) {
    if (!uuid) return null;
    const page = await fromUuid(uuid).catch(() => null);
    if (!page || page.type !== RECIPE_PAGE_TYPE) return null;
    return {
      uuid,
      name: page.system?.resultName || page.name || "",
      img:  page.system?.resultImg || "icons/svg/item-bag.svg",
    };
  }

  // ---------------------------------------------------------------- drag/drop

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    if (!root) return;
    for (const slot of root.querySelectorAll("[data-drop]")) {
      slot.addEventListener("dragover",  this.#onDragOver.bind(this));
      slot.addEventListener("dragleave", this.#onDragLeave.bind(this));
      slot.addEventListener("drop",      this.#onDrop.bind(this));
    }
    // Inline ingredient edits are routed through direct document.update calls
    // instead of the form submission path — the form path round-trips through
    // schema cleaning which strips components down to their `initial` values
    // whenever any field changes on the page.
    for (const input of root.querySelectorAll("[data-hm-field='ingredient.name']")) {
      input.addEventListener("change", this.#onIngredientNameChange.bind(this));
    }
    for (const input of root.querySelectorAll("[data-hm-field='component.quantity']")) {
      input.addEventListener("change", this.#onComponentQuantityChange.bind(this));
    }
  }

  async #onIngredientNameChange(event) {
    const input = event.currentTarget;
    const ingId = input.dataset.ingredientId;
    const ingredients = foundry.utils.deepClone(this.document.system.ingredients ?? []);
    const ing = ingredients.find(i => i.id === ingId);
    if (!ing) return;
    ing.name = String(input.value ?? "");
    await this.document.update({ "system.ingredients": ingredients });
  }

  async #onComponentQuantityChange(event) {
    const input = event.currentTarget;
    const ingId  = input.dataset.ingredientId;
    const compId = input.dataset.componentId;
    const q = Number(input.value);
    if (!Number.isFinite(q)) return;
    const ingredients = foundry.utils.deepClone(this.document.system.ingredients ?? []);
    const comp = ingredients.find(i => i.id === ingId)?.components?.find(c => c.id === compId);
    if (!comp) return;
    comp.quantity = Math.max(0, Math.trunc(q));
    await this.document.update({ "system.ingredients": ingredients });
  }

  #onDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add("hm-slot--hover");
  }

  #onDragLeave(event) {
    event.currentTarget.classList.remove("hm-slot--hover");
  }

  async #onDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const el = event.currentTarget;
    el.classList.remove("hm-slot--hover");

    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); }
    catch { return; }
    if (!data?.uuid) return;

    const target = el.dataset.drop;

    // Base-item recipe slot accepts a JournalEntryPage of the recipe sub-type
    // whose own recipeType is "manufacturing".
    if (target === "baseItemRecipe") {
      const page = await fromUuid(data.uuid).catch(() => null);
      if (!page || page.type !== RECIPE_PAGE_TYPE) {
        ui.notifications?.warn(game.i18n.localize("HELIANAS.NotARecipePage"));
        return;
      }
      if (page.system?.recipeType !== "manufacturing") {
        ui.notifications?.warn(game.i18n.localize("HELIANAS.BaseItemNeedsManufacturing"));
        return;
      }
      await this.document.update({ "system.baseItemRecipeUuid": page.uuid });
      return;
    }

    if (data.type !== "Item") return;

    const item = await fromUuid(data.uuid);
    if (!item) return;

    if (target === "result") {
      const update = {
        name:                item.name,
        "system.resultName": item.name,
        "system.resultImg":  item.img,
        "system.resultUuid": item.uuid,
      };
      this.#mergeAutoFillFromItem(update, item);
      await this.document.update(update);
      return;
    }
    if (target === "component") {
      const ingId  = el.dataset.ingredientId;
      const compId = el.dataset.componentId;
      const ingredients = foundry.utils.deepClone(this.document.system.ingredients);
      const ing = ingredients.find(i => i.id === ingId);
      if (!ing) return;
      const comp = ing.components.find(c => c.id === compId);
      if (!comp) return;
      comp.name = item.name;
      comp.img  = item.img;
      comp.uuid = item.uuid;
      await this.document.update({ "system.ingredients": ingredients });
      return;
    }
    if (target === "ingredient") {
      const ingId = el.dataset.ingredientId;
      const ingredients = foundry.utils.deepClone(this.document.system.ingredients);
      const ing = ingredients.find(i => i.id === ingId);
      if (!ing) return;
      const itemTags = item.flags?.["helianas-mechanics"]?.tags;
      ing.components.push({
        id:           foundry.utils.randomID(),
        uuid:         item.uuid,
        name:         item.name,
        nameMode:     "exact",
        img:          item.img,
        quantity:     1,
        tags:         Array.isArray(itemTags) ? [...itemTags] : [],
        mode:         "some",
        resourcePath: "",
      });
      await this.document.update({ "system.ingredients": ingredients });
    }
  }

  // ---------------------------------------------------------------- actions

  static async #onAddIngredient() {
    const ingredients = foundry.utils.deepClone(this.document.system.ingredients);
    ingredients.push({
      id:   foundry.utils.randomID(),
      name: game.i18n.localize("HELIANAS.NewIngredient"),
      components: [],
    });
    await this.document.update({ "system.ingredients": ingredients });
  }

  static async #onDeleteIngredient(event, target) {
    const id = target.dataset.ingredientId;
    const ingredients = this.document.system.ingredients.filter(i => i.id !== id);
    await this.document.update({ "system.ingredients": ingredients });
  }

  static async #onAddComponent(event, target) {
    const ingId = target.dataset.ingredientId;
    const ingredients = foundry.utils.deepClone(this.document.system.ingredients);
    const ing = ingredients.find(i => i.id === ingId);
    if (!ing) return;
    ing.components.push({
      id:           foundry.utils.randomID(),
      uuid:         "",
      name:         game.i18n.localize("HELIANAS.NewComponent"),
      nameMode:     "exact",
      img:          "",
      quantity:     1,
      tags:         [],
      mode:         "some",
      resourcePath: "",
    });
    await this.document.update({ "system.ingredients": ingredients });
  }

  static async #onDeleteComponent(event, target) {
    const ingId  = target.dataset.ingredientId;
    const compId = target.dataset.componentId;
    const ingredients = foundry.utils.deepClone(this.document.system.ingredients);
    const ing = ingredients.find(i => i.id === ingId);
    if (!ing) return;
    ing.components = ing.components.filter(c => c.id !== compId);
    await this.document.update({ "system.ingredients": ingredients });
  }

  static async #onEditComponent(event, target) {
    const ingId  = target.dataset.ingredientId;
    const compId = target.dataset.componentId;
    const ingredients = foundry.utils.deepClone(this.document.system.ingredients);
    const ing = ingredients.find(i => i.id === ingId);
    if (!ing) return;
    const comp = ing.components.find(c => c.id === compId);
    if (!comp) return;
    const updated = await editComponent(comp);
    if (!updated) return;
    Object.assign(comp, updated);
    await this.document.update({ "system.ingredients": ingredients });
  }

  static async #onClearResult() {
    await this.document.update({
      "system.resultName": "",
      "system.resultImg":  "",
      "system.resultUuid": "",
    });
  }

  static async #onClearBaseItemRecipe() {
    await this.document.update({ "system.baseItemRecipeUuid": "" });
  }
}
