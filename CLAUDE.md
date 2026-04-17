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
