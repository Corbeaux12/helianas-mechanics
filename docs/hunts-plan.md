# Hunts Import Plan

Roadmap for importing the Loot Tavern hunt library (`DndAssets/DNDe5/DMContent/Adventures/Hunts` on the server) into the module's compendiums. The **Cracker Kraken** (Release the Kraken) is the completed pilot; everything below follows the same pipeline.

## Source inventory

| Source | Count | Contains | Item data? |
|---|---|---|---|
| `Biomes/X##-*.pdf` + `P###-*.pdf` (Field Notes) | ~35 | Stat block + lore, usually **one craftable item** (with component line, no price) and sometimes a spell or player option | ⚠️ one item each |
| `Multi-level/**` hunt adventures | ~20 | Full hunt: boss stat blocks at 3 APL tiers, harvest table, craftable items, sometimes spells/familiars | ✅ |
| `LT Compendium Vol 1/2 - PAGES.pdf` | 2 | Item compilations | ✅ |
| Bestiary 2025-12 / 2026-01 | 2 | Field-note compilations | ❌ |
| Silverspring Mine / Porvenir (Ship Mimic Items) / Ol' Silver Serpent Saloon | 3 | Adventures with item sheets | ✅ |

Already available elsewhere (don't recreate): `heliana-core` (880 items incl. all 11 core-adventure bosses' gear), `free-loot-tavern-compendium` (99 + 35 items, 2 actors), `helianas-harvesting` (213 components).

## Pipeline (implemented)

1. Transcribe a hunt's crafting data into `tools/data/hunts/<slug>.json`: creature type, PDF path, harvest table, components (name/tags/price), items (type, component, base recipe, tiers with rarity+value, full description HTML).
2. `npm run build:packs` then generates, deterministically:
   - **hunt-items pack** — one Item per rarity tier (description, rarity, attunement, price), the harvested component items, and a `<Boss> Hunt Notes` recipe-book item flagged to unlock the hunt journal.
   - **recipe-collections pack** — a `<Boss> Recipes` journal: harvest table + item links, an embedded **PDF page** pointing at the hunt PDF under `DndAssets`, and one forge recipe per tier (linked result, linked component, base recipe, essence tier, DC/time by rarity).

Per hunt: ~30–45 min transcription. Batch order suggestion: multi-level hunts by APL (they contain the items), then LT Compendium vols for anything not covered.

## Boss actor plan (phase 2, per hunt)

Add an `actor` block to each hunt JSON and extend the builder with a **hunt-bestiary** Actor pack (dnd5e `npc`):

