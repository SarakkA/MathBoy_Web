// Test del parser delle formule del server online (src/math/sympyParse.js): node tests/sympyParse.mjs
//
// sympy_cases.json contiene formule generate con il codice del server (bullet.py:
// equazioni dei giocatori versus livelli 1-7, forzieri, nemici delle ondate coop, piu'
// qualche colpo applicato), ognuna con str() di sympy ("s") e il suo LaTeX ("latex").
// Il test legge "s" e controlla che la formula impaginata coincida con il LaTeX
// (a parte gli spazi).
import { readFileSync } from "node:fs";

const { parseSympy } = await import(new URL("../src/math/sympyParse.js", import.meta.url).href);
const cases = JSON.parse(readFileSync(new URL("./sympy_cases.json", import.meta.url), "utf8"));

function tokStr(toks) {
  if (typeof toks === "string") return toks;
  return toks.map((t) => (t.t === "frac" ? `\\frac{${tokStr(t.num)}}{${tokStr(t.den)}}` : t.s)).join("");
}
const norm = (s) => s.replace(/\s+/g, "");

let bad = 0;
for (const c of cases) {
  const e = parseSympy(c.s);
  if (!e) { bad++; console.log("non letta:", c.s); continue; }
  const got = norm(tokStr(e.toTokens()));
  const want = norm(c.latex);
  if (got !== want) { bad++; if (bad < 30) console.log(c.s, "| web:", got, "| sympy:", want); }
}
// stringhe malformate o pericolose: devono dare null, mai eccezioni
for (const s of ["__import__('os')", "Eq(x*x, 1)", "x/0", "", "Eq(x, 1", "1/(x+1)", "True"]) {
  if (parseSympy(s) !== null) { bad++; console.log("doveva essere rifiutata:", s); }
}
console.log("casi", cases.length, "| differenze:", bad);
console.log(bad ? "ERRORI" : "tutti ok");
process.exit(bad ? 1 : 0);
