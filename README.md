# Heliana's Mechanics

A Foundry VTT v14 module that implements the crafting system from *Heliana's Guide to Monster Hunting*: **Manufacturing**, **Enchanting**, **Forging**, **Cooking**, quirk-based results, essence-tier boon capping, recipe books, an in-app recipe sheet, item-level crafting tags, and a downtime tracker.

- System: **dnd5e** (tested)
- Foundry compatibility: **v13–v14**
- Module version: **1.2.0**
- No build step — ES modules load directly

---

## Installation

### Module directory

Copy or symlink this folder into your Foundry data directory so it appears at:

```
<Foundry Data>/Data/modules/helianas-mechanics/
```

### Enable

Launch Foundry, open your world, go to **Game Settings → Manage Modules**, tick **Heliana's Mechanics**, save, reload.

### Manifest URL

Alternatively, in Foundry's module browser use the manifest URL of your published build.

---

## Quick start (5 minutes)

1. As GM, create a **Journal Entry** named e.g. "Forge Recipes".
2. Add a page of type **Recipe** (`helianas-mechanics.recipe`). The custom sheet opens automatically — drop an item onto the result slot, add ingredients, drop items onto the component slots (or leave them name-matched), and set DC / time / tool.
3. Grant players at least **Observer** ownership on the journal — or create a **Recipe Book item** (see below) that unlocks it when read.
4. Players click the **🔨 anvil toolbar group** in the left sidebar → **Crafting Workshop**.
5. They pick a **Crafter** (who rolls the check) and an **Inventory Holder** (who owns the ingredients), select the recipe, enter a roll result, and click **Craft**.
6. The craft appears in the **Crafting Tracker**. Use `+1 Hour` / `+1 Day` to advance downtime. When time completes, the item is created on the Inventory Holder with any quirks/boons attached as flags.

---

## Concepts

### Recipes

Recipes are **JournalEntryPage** documents of sub-type `helianas-mechanics.recipe`. The schema (`page.system`):

| Field | Type | Notes |
|---|---|---|
| `recipeType` | `"manufacturing"` \| `"enchanting"` \| `"forging"` \| `"cooking"` | Workshop tab filter. |
| `resultName` / `resultImg` / `resultUuid` | string | Display + (optional) item to clone on completion. |
| `resultQuantity` | integer ≥ 1 | |
| `dc` | integer | Fixed DC the roll must meet. |
| `timeHours` | number | Advance via tracker. |
| `toolKey` | string | Key from [`TOOLS`](scripts/crafting/constants.mjs) (e.g. `smiths-tools`). |
| `toolAbility` | `"str"…"cha"` | |
| `ingredients` | array | See below. |
| `essenceTierRequired` | `""` \| `"frail"…"deific"` | Enchanting: required tier. Manufacturing: optional; caps boons when slotted. |
| `componentCreatureType` | string | Enchanting roll-skill lookup. |
| `rarity` / `attunement` | strings | Display-only. |

### Ingredients and Components

Each **ingredient** is a named slot (e.g. "Metal stock") containing one or more alternative **components**. During crafting, the player picks which component to use.

| Component field | Purpose |
|---|---|
| `name` | Primary match — consumed by exact name (or regex, see `nameMode`). |
| `nameMode` | `"exact"` (default) \| `"regex"`. In regex mode, `name` is a JS pattern — bare patterns match case-insensitively, or use `/pattern/flags` literal form. |
| `uuid` | Optional — matches items whose `flags.core.sourceId` equals this UUID. |
| `quantity` | How many to consume. |
| `tags` | Substitution tags. See below. |
| `mode` | `"some"` (any tag matches) \| `"every"` (all tags required). |
| `resourcePath` | Optional dotted path into `actor.system` (e.g. `attributes.hp`). If set, consumes from the actor sheet instead of inventory. |

**How matching works during crafting (see [Recipe.consumeIngredients](scripts/crafting/Recipe.mjs)):**

