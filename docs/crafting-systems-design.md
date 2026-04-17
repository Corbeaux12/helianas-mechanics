# Crafting Systems — Design Document

## Context

Heliana's Mechanics is a Foundry VTT v14 module. This document designs the Manufacturing crafting system with a scene-controls toolbar entry point, journal-based configurable recipes (GM-authored, player-unlocked via recipe book items), a two-panel crafting workshop UI, and a time-progress tracker. Enchanting data structures are also scaffolded. No code is written until this document is approved.

---

## 1. Toolbar Entry Points

One control group ("Heliana's Mechanics") is added via `getSceneControlButtons`. The group icon acts as an **expand toggle**: clicking it reveals the sub-tool buttons, exactly like Foundry's native Drawing or Measurement groups. The sub-tools collapse again when another group is activated.

```
Left sidebar — collapsed state
┌────┐
│ ...│  ← existing Foundry controls
├────┤
│ 🔨 │  ← Heliana's Mechanics group  (click to expand ▼)
├────┤
│ ...│
└────┘

Left sidebar — expanded state (after clicking 🔨)
┌────┐
│ ...│
├════┤
│ 🔨 │  ← group header (active / highlighted)
├────┤
│ ⚒  │  "Crafting Workshop"  — onClick → opens CraftingApp
├────┤
│ ⏳ │  "Crafting Tracker"   — onClick → opens CraftingTracker
├════┤
│ ...│
└────┘
```

The group itself is **not** a button (`button: false` on the group entry). The two sub-tools are `button: true` with `onClick` handlers. This matches the standard Foundry scene-control pattern where the group expands on selection and sub-tools fire actions.

---

## 2. Crafting Workshop — Screen Schematics

The workshop is a resizable ApplicationV2 window (default 780 × 560 px) with a fixed left sidebar and a dynamic right panel.

### 2a. Empty state (nothing selected)

```
╔══════════════════════════════════════════════════════════════════╗
║  ⚒  Crafting Workshop                                   _ □ ✕  ║
╠═══════════════════════╦══════════════════════════════════════════╣
║  [Manufacturing] [Ench]║                                         ║
║  ┌─────────────────┐  ║                                         ║
║  │ 🔍 Search...    │  ║          Select a recipe                ║
║  └─────────────────┘  ║          from the list to begin.        ║
║  ─────────────────────║                                         ║
║  Iron Longsword        ║                                         ║
║  Steel Dagger          ║                                         ║
║  Chainmail             ║                                         ║
║  Adventurer's Pack     ║                                         ║
║  Leather Armour        ║                                         ║
║  Ring (plain)          ║                                         ║
║                        ║                                         ║
║                        ║                                         ║
║  ── 6 recipes ─────── ║                                         ║
╚═══════════════════════╩═════════════════════════════════════════╝
```

- The tab bar switches between Manufacturing and Enchanting recipe types.
- The search box filters the list by recipe name (client-side, instant).
- Recipe rows show item icon + name only.
- The right panel shows placeholder text when nothing is selected.

---

### 2b. Recipe selected — Manufacturing

```
╔══════════════════════════════════════════════════════════════════╗
║  ⚒  Crafting Workshop                                   _ □ ✕  ║
╠═══════════════════════╦══════════════════════════════════════════╣
║  [Manufacturing] [Ench]║ ┌──────────────────────────────────┐   ║
║  ┌─────────────────┐  ║ │ [⚔️]  Iron Longsword              │   ║
║  │ 🔍 Search...    │  ║ │       Martial Weapon · 15 gp      │   ║
║  └─────────────────┘  ║ └──────────────────────────────────┘   ║
║  ─────────────────────║                                         ║
║  ▶ Iron Longsword     ║  REQUIRED MATERIALS                     ║
║    Steel Dagger       ║  ┌─────────────────────┬──────┬──────┐  ║
║    Chainmail          ║  │ Iron Ingot           │  ×2  │  ✓  │  ║
║    Adventurer's Pack  ║  │ Leather Strip        │  ×1  │  ✓  │  ║
║    Leather Armour     ║  └─────────────────────┴──────┴──────┘  ║
║    Ring (plain)       ║  (✓ = found in inventory, ✗ = missing)  ║
║                       ║                                         ║
║                       ║  Tool:  Smith's Tools  (STR or CON)     ║
║                       ║  DC:    17                               ║
║                       ║  Time:  8 hours                         ║
║                       ║  ─────────────────────────────────────  ║
║                       ║  Essence  (optional — adds boon cap)    ║
║                       ║  ┌────────────────────────────────────┐ ║
║                       ║  │  [🔮 Frail Essence  ×1]       [✕] │ ║
║                       ║  │  or drop an essence item here      │ ║
║                       ║  └────────────────────────────────────┘ ║
║                       ║  Max boons if essence slotted:  1       ║
║                       ║  ─────────────────────────────────────  ║
║                       ║  Roll Formula                           ║
║                       ║  1d20 + STR mod + Prof (Smith's Tools)  ║
║                       ║  ─────────────────────────────────────  ║
║                       ║  Roll result   ┌──────┐                 ║
║                       ║  (after roll)  │  19  │                 ║
║                       ║                └──────┘                 ║
║                       ║           [  Craft Item  ]              ║
╚═══════════════════════╩═════════════════════════════════════════╝
```

