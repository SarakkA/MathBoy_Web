// Da espressione a "pezzi" da impaginare, con le stesse convenzioni del LaTeX di sympy
// che il gioco desktop mostra:
//
//   3/2           ->  frazione impilata
//   -3/2          ->  segno, frazione
//   (3/2)x + 5    ->  \frac{3x}{2} + 5   (la x sta nel numeratore)
//   x/4 - 1/4     ->  \frac{x}{4} - \frac{1}{4}
//   2x + 3 = 0
//
// Pezzi:
//   { t: "text", s }        testo sulla riga (cifre, x)
//   { t: "frac", num, den } frazione impilata; num e den sono stringhe ("3x", "2")
//   { t: "sign", s: "-" }   meno davanti a un numero o a un termine (attaccato)
//   { t: "op", s }          operatore tra termini (+, -, =), con spazio ai lati
//
// Nessuna dipendenza da Phaser: si puo' provare anche da Node.

/** numero da solo (nemici-numero): intero o frazione col segno davanti */
export function numberTokens(f) {
  if (f.isInteger()) return [{ t: "text", s: String(f.num) }];
  const out = [];
  if (f.num < 0) out.push({ t: "sign", s: "-" });
  out.push({ t: "frac", num: String(Math.abs(f.num)), den: String(f.den) });
  return out;
}

/** modulo di un termine (senza segno): coefficiente con o senza x */
function magnitudeTokens(coef, withX) {
  const c = coef.abs();
  if (!withX) {
    if (c.isInteger()) return [{ t: "text", s: String(c.num) }];
    return [{ t: "frac", num: String(c.num), den: String(c.den) }];
  }
  if (c.isOne()) return [{ t: "text", s: "x" }];
  if (c.isInteger()) return [{ t: "text", s: `${c.num}x` }];
  return [{ t: "frac", num: c.num === 1 ? "x" : `${c.num}x`, den: String(c.den) }];
}

/** termine dentro una somma: il primo porta il meno attaccato, gli altri un operatore */
function termTokens(coef, withX, first) {
  const out = [];
  if (first) {
    if (coef.sign() < 0) out.push({ t: "sign", s: "-" });
  } else {
    out.push({ t: "op", s: coef.sign() < 0 ? "-" : "+" });
  }
  return out.concat(magnitudeTokens(coef, withX));
}

/** a·x + b: prima la x poi il termine noto (come sympy), "0" se e' tutto nullo */
export function linearTokens(lin) {
  const out = [];
  if (!lin.a.isZero()) out.push(...termTokens(lin.a, true, true));
  if (!lin.b.isZero()) out.push(...termTokens(lin.b, false, out.length === 0));
  if (out.length === 0) out.push({ t: "text", s: "0" });
  return out;
}

export function equationTokens(eq) {
  return [...linearTokens(eq.lhs), { t: "op", s: "=" }, ...linearTokens(eq.rhs)];
}
