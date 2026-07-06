# Continuation Guide — Loot Tavern Content Import

Handoff notes for continuing the content-import work in a fresh session (written 2026-07-06, mid-batch). Read `CLAUDE.md` and `docs/hunts-plan.md` first; this file covers the live workflow state that isn't obvious from the repo.

## Where things stand

- **Module version:** 1.12.0 deployed. Everything through commit `c8f700c` is live on the server.
- **Hunt Bestiary: COMPLETE.** All 45 Field Notes PDFs → 57 actors in `tools/data/actors/*.json`. Don't touch unless fixing bugs.
- **Hunt Library: COMPLETE.** All 27 hunt PDFs as image-page journals (`assets/hunts/`, manifest `tools/data/hunt-library.json`).
- **Hunt items: 10 of 27 hunts imported** (`tools/data/hunts/*.json`). Latest batch: Bloodfrost of the Fey, Flames of the Faithful, Lure of the Shadowstalker, March of the Living Oasis.
- **IN FLIGHT (next commit):** two hunts were parsed but their JSONs not yet written — see "In-flight batch data" below. Write those two files, then build/test/verify/deploy as described.

## The per-batch workflow (repeat until done)

1. Pick next `*.craft.txt` from the scratchpad (see below) — work APL-ascending. Remaining: The Good/Bad/Oni (in flight), Bones N' Roses (in flight), Dark Wings, Queen of Shadow & Thorn, Spectres of Midwinter, Timekeeper's Trials, Just Desserts, Coral Hive, Throne of the Devourer, Den of the Deceiver, Forge of the Divine Machine, Dragonfruit, Synaptic Shiver, Timeless Tyrant, End Times. **Cold Blood on the Scorching Sand + Chaos at the Coral Court need manual carving** (different layout — carve from the full `.txt` next to the `.craft.txt`).
2. Transcribe to `tools/data/hunts/<slug>.json` following the schema of `tools/data/hunts/bloodhound.json` (fields: name, source, creatureType, pdf, harvest[], components[], items[]; item fields: name, itemType, kind, component **or** components[], baseRecipe, attunement none/required/optional, tiers[{rarity,value}], description as HTML with `<em>/<strong>/<ul>` formatting).
3. `npm run build:packs` then `npx vitest run` (152 tests must pass).
4. **Verify links** — every recipe page must have linked components and result:
   ```js
   node -e "const d=require('./packs-src/recipe-collections/<slug>-recipes.json');
   for (const p of d.pages.filter(p=>p.type==='helianas-mechanics.recipe')) {
     const ok=p.system.ingredients.flatMap(i=>i.components).every(c=>c.uuid)&&p.system.resultUuid;
     if(!ok) console.log('ISSUE', p.name); }"
   ```
   If a **generic** component doesn't link, its name doesn't match the harvesting module. Search the index: `node -e "const a=require('./tools/data/heliana-item-index.json'); console.log(a.map(i=>i.name).filter(n=>/PATTERN/i.test(n)).join('\n'))"` — e.g. "Undead Fat" is actually **"Undead Rancid Fat"**, will-o'-wisp ichor is **"Undead Ethereal Ichor"**. Boss-specific components (e.g. "Pontiff Molten Eye") are created in the hunt-items pack automatically, so they always link.
