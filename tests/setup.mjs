// Minimal Foundry VTT global mocks — enough for unit-testing pure logic.

global.CONST = {
  DOCUMENT_OWNERSHIP_LEVELS: {
    NONE: 0,
    LIMITED: 1,
    OBSERVER: 2,
    OWNER: 3,
  },
};

global.game = {
  user: { id: "user-gm" },
  journal: { contents: [] },
  settings: {
    register: () => {},
    get: () => null,
    set: async () => {},
  },
  i18n: { localize: (k) => k },
  socket: { emit: () => {}, on: () => {} },
  users: { activeGM: null },
  actors: { get: () => null },
};

global.Hooks = {
  once: () => {},
  on: () => {},
  call: () => {},
};

global.ui = {
  notifications: {
    info: () => {},
    warn: () => {},
    error: () => {},
  },
};

global.foundry = {
  utils: {
    randomID: () => Math.random().toString(36).slice(2),
    mergeObject: (a, b) => ({ ...a, ...b }),
    getProperty: (obj, path) => {
      if (!obj || !path) return undefined;
      return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    },
  },
  applications: { api: {} },
  abstract: {
    TypeDataModel: class {},
  },
  data: {
    fields: {
      SchemaField: class { constructor(schema) { this.schema = schema; } },
      StringField: class { constructor(opts) { Object.assign(this, opts ?? {}); } },
      NumberField: class { constructor(opts) { Object.assign(this, opts ?? {}); } },
      ArrayField:  class { constructor(inner) { this.element = inner; } },
      BooleanField:class { constructor(opts) { Object.assign(this, opts ?? {}); } },
    },
  },
};
