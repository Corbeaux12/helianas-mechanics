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

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
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
    return pageDoc(MFG_JOURNAL_SEED, r.name, recipeSystem({
      recipeType: "manufacturing",
      resultName: r.name,
      resultQuantity: r.qty ?? 1,
      dc: r.dc,
      timeHours: r.hours,
      toolKey: r.tool,
      ingredients: r.ings(seed),
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

  const journals = [];
  let jSort = 0;
  for (const section of FORGE_SECTION_ORDER) {
    const sectionRows = bySection.get(section);
    if (!sectionRows) continue;
    const seed = `forge:${section}`;
    const pages = sectionRows.map((row, i) => {
      const name = row.name.replace(/\*+$/, "").trim();
      const sys = buildRecipeSystem(row);
      sys.resultName = name;
      const base = baseFor(section, name);
      if (base) sys.baseItemRecipeUuid = baseRecipeUuid(base);
      // Deterministic ingredient/component ids (buildRecipeSystem uses randomID)
      sys.ingredients.forEach((ing, ii) => {
        ing.id = did(`ing:${seed}:${name}:${ii}`);
        ing.components.forEach((c, ci) => { c.id = did(`comp:${seed}:${name}:${ii}:${ci}`); });
      });
      return pageDoc(seed, name, sys, (i + 1) * 100);
    });
    journals.push(journalDoc(seed, section, pages, (jSort += 100)));
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
  return recipeSystem({
    recipeType: "cooking",
    resultName: r.name,
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
    BOSS_RECIPES.map((r, i) => pageDoc(bossSeed, r.name, cookingSystem(`${bossSeed}:${r.name}`, r), (i + 1) * 100)), 200);

  return [staples, boss];
}

// ------------------------------------------------------------------ build

async function writeSourcesAndCompile(packName, journals) {
  const srcDir = path.join(ROOT, "packs-src", packName);
  rmSync(srcDir, { recursive: true, force: true });
  mkdirSync(srcDir, { recursive: true });
  for (const j of journals) {
    writeFileSync(path.join(srcDir, `${slug(j.name)}.json`), JSON.stringify(j, null, 2) + "\n");
  }
  await compilePack(srcDir, path.join(ROOT, "packs", packName), { log: false });
  const pageCount = journals.reduce((n, j) => n + j.pages.length, 0);
  console.log(`${packName}: ${journals.length} journal(s), ${pageCount} recipe page(s)`);
}

const catalogue = readFileSync(path.join(ROOT, "crafting_catalogue_foundry_reference.md"), "utf8");
const rows = parseCatalogueMarkdown(catalogue);
if (!rows.length) throw new Error("Catalogue parse produced no rows");

await writeSourcesAndCompile(MFG_PACK, [buildManufacturingJournal()]);
await writeSourcesAndCompile("forge-recipes", buildForgeJournals(rows));
await writeSourcesAndCompile("cooking-recipes", buildCookingJournals());

console.log("Done.");
