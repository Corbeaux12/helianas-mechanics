# Continuation Guide — Loot Tavern Content Import

Handoff notes for continuing the content-import work in a fresh session (written 2026-07-06, updated same day after the Opus handoff). Read `CLAUDE.md` and `docs/hunts-plan.md` first; this file covers the live workflow state that isn't obvious from the repo.

## Where things stand

- **Module version:** 1.12.0 deployed. Everything through commit `58583de` is live on the server.
- **Hunt Bestiary: COMPLETE.** All 45 Field Notes PDFs → 57 actors in `tools/data/actors/*.json`. Don't touch unless fixing bugs.
- **Hunt Library: COMPLETE.** All 27 hunt PDFs as image-page journals (`assets/hunts/`, manifest `tools/data/hunt-library.json`).
- **Hunt items: COMPLETE — all 27 of 27 hunts imported** (`tools/data/hunts/*.json`). Latest and last: Chaos at the Coral Court (Pelagia & reefwalkers) — 5 items, 15 recipe pages, all verified linked. Second manual-carve hunt (same "NO CRAFTING SECTION FOUND" issue as Cold Blood; hand-carved from the full `.txt` around line 1571). Two-source hunt (Humanoid Pelagia + Construct reefwalkers, each with their own Harvest Table), no conflicts. Only "Reefwalker Coral Shards" is hunt-specific; everything else (Beast Bone, Volatile Mote of Elemental Water, Humanoid Heart, Phial of Humanoid Blood) is generic.
- **The hunts-import project (the primary task this continuation guide tracked) is done.** No more `tools/data/hunts/*.json` files to write. The "Backlog after hunts" section below is now the active task list — pick from it going forward, starting with item 1 (field-note single-item pass) unless the user directs otherwise.
- **No batch currently in flight.** Nothing pending write.

## Recurring gotcha: crafting-table vs. item-description component conflicts

At least three hunts so far (Queen of Shadow and Thorn, Spectres of Midwinter, The Timekeeper's Trials) have a printed "Crafting" summary table listing one set of components, while at least one individual item description's own "Component:" line names something different. Sometimes the table is right and the description is an OCR-reflow artifact; sometimes it's the reverse (once, it was a genuine cross-contamination from a *different* hunt in the same campaign — Dark Wings, Gleaming Gems's "smokeglass griffon" leaked into The Timekeeper's Trials's Timekeeper's Legacy entry, since both share the "Cult of the Final Hour"/Timespun Sands storyline). **There is no fixed rule for which side is right — always cross-check both against the printed Harvest Table** for that specific hunt; whichever name actually appears there is ground truth. Do this check on every future hunt before finalizing components.

## The per-batch workflow (for hunt-items — kept for reference; all 27 hunts are done, but the same pattern applies to the field-note single-item pass in the backlog below)

1. Pick the next source text (field-note PDF, in the backlog phase).
2. Transcribe to `tools/data/hunts/<slug>.json` following the schema of `tools/data/hunts/bloodhound.json` (fields: name, source, creatureType, pdf, harvest[], components[], items[]; item fields: name, itemType, kind, component **or** components[], baseRecipe, attunement none/required/optional, tiers[{rarity,value}], description as HTML with `<em>/<strong>/<ul>` formatting). If a source's `.craft.txt` says "NO CRAFTING SECTION FOUND", grep the full `.txt` for "Harvest"/"Crafting" and hand-carve the section instead (happened for both Cold Blood on the Scorching Sand and Chaos at the Coral Court).
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

## Backlog after hunts

1. **Field-note single-item pass** — most Field Notes PDFs contain one craftable item with a component line but no price (Toothy Brawl, Vinecharmer, Mantis Menace, Crablaster, Sandripple Spikes, Power Grid set (Bolt Catcher + Static Stabber), Bomb & Weave, Tails of Glory, Lurelimb, Bloodprophet's Eyes, The Steamer, Absolute Zero, Shakwraps, Darkflame's Embrace, Hivecomb Plate, Emotional Dis-Dress, Seam Ripper, Slickshot, Graviturgic Warp-hilt, Toothy Brawl…). Feed them through the hunt pipeline as single-item entries (texts in old scratchpad `hunts/fieldnotes-txt/`).
2. **Cooking-recipe schema extension** for the skipped magical meals.
3. **DndAssets survey** — Maps / Scene Images / Books / Music folders on the server for scenes/adventures packaging (user asked for "everything else you think might be useful").
4. LT Compendium Vol 1/2, Silverspring Mine, Porvenir Ship Mimic Items, Ol' Silver Serpent Saloon item extraction.
5. Unmerged server branch `claude/update-item-tagging-format-1HFFz` (hyphenated tags) — user undecided.