1. If `resourcePath` is set → read/decrement `actor.system.<path>`.
2. Otherwise gather items by name match + `sourceId` match first.
3. Then fall through to **tag match**: any item carrying `flags["helianas-mechanics"].tags` overlapping the component's tags qualifies.
4. Consume stacks in order, deleting items whose quantity reaches 0.

### Tagging items for substitution

Every item sheet has a **tags** button (🏷) in its window header controls (provided by [ItemTagPanel](scripts/crafting/ItemTagPanel.mjs)). Clicking it opens a dialog where you can add tags (type and press Enter, or paste a comma-separated list), remove them via the ✕ on each chip, or re-import words from the item's name. Tags are stored under `flags.helianas-mechanics.tags`, and new items are auto-tagged with the lowercase alphanumeric words of their name (filler words like *the*, *of*, *and* are skipped). Existing items without stored tags still match by name-derived tokens at read time.

If you prefer scripting, the flag is still a plain string array — all three of these are equivalent:

```js
// Via the module API (recommended)
await item.setFlag("helianas-mechanics", "tags", ["metal", "ferrous"]);

// From an Item sheet → Advanced / Edit flag
flags.helianas-mechanics.tags = ["metal", "ferrous"]
```

Starter vocabulary (purely convention, not enforced): `metal`, `wood`, `leather`, `cloth`, `stone`, `gem`, `herb`, `bone`, `scale`, `hide`, `essence`, `reagent`, `tool`, `ferrous`.

---

## The Crafting Workshop

Click the **🔨 Heliana's Mechanics** toolbar group (left sidebar) → **⚒ Crafting Workshop**.

The workshop is a two-pane window:

- **Left:** tab switcher (Manufacturing 🔨 / Enchanting ✨ / Forging 🔥 / Cooking 🍴), search box, recipe list filtered by your unlocked journals.
- **Right:**
  - **Crafter** dropdown — the actor whose sheet rolls the check.
  - **Inventory** dropdown — the actor whose items are consumed, and who receives the crafted item.
  - Ingredient rows with per-component availability (quantity in inventory / quantity required + ✓/✗).
  - Stats row: tool, DC, time.
  - Essence slot (drop an essence item onto it).
  - Roll-formula display, roll-result input, **Craft / Enchant / Forge / Cook** button (adapts to recipe type).

Clicking a component with more than one alternate selects that alternate for consumption.

### Recipe types

