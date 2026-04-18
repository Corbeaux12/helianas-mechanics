import { MODULE_ID } from "./crafting/constants.mjs";
import { CraftingApp }     from "./crafting/CraftingApp.mjs";
import { CraftingTracker } from "./crafting/CraftingTracker.mjs";
import { RecipePageData }  from "./crafting/RecipePageData.mjs";
import { RecipePageSheet } from "./crafting/RecipePageSheet.mjs";
import { RECIPE_PAGE_TYPE } from "./crafting/Recipe.mjs";
import { renderItemTagPanel } from "./crafting/ItemTagPanel.mjs";
import { RecipeImporter } from "./crafting/RecipeImporter.mjs";
import { RecipeBrowser } from "./crafting/RecipeBrowser.mjs";

// ------------------------------------------------------------------ init hook

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Heliana's Mechanics`);

  // Register the recipe JournalEntryPage sub-type data model
  Object.assign(CONFIG.JournalEntryPage.dataModels, {
    [RECIPE_PAGE_TYPE]: RecipePageData,
  });

  // Register the sheet used to edit / view recipe pages
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    JournalEntryPage, MODULE_ID, RecipePageSheet, {
      types:       [RECIPE_PAGE_TYPE],
      makeDefault: true,
      label:       "HELIANAS.RecipeSheet",
    },
  );

  // Persist active crafts as a world-scoped setting (hidden from the config UI)
  game.settings.register(MODULE_ID, "activeCrafts", {
    scope:   "world",
    config:  false,
    type:    Array,
    default: [],
  });

  // Remember the user's preferred crafter / inventory-holder actors
  game.settings.register(MODULE_ID, "craftingActorId", {
    scope: "client", config: false, type: String, default: "",
  });
  game.settings.register(MODULE_ID, "inventoryActorId", {
    scope: "client", config: false, type: String, default: "",
  });
});

// ------------------------------------------------------------------ ready hook

Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | Heliana's Mechanics is ready`);

  // Public API for macros: game.modules.get("helianas-mechanics").api.RecipeImporter
  const moduleRef = game.modules.get(MODULE_ID);
  if (moduleRef) moduleRef.api = { RecipeImporter, RecipeBrowser };

  // One-shot migration: convert legacy flag-based recipes to new sub-type pages
  if (game.user.isGM) await migrateLegacyRecipes();

  // Refresh tracker when a craft is started (fired by CraftingApp after saving)
  Hooks.on("helianas:craftStarted", () => {
    if (CraftingTracker.instance.rendered) CraftingTracker.instance.render();
  });

  // Socket: recipe-book journal-access grant
  game.socket.on(`module.${MODULE_ID}`, async (msg) => {
    if (msg.action === "grantJournalAccess" && game.user.isGM && game.users.activeGM?.isSelf) {
      const journal = await fromUuid(msg.journalUuid);
      if (!journal) return;
      await journal.update({
        ownership: { ...journal.ownership, [msg.userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
      });
      game.socket.emit(`module.${MODULE_ID}`, {
        action:       "journalAccessGranted",
        journalUuid:  msg.journalUuid,
        userId:       msg.userId,
      });
    }

    if (msg.action === "journalAccessGranted" && msg.userId === game.user.id) {
      ui.notifications.info(game.i18n.localize("HELIANAS.RecipesUnlocked"));
      // Re-render any open item sheets so the unlock button updates
      for (const app of Object.values(ui.windows)) {
        if (app.document?.documentName === "Item") app.render();
      }
    }
  });
});

// ------------------------------------------------------------------ legacy recipe migration

async function migrateLegacyRecipes() {
  let migrated = 0;
  for (const journal of game.journal.contents) {
    const legacyPages = journal.pages.contents.filter(p => {
      const f = p.flags?.[MODULE_ID];
      return f?.isRecipe && f?.recipe && !f?.isMigrated && p.type !== RECIPE_PAGE_TYPE;
    });
    if (!legacyPages.length) continue;

    const pagesToCreate = legacyPages.map(p => {
      const old = p.flags[MODULE_ID].recipe;
      const materials = old.materials ?? [];
      return {
        name: old.resultItemName ?? p.name,
        type: RECIPE_PAGE_TYPE,
        system: {
          recipeType:     old.type === "enchanting" ? "enchanting" : "manufacturing",
          resultName:     old.resultItemName ?? "",
          resultImg:      old.resultItemImg ?? "",
          resultUuid:     old.resultItemUuid ?? "",
          resultQuantity: 1,
          dc:             old.dc ?? 15,
          timeHours:      old.timeHours ?? 8,
          toolKey:        old.toolKey ?? "",
          toolAbility:    old.toolAbility ?? "",
          ingredients: materials.map(m => ({
            id:   foundry.utils.randomID(),
            name: m.name ?? "Material",
            components: [{
              id:       foundry.utils.randomID(),
              uuid:     m.uuid ?? "",
              name:     m.name ?? "",
              img:      "",
              quantity: m.quantity ?? 1,
              tags:     [],
              mode:     "some",
              resourcePath: "",
            }],
          })),
          essenceTierRequired:   old.essenceTierRequired ?? "",
          componentCreatureType: old.componentCreatureType ?? "",
          rarity:                old.rarity ?? "",
          attunement:            old.attunement ?? "none",
        },
      };
    });

    await journal.createEmbeddedDocuments("JournalEntryPage", pagesToCreate);
    await Promise.all(legacyPages.map(p => p.update({ [`flags.${MODULE_ID}.isMigrated`]: true })));
    migrated += legacyPages.length;
  }
  if (migrated) {
    ui.notifications.info(game.i18n.format("HELIANAS.MigrationComplete", { count: migrated }));
  }
}

