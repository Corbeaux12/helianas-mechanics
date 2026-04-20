import { MODULE_ID } from "./constants.mjs";
import { RECIPE_PAGE_TYPE } from "./Recipe.mjs";

// Rarity letter codes used in the catalogue → dnd5e rarity string + essence tier + DC + time(hrs).
const RARITY_MAP = {
  C: { rarity: "common",    tier: "",       dc: 12, hours:   1 },
  U: { rarity: "uncommon",  tier: "frail",  dc: 15, hours:  10 },
  R: { rarity: "rare",      tier: "robust", dc: 18, hours:  40 },
  V: { rarity: "very rare", tier: "potent", dc: 21, hours: 160 },
  L: { rarity: "legendary", tier: "mythic", dc: 25, hours: 640 },
  A: { rarity: "artifact",  tier: "deific", dc: 30, hours: 100000 },
};

// "Req" / "Opt" / "—" tokens in the Att column → schema values.
const ATTUNEMENT_MAP = {
  "req":    "required",
  "req_s":  "required-spellcaster",
  "req+":   "required",
  "opt":    "optional",
  "—":      "none",
  "-":      "none",
  "":       "none",
};

/**
 * Parses the bundled catalogue markdown into structured recipe rows.
 * Scans everything under "## PART 7: MAGIC ITEM RECIPES" until the next
 * top-level section and yields one object per pipe-delimited table row.
 */
export function parseCatalogueMarkdown(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];

  let section = null;
  let headers = null;
  let inPart7 = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (/^## PART 7\b/i.test(line)) { inPart7 = true; continue; }
    if (inPart7 && /^## /.test(line)) { inPart7 = false; break; }
    if (!inPart7) continue;

    const sectionMatch = /^### (.+?)\s*$/.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1].replace(/\s*\([^)]*\)\s*$/, "").trim();
      headers = null;
      continue;
    }

    if (!line.startsWith("|")) continue;

    const cells = line.slice(1, line.endsWith("|") ? -1 : undefined)
      .split("|").map(c => c.trim());

    // Header row → grab the column names
    if (!headers && cells.some(c => /^Name$/i.test(c))) {
      headers = cells.map(c => c.toLowerCase());
      continue;
    }
    // Divider row (|---|---|)
    if (cells.every(c => /^-+$/.test(c))) continue;
    if (!headers) continue;

    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = cells[i] ?? "";
    if (!row.name) continue;

    rows.push({ section, ...row });
  }

  return rows;
}

/**
 * Build a RecipePageData-shaped `system` object from one catalogue row plus
 * an optional resolved source item (its UUID, name, image).
 */
export function buildRecipeSystem(row, resolved = null) {
  const rarityLetter = extractFirstRarity(row.rarity ?? "");
  const meta = RARITY_MAP[rarityLetter] ?? RARITY_MAP.C;
  const creatureType = (row.type ?? "").toLowerCase().trim();
  const attunement = normaliseAttunement(row.att ?? row.attunement ?? "");
  const componentName = cleanComponentName(row.component ?? "");

  return {
    recipeType:         "forge",
    baseItemRecipeUuid: "",
    resultName:         resolved?.name ?? row.name,
    resultImg:          resolved?.img ?? "",
    resultUuid:         resolved?.uuid ?? "",
    resultQuantity:     1,
    dc:                 meta.dc,
    timeHours:          meta.hours,
    enchantingDc:       meta.dc,
    enchantingTimeHours: meta.hours,
    toolKey:            "",
    toolAbility:        "",
    ingredients: componentName ? [{
      id:   foundry.utils.randomID(),
      name: "Monster Component",
      components: [{
        id:           foundry.utils.randomID(),
        uuid:         "",
        name:         componentName,
        nameMode:     "exact",
        img:          "",
        quantity:     1,
        tags:         [],
        mode:         "some",
        resourcePath: "",
      }],
    }] : [],
    essenceTierRequired:   meta.tier,
    componentCreatureType: ["beast","dragon","fey","fiend","aberration","celestial","construct","elemental","giant","humanoid","monstrosity","ooze","plant","undead"].includes(creatureType) ? creatureType : "",
    rarity:                meta.rarity,
    attunement,
  };
}

