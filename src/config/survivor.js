// Modalita' Survivor (survivor_state.py): ondate infinite di numeri che inseguono il player.
// Ogni moneta riempie la barra del livello; a ogni livello si sceglie una carta potenziamento.

export const SURVIVOR = {
  map: "survivor_map",
  start: { values: [1], canAdd: true, canSub: true, canMul: false, canDiv: false, lives: 1 },
  maxEnemies: 30,          // oltre (minion esclusi) l'ondata si ferma finche' non se ne risolve qualcuno
  finalWaves: 4,           // le ultime 4 ondate si ripetono all'infinito...
  cycleRateScale: 1.2,     // ...e a ogni ondata ripetuta gli spawn diventano il 20% piu' frequenti
  coinLifetime: 150,       // s
  scoreBarStart: 9,        // monete per il primo livello; poi +1 con probabilita' 50% a ogni livello
  bossMinionInterval: 4,   // s tra un minion e l'altro del boss
  minionSpeed: 30,
  potionInterval: { base: 28, min: 14 }, // s: piu' livelli di carte, piu' pozioni
  potionWeights: { ice: 1, electric: 1, fire: 0.6 },
  potionEffect: 10,        // s di sparo speciale dopo aver raccolto una pozione
  potionSpread: 24,        // px attorno al punto di spawn
};

const BASE = 30;
const FAST = 55;
const VERY_FAST = BASE + 50;
const D = 20;   // durata base di un'ondata (s)
const NICE = 40;

// enemy: "number" (numero che insegue) | "boss" (equazione lenta che genera minion)
// rate: nemici al secondo; spawnPhase: per quanti secondi dell'ondata si generano nemici
const n = (difficulty, rate, speed) => ({ enemy: "number", difficulty, rate, speed });
const boss = (difficulty, rate, speed) => ({ enemy: "boss", difficulty, rate, speed });

export const WAVES = [
  { duration: D, spawnPhase: 9, spawns: [n("pm1", 1, BASE)] },                                   // 1
  { duration: D, spawnPhase: 15, spawns: [n("pm2", 1, BASE)] },                                  // 2
  { duration: D / 2, spawnPhase: 5, spawns: [n("pm1", 2, FAST)] },                               // 3 rapida
  { duration: D, spawnPhase: 10, spawns: [n("pm_random_value", 1, BASE)] },                      // 4
  { duration: D, spawnPhase: 10, spawns: [boss("pm_random_value", 0.21, 10)] },                  // 5 boss
  { duration: NICE, spawnPhase: 10, spawns: [n("pm_large", 0.3, BASE - 5), n("pm_large2", 0.2, BASE - 15)] }, // 6
  { duration: D / 2, spawnPhase: 5, spawns: [n("pm_second_weapon", 2, FAST)] },                  // 7 rapida
  { duration: NICE, spawnPhase: 20, spawns: [n("pm_random_value_diff", 1, BASE)] },              // 8
  { duration: D, spawnPhase: 6,                                                                   // 9 moltiplicazione
    spawns: [n("pm_second_weapon", 1, BASE + 5), n("p_second_weapon_rational", 0.5, BASE - 5)] },
  { duration: NICE, spawnPhase: 10, spawns: [n("pm1", 4, BASE)] },                                // 10 valanga
  { duration: D * 2, spawnPhase: 20, spawns: [boss("pm_2_3_5", 0.21, 10)] },                      // 11 boss
  { duration: D, spawnPhase: 6, spawns: [n("pm_division", 1, 10)] },                              // 12 divisione
  // da qui si cicla: 13-14-15-16, 13-14-15-16, ...
  { duration: D, spawnPhase: 5, spawns: [n("pm_third_weapon", 2, VERY_FAST)] },                   // 13 rapida
  { duration: D, spawnPhase: 7,                                                                   // 14
    spawns: [n("pm_random_value_diff_2", 1, BASE), n("pm_division", 0.4, BASE - 20)] },
  { duration: NICE, spawnPhase: 5,                                                                // 15 razionali
    spawns: [n("pm5", 1, BASE), n("pm_mixed_weapon_rational", 0.5, BASE - 20)] },
  { duration: D * 3, spawnPhase: 20,                                                              // 16 boss
    spawns: [boss("equazione", 0.11, BASE - 20), boss("pm_2_3_5", 0.11, BASE - 20)] },
];

// Carte potenziamento (ui/upgrade_speed.py). minLevel: compaiono dal livello indicato;
// once: si prendono una volta sola; recommended: bordo dorato e scritta "Consigliata".
// icon: { kind: "sprite", frame } in upgrade_icons.png, "heart", { kind: "op" }, { kind: "ammo" }
export const UPGRADES = [
  { id: "bulletSpeed", label: "+40 \nBullet Speed", icon: { kind: "sprite", frame: 1 } },
  { id: "speed", label: "+20 \nSpeed", icon: { kind: "sprite", frame: 0 } },
  { id: "hp", label: "HP \n+100", minLevel: 3, icon: { kind: "heart" } },
  { id: "mul", labelKey: "upgrade.unlock_mul", minLevel: 5, once: true, recommended: true, icon: { kind: "op", op: "×" } },
  { id: "div", labelKey: "upgrade.unlock_div", minLevel: 5, once: true, recommended: true, icon: { kind: "op", op: "÷" } },
  { id: "ammo2", labelKey: "upgrade.unlock_ammo", once: true, recommended: true, icon: { kind: "ammo", value: 2 } },
  { id: "ammo3", labelKey: "upgrade.unlock_ammo", minLevel: 2, once: true, recommended: true, icon: { kind: "ammo", value: 3 } },
  { id: "ammo5", labelKey: "upgrade.unlock_ammo", minLevel: 4, once: true, recommended: true, icon: { kind: "ammo", value: 5 } },
  { id: "ice", labelKey: "upgrade.ice", minLevel: 7, icon: { kind: "sprite", frame: 2 } },
  { id: "electric", labelKey: "upgrade.electric", minLevel: 7, icon: { kind: "sprite", frame: 3 } },
  { id: "fire", labelKey: "upgrade.fire", minLevel: 10, icon: { kind: "sprite", frame: 4 } },
];

/** effetto della carta sulla run del Survivor (UpgradeBase.apply) */
export function applyUpgrade(run, id) {
  switch (id) {
    case "speed": run.speed += 20; run.speedLevel++; break;
    case "bulletSpeed": run.bulletSpeed += 40; run.bulletSpeedLevel++; break;
    case "hp": run.hp = Math.min(run.hp + 100, run.hpMax); break;
    case "mul": run.canMul = true; break;
    case "div": run.canDiv = true; break;
    case "ammo2": case "ammo3": case "ammo5": {
      const v = Number(id.slice(4));
      if (!run.values.includes(v)) { run.values.push(v); run.values.sort((a, b) => a - b); }
      break;
    }
    case "ice": case "electric": case "fire": run.potionLevel[id]++; break;
    default: break;
  }
  if (UPGRADES.find((u) => u.id === id)?.once) run.takenOnce.push(id);
}

/** fino a 3 carte a caso tra quelle disponibili al livello (upgrade_overlay.py _generate_cards) */
export function drawUpgrades(run, level) {
  const pool = UPGRADES.filter((u) => level >= (u.minLevel || 1) && !(u.once && run.takenOnce.includes(u.id)));
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
