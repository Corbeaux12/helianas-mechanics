import { describe, it, expect, vi } from "vitest";
import { QuirkEngine } from "../scripts/crafting/QuirkEngine.mjs";
import {
  MFG_FLAWS, MFG_BOONS,
  ENC_FLAWS, ENC_BOONS,
  FRG_FLAWS, FRG_BOONS,
  COOK_FLAWS, COOK_BOONS,
} from "../scripts/crafting/constants.mjs";

// ── Destruction boundary ──────────────────────────────────────────────────────

describe("calculateQuirks — destruction", () => {
  it("destroys item when delta is exactly -13", () => {
    const r = QuirkEngine.calculateQuirks(4, 17);
    expect(r).toEqual({ destroyed: true, flaws: [], boons: [] });
  });

  it("destroys item when delta is below -13", () => {
    const r = QuirkEngine.calculateQuirks(1, 20);
    expect(r.destroyed).toBe(true);
  });

  it("does NOT destroy at delta -12", () => {
    const r = QuirkEngine.calculateQuirks(5, 17);
    expect(r.destroyed).toBe(false);
  });
});

// ── Flaw counts ───────────────────────────────────────────────────────────────

describe("calculateQuirks — flaws", () => {
  it("gives 3 flaws for delta -12 (boundary)", () => {
    const r = QuirkEngine.calculateQuirks(5, 17);
    expect(r.flaws).toHaveLength(3);
    expect(r.boons).toHaveLength(0);
  });

  it("gives 3 flaws for delta -9 (boundary)", () => {
    const r = QuirkEngine.calculateQuirks(8, 17);
    expect(r.flaws).toHaveLength(3);
  });

  it("gives 2 flaws for delta -8 (boundary)", () => {
    const r = QuirkEngine.calculateQuirks(9, 17);
    expect(r.flaws).toHaveLength(2);
  });

  it("gives 2 flaws for delta -5 (boundary)", () => {
    const r = QuirkEngine.calculateQuirks(12, 17);
    expect(r.flaws).toHaveLength(2);
  });

  it("gives 1 flaw for delta -4 (boundary)", () => {
    const r = QuirkEngine.calculateQuirks(13, 17);
    expect(r.flaws).toHaveLength(1);
  });

  it("gives 1 flaw for delta -1 (boundary)", () => {
    const r = QuirkEngine.calculateQuirks(16, 17);
    expect(r.flaws).toHaveLength(1);
  });

  it("gives no flaws for delta 0", () => {
    const r = QuirkEngine.calculateQuirks(17, 17);
    expect(r.flaws).toHaveLength(0);
  });
});

// ── Boon counts (with and without essence) ───────────────────────────────────

describe("calculateQuirks — boons without essence", () => {
  it("gives 0 boons for delta +5 when no essence", () => {
    const r = QuirkEngine.calculateQuirks(22, 17);
    expect(r.boons).toHaveLength(0);
  });

  it("gives 0 boons for delta +13 when no essence", () => {
    const r = QuirkEngine.calculateQuirks(30, 17);
    expect(r.boons).toHaveLength(0);
  });
});

describe("calculateQuirks — boons with frail essence (cap 1)", () => {
  it("gives 1 boon for delta +5", () => {
    const r = QuirkEngine.calculateQuirks(22, 17, "frail");
    expect(r.boons).toHaveLength(1);
  });

  it("caps at 1 boon for delta +9 (would be 2)", () => {
    const r = QuirkEngine.calculateQuirks(26, 17, "frail");
    expect(r.boons).toHaveLength(1);
  });

  it("caps at 1 boon for delta +13 (would be 3)", () => {
    const r = QuirkEngine.calculateQuirks(30, 17, "frail");
    expect(r.boons).toHaveLength(1);
  });
});

describe("calculateQuirks — boons with robust essence (cap 2)", () => {
  it("gives 1 boon for delta +5", () => {
    const r = QuirkEngine.calculateQuirks(22, 17, "robust");
    expect(r.boons).toHaveLength(1);
  });

  it("gives 2 boons for delta +9", () => {
    const r = QuirkEngine.calculateQuirks(26, 17, "robust");
    expect(r.boons).toHaveLength(2);
  });

  it("caps at 2 boons for delta +13 (would be 3)", () => {
    const r = QuirkEngine.calculateQuirks(30, 17, "robust");
    expect(r.boons).toHaveLength(2);
  });
});

describe("calculateQuirks — boons with potent/mythic/deific essence (cap 3)", () => {
  for (const tier of ["potent", "mythic", "deific"]) {
    it(`gives 3 boons for delta +13 with ${tier}`, () => {
      const r = QuirkEngine.calculateQuirks(30, 17, tier);
      expect(r.boons).toHaveLength(3);
    });

    it(`gives 2 boons for delta +9 with ${tier}`, () => {
      const r = QuirkEngine.calculateQuirks(26, 17, tier);
      expect(r.boons).toHaveLength(2);
    });
  }
});