- **Fully implementable from the PDFs:** name, size/type/alignment, AC, HP (+formula), speeds, ability scores, saves, skills, damage/condition immunities & vulnerabilities, senses, languages, CR/XP/PB; **portrait/token** from `Hunts/Biomes/_Art/*.png` (transparent renders + POG tokens exist for most X-series bosses); every trait/action/bonus action/reaction as a feature item with full description text; simple attacks as weapon-type items with attack + damage activities; save-based abilities as save activities with damage and area templates; recharge/per-day uses.
- **Partially implementable (description + manual toggle):** condition riders on hits (Poisoned on failed save — active-effect must be hand-linked), multiattack sequencing (description only), tiered APL variants (ship the mid-tier actor; note the deltas), familiar companions.
- **Not implementable as automation (description-only features):** inter-creature mechanics (e.g. Briar Lord's *Council of Three* shared saving throws and exchanged glaives), transformation/waterspout movement, summon/phase behaviours, lair-scale events. These remain readable on the sheet; the GM adjudicates.

Expected automation coverage per boss: ~70–80 % of actions (plain attacks and save-for-damage), with the signature "gimmick" mechanic usually in the description-only bucket.

## Status

| Hunt | Items | Recipes | Book | Journal+PDF | Actor |
|---|---|---|---|---|---|
| Cracker Kraken (Release the Kraken) | ✅ 3 items × 3 tiers | ✅ | ✅ | ✅ | ⬜ planned |
| Jörmungummdr (Ascent of the Sour Serpent) | ✅ 3 items (8 tiers) | ✅ | ✅ | ✅ | ⬜ |
| Adelifae & Scarab (Garden of Dark Delights) | ✅ 6 items × 3 tiers¹ | ✅ | ✅ | ✅ | ⬜ |
| Bloodhound (The Twilight Hunter) | ✅ 4 items (13 tiers)² | ✅ | ✅ | ✅ | ⬜ |
| Laceleaf Mantid (Leaf Or Death) | ✅ 6 items (18 tiers)⁴ | ✅ | ✅ | ✅ | ⬜ |
| Bread Dragon & Hasbrodeus (Wizards of the Toast) | ✅ 4 items (9 tiers)⁵ | ✅ | ✅ | ✅ | ⬜ |
| Briar Lord (Field Notes X-38) | n/a | n/a | n/a | ⬜ | ✅ pilot actor |
| Cold Blood³ · Bloodfrost of the Fey · Flames of the Faithful · Lure of the Shadowstalker · March of the Living Oasis · The Good/Bad/Oni · Bones N' Roses · Chaos at the Coral Court³ · Dark Wings · Queen of Shadow & Thorn · Spectres of Midwinter · Timekeeper's Trials · Just Desserts · Coral Hive · Throne of the Devourer · Den of the Deceiver · Forge of the Divine Machine · Dragonfruit · Synaptic Shiver · Timeless Tyrant · End Times | ⬜ texts extracted, awaiting transcription | ⬜ | ⬜ | ⬜ | ⬜ |
| — X/P field-note bosses (no items) | n/a | n/a | n/a | ⬜ | ⬜ |

¹ Herculean Horn & Silkspun Lantern values are estimated (they're quest rewards; the PDF prints no price). Herculean Horn uses the generic harvesting component (Monstrosity Horn).
² Cranium Rat Cowl values estimated (appendix bonus item, no price printed). The "Bloody Hairy" magical meal was skipped (cooking recipe with variable rarity — needs a schema extension).
³ Cold Blood on the Scorching Sand and Chaos at the Coral Court use a different section layout — their crafting text needs manual carving.
⁴ S.N.A.R.E. and Honeydew values estimated (appendix bonus items, no printed price); Juice of Partial Polymorph skipped (no crafting component printed).
⁵ Buzzkill values estimated (appendix bonus item, no printed price); its component is the generic Beast Egg (swarm-of-bees eggs). The *sugar rush* and *enrage* spells referenced by Buzzkill/Heart of Stone are not importable as items yet.

**Field-notes actors (new phase, started):** `tools/data/actors/*.json` → hunt-bestiary Actor pack. Done so far (21): Briar Lord (X-38), Zaptor Matriarch + Zaptor (P-006), Mosslax (P-002), Grief Jinn (P-003), Giblin (P-005), Magnétanque (X-21), Somnoblin (X-23), Purrmafrost (X-27), Hivebound Captain (P-001), Skyslumbre (P-004), Teneblaze (P-008), Empathrem (P-009), Stonemaw (X-25), Obakitsu (X-26), Kougaï (P-010), Shahoko (P-011), Enkon (P-012), Painted Lady (X-20, incl. Chroma Cavern lair), Bicephal Wyrmhole (X-22), High Priest of the Astringentum (X-24). All 45 field-note PDFs are text-extracted in the scratchpad; ~24 stat blocks remain (some PDFs carry two), one transcription each.

**Actor automation & assets (done):** stat-block weapon attacks ("Melee/Ranged Weapon Attack: +X … Hit: N (dice) type damage") are parsed by the builder into natural-weapon items with dnd5e attack activities (ability-derived to-hit where str/dex+PB reproduces the printed bonus, flat bonus otherwise; unconditional "plus X (dice) type" riders become extra damage parts; conditional riders stay in the description) — Midi-QoL picks these up natively. Features get themed Foundry-core icons via a keyword map (same `icons/**` convention the dnd5e SRD monsters use — the system's own icons folder is UI glyphs only). Portrait/token art is compressed to bundled webp under `assets/bestiary/` (≤1024px portraits, ≤512px tokens; the 20–54 MB source PNGs stay on the server).

**Field-notes items (discovered):** contrary to the first survey, most field-note PDFs *do* include one craftable item with its component line (e.g. Toothy Brawl ← Pouch of Fey (Giblin) Teeth, Vinecharmer ← Plant (Mosslax) Bark) — no printed prices, so values must be estimated. These can be fed through the existing hunt pipeline (`tools/data/hunts/`) as single-item hunts in a later pass.
