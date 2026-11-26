// Frazioni esatte, al posto di sympy.Rational del gioco desktop.
// Sempre ridotte ai minimi termini, denominatore positivo.
// I numeri restano piccoli (al massimo qualche migliaio), quindi bastano i Number di JS.

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

  isZero() { return this.num === 0; }
  isInteger() { return this.den === 1; }
  sign() { return Math.sign(this.num); }
  toString() { return this.den === 1 ? String(this.num) : `${this.num}/${this.den}`; }
}
