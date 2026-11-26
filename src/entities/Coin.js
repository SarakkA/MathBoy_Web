import { DEPTH } from "../config/settings.js";
// Moneta lasciata dal nemico risolto (coin.py): rimbalza, poi si raccoglie toccandola.
const FRAMES = 7;            // coin2.png: 3 + 3 + 1 frame da 16x16
const FRAME_TIME = 7 / 60;
const LIFETIME = 15;         // s
const BLINK_TIME = 3;        // lampeggia negli ultimi 3 s
const GRAVITY = 400;

export default class Coin {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.groundY = y;
    this.z = 0;                 // altezza sopra il terreno
    this.vz = 90;               // spinta iniziale verso l'alto
    this.state = "bouncing";    // bouncing -> idle -> collecting
    this.timer = 0;
    this.frame = Phaser.Math.Between(0, 5);
    this.frameTimer = 0;
    this.dead = false;

    this.shadow = scene.add.ellipse(x, y + 7, 10, 3, 0x000000, 0.25).setDepth(DEPTH.shadow);
    this.sprite = scene.add.sprite(x, y, "coin", this.frame).setDepth(y);
    this.rect = new Phaser.Geom.Rectangle(x - 6.5, y - 6.5, 13, 13);
  }

  collect() {
    this.state = "collecting";
    this.sprite.setVisible(true);
  }

  /** ritorna true quando la moneta e' arrivata al player */
  update(dt, target) {
    this.frameTimer += dt;
    if (this.frameTimer >= FRAME_TIME) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % FRAMES;
      this.sprite.setFrame(this.frame);
    }

    if (this.state === "collecting") {
      const dx = target.x - this.x;
      const dy = target.y - (this.groundY - this.z);
      const dist = Math.hypot(dx, dy);
      if (dist < 4) return true;
      const step = Math.min(dist, 220 * dt);
      this.x += (dx / dist) * step;
      this.groundY += (dy / dist) * step;
      this.shadow.setVisible(false);
      this.sync();
      return false;
    }

    if (this.state === "bouncing") {
      this.vz -= GRAVITY * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.z = 0;
        if (Math.abs(this.vz) > 30) this.vz = -this.vz * 0.4;
        else this.state = "idle";
      }
    }

    this.timer += dt;
    if (this.timer >= LIFETIME) {
      this.destroy();
      return false;
    }
    if (this.timer >= LIFETIME - BLINK_TIME) {
      this.sprite.setVisible(Math.floor(this.timer / 0.3) % 2 === 0);
    }
    this.sync();
    return false;
  }

  sync() {
    this.sprite.setPosition(this.x, this.groundY - this.z).setDepth(this.groundY);
    this.shadow.setPosition(this.x, this.groundY + 7);
    this.rect.setPosition(this.x - 6.5, this.groundY - 6.5);
  }

  destroy() {
    this.dead = true;
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
