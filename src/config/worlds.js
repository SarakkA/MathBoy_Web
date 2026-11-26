// Mondi e stanze della campagna (game_manager.py: levels_Z, treasure_config_Z).
//
// Per portare una nuova stanza:
//   1. aggiungi la mappa a MAPS in tools/export_level_web.py (progetto Python) e rilancialo
//   2. aggiungi la stanza qui sotto
//
// enemyLevel: livello passato a generateEquation (src/math/equations.js)
// chest.effect: { unlock: "add" | "sub" } oppure { ammo: <numero> }
// chest.icon:   indice in WEAPON_ICONS (src/ui/weaponIcon.js)
// chest.mouse:  animazione del mouse nel dialogo: "left" | "right" | "wheel"
export const WORLDS = {
  Z: {
    titleKey: "chapter.world_z",
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
    ],
  },
};

export const ALL_MAPS = [...new Set(Object.values(WORLDS).flatMap((w) => w.rooms.map((r) => r.map)))];
