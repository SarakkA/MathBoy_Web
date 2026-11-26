// Test del motore della modalita' Parametrico (src/math/symbolic.js): node tests/parametric.mjs
//
// parametric_cases.json contiene 120 catene casuali generate con il gioco desktop
// (enemy_parametric.py: build_chain, apply_chain, RHS_POOL) e, per ognuna, il LaTeX di sympy:
//   init    forma iniziale dei due lati
//   steps   i colpi inversi della catena, uno alla volta (cancel su entrambi i lati), e se e' risolta
//   random  tre colpi a caso con le munizioni [a, b, -1, 2]
// Il test rifa' tutto in JS e confronta i pezzi impaginati con il LaTeX (a parte spazi e parentesi left/right).
import { readFileSync } from "node:fs";

const WEB = new URL("../src/math/", import.meta.url).href;
const { ParamEquation, ratTokens, treeTokens, _internal } = await import(WEB + "symbolic.js");
const { tApply, S, N, tAdd, tMulNum, tMulSym } = _internal;
const cases = JSON.parse(readFileSync(new URL("./parametric_cases.json", import.meta.url), "utf8"));

const OP = { "+": "+", "-": "-", x: "x", "÷": "÷" };
function tokStr(toks) {
  if (typeof toks === "string") return toks;
  return toks.map((t) => (t.t === "frac" ? `\\frac{${tokStr(t.num)}}{${tokStr(t.den)}}` : t.t === "sup" ? `^{${t.s}}` : t.s)).join("");
}
const norm = (s) => s.replace(/\\left\(/g, "(").replace(/\\right\)/g, ")").replace(/\s+/g, "");
const val = (v) => (typeof v === "object" ? null : v);

const RHS = {
  "0": N(0), "1": N(1), "2": N(2), "-1": N(-1), "3": N(3), a: S("a"), b: S("b"),
  "a + b": tAdd(S("a"), S("b")), "a - b": tAdd(S("a"), tMulNum(S("b"), -1)), "2*a": tMulNum(S("a"), 2),
  "2*b": tMulNum(S("b"), 2), "a + 1": tAdd(S("a"), N(1)), "b - 1": tAdd(S("b"), N(-1)), "a*b": tMulSym(S("a"), "b", 1),
};

let bad = { init: 0, step: 0, solved: 0, rnd: 0 };
let shown = 0;
const report = (kind, c, got, want) => { bad[kind]++; if (shown++ < 25) console.log(kind, JSON.stringify(c.chain), "| web:", got, "| sympy:", want); };

for (const c of cases) {
  let lhs = S("x");
  for (const [k, v] of c.chain) lhs = tApply(lhs, k, v);
  const rhs = RHS[c.rhs];
  const init = [norm(tokStr(treeTokens(lhs))), norm(tokStr(treeTokens(rhs)))];
  const want = c.init.map(norm);
  if (init[0] !== want[0]) report("init", c, init[0], want[0]);
  if (init[1] !== want[1]) report("init", c, init[1], want[1]);

  for (const seq of ["steps", "random"]) {
    let eq = new ParamEquation({ tree: lhs }, { tree: rhs });
    for (const st of c[seq]) {
      // -a: si spara "a" con l'operazione opposta
      let op = OP[st.op];
      let v = st.v;
      if (typeof v === "object") { v = v.neg; op = op === "-" ? "+" : op === "+" ? "-" : op; if (st.op === "x" || st.op === "÷") throw new Error("neg factor"); }
      eq = eq.apply(op, v);
      const got = [norm(tokStr(ratTokens(eq.lhs.rat))), norm(tokStr(ratTokens(eq.rhs.rat)))];
      const w = st.lat.map(norm);
      if (got[0] !== w[0] || got[1] !== w[1]) report(seq === "steps" ? "step" : "rnd", c, got.join(" = "), w.join(" = "));
      if (seq === "steps" && eq.isSolved() !== st.solved) report("solved", c, eq.isSolved(), st.solved);
    }
    if (seq === "steps" && c.steps.length && !c.steps.at(-1).solved) console.log("sympy non risolve?", JSON.stringify(c.chain));
  }
}
console.log("casi", cases.length, "| differenze:", JSON.stringify(bad));
const total = Object.values(bad).reduce((a, b) => a + b, 0);
console.log(total ? "ERRORI" : "tutti ok");
process.exit(total ? 1 : 0);