// ── Neutral zone ─────────────────────────────────────────────────────────────

describe("calculateQuirks — neutral zone (delta 0 to +4)", () => {
  for (const delta of [0, 1, 2, 3, 4]) {
    it(`gives no quirks for delta +${delta}`, () => {
      const r = QuirkEngine.calculateQuirks(17 + delta, 17, "potent");
      expect(r.destroyed).toBe(false);
      expect(r.flaws).toHaveLength(0);
      expect(r.boons).toHaveLength(0);
    });
  }
});

// ── Result structure ──────────────────────────────────────────────────────────

describe("calculateQuirks — result shape", () => {
  it("returned flaws are entries from MFG_FLAWS", () => {
    const r = QuirkEngine.calculateQuirks(5, 17);
    for (const flaw of r.flaws) {
      expect(MFG_FLAWS).toContainEqual(flaw);
    }
  });

  it("returned boons are entries from MFG_BOONS", () => {
    const r = QuirkEngine.calculateQuirks(30, 17, "potent");
    for (const boon of r.boons) {
      expect(MFG_BOONS).toContainEqual(boon);
    }
  });

  it("returned flaws are unique (no duplicates)", () => {
    const r = QuirkEngine.calculateQuirks(5, 17);
    const names = r.flaws.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("returned boons are unique (no duplicates)", () => {
    const r = QuirkEngine.calculateQuirks(30, 17, "potent");
    const names = r.boons.map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ── Type-specific quirk tables ────────────────────────────────────────────────

describe("calculateQuirks — type-specific tables", () => {
  it("uses manufacturing tables by default", () => {
    const r = QuirkEngine.calculateQuirks(5, 17);
    for (const flaw of r.flaws) expect(MFG_FLAWS).toContainEqual(flaw);
  });

  it("uses enchanting tables when recipeType='enchanting'", () => {
    const r = QuirkEngine.calculateQuirks(5, 17, null, "enchanting");
    for (const flaw of r.flaws) expect(ENC_FLAWS).toContainEqual(flaw);
  });

  it("draws enchanting boons when recipeType='enchanting'", () => {
    const r = QuirkEngine.calculateQuirks(30, 17, "potent", "enchanting");
    for (const boon of r.boons) expect(ENC_BOONS).toContainEqual(boon);
  });

  it("uses forging tables when recipeType='forging'", () => {
    const r = QuirkEngine.calculateQuirks(5, 17, null, "forging");
    for (const flaw of r.flaws) expect(FRG_FLAWS).toContainEqual(flaw);
  });

  it("draws forging boons when recipeType='forging'", () => {
    const r = QuirkEngine.calculateQuirks(30, 17, "potent", "forging");
    for (const boon of r.boons) expect(FRG_BOONS).toContainEqual(boon);
  });

  it("uses cooking tables when recipeType='cooking'", () => {
    const r = QuirkEngine.calculateQuirks(5, 17, null, "cooking");
    for (const flaw of r.flaws) expect(COOK_FLAWS).toContainEqual(flaw);
  });

  it("draws cooking boons when recipeType='cooking'", () => {
    const r = QuirkEngine.calculateQuirks(30, 17, "potent", "cooking");
    for (const boon of r.boons) expect(COOK_BOONS).toContainEqual(boon);
  });

  it("falls back to manufacturing tables on unknown recipeType", () => {
    const r = QuirkEngine.calculateQuirks(5, 17, null, "not-a-real-type");
    for (const flaw of r.flaws) expect(MFG_FLAWS).toContainEqual(flaw);
  });
});

// ── _rollUnique internals ─────────────────────────────────────────────────────

describe("_rollUnique", () => {
  it("returns empty array for count 0", () => {
    expect(QuirkEngine._rollUnique(MFG_FLAWS, 0)).toEqual([]);
  });

  it("returns empty array for negative count", () => {
    expect(QuirkEngine._rollUnique(MFG_FLAWS, -1)).toEqual([]);
  });

  it("returns correct number of items", () => {
    const result = QuirkEngine._rollUnique(MFG_FLAWS, 3);
    expect(result).toHaveLength(3);
  });

  it("does not return more items than the table has", () => {
    const tiny = [{ name: "A" }, { name: "B" }];
    const result = QuirkEngine._rollUnique(tiny, 10);
    expect(result).toHaveLength(2);
  });

  it("does not mutate the original table", () => {
    const original = [...MFG_FLAWS];
    QuirkEngine._rollUnique(MFG_FLAWS, 5);
    expect(MFG_FLAWS).toHaveLength(original.length);
  });

  it("uses Math.random for selection (deterministic when mocked)", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    const table = [{ name: "First" }, { name: "Second" }, { name: "Third" }];
    const result = QuirkEngine._rollUnique(table, 1);
    expect(result[0].name).toBe("First");
    spy.mockRestore();
  });
});
