// Test del motore algebrico (src/math/): node tests/algebra.mjs
// Nessuna dipendenza: importa direttamente i moduli del gioco.
const base = new URL("../src/", import.meta.url).href;
const { default: Frac } = await import(base + "math/fraction.js");
const { Linear, Equation } = await import(base + "math/linear.js");
const show = (e) => e.toTokens().map((k) => k.t === "frac" ? `[${k.num}/${k.den}]` : k.t === "op" ? ` ${k.s} ` : k.s).join("");
let fails = 0;
const check = (label, got, want) => { const ok = got === want; if (!ok) fails++; console.log(ok ? "ok " : "NO ", label.padEnd(36), got, ok ? "" : `(atteso ${want})`); };
const X = "x", M = "-", P = "+", D = "÷";
// numeri
check("7/2", show(new Frac(7, 2)), "[7/2]");
check("-7/2", show(new Frac(-7, 2)), "-[7/2]");
check("-3", show(new Frac(-3)), "-3");
// polinomi (enemy_poly.py)
let p = new Linear(1, 5);
check("x + 5", show(p), "x + 5");
check("x - 5", show(new Linear(1, -5)), "x - 5");
check("2x - 3", show(new Linear(2, -3)), "2x - 3");
check("(3/2)x + 5", show(new Linear(new Frac(3, 2), 5)), "[3x/2] + 5");
check("x/4", show(new Linear(new Frac(1, 4), 0)), "[x/4]");
check("x - 1/4", show(new Linear(1, new Frac(-1, 4))), "x - [1/4]");
check("-x + 3", show(new Linear(-1, 3)), "-x + 3");
check("0", show(new Linear(0, 0)), "0");
// (2x + 4) ÷ 2 = x + 2, poi - 2 = x (risolto)
let q = new Linear(2, 4).apply(D, 2);
check("(2x+4)÷2", show(q), "x + 2");
q = q.apply(M, 2);
check("... - 2 risolto", String(q.isSolved()), "true");
// (3/2)x + 5: -5, ×2, ÷3
let r = new Linear(new Frac(3, 2), 5).apply(M, 5).apply(X, 2).apply(D, 3);
check("(3/2)x+5 -> x", show(r) + " " + r.isSolved(), "x true");
// x + 1/4: ×4 = 4x + 1, -1, ÷2 ÷2
let s = new Linear(1, new Frac(1, 4)).apply(X, 4);
check("(x+1/4)×4", show(s), "4x + 1");
// equazioni (enemy_equation2.py)
let e = new Equation(new Linear(new Frac(1, 4), -7), 0);
check("x/4 - 7 = 0", show(e), "[x/4] - 7 = 0");
check("soluzione", String(e.solution()), "28");
e = e.apply(P, 7);
check("+7", show(e), "[x/4] = 7");
e = e.apply(X, 2).apply(X, 2);
check("×2×2", show(e) + " " + e.isSolved(), "x = 28 true");
let e2 = new Equation(new Linear(3, 5), 0).apply(M, 5).apply(D, 3);
check("3x + 5 = 0 -> x = -5/3", show(e2) + " " + e2.isSolved(), "x = -[5/3] true");
let e3 = new Equation(new Linear(6, 0), 0).apply(D, 2);
check("6x = 0 ÷2", show(e3) + " " + e3.isSolved(), "3x = 0 false");
console.log(fails ? `${fails} FALLITI` : "tutti ok");
process.exitCode = fails ? 1 : 0;
