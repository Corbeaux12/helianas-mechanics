import { describe, it, expect } from "vitest";
import { Ingredient, Component } from "../scripts/crafting/Ingredient.mjs";
import { Recipe, RECIPE_PAGE_TYPE } from "../scripts/crafting/Recipe.mjs";
import { MODULE_ID } from "../scripts/crafting/constants.mjs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockItem({ id, name, sourceId, quantity = 1, tags = [] } = {}) {
  const deleted = { value: false };
  const updates = [];
  return {
    id: id ?? foundry.utils.randomID(),
    name,
    system: { quantity },
    flags: {
      core:         sourceId ? { sourceId } : {},
      [MODULE_ID]:  tags.length ? { tags } : {},
    },
    deleted,
    updates,
    async delete() { this.deleted.value = true; },
    async update(diff) {
      this.updates.push(diff);
      if (diff["system.quantity"] != null) this.system.quantity = diff["system.quantity"];
    },
  };
}

function mockActor(items = [], system = {}) {
  const updates = [];
  return {
    items: { contents: items },
    system,
    updates,
    async update(diff) { this.updates.push(diff); Object.assign(this.system, unflatten(diff)); },
  };
}

function unflatten(obj) {
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    const parts = key.split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] ??= {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }
  return out.system ?? out;
}

// ── Component.hasTags ─────────────────────────────────────────────────────────

describe("Component.hasTags", () => {
  it("returns false when the component has no tags", () => {
    const c = new Component({ tags: [] });
    expect(c.hasTags(mockItem({ tags: ["metal"] }))).toBe(false);
  });

  it("'some' mode matches when any tag overlaps", () => {
    const c = new Component({ tags: ["metal", "ferrous"], mode: "some" });
    expect(c.hasTags(mockItem({ tags: ["metal"] }))).toBe(true);
    expect(c.hasTags(mockItem({ tags: ["wood"] }))).toBe(false);
  });

  it("'every' mode matches only when all tags are present", () => {
    const c = new Component({ tags: ["metal", "ferrous"], mode: "every" });
    expect(c.hasTags(mockItem({ tags: ["metal", "ferrous"] }))).toBe(true);
    expect(c.hasTags(mockItem({ tags: ["metal"] }))).toBe(false);
  });

  it("reads tags from the module namespace flag", () => {
    const c = new Component({ tags: ["metal"], mode: "some" });
    const item = mockItem({ tags: ["metal"] });
    expect(c.hasTags(item)).toBe(true);
  });

  it("accepts comma-separated string tags in the flag", () => {
    const c = new Component({ tags: ["metal"], mode: "some" });
    const item = { name: "x", system: { quantity: 1 }, flags: { [MODULE_ID]: { tags: "metal, ferrous" }, core: {} } };
    expect(c.hasTags(item)).toBe(true);
  });
});

// ── Ingredient.evaluate ───────────────────────────────────────────────────────

describe("Ingredient.evaluate", () => {
  it("reports availability against the inventory actor via name match", () => {
    const actor = mockActor([mockItem({ name: "Iron Ingot", quantity: 5 })]);
    const ing = new Ingredient({
      id: "i1",
      components: [{ id: "c1", name: "Iron Ingot", quantity: 2 }],
    });
    const result = ing.evaluate(actor);
    expect(result.components[0].inventoryQuantity).toBe(5);
    expect(result.maxCraftable).toBe(2);
    expect(result.selectedId).toBe("c1");
  });

  it("sums quantities across multiple matching items", () => {
    const actor = mockActor([
      mockItem({ name: "Iron Ingot", quantity: 3 }),
      mockItem({ name: "Iron Ingot", quantity: 4 }),
    ]);
    const ing = new Ingredient({
      components: [{ id: "c1", name: "Iron Ingot", quantity: 2 }],
    });
    expect(ing.evaluate(actor).components[0].inventoryQuantity).toBe(7);
  });

  it("tag-match includes tagged items alongside name match", () => {
    const actor = mockActor([
      mockItem({ name: "Iron Ingot", quantity: 2 }),
      mockItem({ name: "Steel Ingot", quantity: 3, tags: ["metal"] }),
    ]);
    const ing = new Ingredient({
      components: [{ id: "c1", name: "Iron Ingot", quantity: 2, tags: ["metal"], mode: "some" }],
    });
    expect(ing.evaluate(actor).components[0].inventoryQuantity).toBe(5);
  });

  it("resourcePath reads from actor.system instead of inventory", () => {
    const actor = mockActor([], { attributes: { hp: 17 } });
    const ing = new Ingredient({
      components: [{ id: "c1", name: "HP", quantity: 1, resourcePath: "attributes.hp" }],
    });
    const result = ing.evaluate(actor);
    expect(result.components[0].inventoryQuantity).toBe(17);
    expect(result.maxCraftable).toBe(17);
  });

  it("returns maxCraftable=0 when the selected component is short", () => {
    const actor = mockActor([mockItem({ name: "Iron Ingot", quantity: 1 })]);
    const ing = new Ingredient({
      components: [{ id: "c1", name: "Iron Ingot", quantity: 2 }],
    });
    expect(ing.evaluate(actor).maxCraftable).toBe(0);
  });

  it("honours an explicit selectedComponentId", () => {
    const actor = mockActor([
      mockItem({ name: "Iron Ingot", quantity: 10 }),
      mockItem({ name: "Steel Ingot", quantity: 1 }),
    ]);
    const ing = new Ingredient({
      components: [
        { id: "c1", name: "Iron Ingot", quantity: 2 },
        { id: "c2", name: "Steel Ingot", quantity: 2 },
      ],
    });
    const result = ing.evaluate(actor, "c2");
    expect(result.selectedId).toBe("c2");
    expect(result.maxCraftable).toBe(0);
  });
});

