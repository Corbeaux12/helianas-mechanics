import { MFG_FLAWS, MFG_BOONS, ESSENCE_TIERS } from "./constants.mjs";

export class QuirkEngine {
  /**
   * @param {number} rollResult - The total die result
   * @param {number} dc         - The crafting DC
   * @param {string|null} essenceTier - One of the ESSENCE_TIERS keys, or null
   * @returns {{ destroyed: boolean, flaws: object[], boons: object[] }}
   */
  static calculateQuirks(rollResult, dc, essenceTier = null) {
    const delta = rollResult - dc;

    if (delta <= -13) return { destroyed: true, flaws: [], boons: [] };

    let flawCount = 0;
    let boonCount = 0;

    if      (delta <= -9) flawCount = 3;
    else if (delta <= -5) flawCount = 2;
    else if (delta <= -1) flawCount = 1;
    else if (delta <=  4) { /* nothing */ }
    else if (delta <=  8) boonCount = 1;
    else if (delta <= 12) boonCount = 2;
    else                  boonCount = 3;

    // Boons require an essence; cap by tier
    if (boonCount > 0) {
      const cap = essenceTier ? (ESSENCE_TIERS[essenceTier]?.maxBoons ?? 0) : 0;
      boonCount = Math.min(boonCount, cap);
    }

    return {
      destroyed: false,
      flaws: QuirkEngine._rollUnique(MFG_FLAWS, flawCount),
      boons: QuirkEngine._rollUnique(MFG_BOONS, boonCount),
    };
  }

  static _rollUnique(table, count) {
    if (count <= 0) return [];
    const pool = [...table];
    const results = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      results.push(pool.splice(idx, 1)[0]);
    }
    return results;
  }
}