The formula line is derived from the recipe's `toolKey` and `toolAbility` fields and rendered as a human-readable string (e.g. `1d20 + STR mod + Prof (Smith's Tools)`). It is display-only — the player rolls physically or in Foundry's chat and enters the numeric result into the input below.

**Material row legend:**
- `✓` green — at least the required quantity is found on the current actor.
- `✗` red — item not found or UUID not yet configured (craft still allowed with a warning).

**Essence slot:**
- Drop-target `<div>` that accepts Item drops.
- If an item with the matching essence flag is dropped, it populates the slot.
- A small `[✕]` button clears it.
- The "Max boons" line updates reactively based on the slotted essence tier.

**Craft button:**
- Disabled if roll result input is empty.
- On click → triggers the crafting resolution flow (see §5).

---

### 2c. Recipe selected — Enchanting

```
╔══════════════════════════════════════════════════════════════════╗
║  ⚒  Crafting Workshop                                   _ □ ✕  ║
╠═══════════════════════╦══════════════════════════════════════════╣
║  [Mfg] [Enchanting]   ║ ┌──────────────────────────────────┐   ║
║  ┌─────────────────┐  ║ │ [🔮]  Cloak of Protection  +1    │   ║
║  │ 🔍 Search...    │  ║ │       Very Rare · Attunement Req  │   ║
║  └─────────────────┘  ║ └──────────────────────────────────┘   ║
║  ─────────────────────║                                         ║
║  ▶ Cloak of Prot. +1  ║  BASE ITEM (mundane)                    ║
║    Ring of Prot. +1   ║  ┌────────────────────────────────────┐ ║
║    Sword +1           ║  │  Cloak (cloth)               ×1  ✓ │ ║
║                       ║  └────────────────────────────────────┘ ║
║                       ║                                         ║
║                       ║  COMPONENT                              ║
║                       ║  ┌────────────────────────────────────┐ ║
║                       ║  │  Dragon Scale (Dragon type)  ×1  ✓ │ ║
║                       ║  └────────────────────────────────────┘ ║
║                       ║                                         ║
║                       ║  ESSENCE  (required)                    ║
║                       ║  ┌────────────────────────────────────┐ ║
║                       ║  │  [🔮 Potent Essence  ×1]      [✕] │ ║
║                       ║  └────────────────────────────────────┘ ║
║                       ║                                         ║
║                       ║  Skill:  Survival (Dragon type)         ║
║                       ║  DC:     21   Time:  320 hours          ║
║                       ║  Max boons:  3                          ║
║                       ║  ─────────────────────────────────────  ║
║                       ║  Roll Formula                           ║
║                       ║  1d20 + Spellcasting mod + Survival     ║
║                       ║  ─────────────────────────────────────  ║
║                       ║  Roll result   ┌──────┐                 ║
║                       ║                │  24  │                 ║
║                       ║                └──────┘                 ║
║                       ║           [  Enchant Item  ]            ║
╚═══════════════════════╩═════════════════════════════════════════╝
```

---

## 3. Crafting Tracker — Screen Schematic

Default 560 × 480 px. Lists all active crafts belonging to the current user's actor.

```
╔══════════════════════════════════════════════════════════╗
║  ⏳ Crafting Tracker                             _ □ ✕  ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ [⚔️]  Iron Longsword                               │  ║
║  │                                                    │  ║
║  │  ████████████░░░░░░░░░░░░░░░░  5 / 8 hrs  (62%)   │  ║
║  │                                                    │  ║
║  │  [+ 1 Hour]   [+ 1 Day]              [✗ Cancel]   │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                          ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │ [🛡]  Chainmail                                    │  ║
║  │                                                    │  ║
║  │  ███░░░░░░░░░░░░░░░░░░░░░░░░░░  4 / 32 hrs  (12%) │  ║
║  │                                                    │  ║
║  │  [+ 1 Hour]   [+ 1 Day]              [✗ Cancel]   │  ║
║  └────────────────────────────────────────────────────┘  ║
║                                                          ║
║  ─────────────────────── 2 crafts in progress ─────────  ║
╚══════════════════════════════════════════════════════════╝
```

**Progress bar:** CSS `<div>` with `width` set to `(completedHours / totalHours * 100)%`.

**[+ 1 Hour] / [+ 1 Day]:** Increment `completedHours` by 1 or 24. When `completedHours >= totalHours`, the craft completes automatically (see §5).

**[✗ Cancel]:** Opens a `DialogV2` confirmation. On confirm, removes the entry; materials are NOT refunded.

---

## 4. Recipe Book Item Sheet — Injection Schematic

When a player opens the sheet of any item that has the `recipeBookJournalUuid` flag set, the module injects a styled banner above the item description.

```
╔══════════════════════════════════════════════════════════╗
║  📗  Blacksmith's Manual Vol. I                  _ □ ✕  ║
╠══════════════════════════════════════════════════════════╣
║  [Details]  [Description]  [Effects]                     ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │  📖  Recipe Book                                 │   ║
║  │  This item contains crafting recipes.            │   ║
║  │  Reading it will permanently unlock its          │   ║
║  │  recipes for your character.                     │   ║
║  │                                                  │   ║
║  │                    [ 📖 Read & Unlock Recipes ]  │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
║  ... normal item description below ...                   ║
╚══════════════════════════════════════════════════════════╝
```

The button is visible to players only when they are the owner of the item. GMs always see it. Once clicked, the permission grant fires (see §7) and the button text changes to "✓ Recipes Unlocked" (disabled).

---

## 5. Crafting Resolution Flow

```
Player clicks [Craft Item]
        │
        ▼
