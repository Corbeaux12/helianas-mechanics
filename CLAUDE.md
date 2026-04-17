# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a [Foundry VTT](https://foundryvtt.com/) v14 module. Foundry modules are loaded directly by the Foundry server at runtime — there is no build step. All code runs in the browser as native ES modules.

## Module Structure

- `module.json` — The module manifest. Declares the module `id`, `version`, Foundry `compatibility` range, entry scripts, stylesheets, and language files.
- `scripts/module.mjs` — Main entry point, loaded as an ES module. Registers Hooks and initialises the module.
- `styles/module.css` — Module stylesheet, auto-loaded by Foundry.
- `lang/en.json` — Localisation strings, accessed via `game.i18n.localize("HELIANAS.key")`.

## Foundry v14 Conventions

- Scripts must be listed under `esmodules` in `module.json` (not the legacy `scripts` key).
- Use native ES module syntax (`import`/`export`). No bundler is needed; Foundry resolves modules from the filesystem.
- All Foundry globals (`game`, `ui`, `Hooks`, `foundry`, etc.) are available at module scope — no import needed.
- Prefer `Hooks.once("init", …)` for registration (classes, settings, document sub-types) and `Hooks.once("ready", …)` for anything that needs `game` to be fully populated.
- Settings are registered with `game.settings.register(MODULE_ID, key, config)` inside the `init` hook.
- `MODULE_ID` (`"helianas-mechanics"`) must match the `id` field in `module.json` exactly.

## Development Workflow

There is no build step. To develop:

1. Symlink (or copy) this repository folder into your Foundry `Data/modules/` directory so it appears as `Data/modules/helianas-mechanics/`.
2. Start Foundry, enable the module in a world, and reload.
3. Edit source files and reload the browser (`F5`) to pick up changes.

## Adding Features

- New scripts: create the `.mjs` file under `scripts/`, then add its path to `esmodules` in `module.json`.
- New templates: place Handlebars files under `templates/` and render with `renderTemplate("modules/helianas-mechanics/templates/foo.hbs", data)`.
- New localisation keys: add them to `lang/en.json` under the `HELIANAS` namespace.
- Bump `version` in `module.json` with every release.

## Crafting Catalogue Reference

`crafting_catalogue_foundry_reference.md` is the canonical design specification for this module. Read it before implementing any feature. It covers rules, data schemas, and Foundry-specific implementation notes for:

- **Harvesting system** — multi-step workflow (Assess → Carve), cumulative DC calculation per component, creature size scaling (harvest time and max helpers), optional rules (metatags, volatile components, ruining, supply costs).
- **Crafting system** — three types: Manufacturing (tool check), Enchanting (spellcasting check + essence consumption), and Forging (both combined). Quirk tables are applied based on `(roll − DC)` ranges.
- **Magic item recipes** — 100+ entries with required creature type, component, essence tier, attunement type, and rarity.
- **Familiars** — seven trainer-specific familiar types, each with a prerequisite-linked improvement tree scaling from character level 3 to 17.
- **Key lookup tables** — creature type → harvesting skill, creature size → time/helpers, rarity → essence tier/DC/crafting time (Appendix A).
- **Feature checklist** — full list of UI flows and mechanics to implement (Appendix B).

### Foundry Implementation Notes (from the spec)

- Use `ApplicationV2` / `HandlebarsApplicationMixin` for all UI; `foundry.applications.api.DialogV2` for dialogs.
- Store all custom data in the module's flags namespace: `flags["helianas-mechanics"]["key"]`.
- Compendiums to create: Harvest Tables (14), Essence Types (5), Mundane Ingredients (12), Magic Item Recipes (100+), Familiars (7), Quirk Tables (8+).
- Optional rules (metatags, volatile components, etc.) must be individually toggleable via module settings.