| Type | Who rolls | Roll formula | Essence | Notes |
|---|---|---|---|---|
| Manufacturing | Anyone proficient with the tool | `1d20 + ability mod + prof (tool)` | Optional (caps boons) | Mundane items. |
| Enchanting | Spellcasters | `1d20 + spellcasting mod + skill` (skill determined by component creature type) | Required | Magic items from mundane + monster component + essence. |
| Forging | Anyone proficient with the tool | `1d20 + ability mod + prof (tool) + spellcasting mod + skill` | Required | Combined manufacturing + enchanting in one pass. |
| Cooking | Anyone proficient with Cook's Utensils | `1d20 + WIS mod + prof (Cook's Utensils)` | Optional | Meals, tonics, trail fare. |

Each recipe type now draws from its own flaws/boons table: manufacturing (`MFG_FLAWS`/`MFG_BOONS`, 20 entries each), enchanting (`ENC_FLAWS`/`ENC_BOONS`, 15/15), forging (`FRG_FLAWS`/`FRG_BOONS`, 10/10), and cooking (`COOK_FLAWS`/`COOK_BOONS`, 10/10). Unknown recipe types fall back to manufacturing.

### Two-actor pattern

The **Crafter** and **Inventory Holder** can be the same actor (default) or different. Use different actors when, e.g., a PC crafts with supplies from the party stash NPC, or a blacksmith NPC crafts for a PC.

Speaker on the chat message is the Crafter; the crafted item appears on the Inventory Holder.

### Essences

Drag any item flagged as an essence onto the essence slot:

```
flags.helianas-mechanics.isEssence   = true
flags.helianas-mechanics.essenceTier = "frail"  // or robust/potent/mythic/deific
```

Slotted essence caps the **maximum boons** rolled on a successful craft:

| Tier | Max boons |
|---|---|
| (none) | 0 |
| Frail | 1 |
| Robust | 2 |
| Potent / Mythic / Deific | 3 |

---

## Crafting Tracker

Click the **⏳ Crafting Tracker** toolbar button to open it.

- Lists all in-progress crafts belonging to the current user.
- `+1 Hour` / `+1 Day` advance elapsed time.
- When elapsed ≥ total, the tracker auto-creates the crafted item on the Inventory Holder with quirks/boons attached as `flags.helianas-mechanics.{quirks,boons}`, posts a completion chat message, and removes the entry.
- `✗ Cancel` removes the entry **without refunding materials**.

---

## Recipe Books (player unlocks)

Journals granted **Observer** ownership are visible in the workshop. For a player-driven unlock, bind a journal to an **item** and hand the item to the player:

```
// On a dnd5e Item (e.g. "Blacksmith's Manual"):
flags.helianas-mechanics.isRecipeBook          = true
flags.helianas-mechanics.recipeBookJournalUuid = "JournalEntry.xxxxxxxxxxxxxxxx"
```

When a player opens the item sheet, a banner appears with a **Read & Unlock Recipes** button. Clicking it fires a socket to the active GM client, which grants the player Observer on the linked journal. The player sees the recipes in their workshop immediately.

---

## Quirks (flaws & boons)

Calculated from `roll − dc` (**delta**) by [QuirkEngine](scripts/crafting/QuirkEngine.mjs):

| Delta | Result |
|---|---|
| ≤ −13 | **Destroyed** — ingredients consumed, no item produced |
| −12 to −9 | 3 flaws |
| −8 to −5 | 2 flaws |
| −4 to −2 | 1 flaw |
| −1 to +2 | no quirks |
| +3 to +5 | 1 boon |
| +6 to +9 | 2 boons |
| +10 to +12 | 3 boons |
| ≥ +13 | 3 boons + 1 bonus boon |

Boons are capped by the slotted essence tier. Quirk names/effects come from the recipe-type-appropriate table — see `QUIRK_TABLES` in [constants.mjs](scripts/crafting/constants.mjs). When a **cooking** recipe completes, its boons/flaws are also attached to the produced consumable as **Active Effects** (1-hour duration) so they can be toggled when the meal is consumed — see [CookingEffects.mjs](scripts/crafting/CookingEffects.mjs).

---

## Legacy recipe migration

The module used to store recipes as `page.flags["helianas-mechanics"].recipe`. On first world load after upgrade, the GM client scans every journal for such pages and creates a new sub-type page alongside each legacy one, converting materials into single-component ingredients. The legacy page is marked `flags.helianas-mechanics.isMigrated = true` so it runs only once; the original is left in place so you can verify, then delete manually.

Chat will show `Helianas: migrated N legacy recipe(s) to the new format.` on completion.

---

## Authoring new recipes (GM)

Recipe pages ship with a custom sheet ([RecipePageSheet](scripts/crafting/RecipePageSheet.mjs)) that is registered as the default editor for `helianas-mechanics.recipe` pages. Opening a recipe page in edit mode gives you:

- A **result slot** — drag any world/compendium item onto it to populate `resultName`, `resultImg`, and `resultUuid` in one step. The ✗ button clears the slot.
- An **ingredient list** with add / delete buttons. Each ingredient has a grid of **component slots** where you can add, delete, drag items onto, and edit (tags, mode, resource path) via the gear icon.
- Scalar form fields for recipe type, DC, time, tool, tool ability, essence tier, creature type, rarity, and attunement. All fields auto-save on change.
- A read-only view template when the sheet is opened in non-edit mode.

For bulk creation you can still use a macro:

```js
const journal = game.journal.getName("Forge Recipes");
await journal.createEmbeddedDocuments("JournalEntryPage", [{
  name: "Iron Longsword",
  type: "helianas-mechanics.recipe",
  system: {
    recipeType: "manufacturing",
    resultName: "Iron Longsword",
    resultImg:  "icons/weapons/swords/sword-broad-blue.webp",
    dc: 17,
    timeHours: 8,
    toolKey: "smiths-tools",
    toolAbility: "str",
    ingredients: [{
      id: foundry.utils.randomID(),
      name: "Metal stock",
      components: [{
        id: foundry.utils.randomID(),
        name: "Iron Ingot",
        quantity: 2,
        tags: ["metal", "ferrous"],
        mode: "some",
      }],
    }],
  },
}]);
```

Recipes authored under the legacy flag shape are converted automatically on the next world load — see the **Legacy recipe migration** section above. Full design notes live in `docs/crafting-systems-design.md`.

### Bulk import from the catalogue

`scripts/crafting/RecipeImporter.mjs` parses the bundled `crafting_catalogue_foundry_reference.md` and converts each Part 7 table row into a recipe page, resolving the result item's UUID and icon from any enabled Item compendium.

**Catalogue Browser (GM only)** — open the **📖 Catalogue Browser** button in the Heliana's Mechanics toolbar group for a visual multi-select UI. It loads every Part 7 row, lets you filter by section ("Rings", "Potions", etc.) and search by name, and imports the selection into a chosen journal in one click. See [RecipeBrowser.mjs](scripts/crafting/RecipeBrowser.mjs).

**Chat command (GM only):**

```
/helianas-import "Forge Recipes" 50
```

— imports up to 50 catalogue entries into the journal named "Forge Recipes". Rows whose result item cannot be found in any compendium are still imported, but without a `resultUuid` / `resultImg` (drop an item onto the sheet's result slot later to backfill).

**Macro / API:**

```js
const api = game.modules.get("helianas-mechanics").api;
const journal = game.journal.getName("Forge Recipes");
const text    = await (await fetch("modules/helianas-mechanics/crafting_catalogue_foundry_reference.md")).text();
const rows    = api.RecipeImporter.parseCatalogueMarkdown?.(text) ?? []; // or use your own rows
await api.RecipeImporter.importRows(journal, rows, { max: 100 });

