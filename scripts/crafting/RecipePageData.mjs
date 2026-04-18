const { SchemaField, StringField, NumberField, ArrayField } = foundry.data.fields;

function componentSchema() {
  return new SchemaField({
    id:           new StringField({ required: true, blank: false, initial: () => foundry.utils.randomID() }),
    uuid:         new StringField({ required: false, blank: true, initial: "" }),
    name:         new StringField({ required: true, blank: false, initial: "New Component" }),
    img:          new StringField({ required: false, blank: true, initial: "" }),
    quantity:     new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 1 }),
    tags:         new ArrayField(new StringField({ blank: false })),
    mode:         new StringField({ choices: ["some", "every"], initial: "some" }),
    resourcePath: new StringField({ required: false, blank: true, initial: "" }),
  });
}

function ingredientSchema() {
  return new SchemaField({
    id:         new StringField({ required: true, blank: false, initial: () => foundry.utils.randomID() }),
    name:       new StringField({ required: true, blank: false, initial: "New Ingredient" }),
    components: new ArrayField(componentSchema()),
  });
}

export class RecipePageData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      recipeType:     new StringField({ choices: ["manufacturing", "enchanting"], initial: "manufacturing" }),
      resultName:     new StringField({ required: true, blank: true, initial: "" }),
      resultImg:      new StringField({ required: false, blank: true, initial: "" }),
      resultUuid:     new StringField({ required: false, blank: true, initial: "" }),
      resultQuantity: new NumberField({ integer: true, min: 1, initial: 1 }),

      dc:          new NumberField({ integer: true, min: 0, initial: 15 }),
      timeHours:   new NumberField({ nullable: false, min: 0, initial: 8 }),
      toolKey:     new StringField({ required: false, blank: true, initial: "" }),
      toolAbility: new StringField({ required: false, blank: true, initial: "" }),

      ingredients: new ArrayField(ingredientSchema()),

      essenceTierRequired:   new StringField({ required: false, blank: true, initial: "" }),
      componentCreatureType: new StringField({ required: false, blank: true, initial: "" }),
      rarity:                new StringField({ required: false, blank: true, initial: "" }),
      attunement:            new StringField({ required: false, blank: true, initial: "none" }),
    };
  }
}
