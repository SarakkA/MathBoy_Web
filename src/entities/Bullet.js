import { BLU, ROSSO, BULLET_SPEED, BULLET_RADIUS, Op } from "../config/settings.js";
import { shadedBall } from "../core/utils.js";

const PULSE_SPEED = 30;   // bullet.py update_pulse
const PULSE_MIN = 2;
const PULSE_MAX = 5;

// anello colorato dei colpi potenziati dalle pozioni del Survivor (bullet.py)
export const AURA = { ice: 0x96d7ff, electric: 0xffe65a, fire: 0xff8c28 };

/** Pallina col numero sopra che va dritta verso il punto mirato (bullet.py).
 *  I colpi caricati (× e ÷) hanno un anello chiaro che pulsa.
 *  opts.speed: velocita' (il Survivor la aumenta con le carte)
 *  opts.effects: { ice, electric, fire } livello delle carte se la pozione e' attiva, altrimenti 0 */
export default class Bullet {
  constructor(scene, x, y, targetX, targetY, op, value, opts = {}) {
    this.scene = scene;
    this.op = op;
    this.value = value;
    this.color = op === Op.ADD || op === Op.MUL ? BLU : ROSSO;
    this.charged = op === Op.MUL || op === Op.DIV;
    this.effects = opts.effects || { ice: 0, electric: 0, fire: 0 };
    const fx = this.effects;
    // l'elettrico ha la precedenza sul fuoco, il fuoco sul ghiaccio
    this.aura = fx.electric ? AURA.electric : fx.fire ? AURA.fire : fx.ice ? AURA.ice : null;
    this.x = x;
    this.y = y;

    const speed = opts.speed || BULLET_SPEED;
    let dx = targetX - x;
    let dy = targetY - y;
    let len = Math.hypot(dx, dy);
    if (len === 0) { dx = 1; dy = 0; len = 1; }
    this.vx = (dx / len) * speed;
    this.vy = (dy / len) * speed;
    this.dirX = dx / len;
    this.dirY = dy / len;

    this.pulseT = 0;
    this.ring = this.charged ? scene.add.circle(x, y, BULLET_RADIUS + PULSE_MIN, this.aura ?? 0xe6e6e6) : null;
    this.auraCircle = this.aura ? scene.add.circle(x, y, BULLET_RADIUS + 3, this.aura) : null;
    const key = shadedBall(scene, this.color === BLU ? "ball_add" : "ball_sub", BULLET_RADIUS, this.color);
    this.ball = scene.add.image(x, y, key);
    this.label = scene.add.bitmapText(x, y, "gold12", String(value)).setOrigin(0.5);
    const d = BULLET_RADIUS * 2;
    this.rect = new Phaser.Geom.Rectangle(0, 0, d, d);
    this.dead = false;
    this.sync();
  }

  /** colore dello scoppio: quello dell'aura se potenziato (level_base.py spawn_bullet_pop_fx) */
  get popColor() {
    return this.aura ?? this.color;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.ring) {
      this.pulseT += dt * PULSE_SPEED;
      const s = (Math.sin(this.pulseT) + 1) / 2;
      this.ring.setRadius(BULLET_RADIUS + Math.floor(PULSE_MIN + s * (PULSE_MAX - PULSE_MIN)));
    }
    this.sync();
  }

  sync() {
    this.rect.x = this.x - BULLET_RADIUS;
    this.rect.y = this.y - BULLET_RADIUS;
    if (this.ring) this.ring.setPosition(this.x, this.y).setDepth(this.y + 19.98);
    if (this.auraCircle) this.auraCircle.setPosition(this.x, this.y).setDepth(this.y + 19.99);
    this.ball.setPosition(this.x, this.y).setDepth(this.y + 20);
    this.label.setPosition(this.x, this.y).setDepth(this.y + 20.01);
  }

  destroy() {
    this.dead = true;
    this.ring?.destroy();
    this.auraCircle?.destroy();
    this.ball.destroy();
    this.label.destroy();
  }
}
