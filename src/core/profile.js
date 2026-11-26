// Profilo del giocatore salvato nel browser: nome, personaggio, mondi sbloccati, monete totali.
// Nel gioco desktop queste cose stanno in memoria (game_manager.py: player_name,
// player_skin, unlocked_modes, total_score) e si perdono chiudendo il gioco.
//
// ?unlock=all nell'indirizzo sblocca tutti i mondi (comodo per i test).

const KEY = "mathboy.profile";

const DEFAULT = { name: "", skin: 0, unlocked: { Z: true }, totalScore: 0 };

let profile = load();

function load() {
  let data = {};
  try { data = JSON.parse(window.localStorage.getItem(KEY)) || {}; } catch { /* storage bloccato */ }
  const p = { ...DEFAULT, ...data, unlocked: { ...DEFAULT.unlocked, ...(data.unlocked || {}) } };
  if (new URLSearchParams(window.location.search).get("unlock") === "all") {
    for (const w of ["Z", "Q", "ZX", "QX", "EQ"]) p.unlocked[w] = true;
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
  for (const w of ["Z", "Q", "ZX", "QX", "EQ"]) profile.unlocked[w] = true;
  save();
}

export function isUnlocked(world) {
  return Boolean(profile.unlocked[world]);
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
