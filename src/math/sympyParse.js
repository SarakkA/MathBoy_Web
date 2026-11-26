// Legge le formule che manda il server online (str() di oggetti sympy) e le trasforma
// nelle classi del motore algebrico web: Frac, Linear, Equation.
//
//   "Eq(x + 10, 0)"        -> Equation
//   "Eq(2*x/3, -7/2)"      -> Equation
//   "Eq(-7, x + 13)"       -> Equation (lati come arrivano)
//   "-5/2", "3"            -> Frac
//   "x/3 - 10/3"           -> Linear
//
// Il server manda solo espressioni di primo grado in x con coefficienti razionali,
// quindi basta un piccolo parser a discesa ricorsiva. Niente eval: la stringa arriva
// dalla rete e non deve mai essere eseguita come codice (il client desktop usa
// sympify, che invece la valuta).
import Frac from "./fraction.js";
import { Linear, Equation } from "./linear.js";

class ParseError extends Error {}

function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") { i++; continue; }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9]/.test(s[j])) j++;
      out.push({ t: "num", v: Number(s.slice(i, j)) });
      i = j;
    } else if (s.startsWith("Eq", i)) {
      out.push({ t: "eq" });
      i += 2;
    } else if (c === "x") {
      out.push({ t: "x" });
      i++;
    } else if ("+-*/(),".includes(c)) {
      out.push({ t: c });
      i++;
    } else {
      throw new ParseError(`carattere inatteso '${c}'`);
    }
  }
  return out;
}

// valori intermedi: Linear (a·x + b)
const lin = (a, b) => new Linear(a, b);

function mul(p, q) {
  if (p.a.isZero()) return lin(q.a.mul(p.b), q.b.mul(p.b));
  if (q.a.isZero()) return lin(p.a.mul(q.b), p.b.mul(q.b));
  throw new ParseError("prodotto di due termini con la x");
}

function div(p, q) {
  if (!q.a.isZero() || q.b.isZero()) throw new ParseError("divisione per x o per zero");
  return lin(p.a.div(q.b), p.b.div(q.b));
}

function parser(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const take = (t) => {
    const tok = tokens[pos];
    if (!tok || (t && tok.t !== t)) throw new ParseError(`atteso '${t}'`);
    pos++;
    return tok;
  };

  function expr() {
    let v = term();
    while (peek() && (peek().t === "+" || peek().t === "-")) {
      const op = take().t;
      const r = term();
      v = op === "+" ? lin(v.a.add(r.a), v.b.add(r.b)) : lin(v.a.sub(r.a), v.b.sub(r.b));
    }
    return v;
  }

  function term() {
    let v = unary();
    while (peek() && (peek().t === "*" || peek().t === "/")) {
      const op = take().t;
      const r = unary();
      v = op === "*" ? mul(v, r) : div(v, r);
    }
    return v;
  }

  function unary() {
    if (peek() && peek().t === "-") {
      take();
      const v = unary();
      return lin(v.a.neg(), v.b.neg());
    }
    return atom();
  }

  function atom() {
    const tok = take();
    if (tok.t === "num") return lin(0, tok.v);
    if (tok.t === "x") return lin(1, 0);
    if (tok.t === "(") {
      const v = expr();
      take(")");
      return v;
    }
    throw new ParseError(`token inatteso '${tok.t}'`);
  }

  function top() {
    if (peek() && peek().t === "eq") {
      take("eq");
      take("(");
      const l = expr();
      take(",");
      const r = expr();
      take(")");
      return new Equation(l, r);
    }
    const v = expr();
    return v.a.isZero() ? v.b : v;
  }

  const result = top();
  if (pos !== tokens.length) throw new ParseError("testo in avanzo");
  return result;
}

/** stringa sympy -> Frac | Linear | Equation; null se non e' una formula valida */
export function parseSympy(s) {
  if (typeof s !== "string" || s.length > 200) return null;
  try {
    return parser(tokenize(s.trim()));
  } catch (e) {
    if (e instanceof ParseError || e.message === "denominatore zero") return null;
    throw e;
  }
}

export { Frac };
