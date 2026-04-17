import { describe, it, expect, beforeEach } from "vitest";
import { RecipeManager } from "../scripts/crafting/RecipeManager.mjs";
import { MODULE_ID } from "../scripts/crafting/constants.mjs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePage(recipeOverride = {}, flagOverride = {}) {
  const recipe = {
    type: "manufacturing",
    resultItemName: "Iron Longsword",
    dc: 17,
    timeHours: 8,
    toolKey: "smiths-tools",
    toolAbility: "str",
    materials: [],
    ...recipeOverride,
  };
  return {
    flags: {
      [MODULE_ID]: { isRecipe: true, recipe, ...flagOverride },
    },
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
  it("returns null when page has no flags", () => {
    expect(RecipeManager.getRecipeFromPage({ flags: {} })).toBeNull();
  });

  it("returns null when flags lack the module namespace", () => {
    expect(RecipeManager.getRecipeFromPage({ flags: { other: {} } })).toBeNull();
  });

  it("returns null when isRecipe is false", () => {
    const page = { flags: { [MODULE_ID]: { isRecipe: false, recipe: {} } } };
    expect(RecipeManager.getRecipeFromPage(page)).toBeNull();
  });

  it("returns null when recipe key is missing", () => {
    const page = { flags: { [MODULE_ID]: { isRecipe: true } } };
    expect(RecipeManager.getRecipeFromPage(page)).toBeNull();
  });

  it("returns the recipe object when flags are correct", () => {
    const page = makePage();
    const result = RecipeManager.getRecipeFromPage(page);
    expect(result).not.toBeNull();
    expect(result.resultItemName).toBe("Iron Longsword");
  });

  it("returns the exact recipe reference stored in flags", () => {
    const page = makePage();
    const result = RecipeManager.getRecipeFromPage(page);
    expect(result).toBe(page.flags[MODULE_ID].recipe);
  });
});

// ── _userCanView ──────────────────────────────────────────────────────────────

describe("_userCanView", () => {
  beforeEach(() => {
    game.user.id = "user-1";
  });

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

  it("returns false when user has NONE level", () => {
    const journal = makeJournal([], {
      "user-1": CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
    });
    expect(RecipeManager._userCanView(journal)).toBe(false);
  });

  it("falls back to default ownership when user not listed", () => {
    const journal = makeJournal([], { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER });
    expect(RecipeManager._userCanView(journal)).toBe(true);
  });

  it("denies when neither user nor default is set (undefined falls to 0)", () => {
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
    const result = RecipeManager.getUnlockedRecipes();
    expect(result).toEqual({ manufacturing: [], enchanting: [] });
  });

  it("ignores journals the user cannot view", () => {
    game.journal.contents = [
      makeJournal(
        [makePage()],
        { "user-1": CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE }
      ),
    ];
    const result = RecipeManager.getUnlockedRecipes();
    expect(result.manufacturing).toHaveLength(0);
  });

  it("includes recipes from journals the user can view", () => {
    game.journal.contents = [makeJournal([makePage()])];
    const result = RecipeManager.getUnlockedRecipes();
    expect(result.manufacturing).toHaveLength(1);
  });

  it("groups manufacturing recipes under 'manufacturing'", () => {
    game.journal.contents = [
      makeJournal([makePage({ type: "manufacturing" })]),
    ];
    const result = RecipeManager.getUnlockedRecipes();
    expect(result.manufacturing).toHaveLength(1);
    expect(result.enchanting).toHaveLength(0);
  });

  it("groups enchanting recipes under 'enchanting'", () => {
    game.journal.contents = [
      makeJournal([makePage({ type: "enchanting" })]),
    ];
    const result = RecipeManager.getUnlockedRecipes();
    expect(result.enchanting).toHaveLength(1);
    expect(result.manufacturing).toHaveLength(0);
  });

  it("handles a journal with mixed recipe types", () => {
    game.journal.contents = [
      makeJournal([
        makePage({ type: "manufacturing" }),
        makePage({ type: "enchanting" }),
        makePage({ type: "manufacturing" }),
      ]),
    ];
    const result = RecipeManager.getUnlockedRecipes();
    expect(result.manufacturing).toHaveLength(2);
    expect(result.enchanting).toHaveLength(1);
  });

  it("skips pages without a valid recipe flag", () => {
    game.journal.contents = [
      makeJournal([
        { flags: {} },
        makePage(),
      ]),
    ];
    const result = RecipeManager.getUnlockedRecipes();
    expect(result.manufacturing).toHaveLength(1);
  });

  it("each result entry has {page, recipe} shape", () => {
    const page = makePage();
    game.journal.contents = [makeJournal([page])];
    const result = RecipeManager.getUnlockedRecipes();
    const entry = result.manufacturing[0];
    expect(entry).toHaveProperty("page");
    expect(entry).toHaveProperty("recipe");
    expect(entry.page).toBe(page);
  });

  it("collects recipes across multiple visible journals", () => {
    game.journal.contents = [
      makeJournal([makePage()]),
      makeJournal([makePage(), makePage()]),
    ];
    const result = RecipeManager.getUnlockedRecipes();
    expect(result.manufacturing).toHaveLength(3);
  });

  it("defaults missing recipe.type to 'manufacturing'", () => {
    const page = makePage();
    delete page.flags[MODULE_ID].recipe.type;
    game.journal.contents = [makeJournal([page])];
    const result = RecipeManager.getUnlockedRecipes();
    expect(result.manufacturing).toHaveLength(1);
  });
});