// ── Recipe.consumeIngredients ─────────────────────────────────────────────────

function makePage(systemOverride = {}) {
  return {
    id: "p1",
    type: RECIPE_PAGE_TYPE,
    name: "test",
    parent: { id: "j1" },
    system: {
      recipeType: "manufacturing",
      resultName: "Test",
      ingredients: [],
      ...systemOverride,
    },
  };
}

describe("Recipe.consumeIngredients", () => {
  it("decrements stack quantity by the needed amount", async () => {
    const item = mockItem({ name: "Iron Ingot", quantity: 5 });
    const actor = mockActor([item]);
    const page = makePage({
      ingredients: [{
        id: "i1", name: "Metal",
        components: [{ id: "c1", name: "Iron Ingot", quantity: 2 }],
      }],
    });
    const recipe = new Recipe(page);
    const warnings = await recipe.consumeIngredients(actor);
    expect(warnings).toEqual([]);
    expect(item.system.quantity).toBe(3);
    expect(item.deleted.value).toBe(false);
  });

  it("deletes items whose stack is fully consumed", async () => {
    const item = mockItem({ name: "Iron Ingot", quantity: 2 });
    const actor = mockActor([item]);
    const page = makePage({
      ingredients: [{
        id: "i1", name: "Metal",
        components: [{ id: "c1", name: "Iron Ingot", quantity: 2 }],
      }],
    });
    await new Recipe(page).consumeIngredients(actor);
    expect(item.deleted.value).toBe(true);
  });

  it("falls through to tagged items when name-match exhausted", async () => {
    const iron  = mockItem({ name: "Iron Ingot",  quantity: 1 });
    const steel = mockItem({ name: "Steel Ingot", quantity: 3, tags: ["metal"] });
    const actor = mockActor([iron, steel]);
    const page = makePage({
      ingredients: [{
        id: "i1", name: "Metal",
        components: [{ id: "c1", name: "Iron Ingot", quantity: 2, tags: ["metal"], mode: "some" }],
      }],
    });
    const warnings = await new Recipe(page).consumeIngredients(actor);
    expect(warnings).toEqual([]);
    expect(iron.deleted.value).toBe(true);
    expect(steel.system.quantity).toBe(2);
  });

  it("uses resourcePath via actor.update when set", async () => {
    const actor = mockActor([], { attributes: { hp: 10 } });
    const page = makePage({
      ingredients: [{
        id: "i1", name: "Vitality",
        components: [{ id: "c1", name: "HP", quantity: 3, resourcePath: "attributes.hp" }],
      }],
    });
    const warnings = await new Recipe(page).consumeIngredients(actor);
    expect(warnings).toEqual([]);
    expect(actor.updates).toHaveLength(1);
    expect(actor.updates[0]["system.attributes.hp"]).toBe(7);
  });

  it("warns when inventory is insufficient", async () => {
    const item = mockItem({ name: "Iron Ingot", quantity: 1 });
    const actor = mockActor([item]);
    const page = makePage({
      ingredients: [{
        id: "i1", name: "Metal",
        components: [{ id: "c1", name: "Iron Ingot", quantity: 5 }],
      }],
    });
    const warnings = await new Recipe(page).consumeIngredients(actor);
    expect(warnings).toEqual(["Iron Ingot"]);
  });

  it("warns on insufficient resourcePath and does not update", async () => {
    const actor = mockActor([], { attributes: { hp: 1 } });
    const page = makePage({
      ingredients: [{
        id: "i1", name: "Vitality",
        components: [{ id: "c1", name: "HP", quantity: 5, resourcePath: "attributes.hp" }],
      }],
    });
    const warnings = await new Recipe(page).consumeIngredients(actor);
    expect(warnings).toEqual(["HP"]);
    expect(actor.updates).toHaveLength(0);
  });

  it("honours selectedComponents map to pick alternate components", async () => {
    const iron  = mockItem({ name: "Iron Ingot",  quantity: 5 });
    const steel = mockItem({ name: "Steel Ingot", quantity: 5 });
    const actor = mockActor([iron, steel]);
    const page = makePage({
      ingredients: [{
        id: "i1", name: "Metal",
        components: [
          { id: "c1", name: "Iron Ingot", quantity: 2 },
          { id: "c2", name: "Steel Ingot", quantity: 2 },
        ],
      }],
    });
    await new Recipe(page).consumeIngredients(actor, { i1: "c2" });
    expect(iron.system.quantity).toBe(5);
    expect(steel.system.quantity).toBe(3);
  });
});
