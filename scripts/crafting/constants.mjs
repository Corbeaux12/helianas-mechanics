export const MODULE_ID = "helianas-mechanics";

export const TOOLS = {
  "alchemists-supplies":      { label: "Alchemist's Supplies",      abilities: ["int"] },
  "brewers-supplies":         { label: "Brewer's Supplies",          abilities: ["int"] },
  "calligraphers-supplies":   { label: "Calligrapher's Supplies",    abilities: ["dex"] },
  "carpenters-tools":         { label: "Carpenter's Tools",          abilities: ["dex", "str"] },
  "cartographers-tools":      { label: "Cartographer's Tools",       abilities: ["dex", "int"] },
  "cobblers-tools":           { label: "Cobbler's Tools",            abilities: ["dex", "int"] },
  "cooks-utensils":           { label: "Cook's Utensils",            abilities: ["wis"] },
  "glassblowers-tools":       { label: "Glassblower's Tools",        abilities: ["con", "dex"] },
  "jewelers-tools":           { label: "Jeweler's Tools",            abilities: ["dex"] },
  "leatherworkers-tools":     { label: "Leatherworker's Tools",      abilities: ["dex"] },
  "masons-tools":             { label: "Mason's Tools",              abilities: ["str"] },
  "painters-supplies":        { label: "Painter's Supplies",         abilities: ["dex"] },
  "potters-tools":            { label: "Potter's Tools",             abilities: ["dex"] },
  "smiths-tools":             { label: "Smith's Tools",              abilities: ["con", "str"] },
  "tinkers-tools":            { label: "Tinker's Tools",             abilities: ["dex"] },
  "weavers-tools":            { label: "Weaver's Tools",             abilities: ["con", "dex"] },
  "woodcarvers-tools":        { label: "Woodcarver's Tools",         abilities: ["dex", "str"] },
};

export const ESSENCE_TIERS = {
  frail:  { label: "Frail",  maxBoons: 1 },
  robust: { label: "Robust", maxBoons: 2 },
  potent: { label: "Potent", maxBoons: 3 },
  mythic: { label: "Mythic", maxBoons: 3 },
  deific: { label: "Deific", maxBoons: 3 },
};

// Ordered weakest→strongest; used to filter essence choices by a recipe's
// minimum required tier. "" (no requirement) ranks as 0 so any tier qualifies.
export const ESSENCE_TIER_ORDER = {
  "":       0,
  frail:    1,
  robust:   2,
  potent:   3,
  mythic:   4,
  deific:   5,
};

// Enchanting / forge result-slot auto-fill table.
// Columns map to item "kind" detected from the dropped Item:
//   consumable     → item.type === "consumable"
//   attunement     → item.system.attunement is "required" or "optional"
//   non-attunement → everything else
export const MAGIC_RARITY_TABLE = {
  common:      { tier: "",       dc: 12, consumable: 0.5, "non-attunement":      1, attunement:      2 },
  uncommon:    { tier: "frail",  dc: 15, consumable: 4,   "non-attunement":     10, attunement:     20 },
  rare:        { tier: "robust", dc: 18, consumable: 20,  "non-attunement":     40, attunement:     80 },
  "very rare": { tier: "potent", dc: 21, consumable: 80,  "non-attunement":    160, attunement:    320 },
  legendary:   { tier: "mythic", dc: 25, consumable: 320, "non-attunement":    640, attunement:   1280 },
  artifact:    { tier: "deific", dc: 30, consumable: 50000, "non-attunement": 100000, attunement: 200000 },
};

// Manufacturing DC & Time table keyed by a normalized item sub-type. Picked by
// detectMfgSubtype() based on the dnd5e item's type/subtype/baseItem.
export const MFG_ITEM_TABLE = {
  "adventuring-gear":     { dc: 11, hours:   2 },
  "ammunition":           { dc: 13, hours:   1 },
  "padded-hide-shield":   { dc: 13, hours:   8 },
  "leather-chain-ring":   { dc: 15, hours:  16 },
  "chain-mail":           { dc: 16, hours:  32 },
  "studded-scale":        { dc: 17, hours:  24 },
  "breastplate-splint":   { dc: 18, hours:  40 },
  "half-plate":           { dc: 19, hours:  80 },
  "plate":                { dc: 20, hours: 200 },
  "instrument":           { dc: 15, hours:  16 },
  "potion-base":          { dc: 15, hours:   2 },
  "ring":                 { dc: 15, hours:   8 },
  "rod-staff-wand":       { dc: 17, hours:   8 },
  "spell-scroll-base":    { dc: 15, hours:   2 },
  "simple-weapon":        { dc: 14, hours:   8 },
  "martial-weapon":       { dc: 17, hours:  16 },
  "magitech-firearm":     { dc: 19, hours:  24 },
  "wondrous-item":        { dc: 15, hours:   8 },
};

