import { INGREDIENT_TAGS } from "./constants.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * Opens a dialog to edit a single component. Resolves with the updated
 * component object or null if the user cancelled.
 *
 * @param {object} component  initial values; see RecipePageData component schema
 * @returns {Promise<object|null>}
 */
export async function editComponent(component = {}) {
  const data = {
    id:           component.id ?? foundry.utils.randomID(),
    uuid:         component.uuid ?? "",
    name:         component.name ?? "",
    nameMode:     component.nameMode === "regex" ? "regex" : "exact",
    img:          component.img ?? "",
    quantity:     component.quantity ?? 1,
    tags:         (component.tags ?? []).join(", "),
    mode:         component.mode ?? "some",
    resourcePath: component.resourcePath ?? "",
    tagSuggestions: INGREDIENT_TAGS.join(", "),
  };

  const content = await foundry.applications.handlebars.renderTemplate(
    "modules/helianas-mechanics/templates/crafting/component-edit.hbs",
    data,
  );

  return DialogV2.prompt({
    window: { title: game.i18n.localize("HELIANAS.ComponentEdit") },
    content,
    rejectClose: false,
    ok: {
      label: game.i18n.localize("HELIANAS.Save"),
      callback: (_event, button) => {
        const form = button.form ?? button.closest("form");
        const fd = new foundry.applications.ux.FormDataExtended(form).object;
        return {
          id:           data.id,
          uuid:         fd.uuid ?? "",
          name:         fd.name ?? "",
          nameMode:     fd.nameMode === "regex" ? "regex" : "exact",
          img:          fd.img ?? "",
          quantity:     Number(fd.quantity ?? 1),
          tags:         String(fd.tags ?? "").split(",").map(t => t.trim()).filter(Boolean),
          mode:         fd.mode === "every" ? "every" : "some",
          resourcePath: fd.resourcePath ?? "",
        };
      },
    },
  });
}
