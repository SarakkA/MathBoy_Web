import { ENEMY_SOLVE_DELAY, DEPTH, Op } from "../../config/settings.js";

/** Nemico-numero intero da portare a 0 (enemy_number.py). Il valore iniziale arriva da
 *  generateEquation (math/equations.js). Il desktop lo disegna in LaTeX con matplotlib;
 *  qui basta il testo bitmap. */
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
    this.text = scene.add.bitmapText(x, y, "gold16", "").setOrigin(0.5).setTint(0x000000).setDepth(y);
    this.hitbox = new Phaser.Geom.Rectangle();
    this.refresh();
  }

  refresh() {
    this.text.setText(String(this.value));
    // hitbox ~ ingombro della cifra (desktop: immagine LaTeX ridotta di 26 px per lato)
    const w = Math.max(8, this.text.width - 2);
    const h = 12;
    this.hitbox.setTo(this.x - w / 2, this.y - h / 2, w, h);
    this.shadow.setSize(Math.max(12, this.text.width + 2), 4);
  }

  get topRight() {
    return { x: this.x + this.text.width / 2, y: this.y - this.text.height / 2 };
  }

  takeValue(value, op) {
    if (this.solveTimer !== null) return;
    this.value += op === Op.ADD ? value : -value;
    this.refresh();
    this.scene.tweens.add({ targets: this.text, scale: { from: 1.35, to: 1 }, duration: 140 });
    if (this.value === 0) {
      this.solved = true;
      this.solveTimer = ENEMY_SOLVE_DELAY;
      this.text.setTint(0x2e6b1f);
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
