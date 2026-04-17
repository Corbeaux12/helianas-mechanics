import { MODULE_ID } from "./crafting/constants.mjs";
import { CraftingApp }     from "./crafting/CraftingApp.mjs";
import { CraftingTracker } from "./crafting/CraftingTracker.mjs";

// ------------------------------------------------------------------ init hook

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Heliana's Mechanics`);

  // Persist active crafts as a world-scoped setting (hidden from the config UI)
  game.settings.register(MODULE_ID, "activeCrafts", {
    scope:   "world",
    config:  false,
    type:    Array,
    default: [],
  });
});

// ------------------------------------------------------------------ ready hook

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Heliana's Mechanics is ready`);

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

// ------------------------------------------------------------------ scene controls (toolbar)

Hooks.on("getSceneControlButtons", (controls) => {
  controls.push({
    name:       "helianas-mechanics",
    title:      game.i18n.localize("HELIANAS.ModuleTitle"),
    icon:       "fa-solid fa-hammer",
    layer:      "tokens",  // nearest valid canvas layer; sub-tools are buttons so no layer switch occurs on tool click
    activeTool: "workshop",
    tools: [
      {
        name:    "workshop",
        title:   game.i18n.localize("HELIANAS.CraftingWorkshop"),
        icon:    "fa-solid fa-anvil",
        button:  true,
        onClick: () => CraftingApp.open(),
      },
      {
        name:    "tracker",
        title:   game.i18n.localize("HELIANAS.CraftingTracker"),
        icon:    "fa-regular fa-hourglass-half",
        button:  true,
        onClick: () => CraftingTracker.open(),
      },
    ],
  });
});

// ------------------------------------------------------------------ item sheet injection (recipe books)

Hooks.on("renderItemSheet", (app, html, _data) => {
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
});
