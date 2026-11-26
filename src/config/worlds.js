// Mondi e stanze della campagna (game_manager.py: levels_*, treasure_config_*, default_data_*).
//
// Per portare una nuova stanza:
//   1. aggiungi la mappa a MAPS in tools/export_level_web.py (progetto Python) e rilancialo
//   2. aggiungi la stanza qui sotto
//
// start:        dati iniziali della partita in quel mondo (armi e proiettili gia' posseduti)
// unlocks:      mondo sbloccato completando questo
// enemyLevel:   livello passato a generateEquation (src/math/equations.js)
// chest.effect: { unlock: "add" | "sub" | "mul" | "div" } oppure { ammo: <numero> }
// chest.icon:   indice in WEAPON_ICONS (src/ui/weaponIcon.js)
// chest.mouse:  animazione del mouse nel dialogo: "left" | "right" | "wheel"
export const WORLDS = {
  Z: {
    labelKey: "menu.btn.world_z",
    titleKey: "chapter.world_z",
    start: { values: [1], canAdd: false, canSub: false },
    unlocks: "Q",
    rooms: [
      {
        map: "Z_1",
        enemyLevel: 1,
        tutorial: true,
        chest: { dialogKey: "dialog.unlock_sub", effect: { unlock: "sub" }, icon: 0, mouse: "right" },
      },
      {
        map: "Z_2",
        enemyLevel: 2,
        chest: { dialogKey: "dialog.unlock_add", effect: { unlock: "add" }, icon: 1, mouse: "left" },
      },
      {
        map: "Z_3",
        enemyLevel: 3,
        chest: { dialogKey: "dialog.unlock_value_2", effect: { ammo: 2 }, icon: 2, mouse: "wheel" },
      },
    ],
  },
  Q: {
    labelKey: "menu.btn.world_q",
    titleKey: "chapter.world_q",
    start: { values: [1, 2], canAdd: true, canSub: true },
    unlocks: "ZX",
    rooms: [
      {
        map: "Q_1",
        enemyLevel: 4,
        chest: { dialogKey: "dialog.unlock_mul", effect: { unlock: "mul" }, icon: 3, mouse: "left" },
      },
      {
        map: "Q_2",
        enemyLevel: 5,
        chest: { dialogKey: "dialog.unlock_value_3", effect: { ammo: 3 }, icon: 4, mouse: "wheel" },
      },
      {
        map: "Q_3",
        enemyLevel: 6,
        chest: { dialogKey: "dialog.unlock_div", effect: { unlock: "div" }, icon: 5, mouse: "right" },
      },
    ],
  },
};

// riga "STORIA" del menu, nell'ordine del gioco desktop: i mondi non ancora portati restano grigi
export const STORY_ROW = [
  { id: "Z", labelKey: "menu.btn.world_z" },
  { id: "Q", labelKey: "menu.btn.world_q" },
  { id: "ZX", labelKey: "menu.btn.world_zx" },
  { id: "QX", labelKey: "menu.btn.world_qx" },
  { id: "EQ", labelKey: "menu.btn.world_eq" },
];

export const ALL_MAPS = [
  ...new Set(Object.values(WORLDS).flatMap((w) => w.rooms.map((r) => r.map))),
  "menu_map",
];
