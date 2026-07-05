/**
 * Builds the module's recipe compendium packs from the bundled catalogue.
 *
 *   node tools/build-packs.mjs        (or: npm run build:packs)
 *
 * Generates JSON sources under packs-src/ (committed, reviewable) and
 * compiles them into the LevelDB packs under packs/:
 *
 *   manufacturing-recipes  — mundane base-item recipes from the
 *                            "Manufacturing DC & Time" table (Part 5)
 *   forge-recipes          — every Part 7 magic-item row, one journal per
 *                            section, each linked to a base recipe
 *   cooking-recipes        — Part 8 staple + boss monster recipes
 *
 * Document _ids are deterministic (derived from names), so rebuilding after
 * a catalogue change produces stable diffs and preserves cross-pack links.
 * The mundane-items and recipe-books packs are hand-authored in Foundry and
 * are NOT touched by this script.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_ID = "helianas-mechanics";
const PAGE_TYPE = `${MODULE_ID}.recipe`;

// Minimal Foundry mock so RecipeImporter can be imported outside Foundry.
let idCounter = 0;
globalThis.foundry = { utils: { randomID: () => `tmp${String(idCounter++).padStart(13, "0")}` } };

const { parseCatalogueMarkdown, buildRecipeSystem } =
  await import(new URL("../scripts/crafting/RecipeImporter.mjs", import.meta.url));

// ------------------------------------------------------------ item resolver
//
// Recipes link real items from the Heliana modules + dnd5e SRD packs.
// tools/data/heliana-item-index.json is generated from the installed modules
// (heliana-core, helianas-harvesting, dnd5e, and our own mundane-items pack)
// and maps item names to compendium UUIDs.

const ITEM_INDEX = JSON.parse(
  readFileSync(path.join(ROOT, "tools", "data", "heliana-item-index.json"), "utf8"));

const PHYSICAL_TYPES = new Set(["weapon", "equipment", "consumable", "tool", "loot", "container"]);

/** Pack priority when several packs contain the same item name. */
function packRank(pack, forComponent) {
  const order = forComponent
    ? ["helianas-harvesting.dnd5e-components", /^heliana-core\./, "helianas-mechanics.mundane-items", /^dnd5e\./]
    : ["heliana-core.magical-items", /^heliana-core\.items-/, "heliana-core.items",
       "dnd5e.equipment24", "dnd5e.items", "dnd5e.tradegoods", "helianas-mechanics.mundane-items"];
  for (let i = 0; i < order.length; i++) {
    const o = order[i];
    if (typeof o === "string" ? pack === o : o.test(pack)) return i;
  }
  return order.length;
}

/** Normalise a name for matching: straight quotes, collapsed spaces, lowercase. */
function normKey(name) {
  return String(name).replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, " ").trim().toLowerCase();
}

const NAME_LOOKUP = new Map();
for (const item of ITEM_INDEX.items) {
  if (!PHYSICAL_TYPES.has(item.type)) continue;
  const key = normKey(item.name);
  if (!NAME_LOOKUP.has(key)) NAME_LOOKUP.set(key, []);
  NAME_LOOKUP.get(key).push(item);
}

function lookup(candidates, { forComponent = false } = {}) {
  for (const cand of candidates) {
    const hits = NAME_LOOKUP.get(normKey(cand));
    if (hits?.length) {
      return [...hits].sort((a, b) => packRank(a.pack, forComponent) - packRank(b.pack, forComponent))[0];
    }
  }
  return null;
}

// Catalogue name → official base name(s). Applied before other transforms.
const RESULT_ALIASES = {
  "heliana's guide":               "Heliana's Guide to Monster Hunting",
  "bonze's bokken wind ripper":    "Bonze's Bokken, Wind Ripper",
  "amulet of proof vs detection":  "Amulet of Proof against Detection and Location",
  "stone of good luck":            "Stone of Good Luck (Luckstone)",
  "bag of tricks":                 "Gray Bag of Tricks",
  "manual of clay golems":         "Manual of Golems",
  "manual of flesh golems":        "Manual of Golems",
  "manual of iron golems":         "Manual of Golems",
  "manual of stone golems":        "Manual of Golems",
  "figurine: ivory goats":         "Figurine of Wondrous Power (Ivory Goat of Travail)",
  "feline's fury":                 "Feline's Fury Light Tommybow",
  "+1 ammunition":                 "Ammunition, +1, +2, or +3",
  "+2 ammunition":                 "Ammunition, +1, +2, or +3",
  "+3 ammunition":                 "Ammunition, +1, +2, or +3",
  // Wyrm's Breath Grenades are named for the dragon's gas breath, not its metal
  "wyrm's breath grenade (brass)":  "Wyrm's Breath Grenade (Sleep)",
  "wyrm's breath grenade (bronze)": "Wyrm's Breath Grenade (Repulsion)",
  "wyrm's breath grenade (copper)": "Wyrm's Breath Grenade (Slow)",
  "wyrm's breath grenade (gold)":   "Wyrm's Breath Grenade (Weakening)",
  "wyrm's breath grenade (silver)": "Wyrm's Breath Grenade (Paralysing)",
};

// Representative concrete variants for "any X" template items, tried in order.
const VARIANT_FAMILIES = [
  { test: /\(any [^)]*axe/i,      variants: ["Battleaxe", "Greataxe", "Handaxe"] },
  { test: /\(any [^)]*hammer/i,   variants: ["Warhammer", "Maul", "Light Hammer", "Mace", "Club", "Greatclub"] },
  { test: /\(any [^)]*bow/i,      variants: ["Longbow", "Shortbow"] },
  { test: /\(any [^)]*sword/i,    variants: ["Longsword", "Greatsword", "Shortsword", "Scimitar", "Rapier"] },
  { test: /\(any [^)]*polearm/i,  variants: ["Halberd", "Glaive", "Spear", "Pike", "Quarterstaff"] },
  { test: /\(any two melee/i,     variants: ["Longsword", "Shortsword"] },
  { test: /longsword or greatsword/i, variants: ["Longsword", "Greatsword"] },
  { test: /tommybow/i,            variants: ["Light Tommybow", "Hand Tommybow", "Heavy Tommybow"] },
];
const SECTION_VARIANTS = {
  Rods:   ["Rod", "Staff", "Wand"],
  Armour: ["Breastplate", "Plate Armor", "Half Plate", "Chain Mail", "Chain Shirt", "Ring Mail", "Scale Mail"],
};

const RARITY_LABEL = { C: "Common", U: "Uncommon", R: "Rare", V: "Very Rare", L: "Legendary", A: "Artifact" };

/** Strip catalogue annotations: trailing footnote stars and "(any sword)"-style notes. */
function cleanItemName(name) {
  return name.replace(/\*+$/, "")
    .replace(/\s*\((any|all|each|see)[^)]*\)\s*/gi, " ")
    .replace(/\s+/g, " ").trim();
}