// ------------------------------------------------------------------ scene controls (toolbar)

Hooks.on("getSceneControlButtons", (controls) => {
  controls["helianas-mechanics"] = {
    name:       "helianas-mechanics",
    title:      game.i18n.localize("HELIANAS.ModuleTitle"),
    icon:       "fa-solid fa-hammer",
    layer:      "tokens",  // nearest valid canvas layer; sub-tools are buttons so no layer switch occurs on tool click
    activeTool: "workshop",
    order:      20,
    tools: {
      workshop: {
        name:     "workshop",
        title:    game.i18n.localize("HELIANAS.CraftingWorkshop"),
        icon:     "fa-solid fa-anvil",
        button:   true,
        order:    1,
        onChange: () => CraftingApp.open(),
      },
      tracker: {
        name:     "tracker",
        title:    game.i18n.localize("HELIANAS.CraftingTracker"),
        icon:     "fa-regular fa-hourglass-half",
        button:   true,
        order:    2,
        onChange: () => CraftingTracker.open(),
      },
      ...(game.user?.isGM ? {
        browser: {
          name:     "browser",
          title:    game.i18n.localize("HELIANAS.RecipeBrowserTitle"),
          icon:     "fa-solid fa-book-open",
          button:   true,
          order:    3,
          onChange: () => RecipeBrowser.open(),
        },
      } : {}),
    },
  };
});

// ------------------------------------------------------------------ item sheet injection (recipe books)

Hooks.on("renderItemSheet", (app, html, data) => {
  renderItemTagPanel(app, html, data);
  renderRecipeBookBanner(app, html, data);
});

function renderRecipeBookBanner(app, html, _data) {
  const item = app.document ?? app.object;
  if (!item) return;

  const flags = item.flags?.[MODULE_ID];
  if (!flags?.isRecipeBook || !flags?.recipeBookJournalUuid) return;

  // Check whether the user already has access
  const journalId = flags.recipeBookJournalUuid.split(".").pop();
  const journal   = game.journal.get(journalId);
  const alreadyUnlocked = journal
    ? (journal.ownership?.[game.user.id] ?? journal.ownership?.default ?? 0)
        >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
    : false;

  const banner = document.createElement("div");
  banner.className = "hm-recipe-book-banner";
  banner.innerHTML = `
    <div class="hm-recipe-book-banner__icon"><i class="fa-solid fa-book-open"></i></div>
    <div class="hm-recipe-book-banner__body">
      <strong>${game.i18n.localize("HELIANAS.RecipeBook")}</strong>
      <p>${game.i18n.localize("HELIANAS.RecipeBookDesc")}</p>
      <button class="hm-btn-unlock" type="button"${alreadyUnlocked ? " disabled" : ""}>
        ${alreadyUnlocked
          ? `✓ ${game.i18n.localize("HELIANAS.RecipesUnlocked")}`
          : `📖 ${game.i18n.localize("HELIANAS.UnlockRecipes")}`}
      </button>
    </div>`;

  banner.querySelector(".hm-btn-unlock")?.addEventListener("click", () => {
    game.socket.emit(`module.${MODULE_ID}`, {
      action:      "grantJournalAccess",
      journalUuid: flags.recipeBookJournalUuid,
      userId:      game.user.id,
    });
  });

  // Insert above the description content
  const el     = html instanceof HTMLElement ? html : html[0];
  const target = el.querySelector(".tab[data-tab='description']") ?? el.querySelector(".sheet-body");
  if (target) target.prepend(banner);
}

// ------------------------------------------------------------------ chat command hook (recipe importer)

Hooks.on("chatMessage", (_chatLog, message, _data) => {
  if (typeof message !== "string") return;
  const trimmed = message.trim();
  if (!trimmed.startsWith("/helianas-import")) return;
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("HELIANAS.ImporterGMOnly"));
    return false;
  }
  const args = trimmed.slice("/helianas-import".length).trim();
  RecipeImporter.runCommand(args);
  return false;
});
