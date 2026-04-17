# L'Arsène's Crafting Catalogue — Foundry VTT v14 Module Reference

**Source:** L'Arsène's Crafting Catalogue v1.01 (Plane Shift Press LLC © 2023)  
**Purpose:** Complete data and rules reference for building a Foundry VTT v14 module  
**System:** D&D 5e (dnd5e system in Foundry)

---

## MODULE ARCHITECTURE NOTES FOR FOUNDRY V14

- Foundry v14 uses `ApplicationV2` / `HandlebarsApplicationMixin` for UI
- Use `foundry.applications.api.DialogV2` for dialogs
- Journal entries, Items, and Macros are the primary data containers
- All roll tables should use `RollTable` documents
- Store system data in `flags` namespace: `flags["arsenes-crafting"]["key"]`
- Module ID suggestion: `arsenes-crafting-catalogue`

---

## PART 1: HARVESTING SYSTEM

### Core Concept
After a creature dies, players have a limited time window to harvest magical components. Harvesting requires two checks combined into one "Harvesting Check."

### Harvesting Rules Summary

**Step 1 — Description:** GM uses creature type to determine available components from Harvest Tables.

**Step 2 — Harvest List:** Players declare which components they want to harvest and in what order.

**Step 3 — Harvest DCs:** Each component has a Component DC. The Harvest DC for each component is the cumulative sum of all Component DCs of components listed before it (inclusive).

```
Harvest DC for item N = Sum of Component DCs from item 1 through item N
```

**Example:**
| Component | Component DC | Harvest DC |
|-----------|-------------|------------|
| Pouch of Teeth | 10 | 10 |
| Eye (1) | 5 | 15 |
| Eye (2) | 5 | 20 |
| Eye (3) | 5 | 25 |
| Hide | 20 | 45 |
| Robust Essence | 30 | 75 |

**Step 4 — Harvesting Check:** Sum of Assessment check + Carving check results.

**Step 5 — Loot:** Components where `Harvesting Check >= Harvest DC` are successfully harvested.

### Two Harvesters

| Check Type | Who | Roll | Skill |
|-----------|-----|------|-------|
| Assessment | Assessing harvester | 1d20 + INT mod + proficiency (if applicable) | Depends on creature type |
| Carving | Carving harvester | 1d20 + DEX mod + proficiency (if applicable) | Same skill as Assessment |

- A single creature can make both checks but does so **with disadvantage on both**.
- **Ritual Carving Exception:** When harvesting aberrations, celestials, elementals, fey, or fiends, the carving harvester with a spellcasting ability can use that spellcasting ability instead of DEX.
- **Spells/Buffs:** Only apply if they last the ENTIRE duration of the harvest (see Creature Size and Harvest Time). Bless/guidance (1 min) never apply. Enhance ability (1 hr) can apply.

### Creature Type → Harvest Skill Table

| Creature Type | Skill |
|--------------|-------|
| Aberration | Arcana |
| Beast | Survival |
| Celestial | Religion |
| Construct | Investigation |
| Dragon | Survival |
| Elemental | Arcana |
| Fey | Arcana |
| Fiend | Religion |
| Giant | Medicine |
| Humanoid | Medicine |
| Monstrosity | Survival |
| Ooze | Nature |
| Plant | Nature |
| Undead | Medicine |

### Creature Size → Harvest Time & Max Helpers

| Size | Harvest Time | Max Helpers |
|------|-------------|-------------|
| Tiny | 5 minutes | 0 |
| Small | 10 minutes | 1 |
| Medium | 15 minutes | 2 |
| Large | 30 minutes | 4 |
| Huge | 2 hours | 6 |
| Gargantuan | 12 hours | 10 |

### Helpers
- Must help for the entire duration to contribute.
- If proficient in the creature type's skill: adds their **full** proficiency bonus to the Harvesting Check total.
- If not proficient: adds **half** proficiency bonus (rounded down).
- Helpers count as assessing harvesters for "Failing With Consequences."

### Degradation Rule
- Harvesting must BEGIN within **1 minute** of creature's death.
- Once started, must not cease for the duration.
- Because even the shortest harvest is 5 minutes, only **one creature** can be harvested per battle.
- *Note: `gentle repose` does NOT prevent degradation.*

### Starting vs. Finishing (Important for Optional Rules)
- **Finished harvesting** a component = Harvest Check result meets or exceeds that component's Harvest DC.
- **Started harvesting** a component = Harvest Check result exceeded the DC of the PREVIOUS component (i.e., result ≥ previous Harvest DC + 1).

---

## PART 1B: OPTIONAL HARVESTING RULES

### Metatags (Optional Rule)
When using metatags, components are recorded with the specific creature's name/subtype in parentheses:
- Without: "beast horn"
- With: "beast (rhinoceros) horn" vs "beast (goat) horn"

**In Recipes:** Metatags in parentheses specify creature requirements. **Bold metatag** = required to craft. Normal metatag = grants **advantage** on crafting check.

### Ruining Components (Optional Rule)
**Destructive Damage Types:**
- *Simplified:* Acid, fire, and necrotic always ruin components.
- *Detailed:* Add any damage type the creature is **vulnerable** to. Resistance overrides vulnerability. Immunity = moot.

**Quantity Thresholds:**
- *Simplified (Killing Blow):* If creature dies to a destructive damage type → components ruined.
- *Detailed (CR-based):* If total destructive damage ≥ 10 × creature's CR → ruined.
- *Massive Damage:* If killing blow's remaining damage ≥ creature's max HP → ruined.

**Consequences of Ruining:**
- Harvesting checks made with **disadvantage**.
- GM may optionally remove specific components entirely.

### Volatile Components (Optional Rule)
Marked with superscript **v** in tables. If harvesters START but don't FINISH harvesting a volatile component, it triggers its effect (GM's discretion). The creature's own ability determines save DC and effect.

**Example:** Failing to harvest an adult red dragon's breath sac triggers DC 21 Dex save vs Fire Breath.

**Volatile Component Effects by Type:**
- **Fey Psyche:** Failed harvest → carving harvester makes DC 15 CHA save or becomes POSSESSED by fey psyche (acts as fey's alignment, incapacitated, can be turned or dispelled).
- **Elemental Mote/Core:** Failed harvest → triggers spell effect (save DC 13/16 respectively):
  - Air elemental: lightning bolt
  - Earth elemental: depth charge
  - Fire elemental: fireball
  - Water elemental: wind wall effect

### Failing With Consequences (Optional Rule)
**Special Damage:** If a creature's attacks deal bonus damage types (e.g., giant scorpion's poison), rolling a **natural 1** on either harvesting check means the carving harvester takes that damage (or makes the associated saving throw).

### Storage and Supplies (Optional Rule)
Players expend "harvesting supplies" (gold cost) equal to the **combined Component DCs of all components they STARTED harvesting**.

```
Supplies cost = Sum of Component DCs for each component where harvesting was started
```

- 50 gp of supplies = 1 pound
- Buy from appropriate craftsperson, arcane store, or temple

### Trading Components (Optional Rule)
**Finding a Trader:** Spend 1 day + 25 gp → make INT (Investigation) + CHA (Persuasion) → add results → consult table:

| Total | Buyer Offer | Seller Offer |
|-------|------------|--------------|
| 1-10 | No buyer | No seller |
| 11-25 | 50% | 150% |
| 26-50 | 100% | 100% |
| 51+ | 120% | 80% |

**Settlement Size Modifier:**

| Population | Modifier | Reset Time |
|-----------|---------|------------|
| 1-10 | -12 | 1 year |
| 11-100 | -8 | 6 months |
| 101-1,000 | -4 | 3 months |
| 1,001-10,000 | 0 | 1 month |
| 10,001-100,000 | +4 | 1 week |
| 100,001-1,000,000 | +8 | 3 days |
| 1,000,001+ | +12 | 1 day |

**Component Value (Standard):**

| Component DC | Sell | Buy | Sell w/Supplies | Buy w/Supplies |
|------------|------|-----|-----------------|----------------|
| 5 | 10 gp | 20 gp | 15 gp | 30 gp |
| 10 | 20 gp | 40 gp | 30 gp | 60 gp |
| 15 | 30 gp | 60 gp | 45 gp | 90 gp |
| 20 | 40 gp | 80 gp | 60 gp | 120 gp |
| 25 | 50 gp | 100 gp | 75 gp | 150 gp |

**Essence Value:**

| Essence | Sell | Buy | Sell w/Supplies | Buy w/Supplies |
|--------|------|-----|-----------------|----------------|
| Frail | 50 gp | 100 gp | 75 gp | 150 gp |
| Robust | 250 gp | 500 gp | 280 gp | 560 gp |
| Potent | 1,500 gp | 3,000 gp | 1,535 gp | 3,070 gp |
| Mythic | 8,000 gp | 16,000 gp | 8,040 gp | 16,080 gp |
| Deific | 80,000 gp | 160,000 gp | 80,050 gp | 160,100 gp |

---

## PART 2: ESSENCE

Essence is required to craft any magic item of Uncommon rarity or higher.

| Creature CR | Component DC | Essence | Item Rarity |
|-----------|-------------|---------|-------------|
| 3–6 | 25 | Frail essence | Uncommon |
| 7–11 | 30 | Robust essence | Rare |
| 12–17 | 35 | Potent essence | Very Rare |
| 18–24 | 40 | Mythic essence | Legendary |
| 25+ | 50 | Deific essence | Artifact |

- Cannot harvest a lower-level essence from a higher-CR creature.
- **Mythic Creatures:** If a creature has a mythic trait that raises its effective CR, use the higher CR for essence determination.
- Using a **rarer** essence than required upgrades the item's rarity (and thus DC + time).

---

## PART 3: HARVEST TABLES BY CREATURE TYPE

**Superscript Key:**
- `E` = Edible (no crafting use)
- `E+` = Edible AND used in crafting
- `v` = Volatile
- `**` = Used only for monster-forged items

### Aberration
| DC | Components |
|----|-----------|
| 5 | Antenna, Eye(E+), Flesh(E), Phial of Blood(E+) |
| 10 | Bone(E+), Egg(E), Fat(E+), Pouch of Claws**, Pouch of Teeth, Tentacle |
| 15 | Heart(E), Phial of Mucus, Liver(E), Stinger |
| 20 | Brain(E+), Chitin, Hide, Main Eye(v) |

### Beast
| DC | Components |
|----|-----------|
| 5 | Antenna*(E+), Eye(E+), Flesh(E), Phial of Blood(E+) |
| 10 | Antler**, Beak, Bone(E+), Egg(E), Fat(E+), Fin, Horn, Pincer**, Pouch of Claws, Pouch of Teeth, Talon**, Tusk |
| 15 | Heart(E+), Liver(E+), Poison Gland, Pouch of Feathers, Pouch of Scales, Stinger, Tentacle |
| 20 | Chitin, Pelt |
*Antennae can be used as eyes

### Celestial
*Extraplanar Recall: Only pouch of dust if slain outside home plane or magic circle*
| DC | Components |
|----|-----------|
| 5 | Eye(E+), Flesh(E), Phial of Blood(E+), Pouch of Dust(E+)* |
| 10 | Bone(E), Fat(E+), Horn, Pouch of Teeth |
| 15 | Heart(E+), Liver(E), Pouch of Feathers, Pouch of Scales |
| 20 | Brain(E), Skin |
| 25 | Soul(v) |
*Dust is a spice when edible

### Construct
| DC | Components |
|----|-----------|
| 5 | Phial of Blood(E+), Phial of Oil(E+)* |
| 10 | Flesh(E+), Plating, Stone |
| 15 | Bone(E+), Heart(E), Liver(E), Gears |
| 20 | Brain(E+), Instructions |
| 25 | Lifespark(v) |
*Oil is fat when edible

### Dragon
| DC | Components |
|----|-----------|
| 5 | Eye(E+), Flesh(E), Phial of Blood(E+) |
| 10 | Bone(E+), Egg(E), Fat(E+), Pouch of Claws, Pouch of Teeth |
| 15 | Horn, Liver(E), Pouch of Scales |
| 20 | Heart(E+) |
| 25 | Breath Sac(v) |

### Elemental
*Volatile failures: save DC 13 (mote), 16 (core)*
| DC | Components |
|----|-----------|
| 5 | Eye(E+), Primordial Dust(E+)* |
| 10 | Bone(E+) |
| 15 | Volatile Mote of Air/Earth/Fire/Water(v) |
| 25 | Core of Air/Earth/Fire/Water(v) |
*Primordial dust is a spice

### Fey
*Volatile Psyche: DC 15 CHA save or possession if started but not finished*
| DC | Components |
|----|-----------|
| 5 | Antenna(E+)*, Eye(E+), Flesh(E), Phial of Blood(E+) |
| 10 | Antler**, Beak, Bone(E+), Egg(E), Horn**, Pouch of Claws**, Pouch of Teeth, Talon**, Tusk** |
| 15 | Heart(E+), Fat(E+), Liver(E+), Poison Gland, Pouch of Feathers, Pouch of Scales, Tentacle, Tongue |
| 20 | Brain(E), Skin, Pelt |
| 25 | Psyche(v) |

### Fiend
*Extraplanar Recall: Only pouch of dust if slain outside home plane or magic circle*
*(Three subtypes: Demon, Devil, Yugoloth — component typed accordingly)*
| DC | Components |
|----|-----------|
| 5 | Eye(E+), Flesh(E), Phial of Blood(E+), Pouch of Dust(E+)* |
| 10 | Bone(E+), Horn, Pouch of Claws, Pouch of Teeth |
| 15 | Heart(E+), Fat(E+), Liver(E), Poison Gland, Pouch of Feathers, Pouch of Scales |
| 20 | Brain(E), Skin |
| 25 | Soul(v) |

### Giant
| DC | Components |
|----|-----------|
| 5 | Flesh(E), Nail, Phial of Blood(E+) |
| 10 | Bone(E+), Fat(E+), Tooth |
| 15 | Heart(v)(E+), Liver(E+) |
| 20 | Skin |

### Humanoid
| DC | Components |
|----|-----------|
| 5 | Eye, Phial of Blood(E+) |
| 10 | Bone(E+), Egg(E), Pouch of Teeth |
| 15 | Heart(E+), Liver(E+), Pouch of Feathers, Pouch of Scales |
| 20 | Brain(E+), Skin |

