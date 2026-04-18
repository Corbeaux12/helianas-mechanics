import { describe, it, expect, beforeEach } from "vitest";
import { RecipeManager } from "../scripts/crafting/RecipeManager.mjs";
import { RECIPE_PAGE_TYPE } from "../scripts/crafting/Recipe.mjs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePage(systemOverride = {}, extra = {}) {
  return {
    id: foundry.utils.randomID(),
    type: RECIPE_PAGE_TYPE,
    name: systemOverride.resultName ?? "Iron Longsword",
    parent: { id: "journal-1" },
    system: {
      recipeType: "manufacturing",
      resultName: "Iron Longsword",
      resultImg:  "",
      resultUuid: "",
      resultQuantity: 1,
      dc: 17,
      timeHours: 8,
      toolKey: "smiths-tools",
      toolAbility: "str",
      ingredients: [],
      essenceTierRequired: "",
      componentCreatureType: "",
      rarity: "",
      attunement: "none",
      ...systemOverride,
    },
    ...extra,
  };
}

function makeJournal(pages = [], ownershipOverride = {}) {
  return {
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER, ...ownershipOverride },
    pages: { contents: pages },
  };
}

// ── getRecipeFromPage ─────────────────────────────────────────────────────────

describe("getRecipeFromPage", () => {
  it("returns null when page is null/undefined", () => {
    expect(RecipeManager.getRecipeFromPage(null)).toBeNull();
    expect(RecipeManager.getRecipeFromPage(undefined)).toBeNull();
  });

  it("returns null when page is not of the recipe sub-type", () => {
    const page = { type: "text", system: {} };
    expect(RecipeManager.getRecipeFromPage(page)).toBeNull();
  });

  it("returns null for a legacy flag-only page (pre-migration)", () => {
    const page = {
      type: "text",
      flags: { "helianas-mechanics": { isRecipe: true, recipe: { resultItemName: "x" } } },
    };
    expect(RecipeManager.getRecipeFromPage(page)).toBeNull();
  });

  it("returns a Recipe wrapper for a valid page", () => {
    const page = makePage();
    const recipe = RecipeManager.getRecipeFromPage(page);
    expect(recipe).not.toBeNull();
    expect(recipe.name).toBe("Iron Longsword");
    expect(recipe.page).toBe(page);
  });

  it("exposes recipeType, dc, timeHours, toolKey from system", () => {
    const page = makePage({ recipeType: "enchanting", dc: 22, timeHours: 320, toolKey: "jewelers-tools" });
    const r = RecipeManager.getRecipeFromPage(page);
    expect(r.recipeType).toBe("enchanting");
    expect(r.dc).toBe(22);
    expect(r.timeHours).toBe(320);
    expect(r.toolKey).toBe("jewelers-tools");
  });
});

// ── _userCanView ──────────────────────────────────────────────────────────────

describe("_userCanView", () => {
  beforeEach(() => { game.user.id = "user-1"; });

  it("returns true when user has OWNER level", () => {
    const journal = makeJournal([], { "user-1": CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER });
    expect(RecipeManager._userCanView(journal)).toBe(true);
  });

  it("returns true when user has OBSERVER level", () => {
    const journal = makeJournal([], { "user-1": CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER });
    expect(RecipeManager._userCanView(journal)).toBe(true);
  });

  it("returns false when user has LIMITED level", () => {
    const journal = makeJournal([], {
      "user-1": CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED,
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
    });
    expect(RecipeManager._userCanView(journal)).toBe(false);
  });

  it("falls back to default ownership when user not listed", () => {
    const journal = makeJournal([], { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER });
    expect(RecipeManager._userCanView(journal)).toBe(true);
  });

  it("denies when neither user nor default is set", () => {
    const journal = { ownership: {}, pages: { contents: [] } };
    expect(RecipeManager._userCanView(journal)).toBe(false);
  });
});

// ── getUnlockedRecipes ────────────────────────────────────────────────────────

describe("getUnlockedRecipes", () => {
  beforeEach(() => {
    game.user.id = "user-1";
    game.journal.contents = [];
  });

  it("returns empty lists when there are no journals", () => {
    expect(RecipeManager.getUnlockedRecipes()).toEqual({ manufacturing: [], enchanting: [] });
  });

  it("ignores journals the user cannot view", () => {
    game.journal.contents = [
      makeJournal([makePage()], { "user-1": CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE }),
    ];
    expect(RecipeManager.getUnlockedRecipes().manufacturing).toHaveLength(0);
  });

  it("groups manufacturing recipes under 'manufacturing'", () => {
    game.journal.contents = [makeJournal([makePage({ recipeType: "manufacturing" })])];
    const result = RecipeManager.getUnlockedRecipes();
    expect(result.manufacturing).toHaveLength(1);
    expect(result.enchanting).toHaveLength(0);
  });

  it("groups enchanting recipes under 'enchanting'", () => {
    game.journal.contents = [makeJournal([makePage({ recipeType: "enchanting" })])];
    const result = RecipeManager.getUnlockedRecipes();
    expect(result.enchanting).toHaveLength(1);
    expect(result.manufacturing).toHaveLength(0);
  });

  it("handles a journal with mixed recipe types", () => {
    game.journal.contents = [
      makeJournal([
        makePage({ recipeType: "manufacturing" }),
        makePage({ recipeType: "enchanting" }),
        makePage({ recipeType: "manufacturing" }),
      ]),
    ];
    const result = RecipeManager.getUnlockedRecipes();
    expect(result.manufacturing).toHaveLength(2);
    expect(result.enchanting).toHaveLength(1);
  });

  it("skips pages whose type is not the recipe sub-type", () => {
    game.journal.contents = [
      makeJournal([
        { type: "text", system: {}, parent: { id: "j" }, id: "x" },
        makePage(),
      ]),
    ];
    expect(RecipeManager.getUnlockedRecipes().manufacturing).toHaveLength(1);
  });

  it("each result entry is a Recipe wrapper with .page and .name", () => {
    const page = makePage();
    game.journal.contents = [makeJournal([page])];
    const entry = RecipeManager.getUnlockedRecipes().manufacturing[0];
    expect(entry.page).toBe(page);
    expect(entry.name).toBe("Iron Longsword");
  });

  it("collects recipes across multiple visible journals", () => {
    game.journal.contents = [
      makeJournal([makePage()]),
      makeJournal([makePage(), makePage()]),
    ];
    expect(RecipeManager.getUnlockedRecipes().manufacturing).toHaveLength(3);
  });

  it("defaults missing system.recipeType to 'manufacturing'", () => {
    const page = makePage();
    delete page.system.recipeType;
    game.journal.contents = [makeJournal([page])];
    expect(RecipeManager.getUnlockedRecipes().manufacturing).toHaveLength(1);
  });
});
