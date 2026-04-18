import { TOOLS, ESSENCE_TIERS, CREATURE_TYPE_SKILLS, ABILITY_LABELS } from "./constants.mjs";
import { editComponent } from "./ComponentEditForm.mjs";

const Base = foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet;

export class RecipePageSheet extends Base {
  static DEFAULT_OPTIONS = {
    classes: ["helianas-mechanics", "recipe-page-sheet"],
    position: { width: 620, height: 780 },
    form: {
      submitOnChange: true,
      closeOnSubmit:  false,
    },
    actions: {
      addIngredient:    RecipePageSheet.#onAddIngredient,
      deleteIngredient: RecipePageSheet.#onDeleteIngredient,
      addComponent:     RecipePageSheet.#onAddComponent,
      deleteComponent:  RecipePageSheet.#onDeleteComponent,
      editComponent:    RecipePageSheet.#onEditComponent,
      clearResult:      RecipePageSheet.#onClearResult,
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

    return Object.assign(ctx, {
      system,
      recipeTypeOptions: [
        { value: "manufacturing", label: game.i18n.localize("HELIANAS.Manufacturing") },
        { value: "enchanting",    label: game.i18n.localize("HELIANAS.Enchanting") },
        { value: "forging",       label: game.i18n.localize("HELIANAS.Forging") },
        { value: "cooking",       label: game.i18n.localize("HELIANAS.Cooking") },
      ],
      toolOptions: [
        { value: "", label: game.i18n.localize("HELIANAS.None") },
        ...Object.entries(TOOLS).map(([key, t]) => ({ value: key, label: t.label })),
      ],
      abilityOptions: [
        { value: "", label: game.i18n.localize("HELIANAS.None") },
        ...Object.entries(ABILITY_LABELS).map(([key, label]) => ({ value: key, label })),
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

  // ---------------------------------------------------------------- submit

  /**
   * The form only submits scalar fields (ingredient names, component quantities).
   * Array entries in the schema carry extra state (id, uuid, img, tags, mode,
   * resourcePath) that isn't in the form. Merge those back in by id so a simple
   * quantity edit doesn't wipe an item-linked component.
   */
  _prepareSubmitData(event, form, formData, updateData) {
    const data = super._prepareSubmitData(event, form, formData, updateData);
    const fromForm = foundry.utils.getProperty(data, "system.ingredients");
    if (!Array.isArray(fromForm)) return data;

    const current = this.document.system.ingredients ?? [];
    const merged = fromForm.map((ing, i) => {
      const base = current.find(c => c.id === ing?.id) ?? current[i] ?? {};
      const comps = Array.isArray(ing?.components) ? ing.components : [];
      const baseComps = base.components ?? [];
      return {
        ...base,
        ...ing,
        id: base.id ?? ing?.id ?? foundry.utils.randomID(),
        components: comps.map((c, j) => {
          const cb = baseComps.find(bc => bc.id === c?.id) ?? baseComps[j] ?? {};
          return { ...cb, ...c, id: cb.id ?? c?.id ?? foundry.utils.randomID() };
        }),
      };
    });
    foundry.utils.setProperty(data, "system.ingredients", merged);
    return data;
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
    if (data?.type !== "Item" || !data.uuid) return;

    const item = await fromUuid(data.uuid);
    if (!item) return;

    const target = el.dataset.drop;
    if (target === "result") {
      await this.document.update({
        "system.resultName": item.name,
        "system.resultImg":  item.img,
        "system.resultUuid": item.uuid,
      });
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
}
