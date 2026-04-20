import { TOOLS, ESSENCE_TIERS, CREATURE_TYPE_SKILLS, ABILITY_LABELS } from "./constants.mjs";
import { editComponent } from "./ComponentEditForm.mjs";
import { RECIPE_PAGE_TYPE } from "./Recipe.mjs";

const Base = foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet;

// Rarity → default essence tier, DC, and crafting time (hours).
// Used when an item is dropped onto the Result slot to pre-fill the recipe.
const RARITY_DEFAULTS = {
  "common":    { tier: "",       dc: 12, hours:   1 },
  "uncommon":  { tier: "frail",  dc: 15, hours:  10 },
  "rare":      { tier: "robust", dc: 18, hours:  40 },
  "very rare": { tier: "potent", dc: 21, hours: 160 },
  "legendary": { tier: "mythic", dc: 25, hours: 640 },
  "artifact":  { tier: "deific", dc: 30, hours: 100000 },
};

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
   * Writes rarity/attunement/tier/DC/time fields onto the given update patch
   * based on the dropped item. Only overwrites fields that are still at their
   * schema defaults so we don't stomp on authored values.
   */
  #mergeAutoFillFromItem(update, item) {
    const sys = this.document.system;
    const itemSys = item.system ?? {};

    const rarity = this.#normalizeRarity(itemSys.rarity);
    if (rarity && !sys.rarity) update["system.rarity"] = rarity;

    const attunement = this.#normalizeAttunement(itemSys.attunement);
    if (attunement && sys.attunement === "none") update["system.attunement"] = attunement;

    const meta = RARITY_DEFAULTS[rarity];
    if (!meta) return;

    const isForge = sys.recipeType === "forge";

    if (!sys.essenceTierRequired && meta.tier) {
      update["system.essenceTierRequired"] = meta.tier;
    }
    // Only auto-fill DC/time when they still look like the schema defaults
    // (dc=15, timeHours=8). That way we don't clobber intentional values.
    if (sys.dc === 15) update["system.dc"] = meta.dc;
    if (sys.timeHours === 8) update["system.timeHours"] = meta.hours;
    if (isForge) {
      if (sys.enchantingDc === 15) update["system.enchantingDc"] = meta.dc;
      if (sys.enchantingTimeHours === 8) update["system.enchantingTimeHours"] = meta.hours;
    }
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
