import { BLU, ROSSO, BULLET_SPEED, BULLET_RADIUS, Op } from "../config/settings.js";
import { shadedBall } from "../core/utils.js";

const PULSE_SPEED = 30;   // bullet.py update_pulse
const PULSE_MIN = 2;
const PULSE_MAX = 5;

/** Pallina col numero sopra che va dritta verso il punto mirato (bullet.py).
 *  I colpi caricati (× e ÷) hanno un anello chiaro che pulsa. */
export default class Bullet {
  constructor(scene, x, y, targetX, targetY, op, value) {
    this.scene = scene;
    this.op = op;
    this.value = value;
    this.color = op === Op.ADD || op === Op.MUL ? BLU : ROSSO;
    this.charged = op === Op.MUL || op === Op.DIV;
    this.x = x;
    this.y = y;

    let dx = targetX - x;
    let dy = targetY - y;
    let len = Math.hypot(dx, dy);
    if (len === 0) { dx = 1; dy = 0; len = 1; }
    this.vx = (dx / len) * BULLET_SPEED;
    this.vy = (dy / len) * BULLET_SPEED;

    this.pulseT = 0;
    this.ring = this.charged ? scene.add.circle(x, y, BULLET_RADIUS + PULSE_MIN, 0xe6e6e6) : null;
    const key = shadedBall(scene, this.color === BLU ? "ball_add" : "ball_sub", BULLET_RADIUS, this.color);
    this.ball = scene.add.image(x, y, key);
    this.label = scene.add.bitmapText(x, y, "gold12", String(value)).setOrigin(0.5);
    const d = BULLET_RADIUS * 2;
    this.rect = new Phaser.Geom.Rectangle(0, 0, d, d);
    this.dead = false;
    this.sync();
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
    if (this.ring) this.ring.setPosition(this.x, this.y).setDepth(this.y + 19.99);
    this.ball.setPosition(this.x, this.y).setDepth(this.y + 20);
    this.label.setPosition(this.x, this.y).setDepth(this.y + 20.01);
  }

  destroy() {
    this.dead = true;
    this.ring?.destroy();
    this.ball.destroy();
    this.label.destroy();
  }
}
