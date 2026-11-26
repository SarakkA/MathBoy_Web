// Traduzioni, stesso schema di src/utils/i18n.py: lingua corrente -> italiano -> chiave.
// I cataloghi arrivano da assets/locales/<lang>.json (esportati dal progetto Python)
// piu' le poche stringhe solo-web di config/webStrings.js.
// Lingua scelta con ?lang=en nell'URL, poi ricordata nel browser.
import { WEB_STRINGS } from "../config/webStrings.js";

export const LANGS = ["it", "en", "es", "fr", "de"];
const DEFAULT_LANG = "it";
const STORAGE_KEY = "mathboy.lang";

const catalogs = {};
let lang = DEFAULT_LANG;

export function preloadLocales(scene) {
  for (const l of LANGS) scene.load.json(`locale_${l}`, `assets/locales/${l}.json`);
}

export function initI18n(scene) {
  for (const l of LANGS) {
    catalogs[l] = { ...(scene.cache.json.get(`locale_${l}`) || {}), ...(WEB_STRINGS[l] || {}) };
  }
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  let saved = null;
  try { saved = window.localStorage.getItem(STORAGE_KEY); } catch { /* storage bloccato */ }
  setLanguage(fromUrl || saved || DEFAULT_LANG);
}

export function setLanguage(code) {
  if (!LANGS.includes(code)) return;
  lang = code;
  try { window.localStorage.setItem(STORAGE_KEY, code); } catch { /* storage bloccato */ }
}

export function getLanguage() {
  return lang;
}

export function t(key, fmt) {
  let text = catalogs[lang]?.[key] ?? catalogs[DEFAULT_LANG]?.[key] ?? key;
  if (fmt) text = text.replace(/\{(\w+)\}/g, (m, k) => (k in fmt ? String(fmt[k]) : m));
  return text;
}
