# Heliana's Mechanics

A Foundry VTT v14 module that implements the crafting system from *Heliana's Guide to Monster Hunting*: **Manufacturing**, **Cooking**, and a unified **Forge** type that exposes both an **Enchanting path** (pre-made base item + monster part + essence) and a **Forging path** (raw materials + monster part + essence) from a single recipe. Plus quirk-based results, essence-tier boon capping, recipe books, an in-app recipe sheet, item-level crafting tags, a **bulk item tagger**, and a downtime tracker.

- System: **dnd5e** (tested)
- Foundry compatibility: **v13–v14**
- Module version: **1.4.0**
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
| `recipeType` | `"manufacturing"` \| `"cooking"` \| `"forge"` | Workshop tab filter. `forge` exposes both enchanting and forging paths (see below). |
| `resultName` / `resultImg` / `resultUuid` | string | Display + (optional) item to clone on completion. |
| `resultQuantity` | integer ≥ 1 | |
| `dc` | integer | Base DC for the single-roll types (manufacturing / cooking). On forge recipes it's only used for the Forging path's manufacturing check, falling back to the linked base recipe's DC if present. |
| `timeHours` | number | Advance via tracker. On forge recipes, the forging path uses `max(baseRecipe.timeHours, enchantingTimeHours)`. |
| `toolKey` | string | Key from [`TOOLS`](scripts/crafting/constants.mjs) (e.g. `smiths-tools`). Each tool carries a list of valid abilities — see [Multi-ability tools](#multi-ability-tools). |
| `toolAbility` | legacy | No longer authored per recipe; the tool's own ability list drives the roll. Left on the schema so older pages keep loading. |
| `ingredients` | array | See below. |
| `essenceTierRequired` | `""` \| `"frail"…"deific"` | Required for forge recipes. Optional for manufacturing/cooking (a slotted essence just caps boons). |
| `componentCreatureType` | string | Enchanting-path roll-skill lookup. |
| `rarity` / `attunement` | strings | Display + used by the [result-slot auto-fill](#result-slot-auto-fill). |
| `baseItemRecipeUuid` | string | **Forge only.** UUID of a linked manufacturing recipe page. Its raw materials feed the forging path; its result feeds the enchanting path. |
| `enchantingDc` | integer | **Forge only.** DC of the enchanting check (both paths run this check). |
| `enchantingTimeHours` | number | **Forge only.** Hours for the enchanting portion. |

### Forge recipes (unified Enchanting + Forging)

A forge recipe is a single page that collapses what used to be two separate recipes for every magic item. It holds the **shared** data — the monster component, essence tier, creature type, rarity, attunement, and the result item — and links to one manufacturing recipe for the mundane base item. At craft time the player picks which path to run:

- **Enchanting path.** Player must already have the pre-made base item (e.g. a mundane Longsword) plus the shared monster component and essence. One roll: the selected tool's ability + proficiency, plus a skill determined by the component creature type.
- **Forging path.** Player supplies the raw materials from the linked manufacturing recipe plus the shared monster component and essence. **Two rolls, two quirk passes**: a manufacturing check (tool ability + prof) and an enchanting check (same tool ability + prof + creature-type skill). Flaws and boons are rolled separately against each DC, so a great enchanting roll can still save a flubbed smelt and vice versa.

If a forge recipe has no `baseItemRecipeUuid` the workshop shows a warning and disables crafting. Create the manufacturing recipe first, then drag it onto the forge recipe's **Base Item Recipe** slot.

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

- **Left:** tab switcher (Manufacturing 🔨 / Forge 🔥 / Cooking 🍴), search box, recipe list filtered by your unlocked journals.
- **Right:**
  - **Crafter** dropdown — the actor whose sheet rolls the check.
  - **Inventory** dropdown — the actor whose items are consumed, and who receives the crafted item.
  - **Path toggle** (forge recipes only): Enchanting / Forging.
  - Ingredient rows with per-component availability (quantity in inventory / quantity required + ✓/✗). Hover is a neutral grey, selected is soft green so it never fights the availability ✓ marker.
  - **Essence dropdown** — rendered directly under the ingredients list. Populated from the inventory holder's items that are flagged as essences or carry the `essence` crafting tag, and **filtered to tiers that meet or exceed** the recipe's minimum `essenceTierRequired`. Labelled "Essence (required — Minimum tier: X)" when a floor is set.
  - Stats row: tool + ability list, DC, time. Forging path shows **two** DC/time/formula blocks side-by-side plus a total-time line.
  - Roll-result input(s): one for single-roll types, two (Manufacturing + Enchanting) for the forging path. Each roll gets its own quirk pass.
  - **Craft / Enchant / Forge / Cook** button — adapts to the active recipe type and path.

Clicking a component with more than one alternate selects that alternate for consumption.

### Recipe types and paths

| Type / Path | Who rolls | Roll formula | Essence | Rolls | Notes |
|---|---|---|---|---|---|
| Manufacturing | Anyone proficient with the tool | `1d20 + ability mod + prof (tool)` | Optional (caps boons) | 1 | Mundane items. |
| Forge — Enchanting path | Anyone proficient with the tool | `1d20 + ability mod + prof (tool) + skill` (skill from creature type) | Required | 1 | Consumes the base item + monster part + essence. |
| Forge — Forging path | Same as above | Manufacturing check: `1d20 + ability mod + prof (tool)` · Enchanting check: `1d20 + ability mod + prof (tool) + skill` | Required | **2** | Consumes the base recipe's raw materials + monster part + essence. Each roll produces its own flaws/boons. |
| Cooking | Anyone proficient with Cook's Utensils | `1d20 + WIS mod + prof (Cook's Utensils)` | Optional | 1 | Meals, tonics, trail fare. |

Each flow draws from a recipe-type-appropriate flaws/boons table: manufacturing (`MFG_FLAWS`/`MFG_BOONS`, 20 entries each), enchanting (`ENC_FLAWS`/`ENC_BOONS`, 15/15) — used on the forge enchanting path, forging (`FRG_FLAWS`/`FRG_BOONS`, 10/10) — used on the forge forging path's manufacturing half, and cooking (`COOK_FLAWS`/`COOK_BOONS`, 10/10). Unknown recipe types fall back to manufacturing.

### Multi-ability tools

Some tools accept more than one ability (e.g. Carpenter's = STR **or** DEX, Smith's = CON **or** STR, Weaver's = DEX **or** INT). Each `TOOLS[key]` now stores an `abilities: string[]` list instead of a single ability. The workshop picks the character's highest eligible mod at roll time, and the UI (recipe sheet tool dropdown, workshop stats row) displays all valid abilities joined with "or" (e.g. "Carpenter's Tools (STR or DEX)"). Recipes no longer override the ability per page.

### Two-actor pattern

The **Crafter** and **Inventory Holder** can be the same actor (default) or different. Use different actors when, e.g., a PC crafts with supplies from the party stash NPC, or a blacksmith NPC crafts for a PC.

Speaker on the chat message is the Crafter; the crafted item appears on the Inventory Holder. When a recipe's result slot is linked to a world or compendium item, the completed craft **clones that source item in full** — name, image, system data (description, activities, damage, saving throws, etc.), and existing effects — so the player receives the real item rather than a placeholder. The module only layers its own flags (quirks, boons, recipe type) and, for cooking, the 1-hour boon/flaw Active Effects on top.

### Essences

The essence picker is a **dropdown**, placed directly under the ingredient list, listing the inventory holder's items that are either flagged as an essence or carry the `essence` crafting tag. When a recipe sets a minimum `essenceTierRequired`, the dropdown hides any essence whose tier ranks below it using the order `frail < robust < potent < mythic < deific`, so a recipe requiring *potent* will refuse a frail or robust essence. Tag items as essences by adding the `essence` tag via the tag dialog (see [Tagging items](#tagging-items-for-substitution)), or flag them explicitly:

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

If the recipe type requires an essence (currently just `forge`), the Craft button stays disabled until one is selected.

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

- A **Name** input at the very top of the sheet that edits the underlying `JournalEntryPage.name` directly. Dropping an item onto the result slot also overwrites the page title with the dropped item's name.
- A **result slot** — drag any world/compendium item onto it to populate `resultName`, `resultImg`, `resultUuid`, **and the page title**. See [Result-slot auto-fill](#result-slot-auto-fill) for the values that also get pre-populated from the dropped item.
- An **ingredient list** with add / delete buttons. New ingredient rows default to the name "Ingredient" (previously "New Ingredient"). Each ingredient has a grid of **component slots** where you can add, delete, drag items onto, and edit (tags, mode, resource path) via the gear icon.
- Scalar form fields for recipe type, DC, time, tool, essence tier, creature type, rarity, and attunement. All fields auto-save on change.
- A **Base Item Recipe** drop slot (forge recipes only) that accepts a manufacturing recipe page; drops are rejected if the page isn't a manufacturing recipe.
- **Enchanting DC** and **Enchanting Time** number inputs (forge recipes only).
- A read-only view template when the sheet is opened in non-edit mode.

### Result-slot auto-fill

When you drag an item onto a recipe's result slot, the sheet inspects the dropped item and fills in matching recipe fields — but **only if the corresponding recipe field is still at its schema default**, so it won't clobber values you already authored. The rules:

- **Rarity** and **attunement** are copied from the item when the recipe's corresponding fields are blank.
- **Essence tier** is copied from the rarity column below when the recipe doesn't already require a tier.
- **Tool** is auto-filled based on the dnd5e item's `type` / subtype / `baseItem` (smith's tools for metal weapons and heavy armour, woodcarver's for bows and staves, leatherworker's for hide / leather, weaver's for padded / cloth, calligrapher's for scrolls, alchemist's supplies for potions, and so on). Cooking recipes always use **Cook's Utensils**.
- **DC and hours** are picked differently depending on recipe type:
  - **Manufacturing & cooking** recipes use the Manufacturing DC & Time table, keyed off the item's sub-type (e.g. martial weapon, plate armour, potion base, wondrous item). A cooking recipe whose dropped item has a rarity falls through to the magic table so exotic meals still get proper defaults.
  - **Forge** recipes pull `enchantingDc` / `enchantingTimeHours` from the Enchanting DC & Time table, indexed by rarity × item-kind. The manufacturing side of a forge recipe inherits its DC/time from the linked base recipe at craft time — so the `dc` / `timeHours` on the forge page are only fallbacks.

The Enchanting DC & Time table has three columns keyed off how the item is carried once crafted:

- **Consumable** — `item.type === "consumable"` (potions, scrolls, single-use charges).
- **Attunement** — `item.system.attunement` is `required` or `optional`.
- **Non-attunement** — everything else.

| Rarity | Essence | DC | Consumable hrs | Non-attunement hrs | Attunement hrs |
|---|---|---|---|---|---|
| common | — | 12 | 0.5 | 1 | 2 |
| uncommon | frail | 15 | 4 | 10 | 20 |
| rare | robust | 18 | 20 | 40 | 80 |
| very rare | potent | 21 | 80 | 160 | 320 |
| legendary | mythic | 25 | 320 | 640 | 1,280 |
| artifact | deific | 30 | 50,000 | 100,000 | 200,000 |

The Manufacturing DC & Time table (mirrors the catalogue reference) is keyed by dnd5e item sub-type: adventuring gear (DC 11 / 2 h), ammunition ×20 (13 / 1), padded + hide + shield (13 / 8), leather + chain shirt + ring mail (15 / 16), chain mail (16 / 32), studded + scale (17 / 24), breastplate + splint (18 / 40), half plate (19 / 80), plate (20 / 200), instrument (15 / 16), potion base (15 / 2), ring (15 / 8), rod/staff/wand (17 / 8), spell scroll base (15 / 2), simple weapon (14 / 8), martial weapon (17 / 16), magitech firearm (19 / 24), wondrous item (15 / 8).

For bulk creation you can still use a macro:

```js
const journal = game.journal.getName("Forge Recipes");

// Manufacturing recipe (the base item for forge recipes to reference).
const [longswordRecipe] = await journal.createEmbeddedDocuments("JournalEntryPage", [{
  name: "Iron Longsword",
  type: "helianas-mechanics.recipe",
  system: {
    recipeType: "manufacturing",
    resultName: "Iron Longsword",
    resultImg:  "icons/weapons/swords/sword-broad-blue.webp",
    dc: 17,
    timeHours: 8,
    toolKey: "smiths-tools",
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

// Forge recipe linked to the above — the forging path will auto-pull the
// iron ingots; the enchanting path will expect an Iron Longsword in inventory.
await journal.createEmbeddedDocuments("JournalEntryPage", [{
  name: "Flame Tongue Longsword",
  type: "helianas-mechanics.recipe",
  system: {
    recipeType:           "forge",
    baseItemRecipeUuid:   longswordRecipe.uuid,
    resultName:           "Flame Tongue Longsword",
    dc:                   17,  // fallback for forging-path mfg check if baseRecipe missing
    timeHours:            8,
    enchantingDc:         18,
    enchantingTimeHours:  24,
    essenceTierRequired:  "potent",
    componentCreatureType:"dragon",
    rarity:               "rare",
    attunement:           "required",
    toolKey:              "smiths-tools",
    ingredients: [{
      id: foundry.utils.randomID(),
      name: "Shared magic component",
      components: [{
        id: foundry.utils.randomID(),
        name: "Dragon Breath Sac",
        quantity: 1,
        tags: ["dragon", "breath"],
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

## Bulk Item Tagger (GM)

Tagging items one-by-one doesn't scale past a handful of recipes. The **Bulk Item Tagger** (anvil toolbar → 🏷 Tags icon, GM-only) edits crafting tags on many items in a single pass.

- **Source picker.** World Items sidebar, or any Item compendium pack.
- **Filters.** Name search and an "Has tag" filter, plus select-all / clear / invert.
- **Bulk actions.** Add tags (comma-separated), remove tags, "Apply name-derived tags" (runs the same tokenizer that auto-tags new items), or clear all stored tags (guarded by a confirm dialog).
- **Compendium safety.** Locked packs are unlocked for the update and re-locked afterwards. Per-item failures are caught and counted, so one read-only document doesn't abort the batch.

Also exposed on the module API:

```js
game.modules.get("helianas-mechanics").api.BulkTagger.open();
```

See [BulkTagger.mjs](scripts/crafting/BulkTagger.mjs).

---

## Bundled compendiums

The module ships five empty compendium packs grouped under a **Heliana's Mechanics** folder in the sidebar's Compendium tab. They're empty on install so each GM can fill them with their own content; import items/recipes from your world or another module into whichever pack fits.

| Pack | Type | Purpose |
|---|---|---|
| Heliana's Mundane Items | Item (dnd5e) | Raw materials, tools, ingredients — anything a recipe consumes or produces at the manufacturing tier. |
| Heliana's Recipe Books | Item (dnd5e) | Physical "book" items flagged with `isRecipeBook` + `recipeBookJournalUuid` that unlock a linked journal when a player reads them. |
| Heliana's Manufacturing Recipes | JournalEntry | Journals whose pages are `helianas-mechanics.recipe` sub-type, type `manufacturing`. |
| Heliana's Forge Recipes | JournalEntry | Same, type `forge`. These link to entries in the Manufacturing Recipes pack via `baseItemRecipeUuid`. |
| Heliana's Cooking Recipes | JournalEntry | Same, type `cooking`. |

All packs default to **Observer** for players and **Owner** for Assistant GMs, matching the rest of the sidebar UX. Foundry initializes the underlying LevelDB the first time you write to each pack, so no setup is required beyond enabling the module.

To populate a pack:

1. Author the item or recipe in your world (Items sidebar, or a Journal Entry with recipe pages).
2. Right-click the document → **Import into Compendium** → pick the matching Heliana pack.
3. Or drag the document straight onto the pack in the Compendium tab.

For recipe-book Items, set the flags on the world copy *before* importing so the compendium entry carries them:

```js
await item.setFlag("helianas-mechanics", "isRecipeBook", true);
await item.setFlag("helianas-mechanics", "recipeBookJournalUuid", "JournalEntry.xxxxxxxxxxxxxxxx");
```

---

## Module structure

```
scripts/
  module.mjs                         entry point — hooks, migration, toolbar, socket, chat commands
  crafting/
    constants.mjs                    TOOLS (multi-ability), ESSENCE_TIERS, INGREDIENT_TAGS, QUIRK_TABLES
    RecipePageData.mjs               TypeDataModel schema for the recipe sub-type (incl. forge fields)
    RecipePageSheet.mjs              In-app GM sheet for recipe pages — drop slots, auto-fill from rarity
    Ingredient.mjs                   Ingredient / Component classes + tag and regex-name matching
    Recipe.mjs                       Recipe wrapper + resolveBaseRecipe() + effectiveIngredients(path)
    RecipeManager.mjs                journal → recipe discovery (permission-aware, three types)
    RecipeImporter.mjs               Catalogue markdown parser + compendium UUID resolver
    RecipeBrowser.mjs                GM catalogue browser ApplicationV2 (multi-select import)
    BulkTagger.mjs                   GM bulk item tagger ApplicationV2 (world Items + compendium packs)
    QuirkEngine.mjs                  delta-based flaw/boon calculator (per-type tables)
    CookingEffects.mjs               Cooking boons/flaws → dnd5e ActiveEffect data
    CraftingApp.mjs                  Workshop ApplicationV2 (manufacturing/forge/cooking tabs + path toggle)
    CraftingTracker.mjs              Tracker ApplicationV2
    ComponentEditForm.mjs            DialogV2 component editor (nameMode / tags / resource path)
    ItemTagPanel.mjs                 Item-sheet header button + DialogV2 tag editor, name-derived auto-tags
templates/crafting/
  app.hbs                            Workshop template (path toggle, dual roll inputs, essence dropdown)
  tracker.hbs                        Tracker template
  recipe-page-edit.hbs               Recipe sheet — edit mode
  recipe-page-view.hbs               Recipe sheet — view mode
  component-edit.hbs                 Component editor dialog
  recipe-browser.hbs                 Catalogue Browser template
  bulk-tagger.hbs                    Bulk Item Tagger template
tests/                               Vitest unit tests
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

- ✅ **Unified Forge recipes** — dropped the separate `enchanting` and `forging` types; a single `forge` recipe exposes both paths by linking to a manufacturing recipe for the mundane base. One source of truth per magic item.
- ✅ **Dual-roll forging path** — the forging path asks for a manufacturing *and* an enchanting roll, and runs `QuirkEngine.calculateQuirks` twice so each check contributes its own flaws and boons.
- ✅ **Multi-ability tools** — `TOOLS[key].abilities` is now an array; Carpenter's Tools (STR/DEX), Smith's Tools (CON/STR), Weaver's Tools (DEX/INT) and friends are displayed and rolled correctly.
- ✅ **Inventory-based essence picker** — dropped the essence drop slot in favour of a dropdown populated from the inventory holder's tagged/flagged items.
- ✅ **Result-slot auto-fill** — dropping an item onto a recipe's result slot pre-fills rarity, attunement, essence tier, tool, DC, and time (only when the fields are still at their schema defaults). DC/time are picked from the Manufacturing DC & Time table (manufacturing/cooking) or the Enchanting DC & Time table (forge), and the Enchanting columns are selected by item-kind — consumable, attunement, or non-attunement.
- ✅ **Editable page title** — a Name input at the top of the recipe sheet edits `JournalEntryPage.name` directly; dropping a result item also overwrites the title with that item's name.
- ✅ **Essence-slot tier filter** — the Crafting Workshop's essence dropdown now appears directly under the ingredients list and only offers essences whose tier meets or exceeds the recipe's minimum required tier.
- ✅ **Bulk Item Tagger** — GM-only `ApplicationV2` that edits crafting tags across world Items or any Item compendium pack, with auto-unlock/re-lock of packs.
- ✅ **Softer UI** — Nunito web font scoped to module surfaces only; the ingredient-row highlight is now neutral/green so it no longer clashes with the green ✓ status marker.
- ✅ **Type-specific quirk tables** — manufacturing / enchanting / forging / cooking each have their own flaws + boons tables (`QUIRK_TABLES` lookup); wired through `QuirkEngine.calculateQuirks(roll, dc, essenceTier, recipeType)`.
- ✅ **Catalogue Browser UI** — GM-only `ApplicationV2` toolbar button with section filter, name search, multi-select, and journal picker. Imports selected rows via the existing `RecipeImporter.importRows()` path.
- ✅ **Cooking → Active Effects** — boons and flaws from cooking recipes are attached to the produced consumable as dnd5e ActiveEffect data with 1-hour durations; a handful of boons already carry suggested `changes` entries.
- ✅ Mastercrafted-style item-sheet tag editor (chips + autocomplete).
- ✅ Regex name matching on components (`nameMode: "regex"`).
- ✅ Visual polish: accent-colour variables, smoother drop slots, icon-led workshop tabs, tracker card shadows.
- ✅ Cooking recipe type (Cook's Utensils tab).
- ✅ Catalogue importer (`/helianas-import "Journal Name"` chat command + public API).
- ✅ Droppable ingredient rows (drag an item onto a row to auto-add a new component).

## Credits

- Rules: *Heliana's Guide to Monster Hunting*.
- Ingredient/Component matching engine and two-actor pattern inspired by the [mastercrafted](https://foundryvtt.com/packages/mastercrafted) module.

## License

See [LICENSE](LICENSE) if present, otherwise refer to the module manifest.
