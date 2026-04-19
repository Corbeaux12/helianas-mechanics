import { describe, it, expect } from "vitest";
import { parseCatalogueMarkdown, buildRecipeSystem } from "../scripts/crafting/RecipeImporter.mjs";

const SAMPLE = `
## PART 6: STUFF

nothing to see here

## PART 7: MAGIC ITEM RECIPES

### Rings
| Name | Value | Rarity | Att | Type | Metatag | Component |
|------|-------|--------|-----|------|---------|-----------|
| Ring of Jumping | 1,000 | U | Req | Beast | Frog or toad | Bone |
| Ring of Regeneration | 12,000 | V | Req | Plant | | Membrane |
| Ring of Three Wishes | 150,000 | L | —,C | Humanoid | Halfling | Heart |

### Potions
| Name | Value | Rarity | Type | Metatag | Component |
|------|-------|--------|------|---------|-----------|
| Potion of Healing | 50 | C | Beast | | Fat |
| Potion of Speed | 4,800 | V | Fey | | Liver |

## PART 8: AFTER

should be ignored
| Name | Value |
|------|-------|
| Ignored | 999 |
`;

describe("parseCatalogueMarkdown", () => {
  it("only includes rows from Part 7", () => {
    const rows = parseCatalogueMarkdown(SAMPLE);
    expect(rows.find(r => r.name === "Ignored")).toBeUndefined();
    expect(rows).toHaveLength(5);
  });

  it("captures section names", () => {
    const rows = parseCatalogueMarkdown(SAMPLE);
    expect(rows.filter(r => r.section === "Rings")).toHaveLength(3);
    expect(rows.filter(r => r.section === "Potions")).toHaveLength(2);
  });

  it("parses columns consistently even when schemas differ between sections", () => {
    const rows = parseCatalogueMarkdown(SAMPLE);
    const ring = rows.find(r => r.name === "Ring of Jumping");
    expect(ring.rarity).toBe("U");
    expect(ring.att).toBe("Req");
    expect(ring.type).toBe("Beast");
    expect(ring.component).toBe("Bone");

    // Potions table has no Att column
    const potion = rows.find(r => r.name === "Potion of Healing");
    expect(potion.rarity).toBe("C");
    expect(potion.type).toBe("Beast");
    expect(potion.component).toBe("Fat");
    expect(potion.att).toBeUndefined();
  });
});

describe("buildRecipeSystem", () => {
  it("maps a common catalogue row to manufacturing defaults", () => {
    const sys = buildRecipeSystem({ name: "Potion of Healing", rarity: "C", type: "Beast", component: "Fat" });
    expect(sys.recipeType).toBe("enchanting");
    expect(sys.resultName).toBe("Potion of Healing");
    expect(sys.dc).toBe(12);
    expect(sys.timeHours).toBe(1);
    expect(sys.essenceTierRequired).toBe("");
    expect(sys.rarity).toBe("common");
    expect(sys.componentCreatureType).toBe("beast");
  });

  it("derives essence tier, DC and hours from rarity letter", () => {
    const v = buildRecipeSystem({ name: "Ring of Regeneration", rarity: "V", type: "Plant", component: "Membrane", att: "Req" });
    expect(v.essenceTierRequired).toBe("potent");
    expect(v.dc).toBe(21);
    expect(v.timeHours).toBe(160);
    expect(v.attunement).toBe("required");
  });

  it("picks the first rarity letter when a range is listed", () => {
    const sys = buildRecipeSystem({ name: "Ring of X", rarity: "U→R", type: "Dragon", component: "Eye" });
    expect(sys.rarity).toBe("uncommon");
    expect(sys.essenceTierRequired).toBe("frail");
  });

  it("reduces a compound component to the first alternate", () => {
    const sys = buildRecipeSystem({ name: "Ring", rarity: "R", type: "Beast", component: "Eye or Bone" });
    expect(sys.ingredients[0].components[0].name).toBe("Eye");
  });

  it("merges a resolved item's UUID + image into the result", () => {
    const sys = buildRecipeSystem(
      { name: "Potion of Healing", rarity: "C", type: "Beast", component: "Fat" },
      { uuid: "Compendium.dnd5e.items.abc", name: "Potion of Healing", img: "icons/fat.webp" },
    );
    expect(sys.resultUuid).toBe("Compendium.dnd5e.items.abc");
    expect(sys.resultImg).toBe("icons/fat.webp");
  });

  it("maps the dash attunement marker to 'none'", () => {
    const sys = buildRecipeSystem({ name: "+1 Ammunition", rarity: "U", type: "Beast", component: "Pouch of teeth", att: "—" });
    expect(sys.attunement).toBe("none");
  });

  it("ignores creature types that are not in the CREATURE_TYPE_SKILLS table", () => {
    const sys = buildRecipeSystem({ name: "Thing", rarity: "U", type: "Material", component: "Adamantine" });
    expect(sys.componentCreatureType).toBe("");
  });

  it("returns empty ingredients when the component column is blank", () => {
    const sys = buildRecipeSystem({ name: "Thing", rarity: "U", type: "Beast", component: "" });
    expect(sys.ingredients).toEqual([]);
  });
});
