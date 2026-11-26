// Frazioni esatte, al posto di sympy.Rational del gioco desktop.
// Sempre ridotte ai minimi termini, denominatore positivo.
// I numeri restano piccoli (al massimo qualche migliaio), quindi bastano i Number di JS.
//
// Come Linear ed Equation (linear.js) espone l'interfaccia comune delle espressioni
// colpite dai proiettili: apply(op, valore), isSolved(), toTokens().
import { Op } from "../config/settings.js";
import { numberTokens } from "./tokens.js";

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export default class Frac {
  constructor(num, den = 1) {
    if (den === 0) throw new Error("denominatore zero");
    if (den < 0) { num = -num; den = -den; }
    const g = gcd(num, den);
    this.num = num / g;
    this.den = den / g;
  }

  /** accetta un Frac o un intero */
  static from(v) {
    return v instanceof Frac ? v : new Frac(v, 1);
  }

  add(v) { const o = Frac.from(v); return new Frac(this.num * o.den + o.num * this.den, this.den * o.den); }
  sub(v) { const o = Frac.from(v); return new Frac(this.num * o.den - o.num * this.den, this.den * o.den); }
  mul(v) { const o = Frac.from(v); return new Frac(this.num * o.num, this.den * o.den); }
  div(v) { const o = Frac.from(v); return new Frac(this.num * o.den, this.den * o.num); }
  neg() { return new Frac(-this.num, this.den); }
  abs() { return new Frac(Math.abs(this.num), this.den); }

  equals(v) { const o = Frac.from(v); return this.num === o.num && this.den === o.den; }
  isZero() { return this.num === 0; }
  isOne() { return this.num === 1 && this.den === 1; }
  isInteger() { return this.den === 1; }
  sign() { return Math.sign(this.num); }
  toString() { return this.den === 1 ? String(this.num) : `${this.num}/${this.den}`; }

  // --- interfaccia comune delle espressioni ---

  /** proiettile: op e' uno di Op (+, -, x, ÷), value un intero */
  apply(op, value) {
    if (op === Op.ADD) return this.add(value);
    if (op === Op.SUB) return this.sub(value);
    if (op === Op.MUL) return this.mul(value);
    if (op === Op.DIV) return value === 0 ? this : this.div(value);
    return this;
  }

  /** nemico-numero risolto quando arriva a 0 (enemy_number.py is_solved) */
  isSolved() { return this.isZero(); }

  toTokens() { return numberTokens(this); }
}