// Or open the interactive browser:
api.RecipeBrowser.open();
```

Each generated page carries DC, time, rarity, essence tier, creature type and attunement derived from the row; DC/time come from the Enchanting Rarity/DC/Time table (common → 12/1 hr … artifact → 30/100,000 hr). Tweak anything afterwards via the recipe sheet.

---

## Module structure

```
scripts/
  module.mjs                         entry point — hooks, migration, toolbar, socket, chat commands
  crafting/
    constants.mjs                    TOOLS, ESSENCE_TIERS, INGREDIENT_TAGS, MFG_FLAWS/BOONS
    RecipePageData.mjs               TypeDataModel schema for the recipe sub-type
    RecipePageSheet.mjs              In-app GM sheet for recipe pages (drag/drop result + ingredient + component)
    Ingredient.mjs                   Ingredient / Component classes + tag and regex-name matching
    Recipe.mjs                       Recipe wrapper + consumeIngredients()
    RecipeManager.mjs                journal → recipe discovery (permission-aware, four types)
    RecipeImporter.mjs               Catalogue markdown parser + compendium UUID resolver
    RecipeBrowser.mjs                GM catalogue browser ApplicationV2 (multi-select import)
    QuirkEngine.mjs                  delta-based flaw/boon calculator (per-type tables)
    CookingEffects.mjs               Cooking boons/flaws → dnd5e ActiveEffect data
    CraftingApp.mjs                  Workshop ApplicationV2 (manufacturing/enchanting/forging/cooking tabs)
    CraftingTracker.mjs              Tracker ApplicationV2
    ComponentEditForm.mjs            DialogV2 component editor (nameMode / tags / resource path)
    ItemTagPanel.mjs                 Item-sheet header button + DialogV2 tag editor, name-derived auto-tags
