// Dati della partita che passano da una stanza all'altra
// (game_manager.py: default_data_* e load_data_for_next_level).
import { HP_MAX, LIVES } from "../config/settings.js";
import { WORLDS } from "../config/worlds.js";

export function newRun(world = "Z", skin = 0) {
  const start = WORLDS[world].start;
  return {
    world,
    skin,               // personaggio scelto nell'intro (config/skins.js)
    room: 0,            // indice in WORLDS[world].rooms
    hp: HP_MAX,
    hpMax: HP_MAX,
    lives: LIVES,
    score: 0,           // monete
    values: [...start.values], // numeri sparabili
    valueIndex: 0,
    canAdd: start.canAdd, // armi, sbloccate dai bauli
    canSub: start.canSub,
    canMul: false,
    canDiv: false,
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

/** effetto del baule (game_manager.py: unlock_add, unlock_sub, unlock_mul, unlock_div, unlock_ammo) */
export function applyChestEffect(run, effect) {
  if (effect.unlock === "add") run.canAdd = true;
  if (effect.unlock === "sub") run.canSub = true;
  if (effect.unlock === "mul") run.canMul = true;
  if (effect.unlock === "div") run.canDiv = true;
  if (effect.ammo !== undefined && !run.values.includes(effect.ammo)) run.values.push(effect.ammo);
}
