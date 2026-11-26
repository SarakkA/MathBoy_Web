import { BLU, ROSSO, BULLET_SPEED, BULLET_RADIUS, Op } from "../config/settings.js";
import { shadedBall } from "../core/utils.js";

/** Pallina col numero sopra che va dritta verso il punto mirato (bullet.py). */
export default class Bullet {
  constructor(scene, x, y, targetX, targetY, op, value) {
    this.scene = scene;
    this.op = op;
    this.value = value;
    this.color = op === Op.ADD ? BLU : ROSSO;
    this.x = x;
    this.y = y;

    let dx = targetX - x;
    let dy = targetY - y;
    let len = Math.hypot(dx, dy);
    if (len === 0) { dx = 1; dy = 0; len = 1; }
    this.vx = (dx / len) * BULLET_SPEED;
    this.vy = (dy / len) * BULLET_SPEED;

    const key = shadedBall(scene, op === Op.ADD ? "ball_add" : "ball_sub", BULLET_RADIUS, this.color);
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
    this.sync();
  }

  sync() {
    this.rect.x = this.x - BULLET_RADIUS;
    this.rect.y = this.y - BULLET_RADIUS;
    this.ball.setPosition(this.x, this.y).setDepth(this.y + 20);
    this.label.setPosition(this.x, this.y).setDepth(this.y + 20.01);
  }

  destroy() {
    this.dead = true;
    this.ball.destroy();
    this.label.destroy();
  }
}
