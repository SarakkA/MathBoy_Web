// Dati della partita che passano da una stanza all'altra
// (game_manager.py: default_data e load_data_for_next_level).
import { HP_MAX, LIVES } from "../config/settings.js";

export function newRun(world = "Z") {
  return {
    world,
    room: 0,            // indice in WORLDS[world].rooms
    hp: HP_MAX,
    hpMax: HP_MAX,
    lives: LIVES,
    score: 0,           // monete
    values: [1],        // numeri sparabili
    valueIndex: 0,
    canAdd: false,      // sbloccati dai bauli
    canSub: false,
    runTime: 0,         // s, somma delle stanze completate
    bulletsFired: 0,
    coinsSpawned: 0,
  };
}

export function selectedValue(run) {
  return run.values[run.valueIndex];
}

/** come change_value in player.py: indice limitato, non ciclico */
export function changeValue(run, direction) {
  run.valueIndex = Math.min(Math.max(run.valueIndex - direction, 0), run.values.length - 1);
}

/** valore successivo, ciclico (tocco sul selettore in modalita' touch) */
export function cycleValue(run) {
  run.valueIndex = (run.valueIndex + 1) % run.values.length;
}

/** effetto del baule (game_manager.py: unlock_add, unlock_sub, unlock_ammo) */
export function applyChestEffect(run, effect) {
  if (effect.unlock === "add") run.canAdd = true;
  if (effect.unlock === "sub") run.canSub = true;
  if (effect.ammo !== undefined && !run.values.includes(effect.ammo)) run.values.push(effect.ammo);
}
