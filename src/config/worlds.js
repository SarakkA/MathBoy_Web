// Mondi e stanze della campagna (game_manager.py: levels_*, treasure_config_*, default_data_*).
//
// Per portare una nuova stanza:
//   1. aggiungi la mappa a MAPS in tools/export_level_web.py (progetto Python) e rilancialo
//   2. aggiungi la stanza qui sotto
//
// start:          dati iniziali della partita in quel mondo (armi e proiettili gia' posseduti)
// unlocks:        cosa si sblocca completando il mondo
// doorNeedsChest: la porta si apre solo dopo aver aperto il baule (mondi Z e Q, level_Z.py)
// enemy:          tipo e livello dei nemici, per generateEnemy (src/math/generators.js):
//                 "number" (Z, Q), "poly" (Z[x], Q[x]), "equation" (Eqz)
// chest.effect:   { unlock: "add" | "sub" | "mul" | "div" } oppure { ammo: <numero> }
// chest.icon:     indice in WEAPON_ICONS (src/ui/weaponIcon.js)
// chest.mouse:    animazione del mouse nel dialogo: "left" | "right" | "wheel"

const ALL_WEAPONS = { canAdd: true, canSub: true, canMul: true, canDiv: true };

export const WORLDS = {
  Z: {
    labelKey: "menu.btn.world_z",
    titleKey: "chapter.world_z",
    start: { values: [1], canAdd: false, canSub: false },
    unlocks: "Q",
    doorNeedsChest: true,
    rooms: [
      {
        map: "Z_1",
        enemy: { kind: "number", level: 1 },
        tutorial: true,
        chest: { dialogKey: "dialog.unlock_sub", effect: { unlock: "sub" }, icon: 0, mouse: "right" },
      },
      {
        map: "Z_2",
        enemy: { kind: "number", level: 2 },
        chest: { dialogKey: "dialog.unlock_add", effect: { unlock: "add" }, icon: 1, mouse: "left" },
      },
      {
        map: "Z_3",
        enemy: { kind: "number", level: 3 },
        chest: { dialogKey: "dialog.unlock_value_2", effect: { ammo: 2 }, icon: 2, mouse: "wheel" },
      },
    ],
  },
  Q: {
    labelKey: "menu.btn.world_q",
    titleKey: "chapter.world_q",
    start: { values: [1, 2], canAdd: true, canSub: true },
    unlocks: "ZX",
    doorNeedsChest: true,
    rooms: [
      {
        map: "Q_1",
        enemy: { kind: "number", level: 4 },
        chest: { dialogKey: "dialog.unlock_mul", effect: { unlock: "mul" }, icon: 3, mouse: "left" },
      },
      {
        map: "Q_2",
        enemy: { kind: "number", level: 5 },
        chest: { dialogKey: "dialog.unlock_value_3", effect: { ammo: 3 }, icon: 4, mouse: "wheel" },
      },
      {
        map: "Q_3",
        enemy: { kind: "number", level: 6 },
        chest: { dialogKey: "dialog.unlock_div", effect: { unlock: "div" }, icon: 5, mouse: "right" },
      },
    ],
  },
  ZX: {
    labelKey: "menu.btn.world_zx",
    titleKey: "chapter.world_zx",
    start: { values: [1, 2, 3], ...ALL_WEAPONS },
    unlocks: "QX",
    doorNeedsChest: false,
    rooms: [
      { map: "ZX_1", enemy: { kind: "poly", level: 1 } },
      {
        map: "ZX_2",
        enemy: { kind: "poly", level: 2 },
        chest: { dialogKey: "dialog.unlock_value_5", effect: { ammo: 5 }, icon: 6, mouse: "wheel" },
      },
      { map: "ZX_3", enemy: { kind: "poly", level: 3 } },
    ],
  },
  QX: {
    labelKey: "menu.btn.world_qx",
    titleKey: "chapter.world_qx",
    start: { values: [1, 2, 3, 5], ...ALL_WEAPONS },
    unlocks: "EQ",
    doorNeedsChest: false,
    rooms: [
      { map: "QX_1", enemy: { kind: "poly", level: 4 } },
      { map: "QX_2", enemy: { kind: "poly", level: 5 } },
      { map: "QX_3", enemy: { kind: "poly", level: 6 } },
    ],
  },
  EQ: {
    labelKey: "menu.btn.world_eq",
    titleKey: "chapter.equations",
    start: { values: [1, 2, 3, 5], ...ALL_WEAPONS },
    unlocks: "EXTRA",
    doorNeedsChest: false,
    rooms: [
      { map: "EQ_1", enemy: { kind: "equation", level: 1 } },
      { map: "EQ_2", enemy: { kind: "equation", level: 2 } },
      { map: "EQ_3", enemy: { kind: "equation", level: 3 } },
    ],
  },
};

// riga "STORIA" del menu, nell'ordine del gioco desktop
export const STORY_ROW = ["Z", "Q", "ZX", "QX", "EQ"].map((id) => ({ id, labelKey: WORLDS[id].labelKey }));

export const ALL_MAPS = [
  ...new Set(Object.values(WORLDS).flatMap((w) => w.rooms.map((r) => r.map))),
  "menu_map",
];
