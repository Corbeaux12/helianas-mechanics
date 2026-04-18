# Heliana's Mechanics

A Foundry VTT v14 module that implements the crafting system from *Heliana's Guide to Monster Hunting*: **Manufacturing**, **Enchanting**, quirk-based results, essence-tier boon capping, recipe books, an in-app recipe sheet, and a downtime tracker.

- System: **dnd5e** (tested)
- Foundry compatibility: **v13–v14**
- Module version: **1.1.0**
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
| `recipeType` | `"manufacturing"` \| `"enchanting"` | Workshop tab filter. |
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
| `name` | Primary match — consumed by exact name. |
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

To let a component accept an alternate item, add a module flag to the item:

```js
// On any item the GM wants to be substitutable:
item.setFlag("helianas-mechanics", "tags", ["metal", "ferrous"]);
```

Or via **Item sheet → Advanced / Edit flag**:

```
flags.helianas-mechanics.tags = ["metal", "ferrous"]
```

Suggested starter vocabulary (purely convention, not enforced): `metal`, `wood`, `leather`, `cloth`, `stone`, `gem`, `herb`, `bone`, `scale`, `hide`, `essence`, `reagent`, `tool`, `ferrous`.

---

## The Crafting Workshop

Click the **🔨 Heliana's Mechanics** toolbar group (left sidebar) → **⚒ Crafting Workshop**.

The workshop is a two-pane window:

- **Left:** tab switcher (Manufacturing / Enchanting), search box, recipe list filtered by your unlocked journals.
- **Right:**
  - **Crafter** dropdown — the actor whose sheet rolls the check.
  - **Inventory** dropdown — the actor whose items are consumed, and who receives the crafted item.
  - Ingredient rows with per-component availability (quantity in inventory / quantity required + ✓/✗).
  - Stats row: tool, DC, time.
  - Essence slot (drop an essence item onto it).
  - Roll-formula display, roll-result input, **Craft / Enchant** button.

Clicking a component with more than one alternate selects that alternate for consumption.

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

Boons are capped by the slotted essence tier. Quirk names/effects come from [`MFG_FLAWS`](scripts/crafting/constants.mjs) / [`MFG_BOONS`](scripts/crafting/constants.mjs). Enchanting quirk tables are not yet populated (manufacturing quirks are used as a fallback).

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

---

## Module structure

```
scripts/
  module.mjs                         entry point — hooks, migration, toolbar, socket
  crafting/
    constants.mjs                    TOOLS, ESSENCE_TIERS, INGREDIENT_TAGS, MFG_FLAWS/BOONS
    RecipePageData.mjs               TypeDataModel schema for the recipe sub-type
    RecipePageSheet.mjs              In-app GM sheet for recipe pages (drag/drop, add/delete)
    Ingredient.mjs                   Ingredient / Component classes + tag matching
    Recipe.mjs                       Recipe wrapper + consumeIngredients()
    RecipeManager.mjs                journal → recipe discovery (permission-aware)
    QuirkEngine.mjs                  delta-based flaw/boon calculator
    CraftingApp.mjs                  Workshop ApplicationV2
    CraftingTracker.mjs              Tracker ApplicationV2
    ComponentEditForm.mjs            DialogV2 component editor (tags / mode / resource path)
templates/crafting/
  app.hbs                            Workshop template
  tracker.hbs                        Tracker template
  recipe-page-edit.hbs               Recipe sheet — edit mode
  recipe-page-view.hbs               Recipe sheet — view mode
  component-edit.hbs                 Component editor dialog
tests/                               Vitest unit tests (86 passing)
docs/
  crafting-systems-design.md         Full design spec
crafting_catalogue_foundry_reference.md   Canonical rules reference
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

Planned work, not yet implemented:

- **Item tagging like mastercrafted** — a proper tag-management UI on item sheets (multi-select, autocomplete against `INGREDIENT_TAGS`, shared taxonomy), rather than hand-editing `flags.helianas-mechanics.tags`.
- **Regex name options for ingredients** — allow a component's `name` field to be a regex (e.g. `/^.*\bIngot\b/i`) so one slot can match a family of items without enumerating every UUID.
- **More visually appealing UI** — polish the workshop, tracker, and recipe sheet (better iconography, slot artwork, hover states, empty-state illustrations, responsive layout).
- **Forging** — the third crafting type from the catalogue (tool check + spellcasting check combined), including its own quirk table and mixed essence / mundane ingredient handling.
- **Cooking** — Cook's-Utensils-driven recipes with their own boon/flaw tables (buffs, rest-length modifiers, condition-curing meals).
- **Pull UUIDs and automate recipe creation** — batch-import recipes from the catalogue by resolving the 100+ magic-item UUIDs from enabled compendiums and auto-generating `helianas-mechanics.recipe` pages (component tier, rarity, attunement, creature type all filled in).

## Credits

- Rules: *Heliana's Guide to Monster Hunting*.
- Ingredient/Component matching engine and two-actor pattern inspired by the [mastercrafted](https://foundryvtt.com/packages/mastercrafted) module.

## License

See [LICENSE](LICENSE) if present, otherwise refer to the module manifest.
