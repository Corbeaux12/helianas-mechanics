import { MODULE_ID } from "./constants.mjs";

export class RecipeManager {
  /** Extract recipe data from a JournalEntryPage's flags. */
  static getRecipeFromPage(page) {
    const flags = page.flags?.[MODULE_ID];
    if (!flags?.isRecipe || !flags?.recipe) return null;
    return flags.recipe;
  }

  /**
   * Return all recipes the current user can see, grouped by type.
   * A journal must be at least OBSERVER level for the user (or default).
   *
   * @returns {{ manufacturing: Array, enchanting: Array }}
   */
  static getUnlockedRecipes() {
    const result = { manufacturing: [], enchanting: [] };

    for (const journal of game.journal.contents) {
      if (!RecipeManager._userCanView(journal)) continue;
      for (const page of journal.pages.contents) {
        const recipe = RecipeManager.getRecipeFromPage(page);
        if (!recipe) continue;
        const type = recipe.type ?? "manufacturing";
        if (result[type]) result[type].push({ page, recipe });
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
