// Motore simbolico della modalita' Parametrico (enemy_parametric.py): equazioni di primo
// grado in x con i parametri a e b, al posto di sympy.
//
// Due rappresentazioni per ogni lato dell'equazione:
//
//   albero  forma iniziale, costruita applicando la catena di mosse a x con le stesse
//           semplificazioni automatiche di sympy: i numeri si distribuiscono sulle somme
//           (2·(x + 1) -> 2x + 2, (x + a)/2 -> a/2 + x/2), le lettere no (a·(x + 1) resta
//           com'e'), i termini simili si sommano. Cosi' a schermo si vede la struttura,
//           es. (x + 1)/a oppure b(a + x + 2).
//
//   Rat     forma dopo un colpo, come sympy.cancel: numeratore polinomiale espanso con
//           coefficienti interi diviso un monomio (es. 2b), fattori comuni semplificati.
//           Il desktop chiama cancel su entrambi i lati a ogni colpo, qui e' lo stesso.
//
// I valori sparabili sono numeri interi oppure le stringhe "a" e "b".
import { Op } from "../config/settings.js";
import Frac from "./fraction.js";

const VARS = ["a", "b", "x"];             // ordine lessicografico di sympy (a > b > x)
const isSym = (v) => typeof v === "string";

// --- polinomi in a, b, x: Map "ea,eb,ex" -> Frac ---

const key = (e) => e.join(",");
const unkey = (k) => k.split(",").map(Number);

function polyConst(v) {
  const p = new Map();
  const f = Frac.from(v);
  if (!f.isZero()) p.set("0,0,0", f);
  return p;
}

function polyOf(v) {
  if (!isSym(v)) return polyConst(v);
  const e = [0, 0, 0];
  e[VARS.indexOf(v)] = 1;
  return new Map([[key(e), new Frac(1)]]);
}

function polyAdd(p, q) {
  const out = new Map(p);
  for (const [k, c] of q) {
    const s = (out.get(k) || new Frac(0)).add(c);
    if (s.isZero()) out.delete(k);
    else out.set(k, s);
  }
  return out;
}

function polyMul(p, q) {
  let out = new Map();
  for (const [k1, c1] of p) {
    for (const [k2, c2] of q) {
      const e1 = unkey(k1);
      const e2 = unkey(k2);
      out = polyAdd(out, new Map([[key(e1.map((v, i) => v + e2[i])), c1.mul(c2)]]));
    }
  }
  return out;
}

const polyScale = (p, f) => polyMul(p, polyConst(f));
/** monomi in ordine lessicografico decrescente (a > b > x), costanti in fondo */
const sortedTerms = (p) => [...p.entries()].map(([k, c]) => [unkey(k), c]).sort((s, t) => cmpDeg(t[0], s[0]));