QuirkEngine.calculateQuirks(rollResult, dc, essenceTier?)
        │
        ├─ delta ≤ −13 ──▶  Destroyed  ──▶  Chat: "Item destroyed" · exit
        │
        ├─ flaws/boons calculated
        │
        ▼
Remove materials from actor inventory
  (for each material with a configured UUID:
   find matching item on actor, reduce quantity, delete if 0)
  (materials without UUIDs: skip removal, append warning to chat)
        │
        ▼
Post Chat Message
  ┌──────────────────────────────────────────────────┐
  │  ⚒  Iron Longsword — Craft Started               │
  │  Roll: 19  ·  DC: 17  ·  Delta: +2               │
  │  Result: No quirks or boons.                     │
  │  Time required: 8 hours                          │
  │  ── Materials consumed ──────────────────────── │
  │  Iron Ingot ×2, Leather Strip ×1                 │
  └──────────────────────────────────────────────────┘
        │
        ▼
Create activeCraft entry in world setting "activeCrafts"
  { id, userId, actorId, recipeName, resultItemData,
    quirks[], boons[], totalHours, completedHours: 0 }
        │
        ▼
Close recipe detail panel / refresh tracker
```

### Craft Completion (triggered from Tracker)

```
completedHours >= totalHours
        │
        ▼
Create Item on actor
  game.actors.get(actorId).createEmbeddedDocuments("Item", [
    { ...resultItemData, flags: { "helianas-mechanics": { quirks, boons } } }
  ])
        │
        ▼
Post Chat Message
  ┌──────────────────────────────────────────────────┐
  │  ⚒  Iron Longsword — Craft Complete!             │
  │  Quirks:  Handiwork (−1 attack/damage)           │
  │  Boons:   Durable (item HP ×3)                   │
  └──────────────────────────────────────────────────┘
        │
        ▼
Remove entry from "activeCrafts" setting
Refresh Tracker window
```

---

## 6. Data Schemas

### 6.1 Recipe (flags on JournalEntryPage)

```js
// page.flags["helianas-mechanics"]
{
  isRecipe: true,
  recipe: {
    type: "manufacturing",        // "manufacturing" | "enchanting"
    resultItemName: "Iron Longsword",
    resultItemUuid: "",           // filled in later by GM
    resultItemImg: "icons/weapons/swords/sword-broad-blue.webp",
    dc: 17,
    timeHours: 8,
    toolKey: "smiths-tools",      // key into TOOLS constant
    toolAbility: "str",           // "str" | "dex" | "con" | "int"
    // Manufacturing only:
    materials: [
      { name: "Iron Ingot", quantity: 2, uuid: "" },
      { name: "Leather Strip", quantity: 1, uuid: "" }
    ],
    // Enchanting only:
    essenceTierRequired: "potent",
    componentName: "Dragon Scale",
    componentUuid: "",
    componentCreatureType: "dragon",
    baseItemName: "Cloak (cloth)",
    baseItemUuid: "",
    rarity: "very-rare",
    attunement: "required"        // "none"|"optional"|"required"|"required-spellcaster"
  }
}
```

### 6.2 Recipe Book (flags on Item)

```js
// item.flags["helianas-mechanics"]
{
  isRecipeBook: true,
  recipeBookJournalUuid: "JournalEntry.aBcDeFgH"
}
```

### 6.3 Active Craft (stored in world setting "activeCrafts")

```js
{
  id: "aBcDeFgH",                 // foundry.utils.randomID()
  userId: "...",
  actorId: "...",
  recipeName: "Iron Longsword",
  resultItemData: {               // minimal Item data for creation
    name: "Iron Longsword",
    img: "icons/...",
    type: "weapon"
  },
  quirks: [                       // empty array = no flaws
    { name: "Handiwork", effect: "−1 to attack and damage rolls. Cumulative." }
  ],
  boons: [
    { name: "Durable", effect: "Item HP tripled." }
  ],
  totalHours: 8,
  completedHours: 0
}
```

### 6.4 Essence Item (flags on Item in compendium)

```js
// item.flags["helianas-mechanics"]
{
  isEssence: true,
  essenceTier: "frail"   // "frail"|"robust"|"potent"|"mythic"|"deific"
}
```

---

## 7. Permission Flow — Recipe Unlocking

```
Player clicks [Read & Unlock Recipes]
        │
        ▼
