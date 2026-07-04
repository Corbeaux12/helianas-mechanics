/**
 * Regenerates tools/data/heliana-item-index.json — the name → compendium-UUID
 * index used by build-packs.mjs to link recipe results and components to real
 * items from the installed Heliana modules and the dnd5e system.
 *
 *   node tools/index-heliana-items.mjs <foundry-data-dir>
 *
 * <foundry-data-dir> is the Foundry "Data" directory (or any directory laid
 * out the same way) containing:
 *   modules/heliana-core            (packs + module.json)
 *   modules/helianas-harvesting     (packs + module.json)
 *   systems/dnd5e/packs             (items, equipment24, tradegoods)
 *
 * The repo's own packs/mundane-items is always included. Only item names,
 * UUIDs, icon paths, types, and rarities are recorded — no item content.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ClassicLevel } = require("classic-level");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.argv[2];
if (!dataDir) {
  console.error("Usage: node tools/index-heliana-items.mjs <foundry-data-dir>");
  process.exit(1);
}

const SOURCES = [
  { id: "heliana-core",        manifestPath: path.join(dataDir, "modules", "heliana-core", "module.json") },
  { id: "helianas-harvesting", manifestPath: path.join(dataDir, "modules", "helianas-harvesting", "module.json") },
  { id: "dnd5e", manifest: {
      id: "dnd5e", version: "system", packs: [
        { type: "Item", name: "equipment24", path: "packs/equipment24" },
        { type: "Item", name: "items", path: "packs/items" },
        { type: "Item", name: "tradegoods", path: "packs/tradegoods" },
      ] }, dir: path.join(dataDir, "systems", "dnd5e") },
  { id: "helianas-mechanics", manifest: {
      id: "helianas-mechanics", version: "local", packs: [
        { type: "Item", name: "mundane-items", path: "packs/mundane-items" },
      ] }, dir: ROOT },
];

const items = [];
const meta = [];

for (const src of SOURCES) {
  const manifest = src.manifest ?? JSON.parse(readFileSync(src.manifestPath, "utf8"));
  const dir = src.dir ?? path.dirname(src.manifestPath);
  meta.push(`${manifest.id}@${manifest.version}`);
  for (const pack of manifest.packs) {
    if (pack.type !== "Item") continue;
    // Legacy NeDB packs ("packs/foo.db") are migrated by Foundry v11+ into a
    // LevelDB directory of the same basename.
    const dbDir = path.join(dir, pack.path.replace(/\.db$/, ""));
    if (!existsSync(path.join(dbDir, "CURRENT"))) {
      console.log(`skip (no leveldb): ${manifest.id}/${pack.name}`);
      continue;
    }
    const db = new ClassicLevel(dbDir, { keyEncoding: "utf8", valueEncoding: "json" });
    await db.open();
    let n = 0;
    for await (const [key, doc] of db.iterator()) {
      if (!key.startsWith("!items!")) continue;
      items.push({
        name: doc.name,
        uuid: `Compendium.${manifest.id}.${pack.name}.Item.${doc._id}`,
        img: doc.img ?? "",
        type: doc.type ?? "",
        rarity: doc.system?.rarity ?? "",
        pack: `${manifest.id}.${pack.name}`,
      });
      n++;
    }
    await db.close();
    console.log(`${manifest.id}/${pack.name}: ${n} items`);
  }
}

mkdirSync(path.join(ROOT, "tools", "data"), { recursive: true });
writeFileSync(path.join(ROOT, "tools", "data", "heliana-item-index.json"),
  JSON.stringify({ generated: new Date().toISOString(), modules: meta, items }, null, 2) + "\n");
console.log(`total: ${items.length} items indexed`);
