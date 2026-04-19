import { MODULE_ID } from "./constants.mjs";

const HOUR_SECONDS = 3600;

/**
 * Build ActiveEffect data from cooking quirks/boons for attachment to the
 * consumable item that the tracker produces. Each entry has a 1-hour duration
 * and is flagged so the sheet can render them consistently.
 *
 * We do NOT try to translate every named boon into dnd5e attribute changes —
 * doing so reliably requires system-specific knowledge that is outside the
 * module's scope. Instead, each effect carries a description the player can
 * read and, where the boon name matches a known pattern, a suggested change
 * key is attached so integrators can pick it up.
 *
 * @param {{name: string, effect: string}[]} boons
 * @param {{name: string, effect: string}[]} flaws
 * @returns {object[]} ActiveEffect data objects
 */
export function buildCookingEffects(boons = [], flaws = []) {
  const effects = [];
  for (const b of boons) effects.push(_makeEffect(b, "boon"));
  for (const f of flaws) effects.push(_makeEffect(f, "flaw"));
  return effects;
}

function _makeEffect(quirk, kind) {
  return {
    name:        quirk.name,
    icon:        kind === "boon"
      ? "icons/consumables/food/berries-ration-round-red.webp"
      : "icons/consumables/food/rations-burned-leather.webp",
    description: `<p>${quirk.effect}</p>`,
    duration:    { seconds: HOUR_SECONDS },
    disabled:    false,
    transfer:    true,
    changes:     _suggestedChanges(quirk, kind),
    flags:       {
      [MODULE_ID]: { cookingBuff: kind, source: quirk.name },
    },
  };
}

// Minimal, deliberately-conservative suggestions. Anything not listed here
// still gets a named, descriptive effect — just no attribute-level changes.
const BOON_CHANGE_HINTS = {
  "Fortifying":   [{ key: "system.attributes.hp.tempmax", mode: 2, value: "@prof", priority: 20 }],
  "Warming":      [{ key: "system.traits.ci.value", mode: 2, value: "cold", priority: 20 }],
  "Nourishing":   [{ key: "system.attributes.hd.max", mode: 2, value: "1", priority: 20 }],
};

const FLAW_CHANGE_HINTS = {
  "Heavy":        [{ key: "system.attributes.movement.walk", mode: 2, value: "-5", priority: 20 }],
};

function _suggestedChanges(quirk, kind) {
  const table = kind === "boon" ? BOON_CHANGE_HINTS : FLAW_CHANGE_HINTS;
  return table[quirk.name] ?? [];
}
