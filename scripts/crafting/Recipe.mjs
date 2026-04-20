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

  // Forge-specific
  get baseItemRecipeUuid() { return this.data.baseItemRecipeUuid ?? ""; }
  get enchantingDc() { return this.data.enchantingDc ?? 0; }
  get enchantingTimeHours() { return this.data.enchantingTimeHours ?? 0; }

  /**
   * Resolve the linked base-item manufacturing recipe (forge recipes only).
   * Returns a Recipe wrapper or null when no link is set / resolution fails.
   */
  async resolveBaseRecipe() {
    const uuid = this.baseItemRecipeUuid;
    if (!uuid) return null;
    const page = await fromUuid(uuid).catch(() => null);
    if (!page || page.type !== RECIPE_PAGE_TYPE) return null;
    return new Recipe(page);
  }

  /**
   * Ingredient list to evaluate/consume for a forge recipe given the selected path.
   *
   * - "enchanting": prepends a synthesized "Base Item" ingredient derived from the
   *   base recipe's result, then includes this recipe's shared magic components.
   * - "forging": concatenates the base recipe's raw ingredients with this recipe's
   *   shared magic components.
   *
   * For non-forge recipes, returns `this.ingredients` unchanged.
   */
  effectiveIngredients(path, baseRecipe = null) {
    if (this.recipeType !== "forge") return this.ingredients;
    if (!baseRecipe) return this.ingredients;

    if (path === "enchanting") {
      const baseItem = new Ingredient({
        id:   `forge-base-${this.id ?? "x"}`,
        name: game.i18n?.localize?.("HELIANAS.BaseItem") || "Base Item",
        components: [{
          id:       `forge-base-comp-${this.id ?? "x"}`,
          uuid:     baseRecipe.data.resultUuid ?? "",
          name:     baseRecipe.data.resultName ?? baseRecipe.name ?? "",
          nameMode: "exact",
          img:      baseRecipe.data.resultImg ?? "",
          quantity: 1,
          tags:     [],
          mode:     "some",
        }],
      });
      return [baseItem, ...this.ingredients];
    }

    // Forging path: raw materials from the base recipe + shared magic components.
    return [...baseRecipe.ingredients, ...this.ingredients];
  }

  /**
   * Evaluate all ingredients against the inventory actor.
   * @param {Actor} actor
   * @param {Record<string,string>} selectedComponents  ingredientId → componentId
   */
  evaluate(actor, selectedComponents = {}) {
    return this.evaluateList(this.ingredients, actor, selectedComponents);
  }

  /**
   * Evaluate a caller-supplied ingredient list against the inventory actor.
   * Used by forge recipes to evaluate the synthesized per-path list.
   */
  evaluateList(list, actor, selectedComponents = {}) {
    return list.map(ing => ({
      ingredient: ing,
      ...ing.evaluate(actor, selectedComponents[ing.id]),
    }));
  }

  /**
   * Consume the selected component of each ingredient from the inventory actor.
   *
   * @returns {Promise<string[]>}  names of components that could not be fully consumed
   */
  async consumeIngredients(actor, selectedComponents = {}) {
    return this.consumeFromList(this.ingredients, actor, selectedComponents);
  }

  /**
   * Consume from a caller-supplied ingredient list. Matches items by name first,
   * then by tag; decrements stack quantities and deletes items whose quantity
   * reaches zero. For components with resourcePath, decrements the actor system
   * path via update().
   */
  async consumeFromList(list, actor, selectedComponents = {}) {
    const warnings = [];
    if (!actor) return list.map(i => i.name);

    for (const ingredient of list) {
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
        .filter(i => component.matchesName(i) || (component.uuid && i.flags?.core?.sourceId === component.uuid));
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