export const ABILITY_LABELS = {
  str: "STR", dex: "DEX", con: "CON",
  int: "INT", wis: "WIS", cha: "CHA",
};

export const INGREDIENT_TAGS = [
  "metal", "wood", "leather", "cloth", "stone",
  "gem", "herb", "bone", "scale", "hide",
  "essence", "reagent", "tool", "ferrous",
];

export const CREATURE_TYPE_SKILLS = {
  aberration: "Arcana",
  beast:      "Survival",
  celestial:  "Religion",
  construct:  "Arcana",
  dragon:     "Survival",
  elemental:  "Arcana",
  fey:        "Arcana",
  fiend:      "Religion",
  giant:      "Survival",
  humanoid:   "Medicine",
  monstrosity:"Survival",
  ooze:       "Arcana",
  plant:      "Nature",
  undead:     "Religion",
};

export const MFG_FLAWS = [
  { name: "Artisan's Burden", effect: "The item weighs twice as much as normal." },
  { name: "Crude Make",       effect: "The item's gold value is halved." },
  { name: "Flimsy",           effect: "The item has half its normal hit points." },
  { name: "Handiwork",        effect: "−1 to attack and damage rolls. Cumulative." },
  { name: "Heavy",            effect: "Imposes disadvantage on Dexterity (Stealth) checks." },
  { name: "Ill-Balanced",     effect: "The item imposes −1 penalty to attack rolls. Cumulative." },
  { name: "Ill-Fitted",       effect: "Wearing or wielding the item takes a bonus action instead of an action." },
  { name: "Impure",           effect: "The item's saving throw DC is reduced by 1. Cumulative." },
  { name: "Loud",             effect: "The item makes noise; disadvantage on Stealth checks." },
  { name: "Makeshift",        effect: "The item breaks on a roll of 1 (weapons) or a critical hit (armour)." },
  { name: "Misshapen",        effect: "The item has −1 AC (armour) or −1 to damage (weapons). Cumulative." },
  { name: "Primitive",        effect: "The item is not considered a proper weapon or armour of its type." },
  { name: "Rough",            effect: "Handling the item causes 1 point of damage per round." },
  { name: "Rusted",           effect: "Attacks with this weapon impose disadvantage on the first attack each combat." },
  { name: "Sharp Edges",      effect: "The wielder takes 1 piercing damage on a natural 1." },
  { name: "Shoddy Grip",      effect: "On a natural 1, the item is dropped in a random adjacent space." },
  { name: "Squeaky",          effect: "Disadvantage on Stealth checks while wearing or wielding." },
  { name: "Tarnished",        effect: "The item's gold value is reduced by 25%." },
  { name: "Unbalanced",       effect: "−2 to initiative rolls while wielding." },
  { name: "Warped",           effect: "The item has a permanent, unfixable cosmetic defect." },
];

export const MFG_BOONS = [
  { name: "Balanced",    effect: "+1 to initiative rolls while wielding." },
  { name: "Beautiful",   effect: "The item's gold value is doubled." },
  { name: "Durable",     effect: "Item hit points are tripled." },
  { name: "Elegant",     effect: "Grants advantage on Charisma checks while wielding or wearing." },
  { name: "Fearsome",    effect: "The item's appearance imposes disadvantage on enemy Morale checks." },
  { name: "Fine Make",   effect: "+1 to attack and damage rolls. Cumulative." },
  { name: "Keen Edge",   effect: "The item scores a critical hit on 19–20." },
  { name: "Lightweight", effect: "The item weighs half as much as normal." },
  { name: "Lucky",       effect: "Once per day, reroll one attack roll or saving throw made with this item." },
  { name: "Masterwork",  effect: "+1 to attack rolls. Cumulative." },
  { name: "Polished",    effect: "Advantage on the first attack in combat." },
  { name: "Precise",     effect: "+1 to saving throw DCs. Cumulative." },
  { name: "Quick Draw",  effect: "Drawing or stowing the item is a free action." },
  { name: "Reinforced",  effect: "AC is increased by 1 (armour only). Cumulative." },
  { name: "Resplendent", effect: "Grants advantage on Persuasion checks while wearing." },
  { name: "Sharp",       effect: "+1 to damage rolls. Cumulative." },
  { name: "Silent",      effect: "The item makes no noise; advantage on Stealth checks." },
  { name: "Sturdy",      effect: "The item has resistance to non-magical bludgeoning, piercing, and slashing damage." },
  { name: "Swift",       effect: "Once per combat, you can attack as a bonus action." },
  { name: "True Strike",  effect: "Once per short rest, treat one attack roll as a natural 20." },
];

