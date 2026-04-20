import { MODULE_ID } from "./constants.mjs";
import { buildCookingEffects } from "./CookingEffects.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class CraftingTracker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "helianas-crafting-tracker",
    position: { width: 560, height: 480 },
    window: { title: "HELIANAS.CraftingTracker", resizable: true, icon: "fa-regular fa-hourglass-half" },
    actions: {
      addHour:     CraftingTracker.#addHour,
      addDay:      CraftingTracker.#addDay,
      cancelCraft: CraftingTracker.#cancelCraft,
    },
  };

  static PARTS = {
    main: { template: "modules/helianas-mechanics/templates/crafting/tracker.hbs" },
  };

  // Singleton
  static #instance = null;
  static get instance() {
    if (!CraftingTracker.#instance) CraftingTracker.#instance = new CraftingTracker();
    return CraftingTracker.#instance;
  }
  static open() { CraftingTracker.instance.render({ force: true }); }

  // ------------------------------------------------------------------ context

  _prepareContext() {
    const userId = game.user.id;
    const all    = game.settings.get(MODULE_ID, "activeCrafts") ?? [];
    const mine   = all.filter(c => c.userId === userId);

    return {
      crafts: mine.map(c => ({
        id:             c.id,
        name:           c.recipeName,
        img:            c.resultItemData?.img || "icons/svg/item-bag.svg",
        totalHours:     c.totalHours,
        completedHours: c.completedHours,
        pct:            Math.min(100, Math.floor((c.completedHours / c.totalHours) * 100)),
      })),
    };
  }

  // ------------------------------------------------------------------ actions

  static async #addHour(event, target) {
    await CraftingTracker.#advance.call(this, target.dataset.craftId, 1);
  }

  static async #addDay(event, target) {
    await CraftingTracker.#advance.call(this, target.dataset.craftId, 24);
  }

  static async #advance(craftId, hours) {
    const all = game.settings.get(MODULE_ID, "activeCrafts") ?? [];
    const idx = all.findIndex(c => c.id === craftId);
    if (idx < 0) return;

    all[idx].completedHours = Math.min(all[idx].totalHours, all[idx].completedHours + hours);

    if (all[idx].completedHours >= all[idx].totalHours) {
      await CraftingTracker._completeCraft(all[idx]);
      all.splice(idx, 1);
    }

    await game.settings.set(MODULE_ID, "activeCrafts", all);
    this.render();
  }

  static async #cancelCraft(event, target) {
    const craftId = target.dataset.craftId;
    const confirmed = await DialogV2.confirm({
      window:  { title: game.i18n.localize("HELIANAS.CancelCraftTitle") },
      content: `<p>${game.i18n.localize("HELIANAS.CancelCraftConfirm")}</p>`,
    });
    if (!confirmed) return;

    const filtered = (game.settings.get(MODULE_ID, "activeCrafts") ?? [])
      .filter(c => c.id !== craftId);
    await game.settings.set(MODULE_ID, "activeCrafts", filtered);
    this.render();
  }

  // ------------------------------------------------------------------ completion

  static async _completeCraft(craft) {
    const actor = game.actors.get(craft.actorId);
    if (!actor) return;

    const isCooking = craft.recipeType === "cooking";
    const effects   = isCooking ? buildCookingEffects(craft.boons, craft.quirks) : [];

    // Clone the recipe's linked result item so the player receives a real copy
    // — description, activities, damage, etc. all come along. When no UUID is
    // linked (legacy crafts or authored-by-hand recipes), fall back to the
    // stored name/img snapshot.
    let base = null;
    if (craft.resultUuid) {
      const source = await fromUuid(craft.resultUuid).catch(() => null);
      if (source) {
        base = source.toObject();
        delete base._id;
        delete base.folder;
        delete base.sort;
        delete base.ownership;
      }
    }
    if (!base) base = { ...craft.resultItemData };

    const mergedFlags = foundry.utils.mergeObject(base.flags ?? {}, {
      [MODULE_ID]: {
        quirks:     craft.quirks,
        boons:      craft.boons,
        recipeType: craft.recipeType ?? null,
      },
    });
    const mergedEffects = [...(base.effects ?? []), ...effects];

    await actor.createEmbeddedDocuments("Item", [{
      ...base,
      ...(isCooking ? { type: "consumable" } : {}),
      effects: mergedEffects,
      flags:   mergedFlags,
    }]);

    const flawList = craft.quirks?.length
      ? craft.quirks.map(f => `<li><strong>${f.name}:</strong> ${f.effect}</li>`).join("")
      : `<li>${game.i18n.localize("HELIANAS.NoFlaws")}</li>`;
    const boonList = craft.boons?.length
      ? craft.boons.map(b => `<li><strong>${b.name}:</strong> ${b.effect}</li>`).join("")
      : `<li>${game.i18n.localize("HELIANAS.NoBoons")}</li>`;

    ChatMessage.create({
      content: `<div class="hm-chat-message">
        <h3>⚒ ${craft.recipeName} — ${game.i18n.localize("HELIANAS.CraftComplete")} 🎉</h3>
        <p><strong>${game.i18n.localize("HELIANAS.Flaws")}:</strong></p><ul>${flawList}</ul>
        <p><strong>${game.i18n.localize("HELIANAS.Boons")}:</strong></p><ul>${boonList}</ul>
      </div>`,
      speaker: ChatMessage.getSpeaker({ actor }),
    });
  }
}