templates/crafting/
  app.hbs                            Workshop template
  tracker.hbs                        Tracker template
  recipe-page-edit.hbs               Recipe sheet — edit mode
  recipe-page-view.hbs               Recipe sheet — view mode
  component-edit.hbs                 Component editor dialog
  recipe-browser.hbs                 Catalogue Browser template
tests/                               Vitest unit tests (149 passing)
docs/
  crafting-systems-design.md         Full design spec
crafting_catalogue_foundry_reference.md   Canonical rules reference (parsed by RecipeImporter)
```

---

## Development

```bash
npm install
npm test          # run once
npm run test:watch
```

Tests use Vitest with a minimal Foundry mock in [tests/setup.mjs](tests/setup.mjs). The suite covers constants, QuirkEngine, RecipeManager, and the Ingredient/Component matching + consumption engine.

No build step — just reload Foundry (`F5`) after editing source files.

---

## Settings

| Setting | Scope | Purpose |
|---|---|---|
| `activeCrafts` | world | Array of in-progress crafts (tracker state). Hidden from config UI. |
| `craftingActorId` | client | Last-used Crafter dropdown selection. |
| `inventoryActorId` | client | Last-used Inventory Holder dropdown selection. |

---

## TODO / Roadmap

Remaining follow-ups:

- **Harvesting system** — the first half of the catalogue (Assess → Carve, creature-size timers, helpers, optional metatag/ruining/volatile rules) is still unimplemented.
- **Familiars** — seven trainer-specific familiar trees, still unimplemented.
- **Compendium packs** — ship the Harvest Tables, Essence Types, Mundane Ingredients, Magic Item Recipes, Familiars, and Quirk Tables as bundled compendiums so worlds don't have to run the importer.
- **Expanded cooking-effect mappings** — today only a handful of boons (Fortifying/Warming/Nourishing) and flaws (Heavy) have numeric Active-Effect changes; the rest ship as descriptive effects only. Extend `CookingEffects.mjs` as new patterns settle.

Completed in recent work:

- ✅ **Type-specific quirk tables** — enchanting / forging / cooking each have their own flaws + boons tables (`QUIRK_TABLES` lookup); wired through `QuirkEngine.calculateQuirks(roll, dc, essenceTier, recipeType)`.
- ✅ **Catalogue Browser UI** — GM-only `ApplicationV2` toolbar button with section filter, name search, multi-select, and journal picker. Imports selected rows via the existing `RecipeImporter.importRows()` path.
- ✅ **Cooking → Active Effects** — boons and flaws from cooking recipes are attached to the produced consumable as dnd5e ActiveEffect data with 1-hour durations; a handful of boons already carry suggested `changes` entries.
- ✅ Mastercrafted-style item-sheet tag editor (chips + autocomplete).
- ✅ Regex name matching on components (`nameMode: "regex"`).
- ✅ Visual polish: accent-colour variables, smoother drop slots, icon-led workshop tabs, tracker card shadows.
- ✅ Forging recipe type (tool + spellcasting combined roll).
- ✅ Cooking recipe type (Cook's Utensils tab).
- ✅ Catalogue importer (`/helianas-import "Journal Name"` chat command + public API).
- ✅ Droppable ingredient rows (drag an item onto a row to auto-add a new component).

## Credits

- Rules: *Heliana's Guide to Monster Hunting*.
- Ingredient/Component matching engine and two-actor pattern inspired by the [mastercrafted](https://foundryvtt.com/packages/mastercrafted) module.

## License

See [LICENSE](LICENSE) if present, otherwise refer to the module manifest.