game.socket.emit("module.helianas-mechanics", {
  action: "grantJournalAccess",
  journalUuid: "JournalEntry.xyz",
  userId: game.user.id
})
        │
        ▼  (received by all clients)
if (game.user.isGM && game.users.activeGM?.isSelf)
        │
        ▼
const journal = await fromUuid(journalUuid)
await journal.update({
  ownership: {
    ...journal.ownership,
    [userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
  }
})
        │
        ▼
Emit confirmation back:
game.socket.emit("module.helianas-mechanics", {
  action: "journalAccessGranted",
  journalUuid,
  userId
})
        │
        ▼  (received by originating player)
Re-render item sheet → button text → "✓ Recipes Unlocked" (disabled)
ui.notifications.info("Recipes unlocked!")
```

---

## 8. File & Module Structure

```
scripts/
  module.mjs                   Entry point — registers toolbar, settings,
                               socket handler, item sheet hook, imports all below
  crafting/
    constants.mjs              TOOLS map, ESSENCE_TIERS, MFG_DCS,
                               MFG_FLAWS[], MFG_BOONS[], ENC_FLAWS[], ENC_BOONS[],
                               MUNDANE_INGREDIENTS[], CREATURE_TYPE_SKILLS map
    RecipeManager.mjs          getUnlockedRecipes(actor) — queries game.journal
                               getRecipeFromPage(page) — extracts flag data
    QuirkEngine.mjs            calculateQuirks(rollResult, dc, essenceTier)
                               rollFromTable(table) — weighted random index
    CraftingApp.mjs            ApplicationV2 singleton — crafting workshop
    CraftingTracker.mjs        ApplicationV2 singleton — tracker window

templates/
  crafting/
    app.hbs                    Full workshop layout (list + detail panels)
    tracker.hbs                Tracker layout (craft cards with progress bars)

styles/
  module.css                   All module styles

lang/
  en.json                      All i18n strings under HELIANAS namespace

module.json                    Add 4 new esmodule paths
```

### Key i18n keys (representative)

```
HELIANAS.CraftingWorkshop, HELIANAS.CraftingTracker,
HELIANAS.Manufacturing, HELIANAS.Enchanting,
HELIANAS.RequiredMaterials, HELIANAS.EssenceSlot,
HELIANAS.RollResult, HELIANAS.CraftItem, HELIANAS.EnchantItem,
HELIANAS.AddHour, HELIANAS.AddDay, HELIANAS.CancelCraft,
HELIANAS.RecipeBook, HELIANAS.UnlockRecipes, HELIANAS.RecipesUnlocked,
HELIANAS.CraftStarted, HELIANAS.CraftComplete, HELIANAS.ItemDestroyed
```

---

## 9. Quirk Calculation Summary

| Roll − DC    | Outcome            | Boon cap (by essence)  |
|--------------|--------------------|------------------------|
| −13 or less  | Item destroyed     | —                      |
| −12 to −9    | 3 flaws            | —                      |
| −8 to −5     | 2 flaws            | —                      |
| −4 to −1     | 1 flaw             | —                      |
| 0 to +4      | Nothing            | —                      |
| +5 to +8     | 1 boon             | None=0, Frail=1        |
| +9 to +12    | 2 boons            | Robust=2               |
| +13 or more  | 3 boons            | Potent/Mythic/Deific=3 |

Flaws and boons are rolled randomly from their respective d20 tables (stored as arrays in `constants.mjs`). Boons earned beyond the essence cap are discarded silently.

---

## 10. Out of Scope (for this iteration)

- Harvesting system
- Forging (combined mfg + enchanting) — data structure supports it, UI not yet built
- Hiring helpers / weighted average checks
- Trading interface
- Familiar progression
- Compendium seeding macro (GM can create items manually; UUIDs filled in later)
- Optional rules toggles (metatags, volatile components, ruining)
