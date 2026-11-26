import { DEPTH } from "../config/settings.js";

// frame in upgrade_icons.png (tools/export_level_web.py ICONS)
export const POTION_FRAME = { ice: 2, electric: 3, fire: 4 };
const LIFETIME = 60;     // s a terra
const BLINK_TIME = 3;    // lampeggia negli ultimi 3 s
const GRAVITY = 600;

/** Pozione bonus del Survivor (potion.py): cade dal cielo con un paio di rimbalzi,
 *  si raccoglie toccandola (effetto magnete come le monete) e attiva uno sparo speciale. */
export default class Potion {
  constructor(scene, x, y, kind) {
    this.scene = scene;
    this.kind = kind;
    this.x = x;
    this.groundY = y;
    this.y = y - 70;       // parte dall'alto
    this.vy = 0;
    this.vx = 0;
    this.state = "dropping"; // dropping -> idle -> collecting
    this.timer = 0;
    this.collectTimer = 0;
    this.dead = false;
    this.shadow = scene.add.ellipse(x, y + 7, 10, 3, 0x000000, 0.25).setDepth(DEPTH.shadow);
    this.sprite = scene.add.image(x, this.y, "upgrade_icons", POTION_FRAME[kind]);
    this.rect = new Phaser.Geom.Rectangle(x - 8, y - 8, 16, 16);
    this.sync();
  }

  get touchable() {
    return this.state === "idle" || this.state === "dropping";
  }

  /** impulso iniziale lontano dal player, poi viene risucchiata */
  collect(target) {
    this.state = "collecting";
    this.sprite.setVisible(true);
    this.shadow.setVisible(false);
    let dx = this.x - target.x;
    let dy = this.y - target.y;
    const len = Math.hypot(dx, dy) || 1;
    this.vx = (dx / len) * 250;
    this.vy = (dy / len) * 250;
    this.collectTimer = 0;
  }

  /** ritorna true quando e' arrivata al player */
  update(dt, target) {
    if (this.state === "collecting") {
      this.collectTimer += dt;
      if (this.collectTimer > 0.05) {
        let dx = target.x - this.x;
        let dy = target.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        this.vx += (dx / len) * 1400 * dt;
        this.vy += (dy / len) * 1400 * dt;
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > 200) { this.vx *= 200 / sp; this.vy *= 200 / sp; }
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.groundY = this.y;
      this.sync();
      return Math.hypot(target.x - this.x, target.y - this.y) < 10;
    }

    if (this.state === "dropping") {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.vy *= -0.5;
        if (Math.abs(this.vy) < 30) { this.state = "idle"; this.vy = 0; }
      }
      this.sync();
      return false;
    }

    this.timer += dt;
    if (this.timer >= LIFETIME) {
      this.destroy();
      return false;
    }
    if (this.timer >= LIFETIME - BLINK_TIME) {
      this.sprite.setVisible(Math.floor((this.timer - LIFETIME + BLINK_TIME) / 0.3) % 2 === 0);
    }
    return false;
  }

  sync() {
    this.sprite.setPosition(this.x, this.y).setDepth(this.groundY);
    this.shadow.setPosition(this.x, this.groundY + 7);
    this.rect.setPosition(this.x - 8, this.y - 8);
  }

  destroy() {
    this.dead = true;
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
