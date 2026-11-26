import { DEPTH, Op } from "../../config/settings.js";
import { overlaps } from "../../core/utils.js";
import MathText from "../../ui/mathText.js";
import Frac from "../../math/fraction.js";
import { Linear, Equation } from "../../math/linear.js";

/** Nemico-formula: un numero (Frac), un polinomio (Linear) o un'equazione (Equation).
 *  Ogni proiettile trasforma la formula con expr.apply(op, valore); il nemico e' risolto
 *  quando expr.isSolved() (enemy_number.py, enemy_poly.py, enemy_equation2.py).
 *  Il desktop disegna la formula in LaTeX con matplotlib; qui la impagina MathText.
 *
 *  Nella campagna sta fermo. Nel Survivor insegue il player (chase) e subisce gli effetti
 *  delle pozioni: ghiaccio rallenta, elettrico blocca, fuoco brucia (enemy.py). */
export default class MathEnemy {
  /** solveDelay: secondi tra la soluzione e la sparizione (1 per i numeri, 2 per x ed equazioni) */
  constructor(scene, x, y, expr, solveDelay = 1, { speed = 0, isMinion = false } = {}) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.expr = expr;
    this.solveDelay = solveDelay;
    this.solved = false;
    this.solveTimer = null;
    this.dead = false;

    this.speed = speed;
    this.isMinion = isMinion;
    this.age = 0;
    this.slowFactor = 1;   // ghiaccio
    this.slowTimer = 0;
    this.stopTimer = 0;    // elettrico
    this.burnTimer = 0;    // fuoco
    this.burnTick = 0;

    this.shadow = scene.add.ellipse(x, y + 9, 14, 4, 0x000000, 0.25).setDepth(DEPTH.shadow);
    this.text = new MathText(scene, x, y).setDepth(y);
    this.hitbox = new Phaser.Geom.Rectangle();
    this.iceAura = null;   // ombre colorate degli effetti, create al primo uso
    this.stopAura = null;
    this.refresh();
  }

  refresh() {
    this.text.setValue(this.expr);
    this.place();
  }

  /** hitbox ~ ingombro della formula (desktop: immagine LaTeX ridotta di 26 px per lato) */
  place() {
    const w = Math.max(8, this.text.textW);
    const h = Math.max(12, this.text.textH);
    this.hitbox.setTo(this.x - w / 2, this.y - h / 2, w, h);
    this.text.setPosition(this.x, this.y).setDepth(this.y);
    const sy = this.y + this.text.textH / 2 + 4;
    this.shadow.setPosition(this.x, sy);
    this.shadow.setSize(Math.max(12, this.text.textW + 2), 4);
    this.iceAura?.setPosition(this.x, sy).setSize(w + 6, 8).setVisible(this.slowTimer > 0);
    this.stopAura?.setPosition(this.x, sy + 1).setSize(Math.max(6, w - 4), 5).setVisible(this.stopTimer > 0);
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
      this.iceAura?.setVisible(false);
      this.stopAura?.setVisible(false);
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

  // --- effetti delle pozioni (enemy.py apply_slow, apply_stop, apply_burn) ---

  applySlow(factor, duration) {
    this.slowFactor = factor;
    this.slowTimer = Math.max(this.slowTimer, duration);
    if (!this.iceAura) this.iceAura = this.scene.add.ellipse(0, 0, 10, 8, 0x96d7ff, 110 / 255).setDepth(DEPTH.shadow + 0.1);
    this.place();
  }

  applyStop(duration) {
    this.stopTimer = Math.max(this.stopTimer, duration);
    if (!this.stopAura) this.stopAura = this.scene.add.ellipse(0, 0, 10, 5, 0xffe65a, 150 / 255).setDepth(DEPTH.shadow + 0.2);
    this.place();
  }

  applyBurn(duration) {
    this.burnTimer = Math.max(this.burnTimer, duration);
  }

  get burning() {
    return this.burnTimer > 0 && !this.solved;
  }

  /** ±1 che avvicina alla forma risolta: termine noto (del lato con la x) verso 0.
   *  null se e' gia' 0: le frazioni oscillano, voluto (enemy.py burn_direction) */
  burnOp() {
    let offset = null;
    const e = this.expr;
    if (e instanceof Frac) offset = e;
    else if (e instanceof Linear) offset = e.b;
    else if (e instanceof Equation) offset = (e.lhs.a.isZero() ? e.rhs : e.lhs).b;
    if (!offset || offset.isZero()) return null;
    return offset.sign() > 0 ? Op.SUB : Op.ADD;
  }

  /** timer degli effetti; il fuoco ogni secondo da' un ±1 automatico (enemy.py update) */
  updateEffects(dt) {
    if (this.solved) return;
    if (this.burnTimer > 0) {
      this.burnTimer = Math.max(0, this.burnTimer - dt);
      this.burnTick += dt;
      if (this.burnTick >= 1) {
        this.burnTick -= 1;
        const op = this.burnOp();
        if (op) this.takeValue(1, op);
      }
    } else {
      this.burnTick = 0;
    }
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) { this.slowTimer = 0; this.slowFactor = 1; }
    }
    if (this.stopTimer > 0) this.stopTimer = Math.max(0, this.stopTimer - dt);
  }

  /** verso il player, separandosi dagli altri nemici; i muri fermano l'asse che sbatte
   *  (enemy.py move_towards_player + wall_collision) */
  chase(dt, target, enemies, obstacles) {
    if (this.solved || this.stopTimer > 0) return;
    // la velocita' cresce piano col tempo di vita (0.0003·t a ogni frame a 60 FPS)
    this.age += dt;
    this.speed += 0.0003 * this.age * dt * 60;

    let dx = target.x - this.x;
    let dy = target.y - this.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }

    let sx = 0;
    let sy = 0;
    for (const o of enemies) {
      if (o === this) continue;
      const ox = this.x - o.x;
      const oy = this.y - o.y;
      const dist = Math.hypot(ox, oy);
      const minDist = this.hitbox.width + o.hitbox.width;
      if (dist > 0 && dist < minDist) {
        sx += (ox / dist) * (minDist - dist);
        sy += (oy / dist) * (minDist - dist);
      }
    }
    let mx = dx + sx * 0.05;
    let my = dy + sy * 0.05;
    const m = Math.hypot(mx, my);
    if (m > 0) { mx /= m; my /= m; }

    const step = this.speed * this.slowFactor * dt;
    const hb = this.hitbox;
    const blocked = () => obstacles.some((ob) => overlaps(hb, ob));
    hb.x += mx * step;
    if (blocked()) hb.x -= mx * step;
    hb.y += my * step;
    if (blocked()) hb.y -= my * step;
    this.x = hb.centerX;
    this.y = hb.centerY;
    this.place();
  }

  destroy() {
    this.text.destroy();
    this.shadow.destroy();
    this.iceAura?.destroy();
    this.stopAura?.destroy();
  }
}
