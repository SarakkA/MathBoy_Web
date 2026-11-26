// Generazione dei nemici-numero (enemy_number.py, generate_equation).
// Restituisce sempre una Frac: gli interi sono frazioni con denominatore 1.
// Equazioni e polinomi arriveranno con i mondi Z[x], Q[x], EQ.
import Frac from "./fraction.js";

const pick = (list) => Phaser.Utils.Array.GetRandom(list);
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i); // [a, b)

/** coeff_symmetric(a, b): da -b a -a-1 e da a+1 a b */
const coeffSymmetric = (a, b) => [...range(-b, -a), ...range(a + 1, b + 1)];

const LEVEL_3_VALUES = [-20, -18, -17, -16, -14, -12, -10, 10, 12, 14, 16, 17, 18, 20];
const LEVEL_6_VALUES = [50, 81, 120, 144, 128, 1000, -50, -81, -120, -144, -128, -1000];

/** frazione "tipo livello 5": n/d con n in {5,7,11} e d in {2,3,4,6,9} */
const level5Fraction = () => new Frac(pick([5, 7, 11]), pick([2, 3, 4, 6, 9]));

export function generateEquation(level) {
  switch (level) {
    case 1: // armi [-], proiettili [1]
      return new Frac(Phaser.Math.Between(1, 9));
    case 2: { // armi [+, -], proiettili [1]
      let a = 0;
      while (a === 0) a = Phaser.Math.Between(-10, 10);
      return new Frac(a);
    }
    case 3: // armi [+, -], proiettili [1, 2]
      return new Frac(pick(LEVEL_3_VALUES));
    case 4: // armi [+, -, x], proiettili [1, 2]: 40% mezzi
      if (Math.random() < 0.4) return new Frac(pick([1, 3, 5, 7, 9]), 2);
      return new Frac(pick(coeffSymmetric(0, 10)));
    case 5: // armi [+, -, x], proiettili [1, 2, 3]: 60% frazioni
      if (Math.random() < 0.6) return level5Fraction();
      return new Frac(pick(coeffSymmetric(10, 20)));
    case 6: // armi [+, -, x, /], proiettili [1, 2, 3]
      if (Math.random() < 0.4) return level5Fraction();
      return new Frac(pick(LEVEL_6_VALUES));
    default:
      return new Frac(42); // non dovrebbe succedere
  }
}
