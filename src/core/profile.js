// Profilo del giocatore salvato nel browser: nome, personaggio, mondi sbloccati, monete totali,
// record del Survivor. Nel gioco desktop queste cose stanno in memoria (game_manager.py:
// player_name, player_skin, unlocked_modes, total_score, records) e si perdono chiudendo il gioco.
//
// ?unlock=all nell'indirizzo sblocca tutti i mondi (comodo per i test).

const KEY = "mathboy.profile";
const STORY = ["Z", "Q", "ZX", "QX", "EQ"];

// Durante i test della versione web tutto e' gia' sbloccato (mondi e modalita' extra).
// Rimettere a false per tornare alla progressione normale (Z -> Q -> ... -> EXTRA).
export const UNLOCK_EVERYTHING = true;

const DEFAULT = { name: "", skin: 0, unlocked: { Z: true }, totalScore: 0, records: { survivor: 0 } };

let profile = load();

function load() {
  let data = {};
  try { data = JSON.parse(window.localStorage.getItem(KEY)) || {}; } catch { /* storage bloccato */ }
  const p = {
    ...DEFAULT,
    ...data,
    unlocked: { ...DEFAULT.unlocked, ...(data.unlocked || {}) },
    records: { ...DEFAULT.records, ...(data.records || {}) },
  };
  if (new URLSearchParams(window.location.search).get("unlock") === "all") {
    for (const w of STORY) p.unlocked[w] = true;
  }
  return p;
}

function save() {
  try { window.localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* storage bloccato */ }
}

export function getProfile() {
  return profile;
}

export function setPlayer(name, skin) {
  profile.name = name;
  profile.skin = skin;
  save();
}

/** trucco del menu (tenere premuto T): sblocca tutti i mondi */
export function unlockAll() {
  for (const w of [...STORY, "EXTRA"]) profile.unlocked[w] = true;
  save();
}

/** world: id di un mondo (Z, Q, ...) oppure "EXTRA" per le modalita' extra */
export function isUnlocked(world) {
  return UNLOCK_EVERYTHING || Boolean(profile.unlocked[world]);
}

/** fine di un mondo: somma le monete e sblocca il successivo. Ritorna il mondo appena sbloccato. */
export function completeWorld(nextWorld, coins) {
  profile.totalScore += coins;
  let newly = null;
  if (nextWorld && !profile.unlocked[nextWorld]) {
    profile.unlocked[nextWorld] = true;
    newly = nextWorld;
  }
  save();
  return newly;
}

/** fine del Survivor: somma le monete e tiene il livello piu' alto (add_record_survivor) */
export function addSurvivorResult(coins, level) {
  profile.totalScore += coins;
  profile.records.survivor = Math.max(profile.records.survivor, level);
  save();
}
