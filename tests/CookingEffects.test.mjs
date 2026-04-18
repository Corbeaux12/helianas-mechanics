import { describe, it, expect } from "vitest";
import { buildCookingEffects } from "../scripts/crafting/CookingEffects.mjs";

describe("buildCookingEffects", () => {
  it("produces one effect per boon and flaw", () => {
    const effects = buildCookingEffects(
      [{ name: "Lively", effect: "Advantage on next initiative." }],
      [{ name: "Bland",  effect: "No nourishment." }],
    );
    expect(effects).toHaveLength(2);
  });

  it("tags boons and flaws with a cookingBuff flag", () => {
    const [boon] = buildCookingEffects(
      [{ name: "Savoury", effect: "Advantage on Persuasion." }],
      [],
    );
    expect(boon.flags["helianas-mechanics"].cookingBuff).toBe("boon");

    const [flaw] = buildCookingEffects(
      [],
      [{ name: "Greasy", effect: "Ruins the pot." }],
    );
    expect(flaw.flags["helianas-mechanics"].cookingBuff).toBe("flaw");
  });

  it("sets a 1-hour duration on each effect", () => {
    const [e] = buildCookingEffects([{ name: "Warming", effect: "Cold immunity." }], []);
    expect(e.duration.seconds).toBe(3600);
  });

  it("returns empty array when both lists are empty", () => {
    expect(buildCookingEffects([], [])).toEqual([]);
    expect(buildCookingEffects()).toEqual([]);
  });

  it("embeds the effect description in the HTML", () => {
    const [e] = buildCookingEffects([{ name: "Hearty", effect: "Counts as a full meal." }], []);
    expect(e.description).toContain("Counts as a full meal.");
  });

  it("attaches a suggested hp.tempmax change for Fortifying", () => {
    const [e] = buildCookingEffects([{ name: "Fortifying", effect: "Temp HP." }], []);
    expect(e.changes).toHaveLength(1);
    expect(e.changes[0].key).toBe("system.attributes.hp.tempmax");
  });

  it("attaches a cold-immunity change for Warming", () => {
    const [e] = buildCookingEffects([{ name: "Warming", effect: "Immune to cold." }], []);
    expect(e.changes[0].value).toBe("cold");
  });

  it("attaches a movement reduction for Heavy flaw", () => {
    const [e] = buildCookingEffects([], [{ name: "Heavy", effect: "Slower." }]);
    expect(e.changes[0].key).toBe("system.attributes.movement.walk");
  });

  it("leaves changes empty for boons with no known mapping", () => {
    const [e] = buildCookingEffects([{ name: "Aromatic", effect: "Smells nice." }], []);
    expect(e.changes).toEqual([]);
  });
});
