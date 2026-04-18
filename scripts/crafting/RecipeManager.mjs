import { Recipe, RECIPE_PAGE_TYPE } from "./Recipe.mjs";

export class RecipeManager {
  /**
   * Returns a Recipe wrapper for a JournalEntryPage, or null if the page is
   * not of the helianas-mechanics.recipe sub-type.
   */
  static getRecipeFromPage(page) {
    if (!page || page.type !== RECIPE_PAGE_TYPE) return null;
    return new Recipe(page);
  }

  /**
   * Return all recipes the current user can see, grouped by recipeType.
   * A journal must be at least OBSERVER level for the user (or default).
   *
   * @returns {{ manufacturing: Recipe[], enchanting: Recipe[], forging: Recipe[], cooking: Recipe[] }}
   */
  static getUnlockedRecipes() {
    const result = { manufacturing: [], enchanting: [], forging: [], cooking: [] };

    for (const journal of game.journal.contents) {
      if (!RecipeManager._userCanView(journal)) continue;
      for (const page of journal.pages.contents) {
        const recipe = RecipeManager.getRecipeFromPage(page);
        if (!recipe) continue;
        const type = recipe.recipeType ?? "manufacturing";
        if (result[type]) result[type].push(recipe);
      }
    }

    return result;
  }

  static _userCanView(journal) {
    const userId = game.user.id;
    const ownership = journal.ownership ?? {};
    const level = ownership[userId] ?? ownership.default ?? 0;
    return level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
  }
}