/** Candidate official names for a catalogue item name (optionally rarity-tiered). */
function resultCandidates(name, tierLabel, { rawName = "", section = "", tierIndex = 0 } = {}) {
  const alias = RESULT_ALIASES[normKey(name)] ?? RESULT_ALIASES[normKey(rawName)];
  if (alias) name = alias;

  const out = [];
  if (tierLabel) out.push(`${name} (${tierLabel})`);
  out.push(name);
  let m;
  if ((m = /^Potion of (Greater|Superior|Supreme) Healing$/i.exec(name))) {
    out.push(`Potion of Healing (${m[1]})`);
  }
  if ((m = /^\+(\d) (.+)$/.exec(name))) {
    out.push(`${m[2]}, +${m[1]}`, `${m[2]} +${m[1]}`, `${m[2]}, +1, +2, or +3`);
  }
  if (/^Rod of the Pact Keeper$/i.test(name)) {
    out.push(`Rod of the Pact Keeper, +${tierIndex + 1}`, `Rod of the Pact Keeper +${tierIndex + 1}`);
  }
  if ((m = /^(\d)(?:st|nd|rd|th)-level Scroll$/i.exec(name))) {
    const ord = m[1] + (["st", "nd", "rd"][m[1] - 1] ?? "th");
    out.push(`Spell Scroll, ${ord} Level`, `Spell Scroll (${ord} Level)`);
  }
  if (/^Cantrip Scroll$/i.test(name)) {
    out.push("Spell Scroll, Cantrip", "Spell Scroll (Cantrip)");
  }
  if ((m = /^Belt of Giant Strength \((\w+)\)$/i.exec(name))) {
    out.push(`Belt of ${m[1]} Giant Strength`);
  }
  if ((m = /^Figurine: (.+)$/.exec(name))) {
    out.push(`Figurine of Wondrous Power (${m[1]})`, `Figurine of Wondrous Power, ${m[1]}`, `${m[1]} Figurine`);
  }
  if ((m = /^(.+) \(([^)]+)\)$/.exec(name))) {
    if (tierLabel) out.push(`${m[1]} (${m[2]}) (${tierLabel})`);
    out.push(`${m[2]} ${m[1]}`, m[1]);              // "Horn of Valhalla (Brass)" → "Brass Horn of Valhalla", "Horn of Valhalla"
    if (tierLabel) out.push(`${m[1]} (${tierLabel})`);
  }

  // "any weapon/armour" template items ship as one item per concrete weapon:
  // try representative variants in several official orderings.
  let variants = VARIANT_FAMILIES.find(f => f.test.test(rawName))?.variants
    ?? SECTION_VARIANTS[section];
  if (variants && tierLabel) {
    const noParen = name.replace(/\s*\([^)]*\)\s*$/, "");  // "Pneuma Blade (longsword or greatsword)" → "Pneuma Blade"
    const baseNoLast = noParen.replace(/\s+\S+$/, "");     // "Pneuma Blade" → "Pneuma"
    for (const v of variants) {
      out.push(`${noParen} ${v} (${tierLabel})`,     // Haemstrike Warhammer (Rare)
               `${noParen} (${tierLabel}) ${v}`,     // Sunwing Bow (Uncommon) Longbow
               `${noParen} (${v}) (${tierLabel})`,   // Bonze's Bokken, Wind Ripper (Longsword) (Uncommon)
               `${baseNoLast} ${v} (${tierLabel})`); // Pneuma Longsword (Rare); Splinterspray Light Tommybow (Uncommon)
    }
  }
  return out;
}

function resolveResult(name, tierLabel = null, ctx = {}) {
  return lookup(resultCandidates(name, tierLabel, ctx));
}

/** Candidate harvesting-item names for a catalogue component + creature type. */
function resolveComponent(rawName, creatureType) {
  const name = rawName.trim();
  const type = creatureType ? creatureType[0].toUpperCase() + creatureType.slice(1).toLowerCase() : "";
  const singular = name.replace(/s$/i, "");
  const out = [];
  let m;
  if ((m = /^(Pouch of|Phial of|Bundle of)\s+(.+)$/i.exec(name)) && type) {
    out.push(`${m[1]} ${type} ${m[2]}`);
  }
  if ((m = /^(Volatile mote of|Core of)\s+(.+)$/i.exec(name))) {
    out.push(`${m[1]} Elemental ${m[2]}`);
    if (type) out.push(`${m[1]} ${type} ${m[2]}`);
  }
  if (type) {
    out.push(`${type} ${name}`);
    if (singular !== name) out.push(`${type} ${singular}`);          // Tusks → Beast Tusk
    if (/^skin$/i.test(name)) out.push(`${type} Pelt`, `${type} Hide`); // no "Monstrosity Skin" — pelt/hide instead
  }
  out.push(name, `${name} Ingot`);
  return lookup(out, { forComponent: true });
}

/** Creature types for a row: the schema field, or all types from cells like "Celestial/Fiend". */
function rowCreatureTypes(row, schemaType) {
  if (schemaType) return [schemaType];
  return String(row.type ?? "").split(/\s*(?:AND|\/|,)\s*/i)
    .map(t => t.trim().toLowerCase()).filter(t => /^[a-z]+$/.test(t));
}

/** Split a rarity cell into tier letters: "U/R/V" → ["U","R","V"], "R→V" → ["R"]. */
function tierLetters(rarityCell) {
  const parts = String(rarityCell ?? "").split("/").map(p => {
    const m = /([CURVLA])/i.exec(p);
    return m ? m[1].toUpperCase() : null;
  }).filter(Boolean);
  return parts.length ? parts : ["C"];
}

