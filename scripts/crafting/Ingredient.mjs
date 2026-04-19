import { MODULE_ID } from "./constants.mjs";

const QUANTITY_PATH = "quantity";

export class Component {
  constructor(data = {}, ingredient = null) {
    this.id           = data.id ?? foundry.utils.randomID();
    this.uuid         = data.uuid ?? "";
    this.name         = data.name ?? "";
    this.nameMode     = data.nameMode === "regex" ? "regex" : "exact";
    this.img          = data.img ?? "";
    this.quantity     = Number(data.quantity ?? 1);
    this.tags         = Array.isArray(data.tags) ? [...data.tags] : [];
    this.mode         = data.mode === "every" ? "every" : "some";
    this.resourcePath = data.resourcePath ?? "";
    this.ingredient   = ingredient;

    this.inventoryQuantity = 0;
    this.selected          = false;

    this._nameRegex = null;
    if (this.nameMode === "regex" && this.name) {
      try { this._nameRegex = compileRegex(this.name); }
      catch { this._nameRegex = null; }
    }
  }

  /**
   * True when an item's name matches this component's `name` field, honouring
   * `nameMode` ("exact" or "regex"). Invalid regex patterns silently fall back
   * to no match rather than throwing into the crafting flow.
   */
  matchesName(item) {
    if (!item?.name || !this.name) return false;
    if (this.nameMode === "regex") {
      return this._nameRegex ? this._nameRegex.test(item.name) : false;
    }
    return item.name === this.name;
  }

  getItemTags(item) {
    const flag = item?.flags?.[MODULE_ID]?.tags ?? [];
    if (Array.isArray(flag)) return flag;
    if (typeof flag === "string") {
      return flag.split(",").map(t => t.trim()).filter(Boolean);
    }
    return [];
  }

  hasTags(item) {
    if (!this.tags.length) return false;
    const itemTags = this.getItemTags(item);
    return this.mode === "every"
      ? this.tags.every(t => itemTags.includes(t))
      : this.tags.some(t => itemTags.includes(t));
  }

  matchingItems(actor) {
    if (!actor?.items) return [];
    const items = actor.items.contents ?? actor.items;
    const byName = items.filter(i => {
      if (this.matchesName(i)) return true;
      const sourceId = i.flags?.core?.sourceId;
      if (this.uuid && sourceId && sourceId === this.uuid) return true;
      return false;
    });
    if (!this.tags.length) return byName;
    const byTag = items.filter(i => this.hasTags(i) && !byName.includes(i));
    return [...byName, ...byTag];
  }

  toObject() {
    return {
      id: this.id, uuid: this.uuid, name: this.name, nameMode: this.nameMode,
      img: this.img, quantity: this.quantity, tags: [...this.tags], mode: this.mode,
      resourcePath: this.resourcePath,
    };
  }
}

/**
 * Compile a name pattern into a RegExp. Accepts either a JS literal form
 * (`/pattern/flags`) or a bare pattern which is treated as case-insensitive.
 */
function compileRegex(pattern) {
  const literal = /^\/(.+)\/([a-z]*)$/i.exec(pattern);
  if (literal) return new RegExp(literal[1], literal[2]);
  return new RegExp(pattern, "i");
}

export class Ingredient {
  constructor(data = {}) {
    this.id         = data.id ?? foundry.utils.randomID();
    this.name       = data.name ?? "";
    this.components = (data.components ?? []).map(c => new Component(c, this));
  }

  getComponent(id) {
    return this.components.find(c => c.id === id) ?? null;
  }

  /**
   * Evaluate availability of each component against the inventory actor.
   * Pass in the id of the currently-selected component (defaults to the first component).
   *
   * @returns {{components: Component[], maxCraftable: number, selectedId: string|null}}
   */
  evaluate(actor, selectedComponentId = null) {
    const selected = this.components.find(c => c.id === selectedComponentId)
      ?? this.components[0]
      ?? null;

    for (const component of this.components) {
      component.selected = component === selected;
      component.inventoryQuantity = this._inventoryQuantity(component, actor);
    }

    let maxCraftable = 0;
    if (selected && selected.quantity > 0) {
      maxCraftable = Math.floor(selected.inventoryQuantity / selected.quantity);
    }

    return {
      components:  this.components,
      maxCraftable,
      selectedId:  selected?.id ?? null,
    };
  }

  _inventoryQuantity(component, actor) {
    if (!actor) return 0;
    if (component.resourcePath) {
      const raw = foundry.utils.getProperty(actor.system ?? {}, component.resourcePath);
      return parseFloat(raw) || 0;
    }
    return component.matchingItems(actor).reduce((sum, i) => {
      const q = foundry.utils.getProperty(i.system ?? {}, QUANTITY_PATH);
      return sum + (parseFloat(q) || 0);
    }, 0);
  }

  toObject() {
    return { id: this.id, name: this.name, components: this.components.map(c => c.toObject()) };
  }
}
