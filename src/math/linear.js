// Motore algebrico di primo grado: espressioni ax + b ed equazioni tra due di esse,
// con coefficienti frazionari esatti. Sostituisce sympy per i nemici di Z[x], Q[x] ed Eqz.
//
//   Linear    a·x + b               enemy_poly.py: il colpo agisce su tutta l'espressione,
//                                   risolto quando resta solo x
//   Equation  (a·x + b) = (c·x + d) enemy_equation2.py: il colpo agisce su entrambi i lati,
//                                   risolto quando resta x = numero (o numero = x)
//
// sympy distribuisce da solo i numeri sulle somme: (2x + 4) / 2 diventa x + 2.
// Qui e' lo stesso per costruzione, perche' a e b si trasformano insieme.
import { Op } from "../config/settings.js";
import Frac from "./fraction.js";
import { linearTokens, equationTokens } from "./tokens.js";

export class Linear {
  constructor(a, b = 0) {
    this.a = Frac.from(a); // coefficiente della x
    this.b = Frac.from(b); // termine noto
  }

  static x() { return new Linear(1, 0); }

  add(v) { return new Linear(this.a, this.b.add(v)); }
  sub(v) { return new Linear(this.a, this.b.sub(v)); }
  mul(v) { return new Linear(this.a.mul(v), this.b.mul(v)); }
  div(v) { return new Linear(this.a.div(v), this.b.div(v)); }

  /** solo la x (coefficiente 1, niente termine noto) */
  isX() { return this.a.isOne() && this.b.isZero(); }
  /** solo un numero (niente x) */
  isConstant() { return this.a.isZero(); }
  toString() { return `${this.a}x + ${this.b}`; }

  // --- interfaccia comune delle espressioni ---

  apply(op, value) {
    if (op === Op.ADD) return this.add(value);
    if (op === Op.SUB) return this.sub(value);
    if (op === Op.MUL) return this.mul(value);
    if (op === Op.DIV) return value === 0 ? this : this.div(value);
    return this;
  }

  isSolved() { return this.isX(); }

  toTokens() { return linearTokens(this); }
}

export class Equation {
  constructor(lhs, rhs) {
    this.lhs = lhs instanceof Linear ? lhs : new Linear(0, lhs);
    this.rhs = rhs instanceof Linear ? rhs : new Linear(0, rhs);
  }

  /** soluzione dell'equazione (se a sinistra e a destra la x non si annulla) */
  solution() {
    const a = this.lhs.a.sub(this.rhs.a);
    if (a.isZero()) return null;
    return this.rhs.b.sub(this.lhs.b).div(a);
  }

  apply(op, value) {
    if (op === Op.DIV && value === 0) return this;
    return new Equation(this.lhs.apply(op, value), this.rhs.apply(op, value));
  }

  /** x = numero oppure numero = x */
  isSolved() {
    return (this.lhs.isX() && this.rhs.isConstant()) || (this.rhs.isX() && this.lhs.isConstant());
  }

  toString() { return `${this.lhs} = ${this.rhs}`; }

  toTokens() { return equationTokens(this); }
}
