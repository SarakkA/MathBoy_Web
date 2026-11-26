import { ENEMY_SOLVE_DELAY, DEPTH, Op } from "../../config/settings.js";
import MathText from "../../ui/mathText.js";

/** Nemico-numero da portare a 0 (enemy_number.py): intero o frazione (Frac).
 *  Il valore iniziale arriva da generateEquation (math/equations.js). Il desktop lo
 *  disegna in LaTeX con matplotlib; qui lo disegna MathText. */
export default class EnemyNumber {
  constructor(scene, x, y, value) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.value = value;
    this.solved = false;
    this.solveTimer = null;
    this.dead = false;

    this.shadow = scene.add.ellipse(x, y + 9, 14, 4, 0x000000, 0.25).setDepth(DEPTH.shadow);
    this.text = new MathText(scene, x, y).setDepth(y);
    this.hitbox = new Phaser.Geom.Rectangle();
    this.refresh();
  }

  refresh() {
    this.text.setValue(this.value);
    // hitbox ~ ingombro del numero (desktop: immagine LaTeX ridotta di 26 px per lato)
    const w = Math.max(8, this.text.textW);
    const h = Math.max(12, this.text.textH);
    this.hitbox.setTo(this.x - w / 2, this.y - h / 2, w, h);
    this.shadow.setPosition(this.x, this.y + this.text.textH / 2 + 4);
    this.shadow.setSize(Math.max(12, this.text.textW + 2), 4);
  }

  get topRight() {
    return { x: this.x + this.text.textW / 2 + 2, y: this.y - this.text.textH / 2 - 2 };
  }

  /** applica il proiettile (enemy_number.py take_value) */
  takeValue(value, op) {
    if (this.solveTimer !== null) return;
    if (op === Op.DIV && value === 0) return;
    if (op === Op.ADD) this.value = this.value.add(value);
    else if (op === Op.SUB) this.value = this.value.sub(value);
    else if (op === Op.MUL) this.value = this.value.mul(value);
    else if (op === Op.DIV) this.value = this.value.div(value);
    this.refresh();
    this.scene.tweens.add({ targets: this.text, scale: { from: 1.35, to: 1 }, duration: 140 });
    if (this.value.isZero()) {
      this.solved = true;
      this.solveTimer = ENEMY_SOLVE_DELAY;
      this.text.setColor(0x2e6b1f);
    }
  }

  update(dt) {
    if (this.solveTimer === null) return;
    this.solveTimer -= dt;
    this.text.setAlpha(Math.max(0.2, this.solveTimer / ENEMY_SOLVE_DELAY));
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
