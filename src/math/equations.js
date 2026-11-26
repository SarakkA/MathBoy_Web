// Generazione dei nemici-numero (enemy_number.py, generate_equation).
// Per ora solo i livelli a numeri interi; equazioni, frazioni e polinomi arriveranno
// con i mondi successivi (servira' una piccola libreria di frazioni al posto di sympy).

const LEVEL_3_VALUES = [-20, -18, -17, -16, -14, -12, -10, 10, 12, 14, 16, 17, 18, 20];

export function generateEquation(level) {
  if (level === 1) {
    // armi [-], proiettili [1]
    return Phaser.Math.Between(1, 9);
  }
  if (level === 2) {
    // armi [+, -], proiettili [1]
    let a = 0;
    while (a === 0) a = Phaser.Math.Between(-10, 10);
    return a;
  }
  if (level === 3) {
    // armi [+, -], proiettili [1, 2]
    return Phaser.Utils.Array.GetRandom(LEVEL_3_VALUES);
  }
  return 42; // non dovrebbe succedere
}