### Monstrosity
| DC | Components |
|----|-----------|
| 5 | Antenna(E+)*, Eye(E+), Flesh(E), Phial of Blood(E+) |
| 10 | Antler, Beak, Bone(E+), Egg(E), Fat(E+), Fin, Horn, Pincer, Pouch of Claws, Pouch of Teeth, Talon, Tusk** |
| 15 | Heart(E+), Liver(E+), Poison Gland, Pouch of Feathers, Pouch of Scales, Stinger, Tentacle |
| 20 | Chitin, Pelt |

### Ooze
| DC | Components |
|----|-----------|
| 5 | Phial of Acid(E+)* |
| 10 | Phial of Mucus(E+)* |
| 15 | Vesicle(E+)* |
| 20 | Membrane |
*Acid=blood, mucus=fat, vesicle=liver when edible

*Optional Hard Bits Table: Roll d100 on death for random components from other creature types*

### Plant
| DC | Components |
|----|-----------|
| 5 | Phial of Sap(E+)*, Tuber(E)* |
| 10 | Bundle of Roots(E+)*, Phial of Wax(E)*, Pouch of Hyphae(E+)*, Pouch of Leaves |
| 15 | Poison Gland(E+)*, Pouch of Pollen(v)(E+)*, Pouch of Spores(v)(E+)* |
| 20 | Bark(E+)*, Membrane(E+)* |
*Sap=blood, tuber=flesh, roots/hyphae=bones, wax=fat, poison glands=livers, pollen/spores=spice, bark/membrane=hearts

### Undead
| DC | Components |
|----|-----------|
| 5 | Eye(E+), Bone(E+), Phial of Congealed Blood(E+) |
| 10 | Marrow, Pouch of Teeth, Rancid Fat(E) |
| 15 | Ethereal Ichor(E+)*, Undying Flesh(E+) |
| 20 | Undying Heart(v)(E+) |
*Ethereal ichor is a spice

---

## PART 4: MUNDANE INGREDIENTS

Three types: **Minerals** (ore → ingots), **Fibres** (cotton/silk → cloth), **Wood** (→ planks/poles).

**Finding:** Strength, Dexterity, Intelligence, or Wisdom check (Nature or Survival), 8-hour process.  
**Units Found:** `5 × (1 + check result − DC)`

### Mundane Ingredients Metadata
| Type | Ingredient | Tool | Machinery | Product | Wt/Unrefined | Wt/Refined | Value/Refined |
|------|-----------|------|-----------|---------|--------------|------------|---------------|
| Fibre | Cotton, Flax | Blade | Loom | Cloth | 0.05 lb | 0.04 lb | 1 cp |
| Fibre | Silk | Blade | Loom | Cloth | 0.05 lb | 0.04 lb | 1 sp |
| Fibre | Spidersilk | Blade | Loom | Cloth | 0.05 lb | 0.04 lb | 1 pp |
| Ore | Copper, Iron | Pickaxe | Smeltery | Ingots | 0.08 lb | 0.02 lb | 1 cp |
| Ore | Silver | Pickaxe | Smeltery | Ingots | 0.08 lb | 0.02 lb | 1 sp |
| Ore | Gold | Pickaxe | Smeltery | Ingots | 0.08 lb | 0.02 lb | 1 gp |
| Ore | Platinum | Pickaxe | Smeltery | Ingots | 0.08 lb | 0.02 lb | 1 pp |
| Ore | Mithral | Pickaxe | Smeltery | Ingots | 0.04 lb | 0.01 lb | 1 pp |
| Ore | Adamantine | Pickaxe | Smeltery | Ingots | 0.20 lb | 0.05 lb | 1 pp |
| Wood | Basic Wood | Axe | Sawmill | Planks/Poles | 0.5 lb | 0.25 lb | 1 cp |
| Wood | Exotic Wood | Axe | Sawmill | Planks/Poles | 0.5 lb | 0.25 lb | 1 sp |
| Wood | Xyxlwood | Axe | Sawmill | Planks/Poles | 0.5 lb | 0.25 lb | 1 pp |

### Finding Mundane Ingredients — DC by Terrain
| Ingredient | Arctic | Coast | Desert | Forest | Grassland | Hill | Jungle | Mountain | Swamp | The Low | Urban |
|-----------|--------|-------|--------|--------|-----------|------|--------|----------|-------|---------|-------|
| Cotton, Flax | 50 | 20 | 40 | 15 | 5 | 15 | 15 | 25 | 20 | 25 | 40 |
| Silk | 55 | 35 | 50 | 20 | 20 | 30 | 15 | 40 | 35 | 40 | 50 |
| Spidersilk | 60 | 45 | 55 | 30 | 30 | 40 | 25 | 50 | 45 | 45 | 55 |
| Copper, Iron | 35 | 35 | 15 | 25 | 20 | 5 | 25 | 5 | 35 | 10 | 40 |
| Silver | 40 | 40 | 25 | 35 | 30 | 15 | 35 | 15 | 45 | 20 | 45 |
| Gold | 50 | 45 | 30 | 40 | 35 | 20 | 45 | 20 | 50 | 25 | 50 |
| Platinum | 55 | 50 | 35 | 45 | 40 | 25 | 50 | 25 | 55 | 30 | 55 |
| Adamantine, Mithral | 60 | 55 | 40 | 50 | 45 | 30 | 55 | 30 | 60 | 35 | 60 |
| Basic Wood | 50 | 20 | 40 | 5 | 25 | 25 | 5 | 30 | 25 | 40 | 30 |
| Exotic Wood | 55 | 30 | 50 | 15 | 30 | 35 | 15 | 40 | 35 | 50 | 40 |
| Xyxlwood | 60 | 40 | 60 | 30 | 50 | 55 | 30 | 50 | 45 | 60 | 50 |

**Innately Magical Materials:** Adamantine → adamantine weapons/armour. Mithral → mithral armour. Xyxlwood → wood-based magical items. These items are common rarity magic items once manufactured.

---

## PART 5: CRAFTING SYSTEM

### Three Types of Crafting

| Type | Who Can Do It | What It Produces |
|------|--------------|-----------------|
| Manufacturing | Anyone proficient with tool | Mundane (nonmagical) items |
| Enchanting | Spellcasters only | Magic item (from mundane item + components) |
| Forging | Anyone proficient with tool | Magic item (combines both, no spellcaster needed) |

---

### Manufacturing

**Requirements:** Materials + Tool + Time (+ sometimes auxiliary equipment)  
**Material Cost:** ~1/3 of item purchase value (rule of thumb)  
**Potion/Scroll bases:** 5 gp nonmagical materials regardless

**Check:** At end of crafting time, make ability check using tool proficiency.  
If NOT proficient with tool: make check with **disadvantage** (unless guided by proficient creature/book).

### Tools and Their Products
| Tool | Ability | Item Types |
|------|---------|-----------|
| Alchemist's supplies | Intelligence | Potions; miscellaneous (salves/lotions) |
| Brewer's supplies | Constitution | Potions |
| Calligrapher's supplies | Dexterity | Scrolls |
| Carpenter's tools | DEX or STR | Ammunition (arrows/bolts/needles), rods, staves, wands, polearms, blowguns, clubs, bows, quarterstaves, misc wood |
| Cartographer's tools | DEX or INT | Maps; misc paper items |
| Cobbler's tools | DEX or INT | Footwear |
| Cook's utensils | Constitution | Food |
| Glassblower's tools | CON or DEX | Rods, staves, wands; misc glass |
| Herbalism kit | Intelligence | Potions; salves/lotions |
| Jeweller's tools | Dexterity | Misc jewels/precious metals |
| Leatherworker's tools | Dexterity | Light/hide armour, whips |
| Mason's tools | Strength | Sling bullets; misc stone |
| Painter's supplies | Dexterity | Scrolls |
| Poisoner's kit | DEX or INT | Poisons |
| Potter's tools | Dexterity | Misc clay |
| Smith's tools | CON or STR | Firearm/sling ammunition, medium/heavy armour (not hide), rods, staves, wands, axes, swords, daggers, flails, hammers, maces, mauls, picks |
| Tinker's tools | Dexterity | Rods, staves, wands, crossbows, firearms, tommybows, mechanical wondrous items |
| Weaver's tools | CON or DEX | Padded armour, nets, slings, cloth items |
| Woodcarver's tools | DEX or STR | Ammunition, rods, staves, wands, polearms, bows, misc wood |

### Manufacturing DC & Time
| Item Type | DC | Time |
|-----------|----|----|
| Adventuring gear | 11 | 2 hours |
| Ammunition (×20) | 13 | 1 hour |
| Padded/hide/shield armour | 13 | 8 hours |
| Leather, chain shirt, ring mail | 15 | 16 hours |
| Chain mail | 16 | 32 hours |
| Studded leather, scale mail | 17 | 24 hours |
| Breastplate, splint | 18 | 40 hours |
| Half plate | 19 | 80 hours |
| Plate | 20 | 200 hours |
| Instrument | 15 | 16 hours |
| Potion base | 15 | 2 hours |
| Ring | 15 | 8 hours |
| Rod, staff, wand | 17 | 8 hours |
| Spell scroll base | 15 | 2 hours |
| Simple weapon | 14 | Varies |
| Martial weapon | 17 | Varies |
| Magitech firearm | 19 | Varies |
| Wondrous item | 15 | 8 hours |

---

### Enchanting

**Requirements:** Mundane item + Monster component (from recipe) + Essence (from rarity)  
**Who:** Only spellcasters (uses spellcasting ability)  
**Skill used:** Based on the creature type of the component (same table as harvesting)  
**Check:** Spellcasting ability check using proficiency with appropriate skill

**Spell Scrolls:** Caster must also know the spell.

### Enchanting Rarity, DC, and Time
| Rarity | Essence | DC | Consumable hrs | Non-Attunement hrs | Attunement hrs |
|--------|---------|----|-----------------|--------------------|----------------|
| Common | None | 12 | 0.5 | 1 | 2 |
| Uncommon | Frail | 15 | 4 | 10 | 20 |
| Rare | Robust | 18 | 20 | 40 | 80 |
| Very Rare | Potent | 21 | 80 | 160 | 320 |
| Legendary | Mythic | 25 | 320 | 640 | 1,280 |
| Artifact | Deific | 30 | 50,000 | 100,000 | 200,000 |

---

### Forging

Combines manufacturing and enchanting into one process. Non-spellcasters CAN forge.

**Key difference:** Uses the tool's associated ability (e.g., STR for smith's tools) for the Enchanting check instead of a spellcasting ability.

**Materials:** Same as manufacturing (raw materials) + same as enchanting (monster component + essence)  
**Time:** The LONGER of manufacturing time or enchanting time  
**Two Checks:** Manufacturing check AND Enchanting check (both separate, each can generate their own quirks)

---

### Quirks System

Quirks are properties gained from crafting results. Flaws = bad. Boons = good.

**Quirks Gained Table (same for Manufacturing and Enchanting):**
| Check Result − DC | Quirks |
|------------------|--------|
| −13 or less | TOTAL FAILURE: item destroyed |
| −12 to −9 | Three flaws |
| −8 to −5 | Two flaws |
| −4 to −1 | One flaw |
| 0 to +4 | Nothing |
| +5 to +8 | One boon |
| +9 to +12 | Two boons |
| +13 or more | Three boons |

**Maximum Enchanting Boons by Essence:**
| Essence | Max Boons |
|---------|----------|
| None (Common) | 0 |
| Frail (Uncommon) | 1 |
| Robust (Rare) | 2 |
| Potent (Very Rare) | 3 |
| Mythic (Legendary) | 3 |
| Deific (Artifact) | 3 |

**Enchanted Quirk Duration:**
- Attuneable item: quirk active while attuned
- Consumable: quirk lasts duration of effect (or 1 hour if no duration)
- Other: quirk active while possessed/worn/held

**Removing Quirks:** Redo the crafting check with same tools/essence. Old quirks removed, new ones applied.

---

### Manufacturing Quirk Tables

**Manufacturing Flaws (d20):**
| d20 | Flaw |
|-----|------|
| 1–6 | Handiwork: −1 to attack/damage rolls (weapon) or −1 base AC (armour) or Fragile (other). Cumulative if rolled multiple times. |
| 7–8 | Fragile: Weapon breaks on natural 1 attack roll. Other: breaks on natural 1 when taking critical hit. Threshold +1 per additional Fragile. |
| 9–10 | Unwieldy: Natural 1 on attack = weapon flies 10 ft random direction. Natural 1 on DEX save/acrobatics while worn = fall prone. Threshold +1 per additional Unwieldy. |
| 11–12 | Degradable: d20 each time submerged or each hour in corrosive environment. On 1: breaks. |
| 13–14 | Noisy: Disadvantage on Stealth checks while worn/carried (even stowed). |
| 15 | Pungent: Disadvantage on CHA checks vs creatures that smell; creatures have advantage to detect by smell. |
| 16 | Heavy: Weighs twice as much. |
| 17 | Garish: Disadvantage on CHA (Intimidation) vs creatures that can see it. |
| 18 | Mediocre Finish: Worth half normal value. |
| 19 | Under Insulated: Take additional 1d8 cold or fire damage whenever you take that damage type. |
| 20 | Dangerous: Critical fail threshold increases by 1. |