function extractFirstRarity(str) {
  const m = /([CURVLA])/i.exec(str);
  return m ? m[1].toUpperCase() : "C";
}
function normaliseAttunement(str) {
  const first = String(str).split(",")[0].trim().toLowerCase();
  return ATTUNEMENT_MAP[first] ?? "none";
}
function cleanComponentName(str) {
  // Keep the first component if the row lists alternates ("Eye or Bone")
  return String(str).replace(/\s*\(.*\)\s*$/, "").split(/\s+or\s+|\s*,\s*/)[0].trim();
}

export class RecipeImporter {
  /**
   * Resolve an item name to the first matching world or compendium Item.
   * Returns `{ uuid, name, img }` or null.
   */
  static async resolveItem(name) {
    if (!name) return null;

    // 1) World items
    const worldHit = game.items?.contents?.find(i => i.name === name);
    if (worldHit) return { uuid: worldHit.uuid, name: worldHit.name, img: worldHit.img };

    // 2) Enabled Item compendium packs
    for (const pack of game.packs ?? []) {
      if (pack.metadata?.type !== "Item") continue;
      const index = pack.index ?? await pack.getIndex();
      const entry = index.find(e => e.name === name);
      if (entry) {
        const uuid = `Compendium.${pack.collection}.${entry._id ?? entry.id}`;
        return { uuid, name: entry.name, img: entry.img ?? "" };
      }
    }

    return null;
  }

  /**
   * Create recipe pages in `journal` from a list of catalogue rows.
   * For each row, attempts to resolve the result item from compendiums; rows
   * whose name cannot be found are still imported but without resultUuid/img.
   *
   * @returns {Promise<{ created: number, skipped: string[] }>}
   */
  static async importRows(journal, rows, { max = 100 } = {}) {
    const pagesToCreate = [];
    const skipped = [];

    for (const row of rows.slice(0, max)) {
      const resolved = await RecipeImporter.resolveItem(row.name);
      if (!resolved) skipped.push(row.name);
      pagesToCreate.push({
        name: row.name,
        type: RECIPE_PAGE_TYPE,
        system: buildRecipeSystem(row, resolved),
      });
    }

    if (pagesToCreate.length) {
      await journal.createEmbeddedDocuments("JournalEntryPage", pagesToCreate);
    }
    return { created: pagesToCreate.length, skipped };
  }

  /**
   * Entry point wired to the `/helianas-import <journalName> [max]` chat
   * command. Fetches the bundled catalogue markdown, parses it, and imports
   * into the named journal (creating it if missing).
   */
  static async runCommand(argString) {
    const args = parseCommandArgs(argString);
    if (!args.journalName) {
      ui.notifications.warn(game.i18n.localize("HELIANAS.ImporterUsage"));
      return;
    }

    let journal = game.journal.getName(args.journalName);
    if (!journal) {
      ui.notifications.warn(game.i18n.format("HELIANAS.ImporterNoJournal", { name: args.journalName }));
      return;
    }

    let rows;
    try {
      const res  = await fetch(`modules/${MODULE_ID}/crafting_catalogue_foundry_reference.md`);
      const text = await res.text();
      rows = parseCatalogueMarkdown(text);
    } catch (err) {
      console.error(MODULE_ID, err);
      ui.notifications.error(String(err));
      return;
    }

    ui.notifications.info(game.i18n.format("HELIANAS.ImporterStarted", { count: Math.min(rows.length, args.max) }));
    const { created, skipped } = await RecipeImporter.importRows(journal, rows, { max: args.max });
    ui.notifications.info(game.i18n.format("HELIANAS.ImporterDone", { created, skipped: skipped.length }));
  }
}

function parseCommandArgs(str) {
  const out = { journalName: "", max: 100 };
  if (!str) return out;

  // Match either a "quoted name" or a bare token, followed optionally by a number
  const m = /^\s*(?:"([^"]+)"|(\S+))(?:\s+(\d+))?\s*$/.exec(str);
  if (!m) return out;
  out.journalName = m[1] ?? m[2] ?? "";
  if (m[3]) out.max = Math.max(1, parseInt(m[3], 10));
  return out;
}
