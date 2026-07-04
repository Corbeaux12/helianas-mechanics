# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A [Foundry VTT](https://foundryvtt.com/) v13–v14 module (dnd5e system) implementing the crafting system from *Heliana's Guide to Monster Hunting*. Foundry modules are loaded directly by the Foundry server at runtime — **there is no build step**. All code runs in the browser as native ES modules.

## Commands

```bash
npm install
npm test                                  # vitest run (full suite)
npm run test:watch                        # vitest watch mode
npx vitest run tests/QuirkEngine.test.mjs # single test file
npm run build:packs                       # regenerate recipe compendium packs from the catalogue
node tools/index-heliana-items.mjs <Data> # refresh the item-link index from installed companion modules
```

There is no lint step. To test in Foundry itself: symlink/copy this repo into `Data/modules/helianas-mechanics/`, enable the module in a world, and reload the browser (`F5`) after edits.

### Testing constraints

Tests run in Node with a minimal Foundry mock defined in `tests/setup.mjs` (`game`, `Hooks`, `ui`, `foundry.utils`, `foundry.abstract.TypeDataModel`, data fields). Any module under test must stay importable in Node: only touch Foundry globals inside functions/getters (call time), never at module top level. If a tested module needs a new Foundry API, add it to the mock.

## Architecture

### Recipe data model

Recipes are **JournalEntryPage documents of sub-type `helianas-mechanics.recipe`**. This requires three coordinated registrations:

1. `module.json` → `documentTypes.JournalEntryPage.recipe` declares the sub-type.
2. `scripts/module.mjs` `init` hook assigns `RecipePageData` (a `TypeDataModel`, in `RecipePageData.mjs`) into `CONFIG.JournalEntryPage.dataModels`.
3. `RecipePageSheet` is registered as the default sheet for that sub-type.

Schema changes go in `RecipePageData.mjs`; the type constant is `RECIPE_PAGE_TYPE` in `Recipe.mjs`.

### Crafting flow (the core pipeline)

