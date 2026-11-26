import { DEPTH } from "../../config/settings.js";
import MathText from "../../ui/mathText.js";

/** Nemico-formula: un numero (Frac), un polinomio (Linear) o un'equazione (Equation).
 *  Ogni proiettile trasforma la formula con expr.apply(op, valore); il nemico e' risolto
 *  quando expr.isSolved() (enemy_number.py, enemy_poly.py, enemy_equation2.py).
 *  Il desktop disegna la formula in LaTeX con matplotlib; qui la impagina MathText. */
export default class MathEnemy {
  /** solveDelay: secondi tra la soluzione e la sparizione (1 per i numeri, 2 per x ed equazioni) */
  constructor(scene, x, y, expr, solveDelay = 1) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.expr = expr;
    this.solveDelay = solveDelay;
    this.solved = false;
    this.solveTimer = null;
    this.dead = false;

    this.shadow = scene.add.ellipse(x, y + 9, 14, 4, 0x000000, 0.25).setDepth(DEPTH.shadow);
    this.text = new MathText(scene, x, y).setDepth(y);
    this.hitbox = new Phaser.Geom.Rectangle();
    this.refresh();
  }

  refresh() {
    this.text.setValue(this.expr);
    // hitbox ~ ingombro della formula (desktop: immagine LaTeX ridotta di 26 px per lato)
    const w = Math.max(8, this.text.textW);
    const h = Math.max(12, this.text.textH);
    this.hitbox.setTo(this.x - w / 2, this.y - h / 2, w, h);
    this.shadow.setPosition(this.x, this.y + this.text.textH / 2 + 4);
    this.shadow.setSize(Math.max(12, this.text.textW + 2), 4);
  }

  get topRight() {
    return { x: this.x + this.text.textW / 2 + 2, y: this.y - this.text.textH / 2 - 2 };
  }

  /** applica il proiettile (take_value) */
  takeValue(value, op) {
    if (this.solveTimer !== null) return;
    this.expr = this.expr.apply(op, value);
    this.refresh();
    this.scene.tweens.add({ targets: this.text, scale: { from: 1.35, to: 1 }, duration: 140 });
    if (this.expr.isSolved()) {
      this.solved = true;
      this.solveTimer = this.solveDelay;
      this.text.setColor(0x2e6b1f);
    }
  }

  update(dt) {
    if (this.solveTimer === null) return;
    this.solveTimer -= dt;
    this.text.setAlpha(Math.max(0.2, this.solveTimer / this.solveDelay));
    if (this.solveTimer <= 0) {
      this.dead = true;
      this.scene.onEnemySolved(this);
      this.destroy();
    }
  }

  destroy() {
    this.text.destroy();
    this.shadow.destroy();
  }
}