export const ENC_FLAWS = [
  { name: "Backlash",       effect: "When first attuned, the wearer takes 1d10 force damage." },
  { name: "Bound Spirit",   effect: "The item whispers at night; disadvantage on the first Wisdom save each long rest." },
  { name: "Dim Aura",       effect: "The item's magical effects are suppressed within 5 ft of another magic item of equal or greater rarity." },
  { name: "Draining",       effect: "Each activation costs the user 1 extra hit point." },
  { name: "Finicky",        effect: "The item only functions for one attuned creature at a time, chosen on creation." },
  { name: "Flickering Glyph", effect: "On a natural 1 while activating the item, the effect fails and the charge (if any) is expended." },
  { name: "Hungry",         effect: "The item must 'taste' a drop of blood from its bearer each dawn or cease functioning until fed." },
  { name: "Jealous",        effect: "While attuned, the bearer has disadvantage on saves against other magic items trying to replace attunement." },
  { name: "Leaky Essence",  effect: "The item radiates detectable magic at twice the normal range." },
  { name: "Misaligned",     effect: "The item's save DC is 1 lower than normal. Cumulative." },
  { name: "Restless",       effect: "The item vibrates in its sheath during combat, noisy and disruptive." },
  { name: "Short Fuse",     effect: "Once per long rest, when you critically fail with the item, its charges (if any) reset to 0." },
  { name: "Temperamental",  effect: "On a natural 1 with an attack or save using the item, roll on the Wild Magic surge table." },
  { name: "Unstable",       effect: "The first use after a long rest requires an INT save DC 12 or the effect targets the bearer." },
  { name: "Whispering",     effect: "The item speaks out of turn once per session at the GM's discretion." },
];

export const ENC_BOONS = [
  { name: "Ambient Light",   effect: "The item sheds dim light in a 5-ft radius at will." },
  { name: "Attuned Twin",    effect: "Attunement does not count against the bearer's normal limit." },
  { name: "Bonded",          effect: "The item cannot be disarmed or stolen except by the bearer." },
  { name: "Deep Well",       effect: "The item has one extra charge (if it has charges) or one extra daily use." },
  { name: "Eidolon",         effect: "The item's magical effect ignores one common counter (e.g. silence, antimagic) once per long rest." },
  { name: "Empathic",        effect: "The bearer senses the emotional state of attuned creatures within 30 ft." },
  { name: "Ever-Bright",     effect: "The item never tarnishes, rusts, or dims even under powerful antimagic." },
  { name: "Focused",         effect: "+1 to the item's save DC. Cumulative." },
  { name: "Harmonious",      effect: "Attuning to the item takes 10 minutes instead of the normal hour." },
  { name: "Piercing Light",  effect: "Magical effects from the item ignore resistance to force damage." },
  { name: "Resonant",        effect: "When the bearer casts a cantrip using the item as a focus, they add +1 damage." },
  { name: "Sanctified",      effect: "The item resists sundering; advantage on saves made by the item." },
  { name: "Spiritguard",     effect: "Grants the bearer advantage on death saving throws once per long rest." },
  { name: "Surging",         effect: "Once per long rest, the item's charges refill by 1 on a natural 20 with any d20 roll." },
  { name: "Untiring",        effect: "The item does not require recharging at dawn; it recharges on any long rest." },
];

export const FRG_FLAWS = [
  { name: "Cold Forge",     effect: "The item's magical effect deals 1 less damage. Cumulative." },
  { name: "Crossed Glyphs", effect: "On a natural 1, both the weapon's attack and its magical effect fail." },
  { name: "Disharmonic",    effect: "The mundane and magical sides of the item conflict; −1 to attack rolls OR −1 to save DC (wielder picks each use)." },
  { name: "Half-Bound",     effect: "The item loses its magic if attuned by a creature without proficiency in the relevant tool." },
  { name: "Hot-Headed",     effect: "The item emits heat; disadvantage on Stealth in cold climates, can't be used during a long rest." },
  { name: "Overwrought",    effect: "Item weighs twice as much and deals +1 damage to the wielder on a critical miss." },
  { name: "Seamed",         effect: "Visible forge seams glow under magic detection; cannot be hidden by illusion." },
  { name: "Strained",       effect: "Item breaks on a natural 1 and cannot be repaired without re-forging." },
  { name: "Twinned Flaw",   effect: "Roll once on MFG flaws and once on ENC flaws — the item gains both." },
  { name: "Unsynced",       effect: "The item's charges reset at dusk, not dawn." },
];

