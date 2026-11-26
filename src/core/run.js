// Dati della partita che passano da una stanza all'altra
// (game_manager.py: default_data_* e load_data_for_next_level).
import { HP_MAX, LIVES, PLAYER_SPEED, BULLET_SPEED } from "../config/settings.js";
import { WORLDS } from "../config/worlds.js";
import { SURVIVOR } from "../config/survivor.js";

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
    canMul: Boolean(start.canMul),
    canDiv: Boolean(start.canDiv),
    runTime: 0,         // s, somma delle stanze completate
    bulletsFired: 0,
    coinsSpawned: 0,
  };
}

/** partita Survivor (survivor_state.py: data iniziale, applied_upgrades, livelli delle carte) */
export function newSurvivorRun(skin = 0) {
  const start = SURVIVOR.start;
  return {
    mode: "survivor",
    world: null,
    skin,
    room: 0,
    hp: HP_MAX,
    hpMax: HP_MAX,
    lives: start.lives,
    score: 0,
    values: [...start.values],
    valueIndex: 0,
    canAdd: start.canAdd,
    canSub: start.canSub,
    canMul: start.canMul,
    canDiv: start.canDiv,
    runTime: 0,
    bulletsFired: 0,
    coinsSpawned: 0,
    kills: 0,
    // potenziamenti delle carte
    speed: PLAYER_SPEED,
    bulletSpeed: BULLET_SPEED,
    speedLevel: 0,
    bulletSpeedLevel: 0,
    potionLevel: { ice: 0, electric: 0, fire: 0 },  // livello delle carte pozione (0 = non presa)
    potionTimer: { ice: 0, electric: 0, fire: 0 },  // s rimanenti di sparo speciale
    takenOnce: [],                                  // carte una-tantum gia' prese
  };
}

/** partita Parametrico (game_manager.py default_data_LETTERALE): munizioni a, b, -1, 2
 *  e tutte le operazioni gia' attive. Le lettere sono le stringhe "a" e "b" (src/math/symbolic.js) */
export function newParametricRun(skin = 0) {
  return {
    mode: "parametric",
    world: null,
    skin,
    room: 0,
    hp: HP_MAX,
    hpMax: HP_MAX,
    lives: 3,
    score: 0,
    values: ["a", "b", -1, 2],
    valueIndex: 0,
    canAdd: true,
    canSub: true,
    canMul: true,
    canDiv: true,
    runTime: 0,
    bulletsFired: 0,
    coinsSpawned: 0,
  };
}

/** partita online (game_manager.py data_DEV): proiettili 1, 2, 3, 5 e tutte le operazioni.
 *  In coop il ruolo toglie meta' delle armi: "add_mul" solo + e ×, "sub_div" solo - e ÷. */
export function newNetRun(skin = 0, role = "all") {
  return {
    mode: "online",
    world: null,
    skin,
    room: 0,
    hp: HP_MAX,
    hpMax: HP_MAX,
    lives: 0,            // niente cuori nell'HUD
    score: 0,
    values: [1, 2, 3, 5],
    valueIndex: 0,
    canAdd: role !== "sub_div",
    canSub: role !== "add_mul",
    canMul: role !== "sub_div",
    canDiv: role !== "add_mul",
    runTime: 0,
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
