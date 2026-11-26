// Generazione delle formule dei nemici, per tipo e livello, con le stesse regole casuali
// del gioco desktop:
//   number    enemy_number.py   generate_equation   (mondi Z e Q)       -> Frac
//   poly      enemy_poly.py     generate_equation   (mondi Z[x] e Q[x]) -> Linear
//   equation  enemy_equation2.py generate_equation  (mondo Eqz)          -> Equation
import Frac from "./fraction.js";
import { Linear, Equation } from "./linear.js";

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (a, b) => a + Math.floor(Math.random() * (b - a + 1)); // a..b inclusi
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i); // [a, b)

/** coeff_symmetric(a, b): da -b a -a-1 e da a+1 a b */
const coeffSymmetric = (a, b) => [...range(-b, -a), ...range(a + 1, b + 1)];

// secondi tra la soluzione e la sparizione del nemico
const SOLVE_DELAY = { number: 1, poly: 2, equation: 2 };

/** { expr, solveDelay } per una stanza (config/worlds.js: room.enemy) */
export function generateEnemy({ kind, level }) {
  const make = { number: numberLevel, poly: polyLevel, equation: equationLevel }[kind];
  return { expr: make(level), solveDelay: SOLVE_DELAY[kind] };
}

// --- numeri: mondi Z e Q (enemy_number.py) ---

const LEVEL_3_VALUES = [-20, -18, -17, -16, -14, -12, -10, 10, 12, 14, 16, 17, 18, 20];
const LEVEL_6_VALUES = [50, 81, 120, 144, 128, 1000, -50, -81, -120, -144, -128, -1000];
/** frazione "tipo livello 5": n/d con n in {5,7,11} e d in {2,3,4,6,9} */
const level5Fraction = () => new Frac(pick([5, 7, 11]), pick([2, 3, 4, 6, 9]));

function numberLevel(level) {
  switch (level) {
    case 1: return new Frac(between(1, 9));                       // armi [-], proiettili [1]
    case 2: return new Frac(pick(coeffSymmetric(0, 10)));          // armi [+, -], proiettili [1]
    case 3: return new Frac(pick(LEVEL_3_VALUES));                 // armi [+, -], proiettili [1, 2]
    case 4:                                                        // armi [+, -, x], proiettili [1, 2]
      if (Math.random() < 0.4) return new Frac(pick([1, 3, 5, 7, 9]), 2);
      return new Frac(pick(coeffSymmetric(0, 10)));
    case 5:                                                        // armi [+, -, x], proiettili [1, 2, 3]
      if (Math.random() < 0.6) return level5Fraction();
      return new Frac(pick(coeffSymmetric(10, 20)));
    case 6:                                                        // armi [+, -, x, /], proiettili [1, 2, 3]
      if (Math.random() < 0.4) return level5Fraction();
      return new Frac(pick(LEVEL_6_VALUES));
    default: return new Frac(42);
  }
}

// --- polinomi di primo grado: mondi Z[x] (livelli 1-3) e Q[x] (livelli 4-6) (enemy_poly.py) ---

const xPlus = (b) => new Linear(1, b);
const randomXPlusA = () => xPlus(between(1, 9) * pick([1, -1]));

function polyLevel(level) {
  switch (level) {
    case 1: // x ± a
      return xPlus(pick([1, 2, 3, 4, 5, 6, -1, -2, -3, -4, -5, -6]));
    case 2: // 30% x ± a, altrimenti b·x
      if (Math.random() < 0.3) return randomXPlusA();
      return new Linear(pick([2, 5]), 0);
    case 3: // 50% x ± a, altrimenti a·x + b
      if (Math.random() < 0.5) return randomXPlusA();
      return new Linear(pick([2, 3, 4, 5, 6, 8, 9, 10, 12]), pick(coeffSymmetric(3, 10)));
    case 4: { // x/a oppure x ± 1/a
      const a = pick([2, 3, 4, 5, 6, 8, 9, 10]);
      if (Math.random() < 0.5) return new Linear(new Frac(1, a), 0);
      return xPlus(new Frac(pick([1, -1]), a));
    }
    case 5:
    case 6: {
      const a = pick([2, 3, 5, 6]);
      const a2 = pick([2, 3, 4, 5, 6, 8, 9, 10]);
      const b = pick([1, 2, 3, 4, 5]);
      const c = pick(coeffSymmetric(3, 9));
      if (Math.random() < 0.5) {
        // (b/a)·x + c   (livello 6: + c/a2)
        return new Linear(new Frac(b, a), level === 5 ? new Frac(c) : new Frac(c, a2));
      }
      return new Linear(a2, new Frac(c, a)); // a2·x + c/a
    }
    default: return Linear.x().add(42);
  }
}

// --- equazioni di primo grado: mondo Eqz (enemy_equation2.py) ---

function equationLevel(level) {
  switch (level) {
    case 1: // x + a = 0
      return new Equation(xPlus(pick(coeffSymmetric(1, 10))), 0);
    case 2: {
      if (Math.random() < 0.5) return new Equation(xPlus(pick(coeffSymmetric(10, 20))), 0); // x ± a = 0
      const a = pick([2, 3, 4, 5, 6, 9, 10]);
      if (Math.random() < 0.5) return new Equation(new Linear(a, 0), 0); // a·x = 0
      return new Equation(new Linear(new Frac(1, a), 0), 0);             // x/a = 0
    }
    case 3: {
      const a = pick([1, 2, 3, 4, 5, 6, 8, 9, 10]);
      const b = pick(coeffSymmetric(0, 20));
      if (Math.random() < 0.5) return new Equation(new Linear(a, b), 0); // a·x + b = 0
      return new Equation(new Linear(new Frac(1, a), b), 0);             // x/a + b = 0
    }
    default: return new Equation(Linear.x(), 0);
  }
}
