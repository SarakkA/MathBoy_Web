// Classifica online su Firestore, la stessa del gioco desktop
// (MathBoy2/src/utils/firebase.py, FirebaseLeaderboard): raccolta "scores",
// un documento per partita con name, mode, createdAt e le statistiche della modalita'.
//
// Solo REST con fetch, niente SDK Firebase: niente CDN (le reti scolastiche spesso
// li bloccano) e niente dipendenze. Chi puo' scrivere cosa lo decidono le regole
// (MathBoy2/tools/firestore.rules): solo aggiunte, con campi e limiti controllati.
// Il project ID non e' un segreto: sta in ogni client, desktop compreso.

const PROJECT_ID = "mathboy2-38ef3";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 30000;

/** nomi delle modalita' su Firestore: chiavi condivise col desktop, MAI tradurle */
export const MODE = {
  Z: "Mondo Z",
  Q: "Mondo Q",
  ZX: "Mondo ZX",
  QX: "Mondo QX",
  EQ: "Mondo EQ",
  SURVIVOR: "Survivor",
  PARAMETRIC: "Letterale",
  ONE_MINUTE: "1 Minute",
};

// (mode|field|dir|limit) -> { time, rows }: non si interroga il db a ogni apertura
const cache = new Map();

async function post(url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Le regole controllano i tipi (isInt / isNum): gli interi vanno come integerValue,
// il resto dei numeri come doubleValue (il voto 7.5).
function toValue(v) {
  if (typeof v === "string") return { stringValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === "number") return { doubleValue: v };
  return { stringValue: String(v) };
}

function fromValue(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  return null;
}

/** Invia il punteggio di una partita. Non lancia mai: se la rete o le regole
 *  lo rifiutano, la partita va avanti lo stesso. Ritorna true se e' stato salvato. */
export async function sendScore(name, mode, stats) {
  if (!name) return false;
  const fields = {
    name: toValue(name),
    mode: toValue(mode),
    // ora del computer: le regole la rifiutano se e' sballata di piu' di 10 minuti
    createdAt: { timestampValue: new Date().toISOString() },
  };
  for (const [k, v] of Object.entries(stats)) fields[k] = toValue(v);
  try {
    await post(`${BASE}/scores`, { fields });
  } catch (e) {
    console.warn(`Classifica: punteggio ${mode} non inviato (${e.message || e})`);
    return false;
  }
  for (const key of cache.keys()) if (key.startsWith(`${mode}|`)) cache.delete(key);
  return true;
}

/** I migliori `limit` punteggi di una modalita', ordinati per `field`.
 *  Ritorna un array di oggetti { name, mode, seconds, ... }, oppure null se la
 *  classifica non e' raggiungibile e non c'e' niente in cache. */
export async function getTop(mode, field, dir = "DESCENDING", limit = 8) {
  const key = `${mode}|${field}|${dir}|${limit}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.rows;

  const query = {
    structuredQuery: {
      from: [{ collectionId: "scores" }],
      where: { fieldFilter: { field: { fieldPath: "mode" }, op: "EQUAL", value: { stringValue: mode } } },
      orderBy: [{ field: { fieldPath: field }, direction: dir }],
      limit,
    },
  };
  let rows;
  try {
    const items = await post(`${BASE}:runQuery`, query);
    rows = items
      .filter((it) => it.document)
      .map((it) => Object.fromEntries(Object.entries(it.document.fields || {}).map(([k, v]) => [k, fromValue(v)])));
  } catch (e) {
    console.warn(`Classifica ${mode} non raggiungibile (${e.message || e})`);
    return cached ? cached.rows : null; // meglio dati vecchi che niente
  }
  cache.set(key, { time: Date.now(), rows });
  return rows;
}