**Manufacturing Boons (d20, use d12 for wondrous items — results 13–20 don't apply):**
| d20 | Boon |
|-----|------|
| 1–2 | Durable: Item HP tripled. |
| 3–4 | Unreactive: Resists corrosion/rot. d20 on 11+ = unaffected when environmental damage would occur. |
| 5–6 | Lightweight: Weighs half. Removes Heavy property (or gains Light if it didn't have Heavy). |
| 7–8 | Magnificent Finish: Worth twice normal value. |
| 9–10 | Flashy: Advantage on CHA (Persuasion) vs creatures that can see it. |
| 11–12 | Insulated: Advantage on CON saves vs cold weather (armour/clothing) or vs heat metal (weapon/held). |
| 13–14 | Grippy: Advantage on checks/saves to resist being disarmed (held items and weapons only). |
| 15–16 | Quick Release: Don/doff time ×10 faster (armour/shield only; shield = bonus action or action). |
| 17–18 | Aerodynamic: Range +50% (ammunition/thrown weapons only). |
| 19 | Perfect Balance: Reroll natural 1 on attacks (weapon) or DEX saves/acrobatics (armour/clothing). |
| 20 | Artisanal Craftsmanship: +1 damage rolls (weapon) or nonmagical B/P/S damage −1 (armour). |

---

**Enchanting Flaws (d20):**
| d20 | Flaw |
|-----|------|
| 1–2 | Cursed: Attuning extends curse. Can't willingly part with item. Also roll again for secondary effect. |
| 3 | Battlerage: When combat ends, WIS save or attack all creatures until save succeeds at end of turns. |
| 4 | Desensitisation: Greyscale vision, darkvision −30 ft, muted sound/taste/touch. Disadvantage on Perception. |
| 5 | Gravity Well: Weight ×3, speed −5 ft. |
| 6 | Falsehood: 1d6 psychic when you speak truth (once/minute). |
| 7 | Divinable: Any Arcana-proficient creature that knows your name can pinpoint your location as an action. |
| 8 | Illiteracy: Cannot read or write. |
| 9 | Attraction: Ranged weapon attacks against you have advantage. |
| 10 | Energy Magnet: Random damage type — attacks deal that damage type have advantage vs you; you have disadvantage on saves. |
| 11 | Creature Sustaining: Deal half damage to a random creature type. |
| 12 | External Monologue: After long rest, WIS save or speak all internal thoughts aloud until next long rest. |
| 13 | Chain Reaction: Taking random damage type triggers 3d6 damage of same type to all within 10 ft (including you; you auto-fail). |
| 14 | Rot: Appear rotting, stench follows. Advantage on Intimidation vs non-fiends/undead; disadvantage on other CHA checks. Lasts 24 hrs after item removed. |
| 15 | Malfunctioning Self-Preservation: On critical hit, CON save or polymorph into CR 0 creature for 1 hour. |
| 16 | Gullibility: Disadvantage on Insight checks. |
| 17 | Hunted: Random creature type can detect item within 300 ft and wants it. |
| 18 | Truthfulness: 1d6 psychic when you speak a lie (once/minute). |
| 19 | Alcoholic Potency: Consuming magical liquid requires CON save or gain one level of drunkenness. |
| 20 | Forced Attunement: Requires attunement regardless. Learn a task; can't unattune until completed. |

**Enchanting Boons (d20) — do not stack:**
| d20 | Boon |
|-----|------|
| 1 | Hairology: Change hair colour at will (1 minute). |
| 2 | Favourable Pheromones: Advantage on Animal Handling checks. |
| 3 | Gambler: Proficiency with all gaming sets. |
| 4 | Gravity Void: Standing from prone costs only 5 ft of movement. |
| 5 | Fleet: Speed +5 ft. |
| 6 | Composed: Advantage on Deception checks. (Truesight sees through it.) |
| 7 | Geolocational Position Sense: Always know north and elevation. |
| 8 | Ray of Sunshine: Bonus action to shed bright/dim light (20/20 ft). |
| 9 | Cat's Landing: Half damage from falling. |
| 10 | Eye for Weakness: Bonus action to identify the two lowest saving throw modifiers of a creature within 60 ft. |
| 11 | Proficient: Gain proficiency in a random skill (roll Random Skill table). |
| 12 | Sustenance: Need half food/water; reroll 1s on healing. |
| 13 | Creature Slaying: Attacks deal +PB damage vs random creature type on a critical hit. |
| 14 | Insightful: Advantage on Insight checks to detect lying. |
| 15 | Oxygen Refiner: Breathe underwater. |
| 16 | Energy Repulsor: Random damage type — disadvantage on attacks against you of that type; advantage on your saves. |
| 17 | Self-Preservation System: Reaction on critical hit to polymorph into CR = PB creature (no concentration, once/dawn). |
| 18 | Sidekick: When using Help action, target adds 1d4 to the roll. |
| 19 | Power: +1 to attack rolls and spell save DCs. |
| 20 | Additional Attunement: Attunement slots +1. |

---

### Random Tables

**Random Non-Physical Damage Type (d10):**
1 Acid, 2 Cold, 3 Fire, 4 Force, 5 Lightning, 6 Necrotic, 7 Poison, 8 Psychic, 9 Radiant, 10 Thunder

**Random Skill (d20, reroll 19+):**
1 Acrobatics, 2 Animal Handling, 3 Arcana, 4 Athletics, 5 Deception, 6 History, 7 Insight, 8 Intimidation, 9 Investigation, 10 Medicine, 11 Nature, 12 Perception, 13 Performance, 14 Persuasion, 15 Religion, 16 Sleight of Hand, 17 Stealth, 18 Survival

**Random Creature Type (d20, reroll 15+):**
1 Aberration, 2 Beast, 3 Celestial, 4 Construct, 5 Dragon, 6 Elemental, 7 Fey, 8 Fiend, 9 Giant, 10 Humanoid, 11 Monstrosity, 12 Ooze, 13 Plant, 14 Undead

---

### Item Save DCs (by Rarity)
| Rarity | DC |
|--------|-----|
| Common | 11 |
| Uncommon | 13 |
| Rare | 15 |
| Very Rare | 16 |
| Legendary | 17 |
| Artifact | 18 |

---

### Time, Money, and Helpers

**Working Threshold:** 8 + CON modifier hours/day (safe).  
Beyond threshold: CON save at end of each extra hour (DC = 10 + hours over threshold) or gain 1 exhaustion level.

**Hiring Craftspeople:**

| Type | Rank | Speed | Check Mod | Hourly Rate | OT Rate |
|------|------|-------|-----------|-------------|---------|
| Manufacturer | Journeyman | ×1 | +6 | 1 gp | 2 gp |
| Manufacturer | Expert | ×2 | +8 | 4 gp | 8 gp |
| Manufacturer | Master | ×3 | +11 | 9 gp | 18 gp |
| Enchanter | Journeyman | ×1 | +6 | 20 gp | 40 gp |
| Enchanter | Expert | ×2 | +8 | 80 gp | 160 gp |
| Enchanter | Master | ×3 | +11 | 180 gp | 360 gp |
| Forger | Journeyman | ×1 | +6 | 25 gp | 50 gp |
| Forger | Expert | ×2 | +8 | 100 gp | 200 gp |
| Forger | Master | ×3 | +11 | 200 gp | 400 gp |

**Crafting Teams:** Multiple crafters can work in shifts. Final check = **weighted average** of all checks (weighted by time each worked), rounded down.

---

### Upgrading Items
Use existing magic item as both the mundane item and component. Add essence of desired new rarity. Make Enchanting/Forging check at the new rarity's DC and time. On success: rarity increases. On failure: essence wasted, item unchanged.

### Salvaging
**Time:** 1/10th of original craft time.  
**Mundane items:** Recover half the mundane components (≈ 1/6th item value in materials).  
**Magic items:** Spellcaster makes same check as original enchantment:
- Success: item becomes nonmagical, enchanter recovers 1 essence of commensurate rarity.
- Failure: enchantment explodes, item nonmagical, enchanter + all within 10 ft take Vdam force damage.

### Optional Attunement
**Optional (OA):** Properties marked OA only function while attuned. Unmarked properties work for anyone.

### Socketing
Items of Common rarity or higher have **one socket**.  
Socketable items can be slotted by anyone with proficiency in: Carpenter's, Cobbler's, Glassblower's, Leatherworker's, Smith's, Tinker's, Weaver's, or Woodcarver's tools (1 hour).  
**Removal:** DC 10 DEX or INT check with tool proficiency. Success = socketable recovered. Failure = socketable destroyed.

---

## PART 6: NEW EQUIPMENT

### New Weapons
**Claw:** Simple melee, 1d6 slashing, light, Attached special. Attached: cannot be disarmed, takes an action to don/doff, can hold items but can't attack while doing so, disadvantage on attacks with other weapons in same hand.

**Slingshot:** Simple ranged, 1d6 bludgeoning, two-handed, range 20/60. Uses sling ammunition.

**Nunchucks:** Martial melee, 1d6 bludgeoning, finesse, versatile (1d8), Flourish special.  
Flourish: When using two-handed Attack action, can attempt DC 13 DEX check (+ PB if proficient) before first attack. Success = +2 to first attack roll. Failure = take PB bludgeoning damage, no flourish bonus.

**Tetherhook:** Martial melee, 1d8 piercing, reach, two-handed, Hookpull special.  
Hookpull: As bonus action after hitting target ≤ one size larger, make Athletics check vs target's Athletics or Acrobatics. Success = target is hooked (can't move farther away). Hooked creature can use action to escape. As part of hooking or as bonus action on subsequent turns: can pull creature 5 ft closer.

**Twinblade:** Martial melee, 2d4 slashing, finesse, two-handed, Whirl special.  
Whirl: Bonus action DC 10 DEX check (+PB if proficient). Success = +1 AC until start of next turn. Result 15+ = +2 AC. Failure = take PB slashing damage, no bonus.

### Magitech Firearms (Martial Ranged, DC 19 to manufacture)
All use "loud" property and "reload" property. Damage is nonmagical despite magical propulsion.

| Weapon | Damage | Range | Reload | Loud | Weight | Value |
|--------|--------|-------|--------|------|--------|-------|
| Blunderbuss | 3d4 piercing | 20/60 | 1 | 1,000 ft | 5 lb | 150 gp |
| Musket | 1d10 piercing | 80/240 | 1 | 1,000 ft | 10 lb | 100 gp |
| Pistol | 1d8 piercing | 40/120 | 2 | 500 ft | 2 lb | 200 gp |
| Revolver | 1d10 piercing | 60/240 | 6 | 500 ft | 2 lb | 750 gp |
| Rifle | 1d12 piercing | 120/480 | 6 | 500 ft | 8 lb | 1,000 gp |

**Extra Reloads:** Multiply price by (desired reload / base reload). Max reload = 6.

### New Properties
**Loud (X):** All hearing creatures within X feet are alerted. Range doubled in echoey locations and underwater.  
**Reload (X):** X shots before needing a full action to reload.

### Tommybows
Repeating crossbows. Three variants (hand, light, heavy) mirroring regular crossbows. Replace "loading" property with "reload." Range reduced vs counterpart.

| Variant | Base Crossbow | Range | Reload(2) | Reload(3) | Reload(4) | Reload(5) | Reload(6) |
|---------|--------------|-------|-----------|-----------|-----------|-----------|-----------|
| Hand | 75 gp | 30/60 | 150 gp | 225 gp | 300 gp | 375 gp | 450 gp |
| Light | 25 gp | 80/160 | 50 gp | 75 gp | 100 gp | 125 gp | 150 gp |
| Heavy | 50 gp | 100/200 | 100 gp | 150 gp | 200 gp | 250 gp | 300 gp |

### Monster-Forged Items
Items made directly from monster components. They are **common rarity magic items** if successfully manufactured.

**Properties:**
- Immune to nonmagical decay/corrosion
- Weapons: deal magical damage
- Armour: resizes to fit same size category (Medium and Small treated as same)

**Soft Component Size Requirements:**
| Item | Min Creature Size |
|------|------------------|
| Sling | Small |
| Net, Whip | Medium |
| Armour | Large (one size larger than intended wearer) |

**Hard Component Size Requirements (Bone / Antler/Beak/Horn/Pincer/Talon/Tusk / Claw/Tooth):**
| Item | Bone | Antler/Beak/etc. | Claw/Tooth |
|------|------|------------------|------------|
| Arrow, bolt, dart | Tiny | Small | Medium |
| Claw, dagger, sickle | Small | Medium | Large |
| Blowgun, hand crossbow, pistol, revolver, shortbow | Medium | Large | — |
| Club, handaxe, light hammer, mace, nunchuck, scimitar, shortsword, war pick | Medium | Large | Huge |
| Blunderbuss, heavy crossbow, longbow, musket, rifle | Large | Huge | — |
| Battleaxe, flail, javelin, light crossbow, longsword, morningstar, quarterstaff, rapier, spear, tetherhook, trident, twinblade, warhammer | Large | Huge | Gargantuan |
| Glaive, greataxe, greatclub, greatsword, halberd, lance, maul, pike | Huge | Gargantuan | — |
| Armour | Huge | — | — |

**Cost of Innately Magical Items:** Base nonmagical cost + (10 gp × item weight in pounds)

**Refined Units needed:** For mithral/adamantine/xyxlwood/spidersilk, need refined units equal to item weight in pounds. Monster components work differently (see size tables).

---

## PART 7: MAGIC ITEM RECIPES

**Key:** C=Common, U=Uncommon, R=Rare, V=Very Rare, L=Legendary, A=Artifact  
Bold rarity = different from SRD. Superscript = original SRD rarity.  
**Att abbreviations:** Opt=Optional, Req=Required, Req_s=Required (spellcaster), +C=Consumable

### Ammunition
| Name | Value | Rarity | Att | Type | Metatag | Component |
|------|-------|--------|-----|------|---------|-----------|
| +1 Ammunition* | 25 ea | U | —,C | Beast | | Pouch of teeth |
| +2 Ammunition* | 100 ea | R | —,C | Monstrosity | | Pouch of teeth |
| +3 Ammunition* | 480 ea | V | —,C | Dragon | | Pouch of teeth |
| Arrow of Slaying | 550 ea | V | —,C | Multiple** | | Phial of acid/blood/sap or primordial dust** |
*One essence + one check enchants up to 10 pieces  
**Component/type depends on target creature

### Armour (cost listed is ADDITION to base armour value unless otherwise noted)
| Name | Value+ | Rarity | Att | Type | Metatag | Component |
|------|--------|--------|-----|------|---------|-----------|
| Breastplank (plate) | 1,200 / 3,200 / 11,500+ | U/R/V | Req | Monstrosity | Tavern Mimic | Skin |
| +1 Armor | 1,500+ | R | — | Beast | Dinosaur | Bone |
| +2 Armor | 6,500+ | V | — | Monstrosity | Gorgon | Bone |
| +3 Armor | 28,800+ | L | — | Dragon | Magnetite | Bone |
| Adamantine Armor | 500+ | U | — | Material | | Adamantine |
| Armor of Resistance (Acid) | 1,200+ | U→R | Req | Ooze | Black pudding | Membrane |
| Armor of Resistance (Cold) | 1,200+ | U→R | Req | Fiend | Ice devil | Skin |
| Armor of Resistance (Fire) | 1,500+ | U→R | Req | Elemental | Salamander | Bone |
| Armor of Resistance (Force) | 1,200+ | U→R | Req | Construct | Golem | Bone |
| Armor of Resistance (Lightning) | 1,200+ | U→R | Req | Elemental | Djinni | Bone |
| Armor of Resistance (Necrotic) | 1,200+ | U→R | Req | Undead | Mummy | Undying flesh |
| Armor of Resistance (Poison) | 1,500+ | U→R | Req | Monstrosity | Naga | Liver |
| Armor of Resistance (Psychic) | 1,100+ | U→R | Req | Aberration | Aboleth | Brain |
| Armor of Resistance (Radiant) | 1,100+ | U→R | Req | Celestial | Planetar | Bone |
| Armor of Resistance (Thunder) | 1,100+ | U→R | Req | Giant | Storm | Bone |
| Mithral Armor | 400+ | U | — | Material | | Mithral |
| Armor of Invulnerability | 18,000 | L | Req | Construct | Golem | Plating |
| Demon Armor | 3,000 | R→V | Req | Fiend | Demon | Bone |
| Dwarven Plate | 6,500 | V | — | Dragon | | Phial of blood |
| Glamoured Studded Leather | 2,100 | R | — | Fey | Hag | Phial of blood |
| Dragon Scale Mail (each color) | 9,400 | V | Req | Dragon | [Color] | Pouch of scales |
| Elven Chain | 2,500 | R | — | Fey | | Pouch of scales |
| Haemscale | 1,200 / 4,000 / 52,000+ | U/R/L | Req | Dragon | Magnetite | Pouch of scales |
| Armor of Vulnerability | 500+ | U→R | Req | Fiend | | Phial of blood |
| Plate Armor of Etherealness | 41,600 | L | Req | Undead | | Ethereal ichor |
| Animated Shield | 5,000 | R→V | Req | Construct | Animated | Instructions |
| Arrow-Catching Shield | 5,000 | R | Req | Celestial | | Skin |
| Dragonmaw Shield | 2,300 | R | — | Construct | Koboldzilla | Plating |
| Overgrown Barkshield | 650 / 2,400 / 10,000 | U/R/V | Req | Plant | Treant | Bark |
| Shield of Missile Attraction | 5,000 | R | Req | Dragon | Magnetite | Horn |
| Spellguard Shield | 25,000 | V | Req | Construct | Shield guardian | Plating |
| +1 Shield | 1,500+ | R→U | — | Beast | Beetle | Pouch of scales |
| +2 Shield | 6,500+ | V→R | — | Monstrosity | Bulette | Pouch of scales |
| +3 Shield | 28,800+ | L→V | — | Dragon | | Pouch of scales |

### Potions
| Name | Value | Rarity | Type | Metatag | Component |
|------|-------|--------|------|---------|-----------|
| Oil of Etherealness | 1,900 | R | Undead | | Ethereal ichor |
| Oil of Sharpness | 4,800 | V | Fey | | Fat |
| Oil of Slipperiness | 480 | U | Construct | | Phial of oil |
| Philter of Love | 180 | U | Fey | | Phial of blood |
| Potion of Animal Friendship | 200 | U | Beast | | Phial of blood |
| Potion of Clairvoyance | 900 | R | Celestial | | Eye |
| Potion of Climbing | 50 | C | Beast | Spider | Pouch of claws |
| Potion of Cloud Giant Strength | 6,000 | V | Giant | Cloud | Nail |
| Potion of Diminution | 270 | U→R | Humanoid | Gnome | Phial of blood |
| Potion of Fire Giant Strength | 3,000 | R | Giant | Fire | Nail |
| Potion of Flying | 900 | R→V | Dragon | | Fat |
| Potion of Frost Giant Strength | 1,500 | R | Giant | Frost | Nail |
| Potion of Gaseous Form | 900 | R | Ooze | | Vesicle |
| Potion of Greater Healing | 250 | U | Beast | | Liver |
| Potion of Growth | 270 | U | Giant | | Phial of blood |
| Potion of Healing | 50 | C | Beast | | Fat |
| Potion of Heroism | 180 | U→R | Celestial | | Phial of blood |
| Potion of Hill Giant Strength | 500 | U | Giant | Hill | Nail |
| Potion of Invisibility | 900 | R→V | Humanoid | Duergar | Skin |
| Potion of Mind Reading | 180 | U→R | Aberration | Aboleth | Phial of mucus |
| Potion of Poison | 180 | U | Plant | | Poison gland |
| Potion of Resistance (Acid) | 240 | U | Elemental | | Volatile mote of water |
| Potion of Resistance (Cold) | 240 | U | Fiend | Ice devil | Fat |
| Potion of Resistance (Fire) | 300 | U | Fiend | Hell hound | Fat |
| Potion of Resistance (Force) | 240 | U | Aberration | | Fat |
| Potion of Resistance (Lightning) | 240 | U | Golem | Flesh golem | Fat |
| Potion of Resistance (Necrotic) | 240 | U | Undead | | Phial of congealed blood |
| Potion of Resistance (Poison) | 300 | U | Fiend | Bearded devil | Fat |
| Potion of Resistance (Psychic) | 220 | U | Aberration | Dreamholder | Fat |
| Potion of Resistance (Radiant) | 220 | U | Celestial | Couatl | Fat |
| Potion of Resistance (Thunder) | 220 | U | Giant | Storm | Fat |
| Potion of Speed | 4,800 | V | Fey | | Liver |
| Potion of Stone Giant Strength | 1,500 | R | Giant | Stone | Nail |
| Potion of Storm Giant Strength | 30,000 | L | Giant | Storm | Nail |
| Potion of Superior Healing | 1,000 | R | Monstrosity | | Liver |
| Potion of Supreme Healing | 5,000 | V | Monstrosity | | Fat and Liver |
| Potion of Water Breathing | 180 | U | Beast | | Fin |

### Rings
| Name | Value | Rarity | Att | Type | Metatag | Component |
|------|-------|--------|-----|------|---------|-----------|
| Eye of the Tiger | 650 / 9,500 | U/V | Req | Fiend | Pygmy rakshasa | Eye |
| Ring of Air Elemental Command | 35,000 | L | Req | Elemental | Air elemental | Core of air |
| Ring of Animal Influence | 1,500 | R | — | Beast | | Heart |
| Ring of Birdseye Maple | 550 | U | Opt | Plant | Awakened Tree | Bundle of roots |
| Ring of Djinni Summoning | 90,000 | L | Req | Elemental | Djinni | Core of air |
| Ring of Earth Elemental Command | 35,000 | L | Req | Elemental | Earth elemental | Core of earth |
| Ring of Evasion | 5,000 | R | Req | Fey | | Pouch of feathers |
| Ring of Feather Falling | 2,100 | R | Req | Beast | | Pouch of feathers |
| Ring of Fire Elemental Command | 35,000 | L | Req | Elemental | Fire elemental | Core of fire |
| Ring of Free Action | 16,000 | V→R | Req | Plant | | Bundle of roots |
| Ring of Fungal Symbiosis | 500 / 9,400 | U/V | Opt | Plant | Hyphan | Pouch of spores |
| Ring of Invisibility | 32,000 | L | Req | Elemental | Invisible stalker | Primordial dust |
| Ring of Jumping | 1,000 | U | Req | Beast | Frog or toad | Bone |
| Ring of Mind Shielding | 1,600 | U | Req | Aberration | | Main eye |
| Ring of Poison Resistance | 1,500 | U→R | Req | Dragon | Green | Eye |
| Ring of Protection | 3,500 | R | Req | Construct | | Plating |
| Ring of Regeneration | 12,000 | V | Req | Plant | | Membrane |
| Ring of Resistance (all types) | 1,100–1,500 | U→R | Req | Dragon | [type] | Eye |
| Ring of Shooting Stars | 14,000 | V | Req+ | Aberration | | Antenna |
| Ring of Spell Storing | 8,000 | R | Req | Fey | | Bone |
| Ring of Spell Turning | 50,000 | L | Req | Fiend | Rakshasa | Skin |
| Ring of Swimming | 1,800 | U | — | Beast | | Fin |
| Ring of Telekinesis | 25,000 | V | Req | Aberration | Dreamholder | Brain |
| Ring of the Ram | 5,000 | R | Req | Beast | Goat or sheep | Horn |
| Ring of Three Wishes | 150,000 | L | —,C | Humanoid | Halfling | Heart |
| Ring of Warmth | 4,500 | U | Req | Elemental | | Eye |
| Ring of Water Elemental Command | 35,000 | L | Req | Elemental | Water elemental | Core of water |
| Ring of Water Walking | 1,500 | U | — | Beast | | Fat |
| Ring of X-ray Vision | 6,000 | R | Req | Aberration | | Eye |

### Rods
| Name | Value | Rarity | Att | Type | Metatag | Component |
|------|-------|--------|-----|------|---------|-----------|
| Immovable Rod | 2,000 | U | — | Beast | | Bone |
| Rod of Absorption | 41,600 | L | Req | Construct | | Stone |
| Rod of Alertness | 25,000 | V | Req | Fey | | Eye |
| Rod of Lordly Might | 35,000 | L | Req | Fiend | Pit fiend | Pouch of teeth |
| Rod of Rulership | 6,000 | R | Req | Fiend | Incubus or succubus | Pouch of dust |
| Rod of Security | 20,000 | V | — | Celestial | Unicorn | Horn |
| Sporespreader | 1,000 / 4,500 | U/R | Req | Plant | Hyphan | Spore-filled gills |
| Suncatcher | 900 / 2,300 / 9,800 | U/R/V | Req_s | Fey | Suneater | Beak |

### Scrolls
| Name | Value | Rarity | Type | Component |
|------|-------|--------|------|-----------|
| Cantrip Scroll | 20 | C | **see below | Any |
| 1st-level Scroll | 60 | C | | Any |
| 2nd-level Scroll | 180 | U | | Any |
| 3rd-level Scroll | 360 | U | | Any |
| 4th-level Scroll | 900 | R | | Any |
| 5th-level Scroll | 2,000 | R | | Any |
| 6th-level Scroll | 5,000 | V | | Any |
| 7th-level Scroll | 12,000 | V | | Any |
| 8th-level Scroll | 25,000 | V | | Any |
| 9th-level Scroll | 50,000 | L | | Any |

**Scroll creature type by school:** Abjuration=Construct, Biomancy=Monstrosity, Conjuration=Elemental, Divination=Celestial, Enchantment=Fey, Evocation=Fiend, Illusion=Aberration, Necromancy=Undead, Transmutation=Ooze

### Staves
| Name | Value | Rarity | Att | Type | Metatag | Component |
|------|-------|--------|-----|------|---------|-----------|
| Staff of Charming | 6,000 | R | Req+ | Fiend | Incubus/succubus | Heart |
| Staff of Fire | 12,000 | V | Req+ | Elemental | Magma mephit | Volatile mote of fire |
| Staff of Frost | 12,000 | V | Req+ | Elemental | Ice mephit | Volatile mote of water |
| Staff of Healing | 6,000 | R | Req+ | Celestial | Unicorn | Horn |
| Staff of Power | 65,000 | L→V | Req+ | Giant | Storm | Heart |
| Staff of Striking | 12,000 | V | Req | Fey | Sprite | Psyche |
| Staff of Swarming Insects | 5,000 | R | Req+ | Beast | Beetle or insect | Stinger |
| Staff of Thunder and Lightning | 10,000 | V | Req | Elemental | Djinni | Volatile mote of air |
| Staff of Withering | 2,500 | R | Req+ | Undead | Wight | Bone |
| Staff of the Magi | 4,000,000 | A→L | Req+ | Monstrosity | Kraken | Tentacle |
| Staff of the Python | 1,200 | U | Req+ | Beast | Snake | Pouch of scales |
| Staff of the Woodlands | 22,000 | V→R | Req+ | Plant | Dryad | Bundle of roots |

### Wands
| Name | Value | Rarity | Att | Type | Metatag | Component |
|------|-------|--------|-----|------|---------|-----------|
| +1 Wand of the War Mage | 750 | U | Req_s | Aberration | | Bone |
| +2 Wand of the War Mage | 1,500 | R | Req_s | Aberration | | Bone |
| +3 Wand of the War Mage | 6,200 | V | Req_s | Aberration | | Bone |
| Wand of Binding | 5,000 | R | Req_s | Plant | Shambling mound | Pouch of hyphae |
| Wand of Enemy Detection | 1,200 | U→R | Req | Monstrosity | Ankheg | Antenna |
| Wand of Fear | 5,000 | R | Req | Undead | Ghost | Ethereal ichor |
| Wand of Fireballs | 25,000 | V→R | Req_s | Elemental | Fire elemental | Volatile mote of fire |
| Wand of Lightning Bolts | 25,000 | V→R | Req_s | Elemental | Air elemental | Volatile mote of air |
| Wand of Magic Detection | 600 | U | — | Monstrosity | Sphinx | Eye |
| Wand of Magic Missiles | 900 | U | — | Monstrosity | | Phial of blood |
| Wand of Paralysis | 10,000 | V→R | Req_s | Monstrosity | Phase spider | Stinger |
| Wand of Polymorph | 20,000 | V | Req_s | Monstrosity | Mimic | Flesh |
| Wand of Secrets | 600 | U | — | Beast | [has blindsight] | Antenna |
| Wand of Web | 4,000 | R→U | Req_s | Beast | Spider | Poison gland |
| Wand of Wonder | 4,000 | R | Req_s | Fey | | Heart |

### Weapons
| Name | Value | Rarity | Att | Type | Metatag | Component |
|------|-------|--------|-----|------|---------|-----------|
| Painblinder Mycaxe (any axe) | 400 / 1,800 | U/R | — | Plant | Hyphan | Spore-filled gills |
| Time Splitter (any axe) | 850 / 9,800 | U/V | Req | Aberration | Dreamholder | Bone |
| Sunwing Bow (any bow) | 900 / 2,300 / 12,000 | U/R/V | Opt | Fey | Suneater | Sinew |
| Haemstrike (any hammer*) | 1,000 / 3,500 / 11,000 | U/R/V | Opt | Dragon | Magnetite | Bone |
| Hammer Time (any hammer*) | 1,300 / 6,200 | R/V | — | Aberration | Dreamholder | Main eye |
| Headbanger Lute (any hammer*) | 800 / 9,600 | U/V | Req | Monstrosity | Tavern Mimic | Stomach |
| Mawling Maul (any hammer*) | 650 / 1,600 | U/R | — | Monstrosity | Tavern Mimic | Pouch of teeth |
| Jaw Breakers (any two melee) | 3,200 / 10,500 | R/V | Opt | Elemental | Tar-rasque | Pouch of teeth |
| Gunnspier (any polearm**) | 1,400 / 6,500 | R/V | — | Construct | Koboldzilla | Gearing |
| Bonze's Bokken Wind Ripper (any sword) | 500/2,100/9,700/42,000 | U/R/V/L | Req | Plant | Treant | Bark |
| Tail's End (any sword) | 1,600 / 6,400 | R/V | — | Fiend | Pygmy rakshasa | Sinew |
| Terrorasque (any sword) | 2,600 / 9,900 | R/V | Req | Elemental | Tar-rasque | Pouch of claws (2) |
| Vorpal Sword (any sword) | 24,000 | L | Req | Monstrosity | | Pouch of teeth |
| Splinterspray Tommybow | 400/1,750/8,100 | U/R/V | — | Construct | Animated | Instructions |
| Claws of Corruption (claw) | 500 / 9,400 | U/V | Req | Fiend | Pygmy rakshasa | Pouch of claws |
| Dagger of Venom | 1,900 | R | — | Fiend | Vrock | Poison gland |
| Flooze (flail) | 600 / 9,600 | U/V | Req | Ooze | Polyhedrooze | Gooey wishbones (3) |
| +1 Weapon | 750 | U | — | Beast | | Pouch of claws |
| +2 Weapon | 1,500 | R | — | Monstrosity | | Pouch of claws |
| +3 Weapon | 6,200 | V | — | Dragon | | Pouch of claws |
| Berserker Axe | 2,100 | R | Req | Fiend | | Bone |
| Dancing Sword | 2,100 | R→V | Req | Construct | Flying Sword | Lifespark |
| Defender | 24,000 | L | Req | Construct | | Lifespark |
| Dragon Slayer | 2,400 | R | — | Dragon | | Heart |
| Flame Tongue | 9,400 | V→R | Req | Dragon | [fire-breather] | Breath sac |
| Frost Brand | 9,400 | V | Req | Dragon | [cold-breather] | Breath sac |
| Giant Slayer | 2,400 | R | — | Giant | | Heart |
| Holy Avenger | 150,000 | L | Req+ | Celestial | Solar | Heart |
| Luck Blade | 170,000 | L | Req | Fey | | Psyche |
| Nine Lives Stealer | 9,400 | V | Req | Beast | Cat | Heart |
| Sword of Life Stealing | 2,100 | R | Req | Undead | Wraith | Ethereal ichor |
| Sword of Sharpness | 2,100 | R→V | Req | Giant | | Tooth |
| Sword of Wounding | 2,100 | R | Req | Humanoid | | Pouch of teeth |
| Vicious Weapon | 350 | U→R | — | Undead | | Pouch of teeth |
| Kobold Wristbow (hand crossbow) | 50 | C | Req | Construct | | Gears |
| Javelin of Lightning | 1,200 | U | — | Elemental | | Primordial dust |
| Oathbow (longbow) | 9,400 | V | Req | Fey | | Tongue |
| Sun Blade (longsword) | 12,000 | V→R | Req | Celestial | | Pouch of dust |
| Pneuma Blade (longsword or greatsword) | 1,600 / 7,800 | R/V | — | Construct | Koboldzilla | Lifespark |
| Mace of Disruption | 7,000 | R | Req | Undead | | Marrow |
| Mace of Smiting | 4,500 | R | — | Construct | | Bone |
| Mace of Terror | 7,000 | R | Req | Monstrosity | | Bone |
| Hammer of Thunderbolts (maul) | 16,000 | V→L | — | Giant | Storm | Bone |
| Longspike (rapier) | 850 / 10,000 | U/V | Opt | Plant | Hyphan | Pouch of hyphae |
| Scimitar of Speed | 9,400 | V | Req | Fey | | Pouch of feathers |
| Trident of Fish Command | 700 | U | Req | Beast | | Tentacle |
| Dwarven Thrower (warhammer) | 18,000 | V | Req+ | Giant | Stone | Tooth |

*Includes club, greatclub, light hammer, mace, maul, warhammer  
**Includes halberd, glaive, lance, quarterstaff, spear, twinblade, pike

### Wondrous Items (Selected Key Items)
| Name | Value | Rarity | Att | Type | Metatag | Component |
|------|-------|--------|-----|------|---------|-----------|
| Amulet of Health | 7,000 | R | Req | Beast | Mammoth | Heart |
| Amulet of Proof vs Detection | 1,000 | U | Req | Fey | | Antenna |
| Amulet of the Planes | 20,000 | V | Req | Fiend | | Soul |
| Apparatus of the Crab | 12,000 | V→L | — | Construct | | Brain |
| Astral Luggage | 300 / 3,200 | U/V | — | Aberration | Dreamholder | Brain |
| Bag of Beans | 2,000 | R | —,C | Plant | | Phial of sap |
| Bag of Devouring | 6,500 | V | — | Monstrosity | | Pelt |
| Bag of Holding | 2,500 | U | — | Aberration | | Hide |
| Bag of Tricks | 500 | U | — | Fey | | Skin |
| Bead of Force | 960 | R | —,C | Construct | | Lifespark |
| Belt of Dwarvenkind | 9,500 | V→R | Req | Monstrosity | | Pelt |
| Belt of Giant Strength (Fire) | 24,000 | V | Req | Giant | Fire | Skin |
| Belt of Giant Strength (Frost) | 16,000 | V | Req | Giant | Frost | Skin |
| Belt of Giant Strength (Hill) | 8,000 | R | Req | Giant | Hill | Skin |
| Belt of Giant Strength (Stone) | 16,000 | V | Req | Giant | Stone | Skin |
| Belt of Giant Strength (Storm) | 96,000 | L | Req | Giant | Storm | Skin |
| Bomboozler | 900 / 4,800 | R/V | —,C | Ooze | Polyhedrooze | Phial of acid |
| Boots of Elvenkind | 2,500 | U | — | Plant | | Bark |
| Boots of Levitation | 4,000 | R | Req | Fey | | Skin |
| Boots of Speed | 4,000 | R | Req | Fey | | Pelt |
| Boots of Striding and Springing | 1,800 | U | Req | Construct | | Gears |
| Boots of the Winterlands | 2,000 | U | Req | Beast | | Pelt |
| Bowl of Commanding Water Elementals | 3,200 | R | — | Elemental | | Core of water |
| Bracers of Archery | 1,500 | R→U | Req | Monstrosity | | Pelt |
| Bracers of Defense | 6,000 | R | Req | Monstrosity | | Chitin |
| Brazier of Commanding Fire Elementals | 3,200 | R | — | Elemental | Efreeti | Core of fire |
| Brooch of Shielding | 1,500 | U | Req | Monstrosity | | Pouch of scales |
| Broodmother's Embrace | 3,500/12,000/41,600 | R/V/L | Req | Aberration | Broodmother | Hide |
| Broodslinger | 800/2,500/9,500 | U/R/V | Req | Aberration | Broodmother | Broodling sac |
| Broom of Flying | 8,000 | V→U | — | Plant | | Bundle of roots |
| Caltrooze | 180 | U | —,C | Ooze | Polyhedrooze | Phial of mucus |
| Candle of Invocation | 5,600 | V | Req,C | Celestial/Fiend | | Fat* |
| Cape of the Mountebank | 1,600 | R | — | Monstrosity | | Pelt |
| Carpet of Flying (all sizes) | 8,000–16,000 | V | — | Plant | | Bundle of roots |
| Censer of Controlling Air Elementals | 3,200 | R | — | Elemental | Djinni | Core of air |
| Chime of Opening | 1,500 | R | —,C | Humanoid | | Bone |
| Circlet of Blasting | 360 | U | — | Monstrosity | | Antler |
| Cloak of Arachnida | 9,400 | V | Req | Beast | Giant spider | Chitin |
| Cloak of Displacement | 60,000 | L→R | Req | Monstrosity | | Pelt |
| Cloak of Elvenkind | 5,000 | R→U | Req | Plant | | Phial of sap |
| Cloak of Protection | 3,500 | R→U | Req | Beast | | Chitin |
| Cloak of the Bat | 6,000 | R | Req | Beast | Bat | Pelt |
| Cloak of the Manta Ray | 5,000 | R→U | — | Beast | Ray or shark | Pelt |
| Crawly Turrit | 9,400 | V | Req | Construct AND Dragon | Koboldzilla + — | Instructions + Breath sac |
| Crystal Ball | 28,000 | V | Req | Celestial | | Eye |
| Cube of Force | 16,000 | V→R | Req | Construct | | Instructions |
| Cubic Gate | 40,000 | L | — | Elemental | | Primordial dust |
| Decanter of Endless Water | varies | U-L* | — | Elemental | | Volatile mote of water |
| Deck of Illusions | 600 | U | —,C | Celestial | | Soul |
| Deck of Many Things | 60,000 | L | — | Fiend | | Soul |
| Dimensional Doorknob | 500 | U | — | Construct | | Gears |
| Dimensional Shackles | 2,500 | R | — | Aberration | | Fat |
| Dreamy the Lucid | 200 | U | — | Aberration | Dreamholder | Subeye |
| Dust of Disappearance | 250 | U | —,C | Elemental | | Primordial dust |
| Dust of Dryness | 180 | U | —,C | Celestial | | Pouch of dust |
| Dust of Sneezing and Choking | 480 | U | —,C | Fiend | | Pouch of dust |
| Efficient Quiver | 1,000 | U | — | Fey | | Pouch of teeth |
| Efreeti Bottle | 30,000 | L→V | —,C | Elemental | Efreeti | Core of fire |
| Elemental Gem (all types) | 960 | R→U | —,C | Elemental | various | Eye |
| Eversmoking Bottle | 480 | U | — | Plant | | Pouch of spores |
| Eyes of Charming | 1,000 | U | Req | Fey | | Eye |
| Eyes of Googly | 20 | C | — | Monstrosity | Mimic | Eye |
| Eyes of Minute Seeing | 850 | U | — | Beast | Bird | Eye |
| Eyes of the Eagle | 850 | U | Req | Beast | Eagle | Eye |
| Feather Token (Anchor) | 50 | C→R | —,C | Plant | | Bundle of roots |
| Feather Token (Bird) | 3,000 | R | —,C | Beast | | Beak |
| Feather Token (Fan) | 300 | U | —,C | Monstrosity | | Pouch of feathers |
| Feather Token (Swan Boat) | 1,400 | R | —,C | Monstrosity | | Beak |
| Feather Token (Tree) | 50 | C→R | —,C | Plant | | Bark |
| Feather Token (Whip) | 600 | U→R | —,C | Aberration | | Tentacle |
| Feline's Fury | 4,500 | R | Req | Fiend | Pygmy rakshasa | Soul |
| Felinobelix | 2,100 / 41,600 | R/L | Req | Fiend | Handler | Soul |
| Figurine: Bronze Griffon | 2,000 | R | — | Monstrosity | Griffon | Pouch of feathers |
| Figurine: Ebony Fly | 4,000 | R | — | Beast | Insect | Chitin |
| Figurine: Golden Lions | 600 | U→R | — | Beast | Lion | Pelt |
| Figurine: Ivory Goats | 17,400 | V→R | — | Beast | Goat | Horn |
| Figurine: Marble Elephant | 6,000 | R | — | Beast | Elephant | Tusks |
| Figurine: Obsidian Steed | 24,000 | V | — | Beast | Horse | Bone |
| Figurine: Onyx Dog | 3,000 | R | — | Beast | Dog or wolf | Pouch of teeth |
| Figurine: Serpentine Owl | 7,000 | R | — | Beast | Owl | Eye |
| Figurine: Silver Raven | 1,000 | U | — | Beast | Bird | Beak |
| Folding Boat | 3,000 | R | — | Plant | | Bark |
| Gauntlets of Ogre Power | 5,000 | R→U | Req | Giant | Ogre | Bone |
| Gem of Brightness | 5,000 | R→U | —,C | Celestial | | Fat |
| Gem of Seeing | 8,000 | R | Req | Celestial | | Eye |
| Gloves of Missile Snaring | 1,500 | U | Req | Fey | | Pelt |
| Gloves of Swimming and Climbing | 900 | U | Req | Beast | Shark | Pouch of scales |
| Goggles of Night | 1,000 | U | — | Monstrosity | | Eye |
| Grill of Barbecuing | 350 | U | — | Elemental | | Volatile mote of fire |
| Hat of Disguise | 1,200 | U | Req | Fiend | Shapechanger | Skin |
| Headband of Intellect | 5,000 | R→U | Req | Humanoid | | Brain |
| Heliana's Guide | 300 / 6,200 | U/V | — | Humanoid | | Brain |
| Helm of Brilliance | 25,000 | V | Req | Celestial | | Pouch of scales |
| Helm of Comprehending Languages | 500 | U | — | Construct | | Brain |
| Helm of Telepathy | 2,000 | U | Req | Fiend | | Brain |
| Helm of Teleportation | 23,000 | V→R | Req | Fey | | Tentacle |
| Handy Haversack | 1,500 | U→R | — | Aberration | | Hide |
| Horn of Blasting | 450 | U→R | — | Dragon | | Horn |
| Horn of Valhalla (Brass) | 8,400 | R | — | Beast | Elephant | Tusk |
| Horn of Valhalla (Bronze) | 14,000 | V | — | Beast | Mammoth | Tusk |
| Horn of Valhalla (Iron) | 28,800 | L | — | Fiend | Balor | Horn |
| Horn of Valhalla (Silver) | 5,600 | R | — | Beast | Rhinoceros | Horn |
| Horseshoes of Speed | 5,000 | R | — | Beast | | Pouch of claws |
| Horseshoes of a Zephyr | 6,200 | V | — | Monstrosity | | Pouch of claws |
| Infested Cultist's Skull | 500 / 7,000 | U/V | — | Humanoid | Cultist | Bone |
| Instant Fortress | 75,000 | L→R | — | Construct | | Bone |
| Ioun Stone (Absorption) | 9,400 | V | Req | Aberration | | Chitin |
| Ioun Stone (Agility) | 9,400 | V | Req | Fey | Dex≥20 | Psyche |
| Ioun Stone (Awareness) | 12,000 | V→R | Req | Dragon | Adult or Ancient | Heart |
| Ioun Stone (Fortitude) | 9,400 | V | Req | Fiend | Con≥20 | Soul |
| Ioun Stone (Greater Absorption) | 41,600 | L | Req | Construct | Shield guardian | Lifespark |
| Ioun Stone (Insight) | 9,400 | V | Req | Celestial | Wis≥20 | Soul |
| Ioun Stone (Intellect) | 9,400 | V | Req | Fey | Int≥20 | Psyche |
| Ioun Stone (Leadership) | 9,400 | V | Req | Celestial | Cha≥20 | Soul |
| Ioun Stone (Mastery) | 41,600 | L | Req | Fiend | Pit fiend | Soul |
| Ioun Stone (Protection) | 2,100 | R | Req | Monstrosity | Gorgon | Horn |
| Ioun Stone (Regeneration) | 9,400 | V→L | Req | Giant | Troll | Liver |
| Ioun Stone (Reserve) | 5,200 | R | Req | Humanoid | Spellcaster | Brain |
| Ioun Stone (Strength) | 9,400 | V | Req | Dragon | Str≥20 | Horn |
| Ioun Stone (Sustenance) | 2,100 | R | Req | Undead | Vampire | Undying heart |
| Iron Bands of Binding | 4,000 | R | — | Plant | Shambling mound | Bundle of roots |
| Iron Flask | 28,800 | L | — | Construct | Iron Golem | Plating |
| Kobbold Flaymefrower | 750 / 9,800 | U/V | Req | Construct | Koboldzilla | Arcanothermic core |
| Lantern of Revealing | 900 | U | — | Fey | Hag | Eye |
| L'Arsène's Quadnoculars | 1,500 | R | — | Construct | | Brain |
| Mantle of Spell Resistance | 19,000 | V→R | Req | Fiend | Rakshasa | Skin |
| Manual of Bodily Health | 14,000 | V | — | Giant | | Liver |
| Manual of Clay Golems | 8,200 | V | —,C | Construct | Clay golem | Stone |
| Manual of Flesh Golems | 6,200 | V | —,C | Construct | Flesh golem | Flesh |
| Manual of Gainful Exercise | 14,000 | V | — | Humanoid | | Liver |
| Manual of Iron Golems | 12,200 | V | —,C | Construct | Iron golem | Plating |
| Manual of Quickness of Action | 14,000 | V | — | Fey | | Phial of blood |
| Manual of Stone Golems | 9,200 | V | —,C | Construct | Stone golem | Stone |
| Marvelous Pigments | 8,600 | V | —,C | Plant | | Phial of wax |
| Medallion of Thoughts | 1,200 | U | Req | Aberration | | Phial of blood |
| Mirror of Life Trapping | 18,000 | V | — | Undead | | Eye |
| Mycelial Cloak | 2,300 | R | Req | Plant | Hyphan | Membrane |
| Necklace of Adaptation | 1,200 | U | Req | Monstrosity | | Poison gland |
| Necklace of Fireballs* | 400/bead | U–R | — | Dragon | [fire-immune] | Breath sac |
| Necklace of Prayer Beads (Bless) | 300 | U | Req+ | Celestial | | Pouch of teeth |
| Necklace of Prayer Beads (Curing) | 600 | U | Req+ | Celestial | | Pouch of teeth |
| Necklace of Prayer Beads (Favor) | 3,200 | R | Req+ | Celestial | | Pouch of teeth |
| Necklace of Prayer Beads (Smiting) | 600 | U | Req+ | Celestial | | Pouch of teeth |
| Necklace of Prayer Beads (Summons) | 6,400 | V | Req+ | Celestial | | Pouch of teeth |
| Necklace of Prayer Beads (Wind Walk) | 6,400 | V | Req+ | Celestial | | Pouch of teeth |
| Oozemat Coat | 3,500 | R | Req | Ooze | Polyhedrooze | Membrane |
| Orb of Dragonkind | 4,000,000 | A | Req | Dragon | | Heart |
| Pearl of Power | 1,000 | U | Req_s | Aberration | | Pouch of teeth |
| Periapt of Health | 400 | U | — | Monstrosity | | Heart |
| Periapt of Proof against Poison | 5,000 | R | — | Fey | | Poison gland |
| Periapt of Wound Closure | 800 | U | Req | Ooze | | Phial of mucus |
| Pipes of Haunting | 800 | U | — | Fey | | Bone |
| Pipes of the Sewers | 700 | U | Req | Monstrosity | | Bone |
| Portable Hole | 2,500 | R | — | Aberration | | Hide |
| Restorative Ointment | 360 | U | —,C | Plant | | Pouch of leaves |
| Robe of Eyes | 4,000 | R | Req | Monstrosity | Sphinx | Eye |
| Robe of Scintillating Colors | 9,400 | V | Req | Plant | | Pouch of pollen |
| Robe of Stars | 18,000 | V | Req | Aberration | | Eye |
| Robe of Useful Items | 1,250 | U | —,C | Humanoid | | Skin |
| Robe of the Archmagi | 41,600 | L | Req+ | Multiple** | | Skin |
| Robes of Beaurêve | 1,600 / 32,000 | R/L | Req | Aberration | Dreamholder | Hide |
| Rolly Turrit | 2,100 | R | Req | Construct | Koboldzilla | Instructions |
| Rope of Climbing | 900 | U | — | Monstrosity | | Talon |
| Rope of Entanglement | 2,000 | R | — | Monstrosity | | Pincer |
| Scarab of Protection | 41,600 | L | Req | Undead | Lich | Undying heart |
| Shard Crown | 2,800/10,000/41,600 | R/V/L | Req | Dragon | Magnetite | Horn |
| Slime-in-a-Skull | 700 / 10,000 | U/V | Req | Ooze | Polyhedrooze | Vesicle |
| Slippers of Spider Climbing | 1,500 | U | Req | Beast | Spider | Pouch of claws |
| Snow Wolf Cowl | 900/3,500/11,500 | U/R/V | Req | Beast | Wolf | Pelt |
| Sovereign Glue | 4,800 | V→L | —,C | Ooze | Black Pudding | Phial of mucus |
| Spelleater Tome | 850 / 2,700 | U/R | Req | Monstrosity | Tavern Mimic | Brain |
| Sphere of Annihilation | 15,000 | V→L | — | Fiend | | Eye |
| Stone of Controlling Earth Elementals | 3,200 | R | — | Elemental | | Core of earth |
| Stone of Good Luck | 1,500 | U | Req | Humanoid | Halfling | Heart |
| Sunfeather Shroud | 500/2,100/9,400 | U/R/V | Req | Fey | Suneater | Pouch of feathers |
| Talisman of Pure Good | 72,000 | L | Req+ | Celestial | Good-aligned god | Heart |
| Talisman of Ultimate Evil | 62,000 | L | Req+ | Fiend | Evil-aligned god | Heart |
| Talisman of the Sphere | 15,000 | V→L | Req | Celestial | | Eye |
| Tarrobe | 2,500 / 42,000 | R/L | Req | Elemental | Tar-rasque | Volatile mote of tar |
| Tome of Clear Thought | 9,200 | V | — | Construct | | Phial of blood |
| Tome of Leadership and Influence | 9,200 | V | — | Celestial | | Horn |
| Tome of Living Memories | 750/2,300/10,000 | U/R/V | Opt+ | Aberration | Broodmother | Eye / Eyes (2) / Eyes (3) |
| Tome of Understanding | 9,200 | V | — | Aberration | | Brain |
| Universal Solvent | 22,400 | L | — | Ooze | | Phial of acid |
| Ventilation Unit D-20 | 2,100 | R | Req | Ooze | Polyhedrooze | Phial of acid + Phial of mucus |
| Viscous Symbiote | 2,100/9,400/41,600 | R/V/L | Req | Elemental | Tar-rasque | Core of tar |
| Well of Many Worlds | 96,000 | L | — | Aberration | | Hide |
| Wind Fan | 700 | U | — | Monstrosity | | Pouch of feathers |
| Winged Boots | 6,000 | R→U | Req | Fiend | | Pouch of feathers |
| Wings of Flying | 6,000 | R | Req | Celestial | | Pouch of feathers |
| Wyrm's Breath Grenade (Brass) | 3,500 | V | — | Dragon | Brass | Breath sac |
| Wyrm's Breath Grenade (Bronze) | 1,100 | R | — | Dragon | Bronze | Breath sac |
| Wyrm's Breath Grenade (Copper) | 1,250 | R | — | Dragon | Copper | Breath sac |
| Wyrm's Breath Grenade (Gold) | 3,200 | V | — | Dragon | Gold | Breath sac |
| Wyrm's Breath Grenade (Silver) | 18,000 | L | — | Dragon | Silver | Breath sac |

---

## PART 8: COOKING SYSTEM

### Rules Summary
- Takes **1 hour** to cook, **10 minutes** to consume and digest
- Must be consumed within **1 hour** of cooking or loses all magical effects
- Effects last **8 hours** (or until dispelled)
- New meal replaces effects of previous meal (old effects end after 10-minute consumption window)
- **Dispel magic level:** Uncommon=2nd, Rare=4th, Very Rare=6th, Legendary=8th
- **Portions:** Typically feeds 1 Large creature or up to 4 Medium/Small creatures

### Check
Constitution (cook's utensils) check vs Recipe DC.  
**Helping:** One creature can assist for the full hour. Proficient = adds full PB. Not proficient = adds half PB (rounded down).

### Recipe Difficulty Tiers
| Tier | # Ingredients | DC |
|------|-------------|-----|
| Novice | 1 | 12 |
| Journeyman | 2 | 16 |
| Expert | 3 | 20 |
| Artisan | 4 | 24 |

### Staple Recipes
**Novice (DC 12, 1 ingredient):**
- Keyebob — Eye
- Tempura — Fat
- Steak — Flesh
- Blood Curd — Blood
- Bone Broth — Bone
- Egg Dumpling — Egg
- Hearty Stew — Heart
- Liverwurst — Liver

**Journeyman (DC 16, 2 ingredients):**
- Meaty Masala — Flesh + Spice
- Tofeye Apple — Bone + Eye
- Dwarven Scotch — Egg + Flesh
- Gobbois Gras — Fat + Liver
- Devilled Egg — Egg + Spice
- Black Pudding — Blood + Fat
- Bloody Gazpacho* — Blood + Spice (*no heat source required)
- Carrion Delight — Bone + Fat

**Expert (DC 20, 3 ingredients):**
- Chronomancer's Slow Cooked Joint — Bone + Fat + Flesh
- Offally Good Stew — Brain + Heart + Liver
- Draconic Delight — Egg + Flesh + Spice
- Brain Barbacoa — Bone + Brain + Eye

**Artisan (DC 24, 4 ingredients):**
- Scarlet Eye Flan — Blood + Brain + Eye + Fat
- Beastial Bourguignon — Flesh + Heart + Liver + Spice

### Boss Monster Recipes
| Recipe | DC | Boss Ingredient | Other Ingredients |
|--------|----|-----------------|--------------------|
| Aboleth Ramen | 12 | Flesh: Aberration (broodmother) tentacle | — |
| Jello Shot | 16 | Blood: Phial of ooze (polyhedrooze) mucus | Fat |
| Mushroom Mélange | 16 | Spice: Pouch of plant (hyphan) spores | Fat |
| Rakoyaki | 16 | Brain: Fiend (pygmy) brain | Blood |
| Skrapyard Sosig | 16 | Flesh: Construct (koboldzilla) tubing | Egg |
| Tongue Twister Tart | 16 | Flesh: Monstrosity (tavern mimic) tongue | Brain |
| Magnetite Curry | 20 | Flesh: Dragon (magnetite) flesh | Liver + Spice |
| Dumpleyengs | 20 | Eye: Aberration (dreamholder) subeye | Blood + Heart |
| Suneater Steak and Eggs | 20 | Flesh: Fey (suneater) flesh | Blood + Egg |
| Tar-rasque Marrow Broth | 24 | Bone: Elemental (tar-rasque) marrow | Heart + Liver + Spice |

### Boss Monster Effect Scaling
| Recipe | Uncommon | Rare | Very Rare | Legendary |
|--------|----------|------|-----------|----------|
| Aboleth Ramen (extra reach) | 5 ft. | 5 ft. | 10 ft. | 10 ft. |
| Jello Shot (simultaneous resistances) | 1 | 1 | 2 | 2 |
| Mushroom Mélange (corpse detection radius) | 60 ft. | 240 ft. | 960 ft. | 1 mile |
| Rakoyaki (spell level blocked) | Cantrip | 1st level | 2nd level | 3rd level |
| Skrapyard Sosig (temp HP/turn) | CHA mod | CHA mod+2 | CHA mod+4 | CHA mod+6 |
| Tongue Twister Tart (Investigation DC to spot you) | DC 13 | DC 15 | DC 16 | DC 17 |
| Magnetite Curry (ferrous damage reduction) | 1d6 | 1d8 | 1d10 | 1d12 |
| Dumpleyengs (daydream spell DC) | DC 13 | DC 15 | DC 16 | DC 17 |
| Suneater Steak and Eggs (HP regained/hr in sunlight) | 1d6 | 2d6 | 3d6 | 4d6 |
| Tar-rasque Marrow Broth (bonus necrotic damage) | 1d4 | 2d4 | 3d4 | 4d4 |

### Cooking Quirks
**Quirks Gained:**
| Result − DC | Quirks | Min Essence |
|------------|--------|-------------|
| −13 or less | 4 flaws | Uncommon |
| −12 to −9 | 3 flaws | Uncommon |
| −8 to −5 | 2 flaws | Uncommon |
| −4 to −1 | 1 flaw | Uncommon |
| 0 to +4 | None | Uncommon |
| +5 to +8 | 1 boon* | Rare |
| +9 to +12 | 2 boons* | Very Rare |
| +13+ | 3 boons* | Legendary |
*Limited by meal rarity

**Cooking Flaws (d8):**
1. Rottworth's Revenge: Poisoned + can't benefit from rests. Suppress effect only (1 hr) with remove poison.
2. Nauseating Nightmare: Disadvantage on INT/WIS/CHA checks and initiative rolls.
3. Tongue Tied: Can only speak a language of one creature type you ate.
4. Flatulence: Disadvantage on CHA checks within 30 ft (smell) and disadvantage on Stealth (smell/sound).
5. Borborygmus Bomb: Disadvantage on concentration saves. After 1d8 hours: cloudkill centered on self (1 min).
6. High Glycemic Index: After 1d4 hours: disadvantage on DEX checks and saves.
7. Allergic Reaction: DC 10 CON save at start of each turn or use action/bonus action to scratch.
8. Food Baby: Speed −5 ft.

**Cooking Boons (d8):**
1. Iron Gut: Resistance to poison damage; advantage on saves vs poisoned.
2. Sweet Breath: Advantage on CHA checks vs creatures within 30 ft that can smell.
3. Linguistic Learning: Gain a language associated with each creature type consumed.
4. Slow Release Energy: Advantage on concentration saves.
5. Fearless Fancy: Immune to frightened condition.
6. Hearty Harvest: Advantage on STR checks; count as one size larger for carry/push/drag/lift.
7. Peaceful Digestion: Regain +1 HP per HD on short rest; recover +PB expended HD on long rest.
8. Fast Food: Speed +5 ft.

---

## PART 9: EDIBLE COMPONENT EFFECTS

### Blood
**Effect:** First time each turn you hit a creature of the blood's creature type, deal bonus damage (same type as attack):
- Uncommon: +1d4
- Rare: +1d6
- Very Rare: +1d8
- Legendary: +1d10

*(Applies to all listed creature types: Aberration, Beast, Celestial, Construct, Dragon, Fey, Fiend, Giant, Humanoid, Monstrosity, Ooze, Plant, Undead — but NOT Elemental)*

### Bone
**Effect by creature type (effect doesn't change with rarity unless noted):**
- Aberration: Advantage on saves vs stunned
- Beast: Advantage on saves vs blinded
- Celestial: Gain temp HP at start of each minute (Uncommon: 1d6, Rare: 2d6, VR: 3d6, L: 4d6)
- Construct: Advantage on saves vs exhaustion
- Dragon: Advantage on saves vs frightened
- Elemental: Advantage on saves vs extreme weather/temperature
- Fey: Advantage on saves vs charmed
- Fiend: Advantage on saves vs poisoned
- Giant: Advantage on saves vs restrained
- Humanoid: Advantage on saves vs diseases
- Monstrosity: Advantage on saves vs paralyzed
- Plant: Can't be put to sleep by magic
- Undead: Advantage on saves vs diseases + immediately regain HP (Uncommon: 1d4+1, Rare: 2d4+2, VR: 3d4+3, L: 4d4+4)

### Brain
*(Available for: Aberration, Celestial, Construct, Fey, Fiend, Humanoid only)*
- Aberration: Telepathy with visible creatures sharing a language (30/90/300/900 ft); VR+ = advantage on Insight; L = also detect thoughts
- Celestial: +1/+2/+3/+4 bonus to CHA checks
- Construct: +1/+2/+3/+4 bonus to INT checks
- Fey: +1/+2/+3/+4 bonus to WIS checks
- Fiend: +1/+2/+3/+4 bonus to CHA checks
- Humanoid: +1/+2/+3/+4 bonus to random skill checks

### Egg
*(Available for: Aberration, Beast, Dragon, Fey, Monstrosity only)*
- Aberration: Grow a tentacle (hold items, grapple — uses tentacle STR: +0/+2/+4/+6)
- Beast: Advantage on saves vs environmental effects (adapts to environment)
- Dragon: Grow a fanged maw for unarmed strikes (1d6/1d8/1d10/1d12 + STR)
- Fey: Under effects of chameleon skin spell
- Monstrosity: AC calculation: 12+DEX / 13+DEX / 14+DEX / 15+DEX mod

### Eye
- Aberration: Detect magic in 10/20/60/180 ft radius
- Beast: +1/+2/+3/+4 to Perception checks
- Celestial: Detect evil and good in 10/20/60/180 ft
- Dragon: +1/+2/+3/+4 to Intimidation checks
- Elemental: Know location of elementals within 10/20/60/180 ft
- Fey: See invisibility to 10/20/60/180 ft
- Fiend: See normally in darkness (magical and nonmagical) to 10/20/60/180 ft
- Monstrosity: Gain darkvision or extend by 30/60/90/120 ft
- Undead: Know location of undead within 10/20/60/180 ft

### Fat
*(Damage reduction. Roll die, subtract from that damage type. Uncommon: 1d4, Rare: 1d6, VR: 1d8, L: 1d10. Calculated BEFORE resistance.)*
- Aberration: Psychic
- Beast: Cold
- Celestial: Radiant
- Construct: Lightning
- Dragon: Same as breath weapon damage type (random if multiple)
- Fey: Poison
- Fiend: Fire
- Giant: Same as giant's associated damage type (random if multiple)
- Monstrosity: Thunder
- Ooze: Acid
- Plant: Poison
- Undead: Necrotic

### Flesh
*(First attack each turn that hits: +1/+2/+3/+4 bonus damage of the type listed. Calculated BEFORE resistance.)*
- Aberration: Psychic
- Beast: Cold
- Celestial: Radiant
- Construct: Lightning
- Dragon: Same as breath weapon
- Fey: Poison
- Fiend: Fire
- Giant: Associated damage type
- Monstrosity: Thunder
- Plant: Acid
- Undead: Necrotic

### Heart
**Effect:** Know direction (not distance) of all living hearts of that creature type within radius (can't penetrate 1 ft stone/1 inch metal/thin lead/3 ft wood or dirt):
- Uncommon: 60 ft
- Rare: 240 ft
- Very Rare: 960 ft
- Legendary: 1 mile

*(Available for: Aberration, Beast, Celestial, Construct, Dragon, Fey, Fiend, Giant, Humanoid, Monstrosity, Plant, Undead — NOT Ooze or Elemental)*

### Liver
**Effect:** When a creature of the liver's type hits you with a melee attack, that creature takes necrotic damage (once per turn):
- Uncommon: 1d4
- Rare: 1d6
- Very Rare: 1d8
- Legendary: 1d10

*(Available for: Aberration, Beast, Celestial, Construct, Dragon, Fey, Fiend, Giant, Humanoid, Monstrosity, Ooze, Plant — NOT Undead or Elemental)*

### Spice
*(Available for: Celestial, Elemental, Fiend, Plant, Undead only)*
- Celestial: Uncommon=feather fall constant; Rare+= also fly (15/30/60 ft speed)
- Elemental: Cast random elemental cantrip at will (at caster level: Uncommon=base, Rare=5th, VR=11th, L=17th). Random cantrips: 1 acid splash, 2 concussion, 3 fire bolt, 4 ray of frost, 5 shocking grasp, 6 water whip
- Fiend: Gain temp HP at start of each minute (2d4/4d4/6d4/8d4)
- Plant: Under effects of speak with plants spell
- Undead: Max and current HP increase (2d4/4d4/6d4/8d4)

---

## PART 10: FAMILIARS (HUMPERDINK'S BIOMANCY BOUTIQUE)

### Crafting Familiars
Requires: specific monster component + drop of PC's blood + 20 gp × PC's level fee. After 24 hours, familiar is bonded to the PC who donated blood. When PC casts find familiar, they can summon this crafted familiar.

**Becoming a Bespoke Companion:** Tamer class can tame crafted familiar without ability check. Once tamed = bespoke companion (can no longer be summoned by find familiar).

**Shared Resilience:** When becoming a companion, gains Bonus Tamer Improvement for free. At tamer levels 3, 5, 11, 17: each bespoke companion gains +1 Hit Die (max increases by HD roll + CON mod, min 0). Retroactive.

**Save DC formula for all familiars:** 8 + tamer's proficiency bonus + familiar's [key ability] modifier

---

### Brainmuncher
- **Type:** Aberration
- **Component:** Mind flayer
- **Bonus Improvement:** Detect Thoughts + +2 Hit Dice
- **Key Ability (Save DC):** Intelligence
- **Base Stats:** Tiny aberration, lawful evil. AC 12, HP 2 (1d4). Speed 30 ft. STR -1, DEX 0, CON 0, INT +2, WIS +1, CHA +1. Skills: Arcana +4, Deception +3, Insight +3, Perception +3. Darkvision 60 ft. Languages: Deep Speech, telepathy 30 ft. CR 1/8.
- **Traits:** Brainmuncher (tendency to eat brains of Tiny beasts)
- **Actions:** Tentacles (1d4+2 psychic melee), Levitate (self only)
- **Improvements:**
  - Detect Thoughts (companion prerequisite): Always under detect thoughts; telepathy → 60 ft; can communicate via thoughts/emotions without shared language
  - Teleport (3rd-level): Bonus action, 30 ft teleport. 1/short or long rest
  - Creature Sense (3rd-level + Detect Thoughts): Action, 300 ft radius creature awareness (INT 4+) for 1 minute (concentration). 1/short or long rest. Tentacle die → d10 (d10→2d6 at 5th tamer level)
  - Magic Resilience I (3rd-level): +2 to saves vs magic
  - Mind Blast I (5th-level): Action, 30-ft cone, INT save or 3d6 psychic (stunned if fail by 5+). 1/short rest. (→5d6 at 9th tamer level)
  - Psionic Shield I (5th-level): +2 AC (natural). Reaction: halve psychic damage for creature within telepathy range
  - Telepathic Hub (9th-level + Creature Sense): Action, link up to 10 minds within telepathy range for 1 hour. Overhears all linked communications. Tentacle → 2d8, telepathy → 120 ft. (→2d10 at 13th, 2d12 at 17th)
  - Magic Resilience II (13th-level + MR I): Additional +2 to saves vs magic
  - Mind Blast II (13th-level + MB I): 7d6 (→10d6 at 17th), cone 60 ft, +1 save DC
  - Psionic Shield II (13th-level + PS I): Additional +2 AC
  - Domination (17th-level + Telepathic Hub): Action, 60 ft, WIS save or charmed 1 min (auto-save if CR > half tamer level rounded up). 1/long rest

---

### Caprisoul
- **Type:** Undead
- **Component:** Wight + Stirge
- **Bonus Improvement:** Spirit Transfer + +2 Hit Dice
- **Key Ability (Save DC):** Constitution
- **Base Stats:** Tiny undead, neutral. AC 13, HP 3 (1d4+1). Speed 10 ft, fly 30 ft. STR -3, DEX +3, CON +1, INT -1, WIS -1, CHA -2. Skills: Stealth +5. Resistances: necrotic. Immunities: poison. Condition Immunities: charmed, poisoned. Darkvision 60 ft. CR 1/8.
- **Traits:** Death Burst (on death: 5-ft burst, DC 11 DEX save or 2d4 psychic)
- **Actions:** Soul Drain (+5, 1 piercing + 1d6 necrotic, temp HP = half necrotic; DC 11 CON or HP max reduced by necrotic dealt until long rest)
- **Improvements:**
  - Spirit Transfer (companion prerequisite): Stores soul power pool (cap = 10 + tamer levels). Action: empty pool into willing creature within 5 ft → regain HP equal to pool. Emits dim light while pool active. Death Burst + pool damage. Resets on long rest. 2/short or long rest
  - Immaterial (3rd-level): Bonus action: resistance to B/P/S until next turn. 1/short or long rest
  - Quick I (3rd-level): Flying speed +10 ft, +2 AC (unarmoured)
  - Soulbeam I (5th-level + Spirit Transfer): Action, release pool in 5×60-ft line, DEX save or pool damage (psychic). 1/short or long rest. (+2d6 at 9th level)
  - Flyby (5th-level): No opportunity attacks when flying out of reach
  - Soul Siphon (5th-level): Soul Drain +1d6 necrotic total (→3d6 at 11th, 4d6 at 17th)
  - Uncanny Dodge (9th-level): Reaction to halve attack damage
  - Quick II (9th-level + Quick I): Additional +10 ft fly speed, +2 AC
  - Incorporeality (13th-level + Immaterial): While Immaterial, can move through creatures/objects as difficult terrain
  - Soulbeam II (13th-level + Soulbeam I): Line → 90 ft, +1 save DC, additional 4d6 (→7d6 total at 17th)
  - Soulform (17th-level + Incorporeality or Soulbeam II): Bonus action, releases pool: becomes Medium, weightless hover, resistance B/P/S, can move through creatures/objects, gains temp HP = pool, pool resets, gains Soul Lance ranged spell attack (7d6 psychic + WIS save or frightened). Lasts 1 minute or until 0 HP (then unconscious until long rest). 1/long rest

---

### Couatling
- **Type:** Celestial
- **Component:** Couatl
- **Bonus Improvement:** Linguist + +2 Hit Dice
- **Key Ability (Save DC):** Charisma
- **Base Stats:** Tiny celestial, lawful good. AC 13 (natural), HP 2 (1d4). Speed 20 ft, fly 30 ft. STR -2, DEX +2, CON 0, INT 0, WIS +1, CHA +2. Skills: Perception +3. Resistances: psychic, radiant. Darkvision 60 ft. Telepathy 30 ft. CR 1/8.
- **Traits:** Shielded Mind (immune to scrying, emotion-sensing, thought-reading, and location detection)
- **Actions:** Bite (+4, 1d6+2 piercing), Goodsense 1/Day (detect evil and good)
- **Improvements:**
  - Linguist (companion prerequisite): Understands and speaks tamer's languages (falteringly). Action: cast comprehend languages 1/long rest
  - Divine Constriction (3rd-level): Gain Constrict melee spell attack (CHA mod+PB, 1d4+CHA bludgeoning, target grappled and restrained). Die scales with Growth
  - Growth I (3rd-level): Size → Small, HD → d6 (+1 per HD). Bite → 1d8, Constriction → 1d6
  - Divine Aegis (5th-level): Action: cast protection from evil and good or protection from poison. 1/long rest each
  - Solar Beam I (5th-level): Action, 5×30-ft line, DEX save or 5d6 radiant. 1/short rest. (→7d6 at 9th level)
  - True Seeing I (5th-level): Gains blindsight 15 ft. Action: truesight to blindsight range until end of next turn. 1/short rest
  - Divine Armour (9th-level + Divine Aegis): +2 AC (unarmoured). Evil creatures attacking couatling must pass WIS save or lose attack (no area protection; suspended 1 min if couatling attacks)
  - Growth II (9th-level + Growth I): Size → Medium, HD → d8 (+1 per HD). Bite → 1d10, Constriction → 1d8
  - Solar Beam II (13th-level + SB I): 9d6 (→12d6 at 17th), line → 60 ft, +1 save DC
  - True Seeing II (13th-level + TS I): Blindsight → 60 ft. Truesight duration → 10 minutes
  - Evil's Scourge (17th-level + Divine Armour): Action: cast dispel evil and good. 1/long rest

---

### Death Shroud
- **Type:** Undead
- **Component:** Undead spellcaster
- **Bonus Improvement:** Recycle + +2 Hit Dice
- **Key Ability (Save DC):** Intelligence
- **Base Stats:** Tiny undead, lawful neutral. AC 12 (natural), HP 2 (1d4). Speed 30 ft. STR -1, DEX +1, CON 0, INT +2, WIS +1, CHA -1. Skills: Medicine +3, Thieves' tools +3. Immunities: poison. Condition Immunities: blinded, charmed, poisoned. Blindsight 60 ft (blind beyond). Languages: understands Common but can't speak. CR 1/8.
- **Traits:** Morbid Curiosity (DC 11 WIS save when detecting fresh corpse or gets distracted and investigates). Turn Immunity.
- **Actions:** Slap (1d4+1 bludgeoning melee), Lich Slap (1d6 necrotic ranged 30 ft; target can't regain HP until start of death shroud's next turn)
- **Improvements:**
  - Recycle (companion prerequisite): Reaction on kill or action near corpse (dead ≤1 hour): absorb corpse, regain HP + temp HP equal to 1 roll of corpse's HD. If corpse ≥ death shroud's size: size +1 category until short/long rest (advantage STR checks/saves, +2 attack, +1d4 slap damage)
  - Growth I (3rd-level): Size → Small, HD → d6. Slap → 1d6, Lich Slap → 1d10
  - Hulking Protector (3rd-level): Reaction to reduce damage to adjacent ally by 1d10 (→2d10 at 13th tamer level)
  - Grave Robber (5th-level): Always under detect magic (radius = blindsight; tamer sees auras too). Bonus action: use thieves' tools or take Use an Object action
  - Growth II (5th-level + Growth I): Size → Medium, HD → d8. Slap → 1d8, Lich Slap → 2d6
  - Multiattack (5th-level): Action: two attacks (any combo of Slap/Lich Slap)
  - Undead Fortitude I (5th-level): +1 AC. At 0 HP: CON save DC=(5+damage taken) or drop to 1 HP (not vs radiant or crits)
  - Corpse Investigator (9th-level + Grave Robber): Action: cast speak with dead. 1/short rest. Tamer gains Medicine proficiency
  - Undead Fortitude II (9th-level + UF I): Additional +1 AC. CON save DC = damage taken (not vs radiant or crits)
  - Growth III (13th-level + Growth II): Size → Large, HD → d10. Slap → 1d10, Lich Slap → 2d8
  - Undead Fortitude III (13th-level + UF II): Additional +1 AC. Can now save vs radiant and crits too
  - Swarm (17th-level + Growth III): Action: deconstructs into 8 ghouls for 1 minute. Tamer issues commands to all 8 (action). Ghouls return/reunite or death shroud becomes unconscious until long rest

---

### Dire Bunny
- **Type:** Aberration
- **Component:** Bonemonger (astral hermit)
- **Bonus Improvement:** Sneak Attack
- **Key Ability (Save DC):** Constitution
- **Base Stats:** Tiny aberration, neutral. AC 13 (natural), HP 4 (1d4+2). Speed 30 ft. STR 0, DEX +1, CON +2, INT -1, WIS +2, CHA 0. Skills: Insight +4, Perception +4. Darkvision 90 ft. Languages: Common, Deep Speech, telepathy 30 ft. CR 1/8.
- **Traits:** Bonemonger (DC 12 WIS save when seeing a bone, or distracted until possesses/loses sight of bone; immune 1 hr after success)
- **Actions:** Bite (+3, 1d4+1 piercing), Detect Thoughts 1/Day (surface thoughts of 1 creature within 30 ft; action to probe deeper, DC 12 WIS save)
- **Improvements:**
  - Sneak Attack (companion prerequisite): Once per turn, +1d6 damage on Bite if advantage OR if enemy within 5 ft of target. Scales: +1d6 at tamer levels 3/5/9/13/17
  - Astral Enchanter I (3rd-level): Tamer gets +2 to Enchanting checks while summoned. Action: cast identify. 1/long rest
  - Mi! (3rd-level): Action, 60-ft range, CON save or 1d8 thunder + 1d8 psychic + frightened until end of dire bunny's next turn
  - Veracious Question (3rd-level): Dire bunny proficient in Persuasion and Intimidation. Tamer adds half PB to Insight/Intimidation/Persuasion. Bonus action to imbue question with magical truth: CHA save or creature blurts truthful answer. 2/short or long rest
  - Grasping Bonetide I (5th-level): Action, 30-ft cone or 15-ft radius circle: DEX save or 3d6 slashing + restrained until end of next turn. 1/short rest. (→5d6 at 9th)
  - Boney Carapace I (5th-level): +2 AC (unarmoured)
  - Springstrike (9th-level + Sneak Attack): Speed +10 ft. Action: move up to half speed without OAs and make one Bite attack
  - Uncanny Dodge (9th-level): Reaction to halve attack damage
  - Zone of Retributive Truth (9th-level + Veracious Question): Bonus action: manifest 20-ft aura for 1 minute. Bonus action each turn: ask one creature in aura a question; must answer truthfully or be thrown up to 20 ft. 1/short or long rest
  - Astral Enchanter II (13th-level + AE I): Additional +2 to Enchanting checks. Cast identify at will
  - Grasping Bonetide II (13th-level + GB I): 7d6 (→10d6 at 17th), 50-ft cone or 20-ft radius, +1 save DC
  - Boney Carapace II (13th-level + BC I): Additional +2 AC
  - Astral Enchanter III (17th-level + AE II): Additional +2 to Enchanting checks. Action: cast locate object. Ends early when dismissed
  - Bone Cage (17th-level + BC II): Additional +1 AC. Action: bone cage spell (self, 30-ft sphere). 1/long rest

---

### Slaghund Pup
- **Type:** Fiend
- **Component:** Hell hound + Owlbear
- **Bonus Improvement:** Growth I + +2 Hit Dice
- **Key Ability (Save DC):** Constitution
- **Base Stats:** Tiny fiend, chaotic neutral. AC 13 (natural), HP 4 (1d4+2). Speed 30 ft. STR +1, DEX +1, CON +2, INT -2, WIS 0, CHA 0. Skills: Perception +2. Vulnerabilities: cold. Immunities: fire. Darkvision 60 ft. CR 1/8.
- **Traits:** Heated Weapons (weapon attacks deal +1d4 fire). Heatable Body (bonus action to heat or cool body; while heated, creatures touching or hitting with melee within 5 ft take 1d4 fire). Reactionary Flame (on surprise: ignites flammable objects within 1 ft not worn/carried)
- **Actions:** Bite (+3, 1d6+1 piercing + 1d4 fire), Claws (+3, 1d4+1 piercing + 1d4 fire)
- **Improvements:**
  - Growth I (companion prerequisite): Size → Small, HD → d6. Bite → 1d8, Claws → 1d6
  - Keen Senses (3rd-level): Advantage on Perception checks
  - Hound's Speed (3rd-level): Speed +20 ft
  - Growth II (5th-level + Growth I): Size → Medium, HD → d8. Bite → 1d10, Claws → 1d8
  - Multiattack (5th-level): Action: one Bite + one Claws
  - Trailblazer (5th-level): Action while Heatable Body active: each space moved into bursts into 5-ft-high flames until next turn. Adjacent creature at start of turn: CON save or 1d4 fire/5-ft-square adjacent; in flames: 5d6 fire. (→1d6/7d6 at 9th)
  - Pack Tactics (9th-level + Keen Senses): Advantage on attacks if an ally is within 5 ft of target
  - White Hot (9th-level): Heatable Body and Heated Weapons deal 1d8 fire. Tamer gains fire resistance while slaghund is summoned
  - Growth III (13th-level + Growth II): Size → Large, HD → d10. Bite → 1d12, Claws → 1d10
  - Trailblazer II (13th-level + Trailblazer I): 1d8/9d6 (→1d10/12d6 at 17th), +1 save DC
  - Fiery Aura (17th-level + White Hot): Action while Heatable Body active: cast fire shield (warm shield, no material components). 1/long rest

---

### Tatzling
- **Type:** Dragon
- **Component:** Silver dragon
- **Bonus Improvement:** Growth I + +2 Hit Dice
- **Key Ability (Save DC):** Constitution
- **Base Stats:** Tiny dragon, lawful good. AC 14 (natural), HP 3 (1d4+1). Speed 30 ft. STR 0, DEX +2, CON +1, INT 0, WIS 0, CHA +1. Skills: Perception +2. Resistances: cold. Darkvision 60 ft. CR 1/8.
- **Traits:** Disaster Prone (natural 1 on attack/ability check → GM-determined disaster)
- **Actions:** Bite (+4, 1d6+2 piercing), Claw (+4, 1d4+2 slashing)
- **Reactions:** Protect 3/Day (impose disadvantage on attack targeting creature within 5 ft)
- **Improvements:**
  - Growth I (companion prerequisite): Size → Small, HD → d6. Bite → 1d8, Claws → 1d6
  - Harden I (3rd-level): +2 AC (unarmoured)
  - Cold Demeanour (3rd-level): Bonus action: temp HP = 3× tamer's PB for 1 minute; if hit with melee while temp HP active, attacker takes cold damage = 3× PB. 1/short or long rest
  - Growth II (5th-level + Growth I): Size → Medium, HD → d8. Bite → 1d10, Claws → 1d8
  - Multiattack (5th-level): Action: one Bite + one Claws
  - Slowing Gaze (5th-level): Action: one creature within 30 ft (can see it); CON save or under slow spell until: next turn (can extend with bonus action each turn), no line of sight, >60 ft away, or tatzling ends it. Tatzling has disadvantage on attacks against others. 1/short or long rest
  - Harden II (9th-level + Harden I): Additional +2 AC
  - Aura of Protection (9th-level): Friendly creatures within 10 ft add tatzling's CON mod (min +1) to saving throws
  - Growth III (13th-level + Growth II): Size → Large, HD → d10. Bite → 1d12, Claws → 1d10
  - Slowing Glare (13th-level + Slowing Gaze): Action: 40-ft cone, CON save or slow spell for 1 minute (repeat save at end of turns). 1/long rest. (→60-ft cone at 17th)
  - Freezing Blast (17th-level + Cold Demeanour): Tatzling gains cold immunity. Action: 20-ft radius CON save or 10d6 cold. Ice covers area for 1 minute (DEX saves or prone; tatzling auto-succeeds). 1/long rest

---

## APPENDIX A: KEY NUMBERS FOR FOUNDRY IMPLEMENTATION

### Rarity ↔ Essence ↔ Enchanting DC ↔ Time

| Rarity | Essence | DC | Consumable | Non-Att | Att |
|--------|---------|----|-----------:|--------:|----:|
| Common | None | 12 | 0.5 hrs | 1 hr | 2 hrs |
| Uncommon | Frail | 15 | 4 hrs | 10 hrs | 20 hrs |
| Rare | Robust | 18 | 20 hrs | 40 hrs | 80 hrs |
| Very Rare | Potent | 21 | 80 hrs | 160 hrs | 320 hrs |
| Legendary | Mythic | 25 | 320 hrs | 640 hrs | 1,280 hrs |
| Artifact | Deific | 30 | 50,000 hrs | 100,000 hrs | 200,000 hrs |

### Essence by CR

| CR Range | Essence Type |
|----------|-------------|
| 1–2 | None (no essence) |
| 3–6 | Frail |
| 7–11 | Robust |
| 12–17 | Potent |
| 18–24 | Mythic |
| 25+ | Deific |

### Item Save DCs by Rarity
Common 11 / Uncommon 13 / Rare 15 / Very Rare 16 / Legendary 17 / Artifact 18

### Harvest Time by Size
Tiny 5 min / Small 10 min / Medium 15 min / Large 30 min / Huge 2 hrs / Gargantuan 12 hrs

---

## APPENDIX B: MODULE FEATURE CHECKLIST

For a complete Foundry v14 module, implement:

**Core Features:**
- [ ] Harvesting Calculator (drag creature, auto-populate components from type, calculate Harvest DCs, roll assessment + carving, output results)
- [ ] Component Inventory (item type for tracking harvested components with creature type tag)
- [ ] Crafting Worksheet (select recipe, auto-populate requirements, roll checks, apply quirks)
- [ ] Cooking Interface (select recipe tier, pick components, roll CON + cook's utensils, apply effects)

**Data:**
- [ ] All 14 creature type harvest tables as compendium entries
- [ ] All essence types as items
- [ ] All mundane ingredient types with terrain DCs
- [ ] All magic item recipes (ammunition, armour, potions, rings, rods, scrolls, staves, wands, weapons, wondrous items)
- [ ] All staple and boss recipes
- [ ] All edible component effects by creature type and rarity
- [ ] All quirk tables (manufacturing flaws/boons, enchanting flaws/boons, cooking flaws/boons)
- [ ] All 7 familiars as actor templates with monster trainer progression

**Roll Tables:**
- [ ] Manufacturing Flaws (d20)
- [ ] Manufacturing Boons (d20/d12)
- [ ] Enchanting Flaws (d20)
- [ ] Enchanting Boons (d20)
- [ ] Cooking Flaws (d8)
- [ ] Cooking Boons (d8)
- [ ] Random Creature Type (d20 reroll 15+)
- [ ] Random Non-Physical Damage Type (d10)
- [ ] Random Skill (d20 reroll 19+)
- [ ] Random Elemental Cantrip (d6)
- [ ] Ooze Random Components (d100)

**Settings:**
- [ ] Optional rules toggles: metatags, ruining components (simplified/detailed), volatile components, failing with consequences, storage and supplies, trading, supply and demand per creature type
- [ ] Degradation window (default: 1 minute)
- [ ] Salvaging rules toggle

---

*End of reference document. All rules, items, and creatures are from L'Arsène's Crafting Catalogue v1.01 © 2023 Plane Shift Press LLC. This document is for personal use in building a Foundry VTT module.*
