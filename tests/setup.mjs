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
  },
  applications: { api: {} },
};