// ------------------------------------------------------------------ helpers

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Deterministic 16-char Foundry document id from a seed string. */
function did(seed) {
  const h = createHash("sha256").update(`helianas:${seed}`).digest();
  let out = "";
  for (let i = 0; i < 16; i++) out += ALPHABET[h[i] % ALPHABET.length];
  return out;
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Build a component entry matching the RecipePageData component schema. */
function comp(seed, name, quantity = 1, tags = []) {
  return {
    id: did(`comp:${seed}:${name}`), uuid: "", name, nameMode: "exact",
    img: "", quantity, tags, mode: "some", resourcePath: "",
  };
}

function ingredient(seed, name, components) {
  return { id: did(`ing:${seed}:${name}`), name, components };
}

function pageDoc(journalSeed, name, system, sort) {
  return {
    _id: did(`page:${journalSeed}:${name}`),
    name,
    type: PAGE_TYPE,
    system,
    title: { show: true, level: 1 },
    sort,
    ownership: { default: -1 },
    flags: {},
  };
}

function journalDoc(seed, name, pages, sort = 0) {
  const _id = did(`journal:${seed}`);
  for (const p of pages) p._key = `!journal.pages!${_id}.${p._id}`;
  return {
    _id,
    _key: `!journal!${_id}`,
    name,
    pages,
    folder: null,
    sort,
    ownership: { default: 0 },
    flags: {},
  };
}

function recipeSystem(overrides) {
  return {
    recipeType: "manufacturing",
    resultName: "", resultImg: "", resultUuid: "", resultQuantity: 1,
    dc: 15, timeHours: 8, toolKey: "", toolAbility: "",
    ingredients: [],
    essenceTierRequired: "", componentCreatureType: "", rarity: "", attunement: "none",
    baseItemRecipeUuid: "", enchantingDc: 15, enchantingTimeHours: 8,
    ...overrides,
  };
}

// ------------------------------------------------------ manufacturing pack
//
// Base-item recipes from the "Manufacturing DC & Time" table. Ingredient
// quantities are module defaults (the catalogue only prices materials at
// ~1/3 item value); component names/tags match the mundane-items pack.

const IRON    = (s, q) => comp(s, "Iron Ingot", q, ["iron", "ingot", "metal"]);
const LEATHER = (s, q) => comp(s, "Leather", q, ["leather", "hide"]);
const CLOTH   = (s, q) => comp(s, "Cotton Cloth", q, ["cotton", "cloth"]);
const PLANK   = (s, q) => comp(s, "Basic Wood Plank", q, ["basic", "wood", "plank"]);
const EXPLANK = (s, q) => comp(s, "Exotic Wood Plank", q, ["exotic", "wood", "plank"]);
const EXPOLE  = (s, q) => comp(s, "Exotic Wood Pole", q, ["exotic", "wood", "pole"]);

const BASE_RECIPES = [
  { name: "Adventuring Gear", tool: "tinkers-tools", dc: 11, hours: 2, ings: s => [
    ingredient(s, "Materials", [IRON(s, 1), PLANK(s, 1), LEATHER(s, 1), CLOTH(s, 1)]) ] },
  { name: "Ammunition", tool: "carpenters-tools", dc: 13, hours: 1, qty: 20, ings: s => [
    ingredient(s, "Shafts", [PLANK(s, 1)]), ingredient(s, "Heads", [IRON(s, 1)]) ] },
  { name: "Padded Armor", tool: "weavers-tools", dc: 13, hours: 8, ings: s => [
    ingredient(s, "Cloth", [CLOTH(s, 4)]) ] },
  { name: "Hide Armor", tool: "leatherworkers-tools", dc: 13, hours: 8, ings: s => [
    ingredient(s, "Hides", [LEATHER(s, 4)]) ] },
  { name: "Shield", tool: "carpenters-tools", dc: 13, hours: 8, ings: s => [
    ingredient(s, "Wood", [PLANK(s, 3)]) ] },
  { name: "Leather Armor", tool: "leatherworkers-tools", dc: 15, hours: 16, ings: s => [
    ingredient(s, "Leather", [LEATHER(s, 5)]) ] },
  { name: "Chain Shirt", tool: "smiths-tools", dc: 15, hours: 16, ings: s => [
    ingredient(s, "Metal stock", [IRON(s, 6)]) ] },
  { name: "Ring Mail", tool: "smiths-tools", dc: 15, hours: 16, ings: s => [
    ingredient(s, "Metal stock", [IRON(s, 8)]), ingredient(s, "Backing", [LEATHER(s, 2)]) ] },
  { name: "Chain Mail", tool: "smiths-tools", dc: 16, hours: 32, ings: s => [
    ingredient(s, "Metal stock", [IRON(s, 10)]) ] },
  { name: "Studded Leather Armor", tool: "leatherworkers-tools", dc: 17, hours: 24, ings: s => [
    ingredient(s, "Leather", [LEATHER(s, 5)]), ingredient(s, "Studs", [IRON(s, 1)]) ] },
  { name: "Scale Mail", tool: "smiths-tools", dc: 17, hours: 24, ings: s => [
    ingredient(s, "Metal stock", [IRON(s, 8)]), ingredient(s, "Backing", [LEATHER(s, 2)]) ] },
  { name: "Breastplate", tool: "smiths-tools", dc: 18, hours: 40, ings: s => [
    ingredient(s, "Metal stock", [IRON(s, 8)]), ingredient(s, "Fittings", [LEATHER(s, 1)]) ] },
  { name: "Splint Armor", tool: "smiths-tools", dc: 18, hours: 40, ings: s => [
    ingredient(s, "Metal stock", [IRON(s, 10)]), ingredient(s, "Fittings", [LEATHER(s, 1)]) ] },
  { name: "Half Plate Armor", tool: "smiths-tools", dc: 19, hours: 80, ings: s => [
    ingredient(s, "Metal stock", [IRON(s, 12)]), ingredient(s, "Fittings", [LEATHER(s, 2)]) ] },
  { name: "Plate Armor", tool: "smiths-tools", dc: 20, hours: 200, ings: s => [
    ingredient(s, "Metal stock", [IRON(s, 16)]), ingredient(s, "Fittings", [LEATHER(s, 2)]) ] },
  { name: "Instrument", tool: "woodcarvers-tools", dc: 15, hours: 16, ings: s => [
    ingredient(s, "Wood", [EXPLANK(s, 2)]) ] },
  { name: "Potion Base", tool: "alchemists-supplies", dc: 15, hours: 2, ings: s => [
    ingredient(s, "Vessel", [comp(s, "Bottle, Glass", 1, ["bottle", "glass"])]) ] },
  { name: "Ring", tool: "jewelers-tools", dc: 15, hours: 8, ings: s => [
    ingredient(s, "Precious metal", [
      comp(s, "Gold Ingot", 1, ["gold", "ingot"]),
      comp(s, "Silver Ingot", 1, ["silver", "ingot"]),
      comp(s, "Platinum Ingot", 1, ["platinum", "ingot"]),
    ]) ] },
  { name: "Rod", tool: "smiths-tools", dc: 17, hours: 8, ings: s => [
    ingredient(s, "Metal stock", [IRON(s, 2)]) ] },
  { name: "Staff", tool: "woodcarvers-tools", dc: 17, hours: 8, ings: s => [
    ingredient(s, "Wood", [EXPOLE(s, 1)]) ] },
  { name: "Wand", tool: "woodcarvers-tools", dc: 17, hours: 8, ings: s => [
    ingredient(s, "Wood", [EXPLANK(s, 1)]) ] },
  { name: "Spell Scroll Base", tool: "calligraphers-supplies", dc: 15, hours: 2, ings: s => [
    ingredient(s, "Parchment", [comp(s, "Parchment", 1, ["parchment", "paper", "cloth"])]) ] },
  { name: "Simple Weapon", tool: "smiths-tools", dc: 14, hours: 8, ings: s => [
    ingredient(s, "Metal stock", [IRON(s, 2)]), ingredient(s, "Haft", [PLANK(s, 1)]) ] },
  { name: "Martial Weapon", tool: "smiths-tools", dc: 17, hours: 16, ings: s => [
    ingredient(s, "Metal stock", [IRON(s, 3)]), ingredient(s, "Haft", [PLANK(s, 1)]) ] },
  { name: "Bow", tool: "woodcarvers-tools", dc: 17, hours: 16, ings: s => [
    ingredient(s, "Stave", [EXPOLE(s, 1)]), ingredient(s, "String", [CLOTH(s, 1)]) ] },
  { name: "Magitech Firearm", tool: "tinkers-tools", dc: 19, hours: 24, ings: s => [
    ingredient(s, "Steel parts", [comp(s, "Steel", 2, ["steel", "metal"])]),
    ingredient(s, "Stock", [EXPLANK(s, 1)]) ] },
  { name: "Wondrous Item", tool: "tinkers-tools", dc: 15, hours: 8, ings: s => [
    ingredient(s, "Materials", [IRON(s, 1), LEATHER(s, 1), CLOTH(s, 1), EXPLANK(s, 1)]) ] },
];

const MFG_PACK = "manufacturing-recipes";
const MFG_JOURNAL_SEED = "manufacturing:base-items";
const MFG_JOURNAL_ID = did(`journal:${MFG_JOURNAL_SEED}`);

function buildManufacturingJournal() {
  const pages = BASE_RECIPES.map((r, i) => {
    const seed = `mfg:${r.name}`;
    const ingredients = r.ings(seed);
    // Link raw materials to the bundled mundane-items pack, results to dnd5e SRD items
    for (const ing of ingredients) {
      for (const c of ing.components) {
        const hit = lookup([c.name], { forComponent: true });
        if (hit) { c.uuid = hit.uuid; c.img = hit.img; }
      }
    }
    const resolved = resolveResult(r.name);
    return pageDoc(MFG_JOURNAL_SEED, r.name, recipeSystem({
      recipeType: "manufacturing",
      resultName: resolved?.name ?? r.name,
      resultImg: resolved?.img ?? "",
      resultUuid: resolved?.uuid ?? "",
      resultQuantity: r.qty ?? 1,
      dc: r.dc,
      timeHours: r.hours,
      toolKey: r.tool,
      ingredients,
    }), (i + 1) * 100);
  });
  return journalDoc(MFG_JOURNAL_SEED, "Base Item Recipes", pages);
}

/** Compendium UUID of a base recipe page, for forge baseItemRecipeUuid links. */
function baseRecipeUuid(baseName) {
  const pid = did(`page:${MFG_JOURNAL_SEED}:${baseName}`);
  return `Compendium.${MODULE_ID}.${MFG_PACK}.JournalEntry.${MFG_JOURNAL_ID}.JournalEntryPage.${pid}`;
}

// ------------------------------------------------------------- forge pack

/** Pick the base manufacturing recipe for a Part 7 row. */
function baseFor(section, name) {
  const n = name.toLowerCase();
  switch (section) {
    case "Ammunition": return "Ammunition";
    case "Potions":    return "Potion Base";
    case "Rings":      return "Ring";
    case "Rods":       return "Rod";
    case "Scrolls":    return "Spell Scroll Base";
    case "Staves":     return "Staff";
    case "Wands":      return "Wand";
    case "Armour":
      if (n.includes("shield"))     return "Shield";
      if (n.includes("studded"))    return "Studded Leather Armor";
      if (n.includes("breastplate") || n.includes("breastplank")) return "Breastplate";
      if (n.includes("chain mail")) return "Chain Mail";
      if (n.includes("chain"))      return "Chain Shirt";
      if (n.includes("scale"))      return "Scale Mail";
      if (n.includes("plate"))      return "Plate Armor";
      if (n.includes("hide"))       return "Hide Armor";
      return "Leather Armor"; // generic "any armour" entries — GM can relink
    case "Weapons":
      if (n.includes("bow")) return "Bow";
      if (/(javelin|dagger|mace |mace$|club|quarterstaff|spear|sling|handaxe|sickle)/.test(n)) return "Simple Weapon";
      return "Martial Weapon";
    case "Wondrous Items": return "Wondrous Item";
    default: return null;
  }
}

/** Every built forge recipe page, for reuse by the themed collections pack. */
const FORGE_PAGE_SPECS = [];
const COOKING_SPECS = [];

/** Order journals the way the catalogue orders its sections. */
const FORGE_SECTION_ORDER = [
  "Ammunition", "Armour", "Potions", "Rings", "Rods",
  "Scrolls", "Staves", "Wands", "Weapons", "Wondrous Items",
];

function buildForgeJournals(rows) {
  const bySection = new Map();
  for (const row of rows) {
    if (!bySection.has(row.section)) bySection.set(row.section, []);
    bySection.get(row.section).push(row);
  }

  const stats = { resolvedResults: 0, unresolvedResults: [], resolvedComps: 0, unresolvedComps: new Set() };
  const journals = [];
  let jSort = 0;
  for (const section of FORGE_SECTION_ORDER) {
    const sectionRows = bySection.get(section);
    if (!sectionRows) continue;
    const seed = `forge:${section}`;
    const pages = [];
    for (const row of sectionRows) {
      const rawName = row.name.replace(/\*+$/, "").trim();
      const cleanName = cleanItemName(row.name);
      const tiers = tierLetters(row.rarity);
      // Per-tier component alternatives ("Eye / Eyes (2) / Eyes (3)")
      const compSplits = String(row.component ?? "").split("/").map(s => s.trim());
      const perTierComponent = tiers.length > 1 && compSplits.length === tiers.length;

      tiers.forEach((tier, ti) => {
        const tierLabel = RARITY_LABEL[tier];
        const pageName = tiers.length > 1 ? `${rawName} (${tierLabel})` : rawName;
        const rowCopy = { ...row, rarity: tier };
        if (perTierComponent) rowCopy.component = compSplits[ti];
        const sys = buildRecipeSystem(rowCopy);

        // Result: resolve against heliana-core / dnd5e items
        const resolved = resolveResult(cleanName, tierLabel, { rawName, section, tierIndex: ti });
        if (resolved) {
          sys.resultName = resolved.name;
          sys.resultImg  = resolved.img;
          sys.resultUuid = resolved.uuid;
          stats.resolvedResults++;
        } else {
          sys.resultName = pageName;
          stats.unresolvedResults.push(pageName);
        }

        const base = baseFor(section, cleanName);
        if (base) sys.baseItemRecipeUuid = baseRecipeUuid(base);

        // Compound components ("Fat and Liver", "Phial of acid + Phial of mucus")
        // become one ingredient per part rather than alternatives.
        const compText = (perTierComponent ? compSplits[ti] : String(row.component ?? ""))
          .replace(/\*+/g, "").trim();
        const parts = compText.split(/\s+\+\s+|\s+and\s+/i).map(p => p.trim()).filter(Boolean);
        if (parts.length > 1 && sys.ingredients.length === 1) {
          sys.ingredients = parts.map(part => ({
            id: "", name: "Monster Component",
            components: [{ id: "", uuid: "", name: part.replace(/\s*\(\d+\)\s*$/, ""), nameMode: "exact",
                           img: "", quantity: 1, tags: [], mode: "some", resourcePath: "" }],
          }));
        }

        // Components: resolve against the harvesting module; scrolls' "Any" has no component.
        // Rows typed "Celestial/Fiend" produce one alternative per resolvable type.
        sys.ingredients = sys.ingredients.filter(ing =>
          !ing.components.every(c => /^any$/i.test(c.name)));
        const types = rowCreatureTypes(row, sys.componentCreatureType);
        sys.ingredients.forEach((ing, ii) => {
          const qtyMatch = /\((\d+)\)\s*$/.exec(parts[ii] ?? compText);
          ing.components = ing.components.flatMap(c => {
            if (qtyMatch) c.quantity = parseInt(qtyMatch[1], 10);
            c.name = c.name.replace(/\*+$/, "").trim();
            const hits = [];
            for (const t of types.length ? types : [""]) {
              const hit = resolveComponent(c.name, t);
              if (hit && !hits.some(h => h.uuid === hit.uuid)) hits.push(hit);
            }
            if (!hits.length) {
              stats.unresolvedComps.add(`${c.name} [${types.join("/") || row.type}]`);
              return [c];
            }
            stats.resolvedComps++;
            return hits.map(h => ({ ...c, name: h.name, uuid: h.uuid, img: h.img }));
          });
        });

        // Deterministic ingredient/component ids (buildRecipeSystem uses randomID)
        sys.ingredients.forEach((ing, ii) => {
          ing.id = did(`ing:${seed}:${pageName}:${ii}`);
          ing.components.forEach((c, ci) => { c.id = did(`comp:${seed}:${pageName}:${ii}:${ci}`); });
        });

        FORGE_PAGE_SPECS.push({ section, pageName, metatag: String(row.metatag ?? ""), sys });
        pages.push(pageDoc(seed, pageName, sys, (pages.length + 1) * 100));
      });
    }
    journals.push(journalDoc(seed, section, pages, (jSort += 100)));
  }

  console.log(`forge results: ${stats.resolvedResults} resolved, ${stats.unresolvedResults.length} unresolved`);
  console.log(`forge components: ${stats.resolvedComps} resolved, ${stats.unresolvedComps.size} distinct unresolved`);
  if (process.env.VERBOSE) {
    console.log("unresolved results:\n  " + stats.unresolvedResults.join("\n  "));
    console.log("unresolved components:\n  " + [...stats.unresolvedComps].join("\n  "));
  }

  const leftovers = [...bySection.keys()].filter(s => !FORGE_SECTION_ORDER.includes(s));
  if (leftovers.length) throw new Error(`Unmapped Part 7 sections: ${leftovers.join(", ")}`);
  return journals;
}

// ----------------------------------------------------------- cooking pack

const EDIBLE_TAGS = {
  Eye: ["eye"], Fat: ["fat"], Flesh: ["flesh"], Blood: ["blood"], Bone: ["bone"],
  Egg: ["egg"], Heart: ["heart"], Liver: ["liver"], Brain: ["brain"], Spice: ["spice"],
};

const STAPLE_RECIPES = [
  { name: "Keyebob",       dc: 12, parts: ["Eye"] },
  { name: "Tempura",       dc: 12, parts: ["Fat"] },
  { name: "Steak",         dc: 12, parts: ["Flesh"] },
  { name: "Blood Curd",    dc: 12, parts: ["Blood"] },
  { name: "Bone Broth",    dc: 12, parts: ["Bone"] },
  { name: "Egg Dumpling",  dc: 12, parts: ["Egg"] },
  { name: "Hearty Stew",   dc: 12, parts: ["Heart"] },
  { name: "Liverwurst",    dc: 12, parts: ["Liver"] },
  { name: "Meaty Masala",    dc: 16, parts: ["Flesh", "Spice"] },
  { name: "Tofeye Apple",    dc: 16, parts: ["Bone", "Eye"] },
  { name: "Dwarven Scotch",  dc: 16, parts: ["Egg", "Flesh"] },
  { name: "Gobbois Gras",    dc: 16, parts: ["Fat", "Liver"] },
  { name: "Devilled Egg",    dc: 16, parts: ["Egg", "Spice"] },
  { name: "Black Pudding",   dc: 16, parts: ["Blood", "Fat"] },
  { name: "Bloody Gazpacho", dc: 16, parts: ["Blood", "Spice"] },
  { name: "Carrion Delight", dc: 16, parts: ["Bone", "Fat"] },
  { name: "Chronomancer's Slow Cooked Joint", dc: 20, parts: ["Bone", "Fat", "Flesh"] },
  { name: "Offally Good Stew",                dc: 20, parts: ["Brain", "Heart", "Liver"] },
  { name: "Draconic Delight",                 dc: 20, parts: ["Egg", "Flesh", "Spice"] },
  { name: "Brain Barbacoa",                   dc: 20, parts: ["Bone", "Brain", "Eye"] },
  { name: "Scarlet Eye Flan",      dc: 24, parts: ["Blood", "Brain", "Eye", "Fat"] },
  { name: "Beastial Bourguignon",  dc: 24, parts: ["Flesh", "Heart", "Liver", "Spice"] },
];

const BOSS_RECIPES = [
  { name: "Aboleth Ramen",           dc: 12, boss: { name: "Tentacle",       tags: ["tentacle", "broodmother", "aberration", "flesh"] }, parts: [] },
  { name: "Jello Shot",              dc: 16, boss: { name: "Phial of mucus", tags: ["mucus", "polyhedrooze", "ooze", "blood"] },          parts: ["Fat"] },
  { name: "Mushroom Mélange",        dc: 16, boss: { name: "Pouch of spores",tags: ["spores", "hyphan", "plant", "spice"] },              parts: ["Fat"] },
  { name: "Rakoyaki",                dc: 16, boss: { name: "Brain",          tags: ["brain", "pygmy", "fiend"] },                          parts: ["Blood"] },
  { name: "Skrapyard Sosig",         dc: 16, boss: { name: "Tubing",         tags: ["tubing", "koboldzilla", "construct", "flesh"] },      parts: ["Egg"] },
  { name: "Tongue Twister Tart",     dc: 16, boss: { name: "Tongue",         tags: ["tongue", "tavern-mimic", "monstrosity", "flesh"] },   parts: ["Brain"] },
  { name: "Magnetite Curry",         dc: 20, boss: { name: "Flesh",          tags: ["flesh", "magnetite", "dragon"] },                     parts: ["Liver", "Spice"] },
  { name: "Dumpleyengs",             dc: 20, boss: { name: "Subeye",         tags: ["subeye", "dreamholder", "aberration", "eye"] },       parts: ["Blood", "Heart"] },
  { name: "Suneater Steak and Eggs", dc: 20, boss: { name: "Flesh",          tags: ["flesh", "suneater", "fey"] },                         parts: ["Blood", "Egg"] },
  { name: "Tar-rasque Marrow Broth", dc: 24, boss: { name: "Marrow",         tags: ["marrow", "tar-rasque", "elemental", "bone"] },        parts: ["Heart", "Liver", "Spice"] },
];

function cookingSystem(seed, r) {
  const ings = [];
  if (r.boss) {
    ings.push(ingredient(seed, "Boss Ingredient", [comp(seed, r.boss.name, 1, r.boss.tags)]));
  }
  for (const part of r.parts) {
    ings.push(ingredient(seed, part, [comp(seed, part, 1, EDIBLE_TAGS[part])]));
  }
  // Boss meals ship as tiered items in heliana-core; link the base (Uncommon) tier
  const resolved = resolveResult(r.name, "Uncommon") ?? resolveResult(r.name);
  return recipeSystem({
    recipeType: "cooking",
    resultName: resolved?.name ?? r.name,
    resultImg: resolved?.img ?? "",
    resultUuid: resolved?.uuid ?? "",
    dc: r.dc,
    timeHours: 1,
    toolKey: "cooks-utensils",
    ingredients: ings,
  });
}

function buildCookingJournals() {
  const stapleSeed = "cooking:staples";
  const staples = journalDoc(stapleSeed, "Staple Recipes",
    STAPLE_RECIPES.map((r, i) => pageDoc(stapleSeed, r.name, cookingSystem(`${stapleSeed}:${r.name}`, r), (i + 1) * 100)), 100);

  const bossSeed = "cooking:boss";
  const boss = journalDoc(bossSeed, "Boss Monster Recipes",
    BOSS_RECIPES.map((r, i) => {
      const sys = cookingSystem(`${bossSeed}:${r.name}`, r);
      COOKING_SPECS.push({ pageName: r.name, sys });
      return pageDoc(bossSeed, r.name, sys, (i + 1) * 100);
    }), 200);

  return [staples, boss];
}

// ---------------------------------------------------- recipe collections pack
//
// Small themed journals modelled on hand-authored "Broodmother Recipes"
// journals: a "Craftable Items" text page with @UUID links, followed by
// copies of the relevant recipe pages. One journal per Heliana boss and one
// per creature type. Handy as recipe-book unlock targets.

const BOSS_COLLECTIONS = [
  { name: "Broodmother Recipes",       match: /broodmother/i,             meal: "Aboleth Ramen" },
  { name: "Dreamholder Recipes",       match: /dreamholder/i,             meal: "Dumpleyengs" },
  { name: "Mecha-Koboldzilla Recipes", match: /koboldzilla/i,             meal: "Skrapyard Sosig" },
  { name: "Polyhedrooze Recipes",      match: /polyhedrooze/i,            meal: "Jello Shot" },
  { name: "Tavern Mimic Recipes",      match: /tavern mimic/i,            meal: "Tongue Twister Tart" },
  { name: "Hyphan Recipes",            match: /hyphan/i,                  meal: "Mushroom Mélange" },
  { name: "Suneater Recipes",          match: /suneater/i,                meal: "Suneater Steak and Eggs" },
  { name: "Magnetite Recipes",         match: /magnetite/i,               meal: "Magnetite Curry" },
  { name: "Tar-rasque Recipes",        match: /tar-rasque/i,              meal: "Tar-rasque Marrow Broth" },
  { name: "Pygmy Rakshasa Recipes",    match: /pygmy rakshasa|handler/i,  meal: "Rakoyaki" },
];

const CREATURE_TYPES = ["aberration", "beast", "celestial", "construct", "dragon", "elemental",
  "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead"];

function textPageDoc(journalSeed, name, html, sort) {
  return {
    _id: did(`page:${journalSeed}:${name}`), name, type: "text",
    title: { show: true, level: 1 }, text: { format: 1, content: html },
    sort, ownership: { default: -1 }, flags: {},
  };
}

function copyRecipePage(journalSeed, spec, sort) {
  const sys = structuredClone(spec.sys);
  sys.ingredients.forEach((ing, ii) => {
    ing.id = did(`ing:${journalSeed}:${spec.pageName}:${ii}`);
    ing.components.forEach((c, ci) => { c.id = did(`comp:${journalSeed}:${spec.pageName}:${ii}:${ci}`); });
  });
  return pageDoc(journalSeed, spec.pageName, sys, sort);
}

function collectionJournal(seed, name, specs, jSort) {
  const links = [];
  const seen = new Set();
  for (const s of specs) {
    const key = s.sys.resultUuid || s.pageName;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(s.sys.resultUuid
      ? `<p>@UUID[${s.sys.resultUuid}]{${s.sys.resultName}}</p>`
      : `<p>${s.sys.resultName}</p>`);
  }
  const pages = [textPageDoc(seed, "Craftable Items", links.join(""), 10)];
  specs.forEach((s, i) => pages.push(copyRecipePage(seed, s, (i + 2) * 100)));
  return journalDoc(seed, name, pages, jSort);
}

function buildCollectionJournals() {
  const journals = [];
  let jSort = 0;

  for (const boss of BOSS_COLLECTIONS) {
    const specs = FORGE_PAGE_SPECS.filter(s => boss.match.test(s.metatag));
    const meal = COOKING_SPECS.find(c => c.pageName === boss.meal);
    if (meal) specs.push(meal);
    if (!specs.length) continue;
    journals.push(collectionJournal(`collection:boss:${boss.name}`, boss.name, specs, (jSort += 100)));
  }

  for (const type of CREATURE_TYPES) {
    const specs = FORGE_PAGE_SPECS.filter(s => s.sys.componentCreatureType === type);
    if (!specs.length) continue;
    const label = type[0].toUpperCase() + type.slice(1);
    journals.push(collectionJournal(`collection:type:${type}`, `${label} Recipes`, specs, (jSort += 100)));
  }

  return journals;
}

// ---------------------------------------------------------------- hunt packs
//
// Hand-authored hunt data files (tools/data/hunts/*.json, transcribed from
// the Loot Tavern hunt PDFs under DndAssets) compile into:
//   hunt-items pack        — craftable items (one per rarity tier), harvested
//                            component items, and a recipe-book item per hunt
//   recipe-collections     — one journal per hunt: item links, the hunt PDF,
//                            and forge recipes per tier

const DND_RARITY = { "common": "common", "uncommon": "uncommon", "rare": "rare", "very rare": "veryRare", "legendary": "legendary", "artifact": "artifact" };

// Enchanting DC / time / essence tier by rarity (matches RecipeImporter's table).
const HUNT_RARITY_META = {
  "common":    { tier: "",       dc: 12, hours: 1 },
  "uncommon":  { tier: "frail",  dc: 15, hours: 10 },
  "rare":      { tier: "robust", dc: 18, hours: 40 },
  "very rare": { tier: "potent", dc: 21, hours: 160 },
  "legendary": { tier: "mythic", dc: 25, hours: 640 },
  "artifact":  { tier: "deific", dc: 30, hours: 100000 },
};

function huntItemDoc(seed, name, { type = "loot", img = "", description = "", rarity = "", attunement = "", price = 0, tags = [], flags = {} }) {
  const _id = did(`huntitem:${seed}:${name}`);
  return {
    _id, _key: `!items!${_id}`,
    name, type,
    img: img || "icons/svg/item-bag.svg",
    system: {
      description: { value: description, chat: "" },
      quantity: 1,
      rarity: DND_RARITY[rarity] ?? "",
      attunement: attunement === "required" ? "required" : "",
      price: { value: price, denomination: "gp" },
      identified: true,
      weight: { value: 0, units: "lb" },
      properties: [],
      type: { value: "", subtype: "" },
    },
    effects: [],
    folder: null, sort: 0,
    ownership: { default: 0 },
    flags,
  };
}

function buildHuntPacks() {
  const huntsDir = path.join(ROOT, "tools", "data", "hunts");
  const huntFiles = (() => {
    try { return readdirSync(huntsDir).filter(f => f.endsWith(".json")); }
    catch { return []; }
  })();

  const itemDocs = [];
  const journals = [];
  let jSort = 10000;

  for (const file of huntFiles) {
    const hunt = JSON.parse(readFileSync(path.join(huntsDir, file), "utf8"));
    const seed = `hunt:${hunt.name}`;
    const journalSeed = `collection:hunt:${hunt.name}`;
    const journalId = did(`journal:${journalSeed}`);
    const journalUuid = `Compendium.${MODULE_ID}.recipe-collections.JournalEntry.${journalId}`;

    // Component items
    const componentIds = {};
    for (const c of hunt.components) {
      const doc = huntItemDoc(seed, c.name, {
        description: `<p>Harvested from a ${hunt.name.toLowerCase()} (${hunt.creatureType}). See ${hunt.source}.</p>`,
        price: c.price ?? 0,
        flags: { [MODULE_ID]: { tags: c.tags ?? [] } },
      });
      componentIds[c.name] = doc._id;
      itemDocs.push(doc);
    }

    // Craftable items (one per tier) + recipes
    const links = [];
    const recipePages = [];
    for (const item of hunt.items) {
      for (const tier of item.tiers) {
        const label = tier.rarity.replace(/(^|\s)\w/g, m => m.toUpperCase());
        const itemName = `${item.name} (${label})`;
        const doc = huntItemDoc(seed, itemName, {
          type: item.itemType,
          description: item.description,
          rarity: tier.rarity,
          attunement: item.attunement,
          price: tier.value,
        });
        itemDocs.push(doc);
        const itemUuid = `Compendium.${MODULE_ID}.hunt-items.Item.${doc._id}`;
        links.push(`<p>@UUID[${itemUuid}]{${itemName}}</p>`);

        const meta = HUNT_RARITY_META[tier.rarity] ?? HUNT_RARITY_META.uncommon;
        const compNames = item.components ?? [item.component];
        const sys = recipeSystem({
          recipeType: "forge",
          resultName: itemName,
          resultUuid: itemUuid,
          dc: meta.dc, timeHours: meta.hours,
          enchantingDc: meta.dc, enchantingTimeHours: meta.hours,
          essenceTierRequired: meta.tier,
          componentCreatureType: hunt.creatureType,
          rarity: tier.rarity,
          attunement: item.attunement,
          baseItemRecipeUuid: item.baseRecipe ? baseRecipeUuid(item.baseRecipe) : "",
          ingredients: compNames.map((compName, ci) => {
            const compId = componentIds[compName];
            // Hunt-local component item, or a generic one from the indexed packs
            // (e.g. the harvesting module's "Monstrosity Horn")
            const uuid = compId ? `Compendium.${MODULE_ID}.hunt-items.Item.${compId}`
              : (lookup([compName], { forComponent: true })?.uuid ?? "");
            return ingredient(`${seed}:${itemName}:${ci}`, "Monster Component", [
              { ...comp(`${seed}:${itemName}:${ci}`, compName, 1,
                  (hunt.components.find(c => c.name === compName)?.tags)
                    ?? compName.toLowerCase().split(/\s+/).filter(w => w.length > 2)),
                uuid },
            ]);
          }),
        });
        recipePages.push({ pageName: itemName, sys });
      }
    }

    // Recipe book item
    itemDocs.push(huntItemDoc(seed, `${hunt.name} Hunt Notes`, {
      description: `<p>Field notes on hunting and harvesting the ${hunt.name.toLowerCase()}, with crafting recipes for its unique items.</p><p>Source: ${hunt.source}</p>`,
      price: 25,
      flags: { [MODULE_ID]: { isRecipeBook: true, recipeBookJournalUuid: journalUuid } },
    }));

    // Hunt journal: links page, PDF page, recipe pages
    const harvestRows = hunt.harvest.map(h => `<tr><td>${h.dc}</td><td>${h.components.join(", ")}</td></tr>`).join("");
    const intro = `<p><em>${hunt.source}</em></p><h2>Harvest Table</h2><table><thead><tr><th>DC</th><th>Components</th></tr></thead><tbody>${harvestRows}</tbody></table><h2>Craftable Items</h2>${links.join("")}`;
    const pages = [textPageDoc(journalSeed, "Craftable Items", intro, 10)];
    if (hunt.pdf) {
      pages.push({
        _id: did(`page:${journalSeed}:pdf`), name: `${hunt.name} (PDF)`, type: "pdf",
        src: hunt.pdf, title: { show: true, level: 1 }, sort: 20,
        ownership: { default: -1 }, flags: {},
      });
    }
    recipePages.forEach((s, i) => pages.push(copyRecipePage(journalSeed, s, (i + 1) * 100 + 100)));
    journals.push(journalDoc(journalSeed, `${hunt.name} Recipes`, pages, (jSort += 100)));
  }

  return { itemDocs, journals };
}

// ------------------------------------------------------------- bestiary pack
//
// Boss actors hand-transcribed from the Field Notes / hunt PDFs into
// tools/data/actors/*.json. Phase 1 ships stats + every trait/action as a
// feature item with its full rules text; attack automation comes later.

const SKILL_ABILITY = { acr: "dex", ani: "wis", arc: "int", ath: "str", dec: "cha", his: "int", ins: "wis", itm: "cha", inv: "int", med: "wis", nat: "int", prc: "wis", prf: "cha", per: "cha", rel: "int", slt: "dex", ste: "dex", sur: "wis" };
const CATEGORY_ACTIVATION = { action: "action", bonus: "bonus", reaction: "reaction", legendary: "legendary", trait: "" };

// Feature icons follow the dnd5e 2024 SRD monster convention: Foundry core
// `icons/**` webp art (the system's own icons/ folder only holds UI glyphs).
// Every path below appears on an SRD monster item, so it exists in any install.
const FEATURE_ICONS = [
  [/multiattack/i, "icons/skills/melee/strike-weapons-orange.webp"],
  [/\b(bite|chomp|fangs?|eat)\b/i, "icons/creatures/abilities/fangs-teeth-bite.webp"],
  [/\bclaws?\b/i, "icons/creatures/claws/claw-curved-jagged-gray.webp"],
  [/\btail\b/i, "icons/creatures/abilities/tail-swipe-green.webp"],
  [/\b(punch|fist|bonk|kick|unarmed)\b/i, "icons/skills/melee/unarmed-punch-fist.webp"],
  [/\b(slam|crush)/i, "icons/magic/sonic/explosion-impact-shock-wave.webp"],
  [/frost breath|ice breath|cold breath/i, "icons/creatures/abilities/dragon-ice-breath-blue.webp"],
  [/fire breath|flame breath/i, "icons/creatures/abilities/dragon-fire-breath-orange.webp"],
  [/\b(glaive|blade|slash|scythe|slice)/i, "icons/skills/melee/blood-slash-foam-red.webp"],
  [/\b(discharge|lightning|shock)\b/i, "icons/magic/lightning/bolt-strike-blue.webp"],
  [/\b(thunder|resonant|boom)/i, "icons/magic/sonic/explosion-shock-wave-teal.webp"],
  [/\b(charge[ds]?|rocket|blast off|pounce|leap)\b/i, "icons/skills/movement/arrow-upward-yellow.webp"],
  [/\b(pulse|magnet|current|field)\b/i, "icons/magic/lightning/orb-ball-spiral-blue.webp"],
  [/\b(vine|briar|root|entangl)/i, "icons/magic/nature/root-vine-entangled-hands.webp"],
  [/\b(fog|mist|smoke|cloud)\b/i, "icons/magic/air/fog-gas-smoke-dense-green.webp"],
  [/\b(frost|ice|snow|freez)/i, "icons/magic/water/projectile-ice-shard.webp"],
  [/\b(fire|lava|flame|ember)/i, "icons/magic/fire/beam-jet-stream-embers.webp"],
  [/\b(stealth|sneak|hide|hidden|invisib)/i, "icons/magic/perception/silhouette-stealth-shadow.webp"],
  [/\b(fear|panic|fright|dread)/i, "icons/magic/control/fear-fright-monster-grin-green.webp"],
  [/\b(charm|adoration|allur|entic)/i, "icons/magic/life/heart-area-circle-red-green.webp"],
  [/\b(gaze|eye|sight|sense|stare)\b/i, "icons/magic/control/hypnosis-mesmerism-eye-tan.webp"],
  [/\b(spell|arcan[ae]|magic)\b/i, "icons/magic/symbols/circled-gem-pink.webp"],
  [/\b(guard|protect|shield|ward)/i, "icons/equipment/shield/heater-steel-crystal-red.webp"],
  [/\b(bomb|grenade|explos)/i, "icons/magic/fire/projectiles-salvo-trio-orange.webp"],
  [/\b(shatter|fragment|shard|ceramic)/i, "icons/commodities/metal/fragments-steel-barbed.webp"],
  [/\b(grip|grab|maglock|constrict|jaws)\b/i, "icons/commodities/tech/metal-jaws.webp"],
  [/\b(poison|venom|toxi)/i, "icons/creatures/claws/claw-curved-poison-purple.webp"],
  [/\b(heart|soul|life)\b/i, "icons/magic/life/heart-hand-gold-green.webp"],
  [/\b(stone|rock|skin|earth)\b/i, "icons/magic/earth/projectile-stone-landslide.webp"],
  [/\b(sting|barb)/i, "icons/creatures/abilities/stinger-poison-green.webp"],
  [/\b(tentacle|arm)\b/i, "icons/creatures/tentacles/tentacles-octopus-black-pink.webp"],
];
const CATEGORY_DEFAULT_ICON = {
  trait: "icons/magic/symbols/runes-carved-stone-green.webp",
  action: "icons/skills/melee/strike-weapons-orange.webp",
  bonus: "icons/skills/movement/arrow-upward-yellow.webp",
  reaction: "icons/skills/melee/shield-damaged-broken-orange.webp",
  legendary: "icons/skills/melee/strike-weapons-orange.webp",
};

function featureIcon(name, category) {
  for (const [re, icon] of FEATURE_ICONS) if (re.test(name)) return icon;
  return CATEGORY_DEFAULT_ICON[category] ?? "icons/svg/aura.svg";
}

const DAMAGE_TYPES = "bludgeoning|piercing|slashing|acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder";
const ATTACK_RE = new RegExp(
  "<em>(Melee|Ranged) Weapon Attack:<\\/em>\\s*\\+(\\d+),\\s*(?:reach\\s+(\\d+)\\s*ft|range\\s+(\\d+)\\/(\\d+)\\s*ft)\\.?\\s*(?:\\([^)]*\\)\\s*)?\\.?\\s*<em>Hit:<\\/em>\\s*\\d+\\s*\\((\\d+)d(\\d+)(?:\\s*\\+\\s*(\\d+))?\\)\\s*(" + DAMAGE_TYPES + ")\\b(?:\\s+damage)?", "i");
// Unconditional secondary damage: "plus/and N (XdY) <type> damage" in the same
// sentence as the base damage. Conditional riders ("If the target…") follow a
// period and are deliberately left to the description text.
const RIDER_RE = new RegExp("^[^.]*?\\b(?:plus|and)\\s+\\d+\\s*\\((\\d+)d(\\d+)\\)\\s*(" + DAMAGE_TYPES + ")\\s+damage", "i");

// Parse a stat-block weapon attack out of a feature's description HTML.
function parseAttack(html) {
  const m = ATTACK_RE.exec(html);
  if (!m) return null;
  const [, kind, toHit, reach, rShort, rLong, num, den, dmgBonus, dmgType] = m;
  const rest = html.slice(m.index + m[0].length);
  const r = RIDER_RE.exec(rest);
  return {
    melee: kind.toLowerCase() === "melee",
    toHit: Number(toHit),
    reach: reach ? Number(reach) : null,
    rangeShort: rShort ? Number(rShort) : null,
    rangeLong: rLong ? Number(rLong) : null,
    number: Number(num), denomination: Number(den),
    dmgBonus: dmgBonus ? Number(dmgBonus) : 0,
    dmgType: dmgType.toLowerCase(),
    rider: r ? { number: Number(r[1]), denomination: Number(r[2]), type: r[3].toLowerCase() } : null,
  };
}

const crPB = cr => Math.max(2, 2 + Math.floor((Math.max(cr, 1) - 1) / 4));
const abilityMod = score => Math.floor((score - 10) / 2);

// Natural-weapon item + attack activity, mirroring the dnd5e 2024 SRD monster
// structure so sheet rolls (and Midi-QoL) work out of the box. The to-hit
// ability is derived when str/dex + PB reproduces the printed bonus; otherwise
// the activity falls back to a flat attack bonus and a custom damage formula.
function attackWeaponSystem(a, f, atk, iid, actorName) {
  const pb = crPB(a.cr);
  const strMod = abilityMod(a.abilities.str);
  const dexMod = abilityMod(a.abilities.dex);
  // Only derive the ability when BOTH the to-hit and the damage bonus match
  // (mod + PB and mod respectively) — otherwise the sheet would silently add
  // the mod to damage lines the stat block prints without one.
  let ability = "";
  if (strMod + pb === atk.toHit && atk.dmgBonus === strMod) ability = "str";
  else if (dexMod + pb === atk.toHit && atk.dmgBonus === dexMod) ability = "dex";
  const flat = !ability;
  if (flat) console.warn(`  bestiary: flat attack bonus for ${actorName} / ${f.name} (+${atk.toHit})`);

  const base = flat
    ? { number: atk.number, denomination: atk.denomination, bonus: "",
        types: [atk.dmgType],
        custom: { enabled: true, formula: `${atk.number}d${atk.denomination}${atk.dmgBonus ? ` + ${atk.dmgBonus}` : ""}` },
        scaling: { number: 1 } }
    : { number: atk.number, denomination: atk.denomination, bonus: "",
        types: [atk.dmgType], custom: { enabled: false }, scaling: { number: 1 } };

  const parts = atk.rider
    ? [{ number: atk.rider.number, denomination: atk.rider.denomination, bonus: "",
         types: [atk.rider.type], custom: { enabled: false, formula: "" }, scaling: { number: 1 } }]
    : [];

  const aid = did(`activity:${actorName}:${f.name}`);
  return {
    type: { value: "natural", baseItem: "" },
    description: { value: f.description, chat: "" },
    uses: { spent: 0, recovery: [], max: "" },
    properties: [], identified: true, mastery: "",
    unidentified: { name: "Unidentified Weapon", description: "" },
    range: { units: "ft", value: atk.rangeShort, long: atk.rangeLong, reach: atk.melee ? atk.reach : null },
    damage: { base, versatile: { number: null, denomination: null, types: [], custom: { enabled: false }, scaling: { number: 1 } } },
    container: null, quantity: 1,
    weight: { value: 0, units: "lb" }, price: { value: 0, denomination: "gp" },
    rarity: "", attunement: "", attuned: false, equipped: true, cover: null,
    ammunition: {}, armor: { value: null }, proficient: null, crew: { value: [] },
    activities: {
      [aid]: {
        type: "attack", _id: aid, sort: 0,
        activation: { type: CATEGORY_ACTIVATION[f.category] || "action", value: null, override: false, condition: "" },
        consumption: { scaling: { allowed: false }, spellSlot: true, targets: [] },
        description: { chatFlavor: "" },
        duration: { units: "inst", concentration: false, override: false },
        effects: [],
        range: { override: false, units: "self" },
        target: { template: { contiguous: false, units: "ft", type: "" }, affects: { choice: false, type: "" }, override: false, prompt: true },
        uses: { spent: 0, recovery: [], max: "" },
        attack: { critical: { threshold: null }, flat, type: { value: atk.melee ? "melee" : "ranged", classification: "weapon" }, ability, bonus: flat ? String(atk.toHit) : "" },
        damage: { critical: { bonus: "" }, includeBase: true, parts },
        name: "", img: null, flags: {},
      },
    },
  };
}

function buildBestiary() {
  const dir = path.join(ROOT, "tools", "data", "actors");
  let files = [];
  try { files = readdirSync(dir).filter(f => f.endsWith(".json")); } catch { return []; }

  return files.map(file => {
    const a = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    const _id = did(`actor:${a.name}`);

    const abilities = {};
    for (const [key, value] of Object.entries(a.abilities)) {
      abilities[key] = { value, proficient: a.saveProfs?.includes(key) ? 1 : 0 };
    }
    const skills = {};
    for (const [key, mult] of Object.entries(a.skills ?? {})) {
      skills[key] = { value: mult, ability: SKILL_ABILITY[key] };
    }

    const items = (a.features ?? []).map((f, i) => {
      const iid = did(`actorfeat:${a.name}:${f.name}`);
      const shared = {
        _id: iid, _key: `!actors.items!${_id}.${iid}`,
        name: f.name,
        img: featureIcon(f.name, f.category),
        effects: [], sort: (i + 1) * 100, ownership: { default: 0 }, flags: {},
      };
      const atk = parseAttack(f.description);
      if (atk) return { ...shared, type: "weapon", system: attackWeaponSystem(a, f, atk, iid, a.name) };
      return {
        ...shared, type: "feat",
        system: {
          description: { value: f.description, chat: "" },
          type: { value: "monster", subtype: "" },
          activation: { type: CATEGORY_ACTIVATION[f.category] ?? "", cost: CATEGORY_ACTIVATION[f.category] ? 1 : null, condition: "" },
          requirements: "", uses: { spent: 0, recovery: [] }, activities: {},
        },
      };
    });

    const size = a.size ?? "med";
    const tokenScale = { tiny: 0.5, sm: 1, med: 1, lg: 2, huge: 3, grg: 4 }[size] ?? 1;

    return {
      _id, _key: `!actors!${_id}`,
      name: a.name, type: "npc",
      img: a.img ?? "icons/svg/mystery-man.svg",
      system: {
        abilities,
        attributes: {
          ac: { flat: a.ac, calc: "flat" },
          hp: { value: a.hp.value, max: a.hp.value, formula: a.hp.formula ?? "" },
          movement: { units: "ft", ...a.speed },
          senses: { units: "ft", ...(a.senses ?? {}) },
        },
        details: {
          biography: { value: `${a.biography ?? ""}<p><em>Source: ${a.source}</em></p>`, public: "" },
          alignment: a.alignment ?? "",
          type: { value: a.creatureType, subtype: a.subtype ?? "", custom: "" },
          cr: a.cr,
        },
        traits: {
          size,
          languages: { value: (a.languages ?? []).map(l => l.toLowerCase()), custom: a.languagesCustom ?? "" },
          di: { value: a.di ?? [], custom: "" },
          dv: { value: a.dv ?? [], custom: "" },
          dr: { value: a.dr ?? [], custom: a.drCustom ?? "" },
          ci: { value: a.ci ?? [], custom: "" },
        },
        skills,
      },
      items,
      effects: [],
      prototypeToken: {
        name: a.name,
        width: tokenScale, height: tokenScale,
        texture: { src: a.token ?? a.img ?? "icons/svg/mystery-man.svg" },
        actorLink: false, disposition: -1,
      },
      folder: null, sort: 0, ownership: { default: 0 }, flags: {},
    };
  });
}

// ------------------------------------------------------------------ build

async function writeSourcesAndCompile(packName, docs) {
  const srcDir = path.join(ROOT, "packs-src", packName);
  rmSync(srcDir, { recursive: true, force: true });
  mkdirSync(srcDir, { recursive: true });
  for (const d of docs) {
    writeFileSync(path.join(srcDir, `${slug(d.name)}.json`), JSON.stringify(d, null, 2) + "\n");
  }
  await compilePack(srcDir, path.join(ROOT, "packs", packName), { log: false });
  const pageCount = docs.reduce((n, d) => n + (d.pages?.length ?? 0), 0);
  console.log(`${packName}: ${docs.length} document(s)${pageCount ? `, ${pageCount} page(s)` : ""}`);
}

const catalogue = readFileSync(path.join(ROOT, "crafting_catalogue_foundry_reference.md"), "utf8");
const rows = parseCatalogueMarkdown(catalogue);
if (!rows.length) throw new Error("Catalogue parse produced no rows");

await writeSourcesAndCompile(MFG_PACK, [buildManufacturingJournal()]);
await writeSourcesAndCompile("forge-recipes", buildForgeJournals(rows));
await writeSourcesAndCompile("cooking-recipes", buildCookingJournals());
const huntPacks = buildHuntPacks();
await writeSourcesAndCompile("recipe-collections", [...buildCollectionJournals(), ...huntPacks.journals]);
await writeSourcesAndCompile("hunt-items", huntPacks.itemDocs);
await writeSourcesAndCompile("hunt-bestiary", buildBestiary());

console.log("Done.");
