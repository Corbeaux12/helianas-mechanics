# Lair Scenes — Import Plan

Documents how the `lair-scenes` Scene compendium was built: 28 lair-bearing creatures across the 27 multi-level hunts and the Hunt Bestiary, matched to battle-map art **by name only** (no visual inspection of map content), per the user's request. 77 Scene documents total.

## Method

1. Confirmed every one of the 27 multi-level hunt bosses has a printed "Lair Actions" section (grepped the cached hunt texts — all 27 hit).
2. Surveyed the server's `DndAssets/DNDe5/DMContent/Adventures/Hunts/Multi-level/**` folders for hunt-bundled map zips (`*Maps.zip`, `*Extended_Maps.zip`, `*Battle Maps.zip`) and the generic `DndAssets/DNDe5/DMContent/Maps/` + `Scene Images/` libraries (587 + 139 named packs) for thematically-matching substitutes where a hunt shipped no map of its own.
3. Converted everything to compressed webp (quality 82, capped at 6000px on the long side) into `assets/scenes/<slug>/`, and wrote `tools/data/scene-library.json` as the build manifest. `tools/build-packs.mjs`'s `buildScenes()` turns that into the `lair-scenes` pack — one Scene document per image.
4. Grid is left at Foundry's default (100px/square, 5ft) for every scene; none were visually calibrated against the packs' printed `[WxH]`-square dimensions (recorded in `flags.helianas-mechanics.gridSquares` where known) — a GM should use Foundry's Configure Grid tool per scene before running it, same as any imported community map.

## Source types

- **`hunt-map-pack`** (9 creatures, all variants included) — the creature's own official Loot Tavern battle-map pack, exactly as bundled with that hunt's PDF.
- **`preview-map`** (2 creatures) — only a single watermarked preview JPG exists locally (no full pack was ever downloaded to this server).
- **`thematic-match`** (15 creatures) — **no official map exists for this creature at all.** Substituted the nearest same-vibe generic pack purely by name (e.g. "Release the Kraken" → "Beached Kraken"). These are *not* that creature's own art — `flags.helianas-mechanics.matchedPack` records which generic pack was used, and it's called out in the Scene's name/flags so it's never confused with official content.

## Coverage table

| Creature | Hunt / Source | Type | Matched pack (if substitute) |
|---|---|---|---|
| Kaftar Matriarch (Oumdabaa) | Cold Blood on the Scorching Sand | hunt-map-pack | — |
| Laceleaf Mantid | Leaf Or Death | hunt-map-pack | — |
| Bread Dragon & Hasbrodeus | Wizards of the Toast | hunt-map-pack | — |
| Pontiff | Flames of the Faithful | hunt-map-pack | — |
| Anglir | Lure of the Shadowstalker | hunt-map-pack | — |
| Chronosphinx | The Timekeeper's Trials | hunt-map-pack | — |
| Valtharyx (Coral Dragon Turtle) | Scourge of the Coral Hive | hunt-map-pack | — |
| Tomb Tyrant (Firaain) | Tomb of the Timeless Tyrant | hunt-map-pack | — |
| Paradox Dragon | End Times | hunt-map-pack | — |
| Shaitan | Den of the Deceiver | preview-map | — |
| Storm Dragonray | The Synaptick Shiver | preview-map | — |
| Bloodhound | The Twilight Hunter | thematic-match | Village Hunting Guild |
| Adelifae & Scarab | Garden of Dark Delights | thematic-match | Fey Vineyard |
| Cracker Kraken | Release the Kraken | thematic-match | Beached Kraken |
| Queen of Brambles | Queen of Shadow and Thorn | thematic-match | Flooded Fey Ruins |
| The Krampus | Spectres of Midwinter | thematic-match | Lich Catacomb |
| Jorfraust | Bloodfrost of the Fey | thematic-match | Melting Glacier |
| Pepper Oni | The Good, The Bad, and the Oni | thematic-match | Oni Hideout |
| Unit M3T4L and Creo | Forge of the Divine Machine | thematic-match | Steampunk Warforged Factory |
| Celestial Devourer | Throne of the Devourer | thematic-match | Celestial Realm |
| Amalgamooze | Bones N' Roses | thematic-match | Dragon's Hoard |
| Painted Lady | Field Notes X-20 (lair) | thematic-match | Grand Opera House |
| Bladeborne Mantiroar | Field Notes X-28 (lair) | thematic-match | Ancient Battlefield |
| Reef Avatar | Field Notes X-29 (lair) | thematic-match | Deep Sea Temple |
| Draconimbus | Field Notes X-35 (lair) | thematic-match | Black Dragon Lair |
| Growlbear the Grand & Swallybog | Field Notes X-43 (lair) | thematic-match | Bullywug Swamp |
| Dunedrinker | March of the Living Oasis | thematic-match | Oasis Expedition |
| Ice Queen | Just Desserts | thematic-match | Candy Castle |

## Not covered

- **Jörmungummdr** (Ascent of the Sour Serpent) — no map pack exists locally, and no serpent/naga-themed map was found in either generic library. Genuinely unmatched; would need sourcing from elsewhere.
- **Dark Wings Gleaming Gems, Lair of the Spoiled Dragonfruit, Chaos at the Coral Court** — each has only a single non-grid "Landscape" concept-art image bundled in its Digital Assets zip (not a real battle map). Per explicit decision, these were left out of the scene pack rather than passing off concept art as a battle map. A `Cze Peku/Chaos at the Coral Court Adventure` folder looked promising by name but turned out to be unrelated 2020 item-card art on inspection, not a map — confirms the "name-only" method occasionally needs a sanity check when a hit seems too convenient.
- Every hunt boss except **Jörmungummdr** (Ascent of the Sour Serpent) has *some* scene — 23 of the 27 multi-level hunts are covered directly (9 hunt-map-pack + 2 preview-map + 12 thematic-match), plus 5 Field Notes lair actors, for 28 creatures / 27 hunts total (23 covered, 1 unmatched, 3 excluded).