5. Update the status table + footnotes in `docs/hunts-plan.md` (footnote estimated prices and skipped items).
6. Commit (message style: `feat: <hunts> — <items>`, end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` — change to the actual model), push, deploy.

## Deploy

SSH creds are in the memory dir (`foundry-deploy-server.md`): `corbo@192.168.0.178`, password works for an askpass script at `$SCRATCHPAD/askpass.sh` (recreate if the scratchpad is gone: a one-line `echo <password>` sh script, then `export SSH_ASKPASS=... SSH_ASKPASS_REQUIRE=force DISPLAY=dummy`).

```bash
ssh corbo@192.168.0.178 'cd /mnt/storage/foundry/data/Data/modules/helianas-mechanics && \
  git stash push -u -m "pre-deploy $(date +%F)" >/dev/null 2>&1; git pull --ff-only; git log --oneline -1'
```
The stash is required — Foundry rotates LevelDB files in `packs/` while running. Never try to systemctl/restart Foundry (blocked); tell the user to restart it.

## Scratchpad (session-specific — may need rebuilding)

Old path: `C:\Users\walru\AppData\Local\Temp\claude\c--Users-walru-Documents-GitHub-helianas-mechanics\<old-session-id>\scratchpad`. A new session gets a NEW scratchpad; the old one may still exist on disk — check for `hunts/txt/*.craft.txt` (27 carved crafting sections), `hunts/fieldnotes-txt/`, `art-src/`, `askpass.sh`, and node_modules with `sharp` + `pdf-to-img`. If gone, re-download hunt PDFs from the server (`.../Adventures/Hunts/Multi-level/**`) and re-carve: extract text with pdf-parse, carve from the "Crafting" heading to the doubled page-heading regex `/Appendix B - [A-Za-z ]+Appendix B/`.

## Conventions & gotchas

- **Component pricing by harvest DC:** DC 5 → 15 gp, DC 10 → 40, DC 15 → 70, DC 20 → 110, DC 25 → 160.
- **Component naming:** `<Boss> <Part>` ("Anglir Fin"), pouches/phials keep the container ("Pouch of Jorfraust Claws", "Phial of Dunedrinker Sap"), harvesting-convention names for motes/cores ("Volatile Mote of Pontiff Wax", "Core of Pontiff Wax").
- **Base recipes** (must match `BASE_RECIPES` names in `tools/build-packs.mjs`): Simple Weapon, Martial Weapon, Magitech Firearm, Wondrous Item, Ring, Rod, Staff, Wand, Shield, Potion Base, Spell Scroll Base, Leather Armor / Breastplate / etc.
- **Magical meals are SKIPPED** (need a cooking-recipe schema extension) — footnote them. Skipped so far: Bloody Hairy, Candlelight Fondue, See-Through Sausage.
- **Duplicates:** S.N.A.R.E. already imported (Leaf Or Death) — skip repeats.
- **Estimated prices** for appendix/treasure items with no printed value — always footnote in hunts-plan.md.
- **`docs/hunts-plan.md` may be touched by a linter mid-session** — re-read before editing if an Edit fails.
- README + `module.json` version bump whenever a pack gains a user-visible feature (CLAUDE.md rule). Content-only additions to existing packs don't need a bump each batch — bump per milestone.

## In-flight batch data (write these two files, then step 3 onward)

### `tools/data/hunts/the-good-the-bad-and-the-oni.json`
Pepper Oni (Fiend), APL 4/8/12. PDF: `DndAssets/DNDe5/DMContent/Adventures/Hunts/Multi-level/4th, 8th, & 12th/The Good, The Bad, and the Oni/The Good, The Bad, and the Oni v1.1 - PAGES.pdf`.
Harvest: DC 10 Eye, DC 15 Horn, DC 20 Heart (volatile). Components: Pepper Oni Eye (40), Pepper Oni Horn (70), Pepper Oni Heart (110), tags ["...", "pepper oni", "fiend"].
Items (descriptions in the old scratchpad craft text, or re-extract):
1. **Capsitoxin** — consumable, "Potion", component Pepper Oni Eye, base "Potion Base", attunement none, U 270 / R 960 / V 4960. Three delivery modes (ingestion/inhalation/injury), DC 15 base.
2. **Pepper Pick** — weapon, "Weapon (war pick)", component Pepper Oni Horn, base "Martial Weapon", attunement required, U 790 / R 3200 / V 12650. +1 weapon, 4 charges, Pepper Pop d4-explosion rider.
3. **Shotgum** — weapon, "Weapon (any firearm)", component Pepper Oni Heart, base "Magitech Firearm", attunement required, U 630 / R 2870 / V 12580. Gumball ammo, Up levitation property.

### `tools/data/hunts/bones-n-roses.json`
Amalgamooze / Ooze Knight-Dragon (Ooze), APL 5/10/15. PDF: `.../Multi-level/5th, 10th, & 15th/BloodNRoses/Bones N' Roses - v1.1-PAGES.pdf`.
Harvest: DC 10 Bone (3), DC 15 Vesicle E+ (5), DC 20 Heart (1). Components: Amalgamooze Bone (40), Amalgamooze Vesicle (70), Amalgamooze Heart (110), tags ["...", "amalgamooze", "ooze"].
Items:
1. **Amalgamask** — equipment, "Wondrous item", component Vesicle, base "Wondrous Item", required, U 650 / R 2100 / V 11500. Fickle Faces expression table (Joyous Laughter→Performance, Raging Scream→Intimidation, Sinister Smile→Deception, Focused Frown→Insight, Pitiful Sob→Persuasion), 2d6 slashing to shift; VR adds Blood of the Guilty.
2. **Heartbeater** — weapon, "Weapon (flail)", component Heart, base "Martial Weapon", required, U 800 / R 2200 / V 11000. Rip Cage (heart into cage, undead type, +1d6 necrotic), Hollow Beat (chill touch DC 15).
3. **Maiden's Tower** — equipment, "Armour (shield)", component Bone, base "Shield", required, U 900 / R 2800 / V 12500. Share the Pain 1d8 retaliation; Locked In (DC 15 Cha banishment demiplane).
4. **Liberator** — weapon, "Weapon (any sword)", component **"Pouch of Celestial Feathers"** (generic — verify against index!), base "Martial Weapon", attunement none, treasure reward with **no printed price → estimate** U 550 / R 2300 / V 9500 (footnote ⁷). Chainbreaker Strike (adv + 2d6 radiant vs grapplers), R adds To the Rescue!, VR +1 weapon and 6d6.

Full item description text for both hunts is in the old scratchpad at `hunts/txt/The_Good_The_Bad_and_the_Oni_v1_1_PAGES.craft.txt` and `hunts/txt/Bones_N_Roses_v1_1_PAGES.craft.txt` — transcribe those verbatim into the `description` HTML (same style as existing hunt JSONs). If the scratchpad is gone, re-extract from the PDFs on the server.

## Backlog after hunts

1. **Field-note single-item pass** — most Field Notes PDFs contain one craftable item with a component line but no price (Toothy Brawl, Vinecharmer, Mantis Menace, Crablaster, Sandripple Spikes, Power Grid set (Bolt Catcher + Static Stabber), Bomb & Weave, Tails of Glory, Lurelimb, Bloodprophet's Eyes, The Steamer, Absolute Zero, Shakwraps, Darkflame's Embrace, Hivecomb Plate, Emotional Dis-Dress, Seam Ripper, Slickshot, Graviturgic Warp-hilt, Toothy Brawl…). Feed them through the hunt pipeline as single-item entries (texts in old scratchpad `hunts/fieldnotes-txt/`).
2. **Cooking-recipe schema extension** for the skipped magical meals.
3. **DndAssets survey** — Maps / Scene Images / Books / Music folders on the server for scenes/adventures packaging (user asked for "everything else you think might be useful").
4. LT Compendium Vol 1/2, Silverspring Mine, Porvenir Ship Mimic Items, Ol' Silver Serpent Saloon item extraction.
5. Unmerged server branch `claude/update-item-tagging-format-1HFFz` (hyphenated tags) — user undecided.
