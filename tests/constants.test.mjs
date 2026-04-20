import { describe, it, expect } from "vitest";
import {
  MODULE_ID,
  TOOLS,
  ESSENCE_TIERS,
  ABILITY_LABELS,
  CREATURE_TYPE_SKILLS,
  MFG_FLAWS,
  MFG_BOONS,
  ENC_FLAWS,
  ENC_BOONS,
  FRG_FLAWS,
  FRG_BOONS,
  COOK_FLAWS,
  COOK_BOONS,
  QUIRK_TABLES,
} from "../scripts/crafting/constants.mjs";

describe("MODULE_ID", () => {
  it("matches the id in module.json", () => {
    expect(MODULE_ID).toBe("helianas-mechanics");
  });
});

describe("TOOLS", () => {
  it("every entry has a label and a non-empty abilities array", () => {
    for (const [key, tool] of Object.entries(TOOLS)) {
      expect(tool, `${key} missing label`).toHaveProperty("label");
      expect(Array.isArray(tool.abilities), `${key}.abilities is not an array`).toBe(true);
      expect(tool.abilities.length, `${key}.abilities is empty`).toBeGreaterThan(0);
    }
  });

  it("all abilities are valid 5e stat abbreviations", () => {
    const valid = new Set(["str", "dex", "con", "int", "wis", "cha"]);
    for (const [key, tool] of Object.entries(TOOLS)) {
      for (const a of tool.abilities) {
        expect(valid.has(a), `${key} has invalid ability '${a}'`).toBe(true);
      }
    }
  });

  it("smiths-tools accepts CON or STR", () => {
    expect(TOOLS["smiths-tools"]).toBeDefined();
    expect(TOOLS["smiths-tools"].abilities).toEqual(["con", "str"]);
  });

  it("carpenters-tools accepts DEX or STR", () => {
    expect(TOOLS["carpenters-tools"].abilities).toEqual(["dex", "str"]);
  });
});

describe("ESSENCE_TIERS", () => {
  const expectedTiers = ["frail", "robust", "potent", "mythic", "deific"];

  it("contains exactly the five tiers", () => {
    expect(Object.keys(ESSENCE_TIERS)).toEqual(expectedTiers);
  });

  it("every tier has a label and maxBoons", () => {
    for (const [key, tier] of Object.entries(ESSENCE_TIERS)) {
      expect(tier, `${key} missing label`).toHaveProperty("label");
      expect(tier, `${key} missing maxBoons`).toHaveProperty("maxBoons");
    }
  });

  it("maxBoons is non-decreasing across tiers", () => {
    const boons = expectedTiers.map((k) => ESSENCE_TIERS[k].maxBoons);
    for (let i = 1; i < boons.length; i++) {
      expect(boons[i]).toBeGreaterThanOrEqual(boons[i - 1]);
    }
  });

  it("frail caps at 1, robust at 2, others at 3", () => {
    expect(ESSENCE_TIERS.frail.maxBoons).toBe(1);
    expect(ESSENCE_TIERS.robust.maxBoons).toBe(2);
    expect(ESSENCE_TIERS.potent.maxBoons).toBe(3);
    expect(ESSENCE_TIERS.mythic.maxBoons).toBe(3);
    expect(ESSENCE_TIERS.deific.maxBoons).toBe(3);
  });
});

describe("ABILITY_LABELS", () => {
  it("covers all six core stats", () => {
    for (const stat of ["str", "dex", "con", "int", "wis", "cha"]) {
      expect(ABILITY_LABELS[stat]).toBeDefined();
    }
  });

  it("labels are uppercase abbreviations", () => {
    for (const label of Object.values(ABILITY_LABELS)) {
      expect(label).toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe("CREATURE_TYPE_SKILLS", () => {
  it("contains at least the 14 standard creature types", () => {
    const required = [
      "aberration", "beast", "celestial", "construct", "dragon",
      "elemental", "fey", "fiend", "giant", "humanoid",
      "monstrosity", "ooze", "plant", "undead",
    ];
    for (const type of required) {
      expect(CREATURE_TYPE_SKILLS[type], `missing skill for ${type}`).toBeDefined();
    }
  });

  it("all mapped skills are non-empty strings", () => {
    for (const [type, skill] of Object.entries(CREATURE_TYPE_SKILLS)) {
      expect(typeof skill, `${type} skill is not a string`).toBe("string");
      expect(skill.length, `${type} skill is empty`).toBeGreaterThan(0);
    }
  });
});

describe("MFG_FLAWS", () => {
  it("has at least 10 entries", () => {
    expect(MFG_FLAWS.length).toBeGreaterThanOrEqual(10);
  });

  it("every entry has a name and effect", () => {
    for (const flaw of MFG_FLAWS) {
      expect(flaw).toHaveProperty("name");
      expect(flaw).toHaveProperty("effect");
    }
  });

  it("all names are unique", () => {
    const names = MFG_FLAWS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("MFG_BOONS", () => {
  it("has at least 10 entries", () => {
    expect(MFG_BOONS.length).toBeGreaterThanOrEqual(10);
  });

  it("every entry has a name and effect", () => {
    for (const boon of MFG_BOONS) {
      expect(boon).toHaveProperty("name");
      expect(boon).toHaveProperty("effect");
    }
  });

  it("all names are unique", () => {
    const names = MFG_BOONS.map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("Type-specific quirk tables", () => {
  const tables = {
    ENC_FLAWS, ENC_BOONS,
    FRG_FLAWS, FRG_BOONS,
    COOK_FLAWS, COOK_BOONS,
  };

  for (const [label, table] of Object.entries(tables)) {
    it(`${label} has at least 5 entries`, () => {
      expect(table.length).toBeGreaterThanOrEqual(5);
    });

    it(`${label} entries all have name and effect`, () => {
      for (const row of table) {
        expect(row).toHaveProperty("name");
        expect(row).toHaveProperty("effect");
      }
    });

    it(`${label} names are unique`, () => {
      const names = table.map(r => r.name);
      expect(new Set(names).size).toBe(names.length);
    });
  }
});

describe("QUIRK_TABLES", () => {
  it("has all four recipe types", () => {
    expect(Object.keys(QUIRK_TABLES).sort()).toEqual(
      ["cooking", "enchanting", "forging", "manufacturing"],
    );
  });

  it("each entry has flaws and boons arrays", () => {
    for (const [type, pair] of Object.entries(QUIRK_TABLES)) {
      expect(Array.isArray(pair.flaws), `${type}.flaws not array`).toBe(true);
      expect(Array.isArray(pair.boons), `${type}.boons not array`).toBe(true);
    }
  });

  it("manufacturing points at MFG tables", () => {
    expect(QUIRK_TABLES.manufacturing.flaws).toBe(MFG_FLAWS);
    expect(QUIRK_TABLES.manufacturing.boons).toBe(MFG_BOONS);
  });
});
