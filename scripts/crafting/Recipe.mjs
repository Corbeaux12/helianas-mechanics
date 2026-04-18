import { MODULE_ID } from "./constants.mjs";
import { Ingredient } from "./Ingredient.mjs";

export const RECIPE_PAGE_TYPE = `${MODULE_ID}.recipe`;

export class Recipe {
  constructor(page) {
    this.page = page;
    this.data = page?.system ?? {};
    this.ingredients = (this.data.ingredients ?? []).map(i => new Ingredient(i));
  }

  get id() { return this.page?.id ?? null; }
  get name() { return this.data.resultName || this.page?.name || ""; }
  get img() { return this.data.resultImg || "icons/svg/item-bag.svg"; }
  get recipeType() { return this.data.recipeType ?? "manufacturing"; }
  get dc() { return this.data.dc ?? 0; }
  get timeHours() { return this.data.timeHours ?? 0; }
  get toolKey() { return this.data.toolKey ?? ""; }
  get toolAbility() { return this.data.toolAbility ?? ""; }
  get rarity() { return this.data.rarity ?? ""; }
  get attunement() { return this.data.attunement ?? ""; }
  get essenceTierRequired() { return this.data.essenceTierRequired ?? ""; }
  get componentCreatureType() { return this.data.componentCreatureType ?? ""; }

  /**
   * Evaluate all ingredients against the inventory actor.
   * @param {Actor} actor
   * @param {Record<string,string>} selectedComponents  ingredientId → componentId
   */
  evaluate(actor, selectedComponents = {}) {
    return this.ingredients.map(ing => ({
      ingredient: ing,
      ...ing.evaluate(actor, selectedComponents[ing.id]),
    }));
  }

  /**
   * Consume the selected component of each ingredient from the inventory actor.
   * Items matched by name first, then by tag; decrements stack quantities and
   * deletes items whose quantity reaches zero. For components with resourcePath,
   * decrements the actor system path via update().
   *
   * @returns {Promise<string[]>}  names of components that could not be fully consumed
   */
  async consumeIngredients(actor, selectedComponents = {}) {
    const warnings = [];
    if (!actor) return this.ingredients.map(i => i.name);

    for (const ingredient of this.ingredients) {
      const component = ingredient.getComponent(selectedComponents[ingredient.id])
        ?? ingredient.components[0];
      if (!component) continue;

      let needed = component.quantity;
      if (needed <= 0) continue;

      if (component.resourcePath) {
        const current = parseFloat(foundry.utils.getProperty(actor.system ?? {}, component.resourcePath)) || 0;
        if (current < needed) {
          warnings.push(component.name);
          continue;
        }
        await actor.update({ [`system.${component.resourcePath}`]: current - needed });
        continue;
      }

      const byName = component.matchingItems(actor)
        .filter(i => i.name === component.name || i.flags?.core?.sourceId === component.uuid);
      const byTag = component.matchingItems(actor).filter(i => !byName.includes(i));
      for (const item of [...byName, ...byTag]) {
        if (needed <= 0) break;
        const qty = parseFloat(foundry.utils.getProperty(item.system ?? {}, "quantity")) || 1;
        if (qty <= needed) {
          await item.delete();
          needed -= qty;
        } else {
          await item.update({ "system.quantity": qty - needed });
          needed = 0;
        }
      }
      if (needed > 0) warnings.push(component.name);
    }

    return warnings;
  }
}