- `RecipeManager.mjs` — discovers recipes by scanning journals the user has ≥ Observer ownership on, grouped by `recipeType` (`manufacturing` | `cooking` | `forge`).
- `Recipe.mjs` — wrapper around a recipe page. Forge recipes link a manufacturing recipe via `baseItemRecipeUuid` (`resolveBaseRecipe()`), and `effectiveIngredients(path)` synthesizes the ingredient list for the chosen path: **enchanting** (pre-made base item + magic components, one roll) or **forging** (base recipe's raw materials + magic components, two rolls / two quirk passes).
- `Ingredient.mjs` — ingredient/component matching + consumption. Matching order: `resourcePath` (actor sheet resource) → name match (exact or regex via `nameMode`) / `flags.core.sourceId` UUID match → tag overlap (`flags.helianas-mechanics.tags`, `mode: "some" | "every"`).
- `CraftingApp.mjs` — the Workshop `ApplicationV2`. Two-actor pattern: separate Crafter (rolls the check) and Inventory Holder (owns ingredients, receives the item), persisted in client settings.
- `QuirkEngine.mjs` — computes flaws/boons from the `roll − dc` delta; boons capped by slotted essence tier. Per-recipe-type tables live in `constants.mjs` (`QUIRK_TABLES`).
- `CraftingTracker.mjs` — downtime tracker; in-progress crafts persist in the world setting `activeCrafts`. On completion it clones the full source item (`resultUuid`) and layers module flags (quirks/boons) on top; cooking results additionally get 1-hour Active Effects from `CookingEffects.mjs`.
- `constants.mjs` — `MODULE_ID`, `TOOLS` (each with an `abilities` array — tools are multi-ability), `ESSENCE_TIERS` / `ESSENCE_TIER_ORDER`, result-slot auto-fill tables (`MAGIC_RARITY_TABLE`, `MFG_ITEM_TABLE`), quirk tables.

### Tagging subsystem

Crafting-tag substitution data lives in `flags.helianas-mechanics.tags` (plain string array). `ItemTagPanel.mjs` provides the per-item tag editor and `deriveTagsFromName()` (also run on the `preCreateItem` hook to auto-tag new items); `BulkTagger.mjs` is the GM batch editor (handles compendium unlock/re-lock).

### Cross-cutting patterns

- **Item-sheet injection needs two hooks**: legacy `renderItemSheet` *and* `renderApplicationV2` (dnd5e 4.x sheets are ApplicationV2 and don't fire the legacy hook). See `module.mjs`.
- **Sockets**: the recipe-book unlock flows through `game.socket` on `module.helianas-mechanics`; only the active GM client (`game.users.activeGM?.isSelf`) performs the ownership update.
- **Public API** for macros is exposed on `game.modules.get("helianas-mechanics").api` (`RecipeImporter`, `RecipeBrowser`, `BulkTagger`) in the `ready` hook.
- **Chat command**: `/helianas-import` is intercepted via the `chatMessage` hook and routed to `RecipeImporter.runCommand()`.
- **Legacy migration**: `module.mjs` one-shot converts old flag-based recipes (`flags.helianas-mechanics.recipe`) to sub-type pages on GM login.
- `packs/` contains **LevelDB binary data** for the bundled compendiums (declared under `packs` in `module.json`). Never hand-edit these files. The three recipe packs (`manufacturing-recipes`, `forge-recipes`, `cooking-recipes`) are **generated** by `tools/build-packs.mjs` from the catalogue markdown (JSON sources in `packs-src/`, deterministic document IDs) — change the catalogue or the script and rerun `npm run build:packs`, never edit those packs in Foundry. Recipe results/components are linked to real compendium items via `tools/data/heliana-item-index.json` (names → UUIDs from heliana-core, helianas-harvesting, and dnd5e; regenerate with `tools/index-heliana-items.mjs` when those change). Multi-rarity catalogue rows expand to one recipe page per tier. The `recipe-collections` pack (boss/creature-type journals) and `hunt-items` pack are also generated; hunt content is hand-transcribed from the PDFs into `tools/data/hunts/*.json` (see `docs/hunts-plan.md` for the import roadmap). `mundane-items` and `recipe-books` are hand-authored in Foundry and not touched by the build. `.gitattributes` marks `packs/**` as binary — required, or `core.autocrlf` corrupts the `CURRENT` files on Windows checkouts.

## Foundry v14 Conventions

- Scripts are listed under `esmodules` in `module.json`; native `import`/`export`, no bundler.
- Foundry globals (`game`, `ui`, `Hooks`, `foundry`, `CONFIG`, `CONST`) are available at module scope — no import needed (but see testing constraints above).
- Use `ApplicationV2` / `HandlebarsApplicationMixin` for UI; `foundry.applications.api.DialogV2` for dialogs.
- `Hooks.once("init", …)` for registration (data models, sheets, settings); `Hooks.once("ready", …)` for anything needing a populated `game`.
- Store all custom data under the module's flag namespace: `flags["helianas-mechanics"][...]`.
- `MODULE_ID` (`"helianas-mechanics"`) must match the `id` in `module.json` exactly.
- Optional rules from the spec (metatags, volatile components, etc.) must be individually toggleable via module settings.

## Adding Features

- New scripts: create the `.mjs` under `scripts/crafting/` and import it from `module.mjs` (only `module.mjs` is listed in `esmodules`).
- New templates: Handlebars files under `templates/crafting/`, rendered via `renderTemplate("modules/helianas-mechanics/templates/crafting/foo.hbs", data)`.
- New localisation keys: `lang/en.json` under the `HELIANAS` namespace, accessed via `game.i18n.localize("HELIANAS.key")`.
- Bump `version` in `module.json` with every release.
- **Always update `README.md` after adding or changing a user-visible feature.** Any schema change, new recipe type, new tool, new ApplicationV2, new chat command, new hook surface, or changed UX flow must be reflected in the README in the same commit as the code change. Include at minimum: the feature's purpose, how to open/invoke it, any new flags or schema fields it introduces, and — if relevant — a bullet under the "Completed in recent work" list near the end. Bug fixes and pure refactors don't need a README change unless they alter documented behavior.

## Reference Documents

- `crafting_catalogue_foundry_reference.md` — canonical design spec (rules, data schemas, lookup tables, Appendix B feature checklist). Read it before implementing any feature. It is also **parsed at runtime** by `RecipeImporter.mjs` (Part 7 tables → recipe pages), so preserve its table structure when editing it.
- `docs/crafting-systems-design.md` — design notes for the implemented crafting systems.
- Still unimplemented from the spec: the **Harvesting system** (Assess → Carve workflow, creature-size scaling, optional metatag/volatile/ruining rules) and **Familiars** (seven trainer-specific improvement trees). See the README's TODO section.