export const FRG_BOONS = [
  { name: "Adamant Core",    effect: "Item is immune to non-magical damage." },
  { name: "Dual Attuned",    effect: "The item grants the wielder one additional use of their lowest-level spell slot per long rest." },
  { name: "Forge-Sealed",    effect: "Item cannot be targeted by antimagic of 5th level or lower." },
  { name: "Harmonised",      effect: "+1 to both attack rolls and save DCs when wielding. Cumulative to +2." },
  { name: "Living Metal",    effect: "Item self-repairs 1 hp per hour if not reduced to 0 hp." },
  { name: "Runeforged",      effect: "Grants resistance to one damage type (chosen at creation)." },
  { name: "Soulbond",        effect: "The item returns to the wielder's hand at the start of their turn if within 30 ft." },
  { name: "Storm-Tempered",  effect: "When wielded during a thunderstorm, attacks deal +1d4 lightning damage." },
  { name: "Twinned Boon",    effect: "Roll once on MFG boons and once on ENC boons — the item gains both." },
  { name: "Warded",          effect: "Grants the wielder advantage on saves vs. spells of 3rd level or lower." },
];

export const COOK_FLAWS = [
  { name: "Bland",         effect: "The meal provides no nourishment; it counts as rations only, no buff granted." },
  { name: "Burnt",         effect: "Eating the meal costs 1 hit point." },
  { name: "Gassy",         effect: "For 1 hour after eating, disadvantage on Stealth checks." },
  { name: "Greasy",        effect: "The meal's container is unusable for future cooking; discard it." },
  { name: "Half-Cooked",   effect: "The eater must succeed on a CON save DC 10 or be poisoned for 10 minutes." },
  { name: "Heavy",         effect: "After eating, the eater's speed is reduced by 5 ft for 1 hour." },
  { name: "Oversalted",    effect: "The eater must drink double rations of water for the next day or gain one level of exhaustion." },
  { name: "Repulsive",     effect: "The meal smells foul; disadvantage on Charisma checks for 1 hour after eating." },
  { name: "Runny",         effect: "Half the meal spills on preparation; only half the normal number of servings produced." },
  { name: "Scalding",      effect: "The first bite deals 1 fire damage." },
];

export const COOK_BOONS = [
  { name: "Aromatic",      effect: "While the meal remains hot (1 hour), eaters gain advantage on Wisdom (Perception) checks that rely on smell." },
  { name: "Fortifying",    effect: "Grants the eater temporary hit points equal to their proficiency bonus for 1 hour." },
  { name: "Hearty",        effect: "Counts as a full meal even for creatures that normally require double rations." },
  { name: "Invigorating",  effect: "Reduces one level of exhaustion when finished (once per long rest per eater)." },
  { name: "Lively",        effect: "Advantage on the next initiative roll, within 1 hour of eating." },
  { name: "Nourishing",    effect: "The eater regains an additional hit die worth of HP during their next short rest." },
  { name: "Restorative",   effect: "Removes the effects of one disease or poison of common or lower tier." },
  { name: "Savoury",       effect: "Advantage on the next Charisma (Persuasion) check, within 1 hour of eating." },
  { name: "Soothing",      effect: "Grants advantage on saves against fear for 1 hour after eating." },
  { name: "Warming",       effect: "The eater is immune to the effects of extreme cold for 1 hour." },
];

/**
 * Lookup: recipeType → { flaws, boons } table pair used by QuirkEngine.
 * Falls back to MFG_* for unknown or unset types.
 */
export const QUIRK_TABLES = {
  manufacturing: { flaws: MFG_FLAWS,  boons: MFG_BOONS  },
  enchanting:    { flaws: ENC_FLAWS,  boons: ENC_BOONS  },
  forging:       { flaws: FRG_FLAWS,  boons: FRG_BOONS  },
  cooking:       { flaws: COOK_FLAWS, boons: COOK_BOONS },
};
