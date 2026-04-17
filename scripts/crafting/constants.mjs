export const MODULE_ID = "helianas-mechanics";

export const TOOLS = {
  "alchemists-supplies":      { label: "Alchemist's Supplies",      ability: "int" },
  "brewers-supplies":         { label: "Brewer's Supplies",          ability: "int" },
  "calligraphers-supplies":   { label: "Calligrapher's Supplies",    ability: "dex" },
  "carpenters-tools":         { label: "Carpenter's Tools",          ability: "str" },
  "cartographers-tools":      { label: "Cartographer's Tools",       ability: "int" },
  "cobblers-tools":           { label: "Cobbler's Tools",            ability: "dex" },
  "cooks-utensils":           { label: "Cook's Utensils",            ability: "wis" },
  "glassblowers-tools":       { label: "Glassblower's Tools",        ability: "dex" },
  "jewelers-tools":           { label: "Jeweler's Tools",            ability: "dex" },
  "leatherworkers-tools":     { label: "Leatherworker's Tools",      ability: "dex" },
  "masons-tools":             { label: "Mason's Tools",              ability: "str" },
  "painters-supplies":        { label: "Painter's Supplies",         ability: "dex" },
  "potters-tools":            { label: "Potter's Tools",             ability: "dex" },
  "smiths-tools":             { label: "Smith's Tools",              ability: "str" },
  "tinkers-tools":            { label: "Tinker's Tools",             ability: "dex" },
  "weavers-tools":            { label: "Weaver's Tools",             ability: "dex" },
  "woodcarvers-tools":        { label: "Woodcarver's Tools",         ability: "dex" },
};

export const ESSENCE_TIERS = {
  frail:  { label: "Frail",  maxBoons: 1 },
  robust: { label: "Robust", maxBoons: 2 },
  potent: { label: "Potent", maxBoons: 3 },
  mythic: { label: "Mythic", maxBoons: 3 },
  deific: { label: "Deific", maxBoons: 3 },
};

export const ABILITY_LABELS = {
  str: "STR", dex: "DEX", con: "CON",
  int: "INT", wis: "WIS", cha: "CHA",
};

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