function cmpDeg(e1, e2) {
  for (let i = 0; i < e1.length; i++) if (e1[i] !== e2[i]) return e1[i] - e2[i];
  return 0;
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

// --- forma cancel: numeratore polinomiale / monomio in a, b (con coefficiente intero > 0) ---

export class Rat {
  constructor(num, den = { c: 1, e: [0, 0, 0] }) {
    this.num = num;
    this.den = den;
  }

  static of(v) {
    return new Rat(polyOf(v));
  }

  denPoly() {
    return new Map([[key(this.den.e), new Frac(this.den.c)]]);
  }

  /** + k·v (k = 1 oppure -1) */
  addScaled(v, k) {
    return new Rat(polyAdd(this.num, polyScale(polyMul(polyOf(v), this.denPoly()), k)), this.den).cancel();
  }

  mul(v) { return new Rat(polyMul(this.num, polyOf(v)), this.den).cancel(); }

  div(v) {
    if (!isSym(v)) {
      if (v === 0) return this;
      const num = v < 0 ? polyScale(this.num, -1) : this.num;
      return new Rat(num, { c: this.den.c * Math.abs(v), e: [...this.den.e] }).cancel();
    }
    const e = [...this.den.e];
    e[VARS.indexOf(v)] += 1;
    return new Rat(this.num, { c: this.den.c, e }).cancel();
  }

  /** sympy.cancel: coefficienti interi, poi via il fattore numerico e le lettere in comune */
  cancel() {
    let num = this.num;
    let c = this.den.c;
    const e = [...this.den.e];
    if (num.size === 0) return new Rat(new Map());
    let l = 1;
    for (const f of num.values()) l = (l * f.den) / gcd(l, f.den);
    if (l !== 1) { num = polyScale(num, l); c *= l; }
    let g = c;
    for (const f of num.values()) g = gcd(g, f.num);
    if (g > 1) { num = polyScale(num, new Frac(1, g)); c /= g; }
    for (let i = 0; i < 2; i++) {
      const m = Math.min(e[i], ...[...num.keys()].map((k) => unkey(k)[i]));
      if (m > 0) {
        e[i] -= m;
        const shifted = new Map();
        for (const [k, f] of num) { const ex = unkey(k); ex[i] -= m; shifted.set(key(ex), f); }
        num = shifted;
      }
    }
    return new Rat(num, { c, e });
  }

  apply(op, v) {
    if (op === Op.ADD) return this.addScaled(v, 1);
    if (op === Op.SUB) return this.addScaled(v, -1);
    if (op === Op.MUL) return this.mul(v);
    if (op === Op.DIV) return this.div(v);
    return this;
  }

  isX() {
    return this.den.c === 1 && this.den.e.every((v) => v === 0) && this.num.size === 1
      && this.num.has("0,0,1") && this.num.get("0,0,1").isOne();
  }

  hasX() {
    return [...this.num.keys()].some((k) => unkey(k)[2] > 0);
  }

  toTokens() { return ratTokens(this); }
}

// --- albero (forma iniziale, con le semplificazioni automatiche di sympy) ---
//   { k: "num", v: Frac }   { k: "sym", s }   { k: "add", terms: [...] }
//   { k: "mul", c: Frac, f: [{ b: nodo sym o add, e: intero }] }

const N = (v) => ({ k: "num", v: Frac.from(v) });
const S = (s) => ({ k: "sym", s });

/** coefficiente e "resto" di un termine, per sommare i termini simili */
function split(t) {
  if (t.k === "num") return [t.v, null];
  if (t.k === "sym") return [new Frac(1), { k: "mul", c: new Frac(1), f: [{ b: t, e: 1 }] }];
  if (t.k === "mul") return [t.c, { ...t, c: new Frac(1) }];
  return [new Frac(1), { k: "mul", c: new Frac(1), f: [{ b: t, e: 1 }] }];
}

const restKey = (r) => (r ? JSON.stringify(r.f.map(({ b, e }) => [nodeKey(b), e])) : "1");
function nodeKey(n) {
  if (n.k === "num") return n.v.toString();
  if (n.k === "sym") return n.s;
  if (n.k === "mul") return `${n.c}*${restKey(n)}`;
  return `(${n.terms.map(nodeKey).join("+")})`;
}

function build(c, rest) {
  if (c.isZero()) return N(0);
  if (!rest) return { k: "num", v: c };
  if (rest.f.length === 1 && rest.f[0].e === 1 && c.isOne() && rest.f[0].b.k === "sym") return rest.f[0].b;
  if (rest.f.length === 1 && rest.f[0].e === 1 && c.isOne()) return rest.f[0].b;
  return { k: "mul", c, f: rest.f };
}

function tAdd(a, b) {
  const terms = [...(a.k === "add" ? a.terms : [a]), ...(b.k === "add" ? b.terms : [b])];
  const groups = new Map();
  for (const t of terms) {
    const [c, rest] = split(t);
    const k = restKey(rest);
    const g = groups.get(k);
    if (g) g.c = g.c.add(c);
    else groups.set(k, { c, rest });
  }
  const out = [...groups.values()].map(({ c, rest }) => build(c, rest)).filter((t) => !(t.k === "num" && t.v.isZero()));
  if (out.length === 0) return N(0);
  if (out.length === 1) return out[0];
  return { k: "add", terms: out };
}

/** per un numero: sulle somme si distribuisce (come sympy) */
function tMulNum(n, k) {
  const f = Frac.from(k);
  if (n.k === "num") return { k: "num", v: n.v.mul(f) };
  if (n.k === "sym") return build(f, split(n)[1]);
  if (n.k === "mul") return build(n.c.mul(f), { ...n, c: new Frac(1) });
  return n.terms.map((t) => tMulNum(t, f)).reduce((acc, t) => tAdd(acc, t));
}

/** per una lettera (e = 1) o diviso una lettera (e = -1): niente distribuzione */
function tMulSym(n, s, e) {
  let c = new Frac(1);
  let f = [];
  if (n.k === "num") c = n.v;
  else if (n.k === "mul") { c = n.c; f = n.f.map((x) => ({ ...x })); }
  else f = [{ b: n, e: 1 }];
  const i = f.findIndex((x) => x.b.k === "sym" && x.b.s === s);
  if (i >= 0) {
    f[i].e += e;
    if (f[i].e === 0) f.splice(i, 1);
  } else {
    f.push({ b: S(s), e });
  }
  // lettere in ordine alfabetico, poi le somme tra parentesi
  f.sort((p, q) => (p.b.k === "sym" ? 0 : 1) - (q.b.k === "sym" ? 0 : 1) || (p.b.k === "sym" && q.b.k === "sym" ? p.b.s.localeCompare(q.b.s) : 0));
  if (f.length === 0) return { k: "num", v: c };
  return build(c, { f });
}

/** valore di una mossa: numero, "a", "b", oppure { neg: "a" } per -a */
function valueNode(v) {
  if (typeof v === "object") return tMulNum(S(v.neg), -1);
  return isSym(v) ? S(v) : N(v);
}

function tApply(n, kind, v) {
  if (kind === "add") return tAdd(n, valueNode(v));
  if (kind === "mul") return isSym(v) ? tMulSym(n, v, 1) : tMulNum(n, v);
  return isSym(v) ? tMulSym(n, v, -1) : tMulNum(n, new Frac(1, v)); // div
}

/** albero -> forma cancel */
function toRat(n) {
  if (n.k === "num") return new Rat(polyConst(n.v));
  if (n.k === "sym") return Rat.of(n.s);
  if (n.k === "add") {
    return n.terms.map(toRat).reduce((p, q) => {
      const num = polyAdd(polyMul(p.num, q.denPoly()), polyMul(q.num, p.denPoly()));
      return new Rat(num, { c: p.den.c * q.den.c, e: p.den.e.map((v, i) => v + q.den.e[i]) }).cancel();
    });
  }
  let r = new Rat(polyConst(n.c.num)).div(n.c.den);
  for (const { b, e } of n.f) {
    const br = toRat(b);
    if (e > 0) {
      for (let i = 0; i < e; i++) r = new Rat(polyMul(r.num, br.num), { c: r.den.c * br.den.c, e: r.den.e.map((v, j) => v + br.den.e[j]) }).cancel();
    } else {
      for (let i = 0; i < -e; i++) r = r.div(b.s);
    }
  }
  return r;
}

/** esponenti di un termine sulle "variabili" di sympy (Expr.as_terms): a, b, x e poi ogni
 *  somma tra parentesi, che conta come una variabile a se' (es. (x + 1) in b(x + 1)) */
function termVector(n, adds) {
  const v = new Array(3 + adds.length).fill(0);
  const put = (b, e) => {
    if (b.k === "sym") v[VARS.indexOf(b.s)] += e;
    else v[3 + adds.indexOf(nodeKey(b))] += e;
  };
  if (n.k === "sym") put(n, 1);
  else if (n.k === "mul") n.f.forEach(({ b, e }) => put(b, e));
  else if (n.k === "add") put(n, 1);
  return v;
}

// --- da forma a pezzi da impaginare (src/ui/mathText.js) ---

const text = (s) => ({ t: "text", s });

/** lettere con esponente: a, b², x */
function symTokens(name, e) {
  return e === 1 ? [text(name)] : [text(name), { t: "sup", s: String(e) }];
}

function monoTokens(e) {
  return VARS.flatMap((v, i) => (e[i] > 0 ? symTokens(v, e[i]) : []));
}

/** modulo di un termine coef·monomio; con coefficiente frazionario diventa una frazione */
function magnitude(coef, e) {
  const c = coef.abs();
  const mono = monoTokens(e);
  const numPart = (n) => (n === 1 && mono.length ? mono : [text(String(n)), ...mono]);
  if (c.isInteger()) return numPart(c.num);
  return [{ t: "frac", num: numPart(c.num), den: [text(String(c.den))] }];
}

/** somma di termini [negativo, pezzi, { isConst, nsyms }]: il primo col meno attaccato,
 *  gli altri con l'operatore. Come sympy, "-x + 1" si scrive "1 - x": con due soli termini,
 *  una costante positiva e un termine negativo in una sola lettera, la costante va prima. */
function sumTokens(terms) {
  if (terms.length === 2) {
    const [t0, t1] = terms;
    if (t0[0] && t0[2]?.nsyms === 1 && !t1[0] && t1[2]?.isConst) terms = [t1, t0];
  }
  const out = [];
  terms.forEach(([neg, mag], i) => {
    if (i === 0) { if (neg) out.push({ t: "sign", s: "-" }); }
    else out.push({ t: "op", s: neg ? "-" : "+" });
    out.push(...mag);
  });
  return out.length ? out : [text("0")];
}

const monoMeta = (e) => ({ isConst: e.every((v) => v === 0), nsyms: e.filter((v) => v !== 0).length });

/** lettere che compaiono in un nodo dell'albero */
function syms(n) {
  if (n.k === "num") return new Set();
  if (n.k === "sym") return new Set([n.s]);
  if (n.k === "add") return new Set(n.terms.flatMap((t) => [...syms(t)]));
  return new Set(n.f.flatMap(({ b }) => [...syms(b)]));
}

export function ratTokens(r) {
  const terms = sortedTerms(r.num);
  if (terms.length === 0) return [text("0")];
  const denMono = monoTokens(r.den.e);
  if (denMono.length === 0) {
    // denominatore solo numerico: sympy scrive la somma di frazioni separate (x/2 - 1/2)
    return sumTokens(terms.map(([e, c]) => {
      const f = c.div(r.den.c);
      return [f.sign() < 0, magnitude(f, e), monoMeta(e)];
    }));
  }
  const den = r.den.c === 1 ? denMono : [text(String(r.den.c)), ...denMono];
  if (terms.length === 1) {
    const [e, c] = terms[0];
    const out = c.sign() < 0 ? [{ t: "sign", s: "-" }] : [];
    return [...out, { t: "frac", num: magnitude(c, e), den }];
  }
  return [{ t: "frac", num: sumTokens(terms.map(([e, c]) => [c.sign() < 0, magnitude(c, e), monoMeta(e)])), den }];
}

/** [negativo, pezzi del modulo] di un termine dell'albero */
function termParts(n) {
  if (n.k === "num") return [n.v.sign() < 0, n.v.isInteger() ? [text(String(Math.abs(n.v.num)))] : [{ t: "frac", num: String(Math.abs(n.v.num)), den: String(n.v.den) }]];
  if (n.k === "sym") return [false, [text(n.s)]];
  if (n.k === "add") {
    return [false, sumTokens(orderTerms(n.terms).map((t) => [...termParts(t), { isConst: t.k === "num", nsyms: syms(t).size }]))];
  }
  const p = Math.abs(n.c.num);
  const q = n.c.den;
  const up = n.f.filter((x) => x.e > 0);
  const down = n.f.filter((x) => x.e < 0);
  const isFrac = q !== 1 || down.length > 0;
  const lone = isFrac && p === 1 && up.length === 1 && up[0].b.k === "add"; // (x + 1)/a: senza parentesi
  const factor = ({ b, e }) => (b.k === "sym" ? symTokens(b.s, e)
    : lone ? termParts(b)[1] : [text("("), ...termParts(b)[1], text(")")]);
  const num = [...(p !== 1 || up.length === 0 ? [text(String(p))] : []), ...up.flatMap(factor)];
  if (!isFrac) return [n.c.sign() < 0, num];
  const den = [...(q !== 1 ? [text(String(q))] : []), ...down.flatMap(({ b, e }) => symTokens(b.s, -e))];
  return [n.c.sign() < 0, [{ t: "frac", num, den }]];
}

/** termini di una somma in ordine lessicografico decrescente sulle variabili di sympy */
function orderTerms(terms) {
  const adds = [...new Set(terms.flatMap((t) => (t.k === "mul" ? t.f.filter((x) => x.b.k === "add").map((x) => nodeKey(x.b)) : [])))].sort();
  return [...terms].sort((p, q) => cmpDeg(termVector(q, adds), termVector(p, adds)));
}

export function treeTokens(n) {
  const [neg, mag] = termParts(n);
  return n.k === "add" ? mag : [...(neg ? [{ t: "sign", s: "-" }] : []), ...mag];
}

export function tokensToString(toks) {
  if (typeof toks === "string") return toks;
  return toks.map((t) => {
    if (t.t === "frac") return `\\frac{${tokensToString(t.num)}}{${tokensToString(t.den)}}`;
    if (t.t === "sup") return `^${t.s}`;
    if (t.t === "op") return ` ${t.s} `;
    return t.s;
  }).join("");
}

// --- equazione del nemico ---

/** lato: { tree } prima del primo colpo, { rat } dopo */
export class ParamEquation {
  constructor(lhs, rhs) {
    this.lhs = lhs;
    this.rhs = rhs;
  }

  static side(s) {
    return s.rat ?? toRat(s.tree);
  }

  /** il colpo agisce su entrambi i lati, poi cancel (enemy_parametric.py take_value) */
  apply(op, value) {
    if (op === Op.DIV && value === 0) return this;
    return new ParamEquation(
      { rat: ParamEquation.side(this.lhs).apply(op, value) },
      { rat: ParamEquation.side(this.rhs).apply(op, value) },
    );
  }

  /** x isolata da un lato e assente dall'altro */
  isSolved() {
    if (!this.lhs.rat || !this.rhs.rat) return false;
    const l = this.lhs.rat;
    const r = this.rhs.rat;
    return (l.isX() && !r.hasX()) || (r.isX() && !l.hasX());
  }

  toTokens() {
    const tok = (s) => (s.rat ? ratTokens(s.rat) : treeTokens(s.tree));
    return [...tok(this.lhs), { t: "op", s: "=" }, ...tok(this.rhs)];
  }

  /** in stile LaTeX, per i test e il debug: rac{x + 1}{a} = b^2 */
  toString() {
    return tokensToString(this.toTokens());
  }
}

// --- generazione (enemy_parametric.py): una catena di `level` mosse, ognuna annullabile
//     con UN colpo delle munizioni [a, b, -1, 2] ---

const ADD_LETTERS = ["a", { neg: "a" }, "b", { neg: "b" }];
const ADD_NUMBERS = [1, -1, 2, -2];
const FACTORS = [2, -1, "a", "b"];
const sameTerm = (u, v) => JSON.stringify(u) === JSON.stringify(v);
const negTerm = (t) => (typeof t === "object" ? t.neg : isSym(t) ? { neg: t } : -t);

/** mosse ancora ammesse: nessuna coppia deve fondersi in un colpo solo (candidates) */
function candidates(chain) {
  const usedTerms = chain.filter(([k]) => k === "add").map(([, v]) => v);
  const usedFactors = chain.filter(([k]) => k !== "add").map(([, v]) => v);
  const out = [];
  for (const t of ADD_LETTERS) {
    if (!usedTerms.some((u) => sameTerm(u, t) || sameTerm(u, negTerm(t)))) out.push(["add", t]);
  }
  if (!ADD_NUMBERS.some((n) => usedTerms.includes(n))) out.push(...ADD_NUMBERS.map((n) => ["add", n]));
  for (const f of FACTORS) {
    if (!usedFactors.includes(f)) {
      out.push(["mul", f]);
      if (f !== -1) out.push(["div", f]);
    }
  }
  return out;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// lato destro: piccolo e leggibile, indipendente dalla catena (RHS_POOL)
const RHS_POOL = [
  () => N(0), () => N(1), () => N(2), () => N(-1), () => N(3), () => S("a"), () => S("b"),
  () => tAdd(S("a"), S("b")), () => tAdd(S("a"), tMulNum(S("b"), -1)), () => tMulNum(S("a"), 2),
  () => tMulNum(S("b"), 2), () => tAdd(S("a"), N(1)), () => tAdd(S("b"), N(-1)), () => tMulSym(S("a"), "b", 1),
];

/** catena di mosse applicata a x = lato sinistro; lato destro dal pool; lati scambiati a caso */
export function generateParametric(level) {
  const chain = [];
  for (let i = 0; i < level; i++) {
    const c = candidates(chain);
    if (!c.length) break;
    chain.push(pick(c));
  }
  let lhs = S("x");
  for (const [kind, v] of chain) lhs = tApply(lhs, kind, v);
  const rhs = pick(RHS_POOL)();
  const eq = Math.random() < 0.5
    ? new ParamEquation({ tree: lhs }, { tree: rhs })
    : new ParamEquation({ tree: rhs }, { tree: lhs });
  eq.chain = chain;
  return eq;
}

// per i test
export const _internal = { tApply, toRat, S, N, tAdd, tMulNum, tMulSym };
