import { PLAYER_SPEED } from "../config/settings.js";
import { SKINS, DEATH_FRAME_TIME, SPRITE_TOP } from "../config/skins.js";
import { overlaps } from "../core/utils.js";

// settori di 60° attorno al player, da atan2 (level_base.py handle_player_input)
const SECTORS = ["left_up", "up", "right_up", "right", "down", "left"];
const HITBOX_W = 12; // 48x48 ridotto di 36x32
const HITBOX_H = 16;

/** Movimento, collisioni e animazione. HP, vite, monete e armi stanno nella run (core/run.js).
 *  skin: indice in SKINS (config/skins.js), scelto nell'intro. */
export default class Player {
  constructor(scene, x, y, skin = 0) {
    this.scene = scene;
    this.skin = SKINS[skin] || SKINS[0];
    this.hitbox = new Phaser.Geom.Rectangle(x - HITBOX_W / 2, y - HITBOX_H / 2, HITBOX_W, HITBOX_H);
    this.shadow = this.skin.shadow ? scene.add.image(x, y, "shadow").setOrigin(0.5, 0) : null;
    this.sprite = scene.add.sprite(x, y, this.skin.anims.idle_up[0], 0).setOrigin(0.5, 0);

    this.speed = PLAYER_SPEED;
    this.isDead = false;
    this.locked = false; // fermo durante baule e dialoghi (can_move/can_shoot = False)
    this.state = "idle_up";
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.verso = 1; // 1 avanti, -1 indietro (cammina all'indietro se mira dietro di sé)
    this.sync();
  }

  get center() {
    return { x: this.hitbox.centerX, y: this.hitbox.centerY };
  }

  /** bordo basso dello sprite (sotto ci va la barra della vita, come health_bar.py) */
  get spriteBottom() {
    return this.hitbox.centerY - SPRITE_TOP + 48;
  }

  /** dir: {x,y} di movimento (non normalizzato); aim: vettore player -> punto di mira */
  update(dt, dir, aim, obstacles) {
    if (this.isDead) {
      this.state = "death";
      this.animate(dt, 1, DEATH_FRAME_TIME);
      return;
    }
    if (this.locked) {
      this.animate(dt, 1, this.skin.frameTime);
      return;
    }

    let dx = dir.x;
    let dy = dir.y;
    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    const angle = Math.atan2(aim.y, aim.x);
    const sector = Math.floor((angle + Math.PI) / (Math.PI / 3)) % 6;
    this.state = moving ? SECTORS[sector] : "idle_" + SECTORS[sector];
    if (moving) this.verso = aim.x * dx + aim.y * dy > 0 ? 1 : -1;

    this.move(dt, dx, dy, obstacles);
    this.animate(dt, this.verso, this.skin.frameTime);
  }

  // asse x poi asse y, respingendo la hitbox fuori dagli ostacoli (player.py move/collision)
  move(dt, dx, dy, obstacles) {
    const hb = this.hitbox;
    hb.x += dx * this.speed * dt;
    for (const ob of obstacles) {
      if (!overlaps(hb, ob)) continue;
      if (dx > 0) hb.x = ob.x - hb.width;
      else if (dx < 0) hb.x = ob.right;
    }
    hb.y += dy * this.speed * dt;
    for (const ob of obstacles) {
      if (!overlaps(hb, ob)) continue;
      if (dy > 0) hb.y = ob.y - hb.height;
      else if (dy < 0) hb.y = ob.bottom;
    }
    this.sync();
  }

  animate(dt, step, frameTime) {
    const [texture, row, flip, count] = this.skin.anims[this.state];
    this.frameTimer += dt;
    if (this.frameTimer >= frameTime) {
      this.frameTimer = 0;
      if (this.state === "death") {
        this.frameIndex = Math.min(this.frameIndex + 1, count - 1);
      } else {
        this.frameIndex = (((this.frameIndex + step) % count) + count) % count;
      }
    }
    this.frameIndex %= count;
    if (this.sprite.texture.key !== texture) this.sprite.setTexture(texture);
    this.sprite.setFrame(row * this.skin.cols + this.frameIndex);
    this.sprite.setFlipX(flip);
  }

  /** blocca il player e lo gira verso il punto (level_Z.py force_player_to_read) */
  lockFacing(x, y) {
    this.locked = true;
    const dx = x - this.hitbox.centerX;
    const dy = y - this.hitbox.centerY;
    if (Math.abs(dx) > Math.abs(dy)) this.state = dx > 0 ? "idle_right" : "idle_left";
    else this.state = dy > 0 ? "idle_down" : "idle_up";
  }

  startDeath() {
    this.isDead = true;
    this.frameIndex = 0;
    this.frameTimer = 0;
  }

  revive() {
    this.isDead = false;
    this.state = "idle_down";
  }

  sync() {
    const x = this.hitbox.centerX;
    const top = this.hitbox.centerY - SPRITE_TOP;
    this.sprite.setPosition(x, top).setDepth(this.hitbox.bottom);
    if (this.shadow) this.shadow.setPosition(x, top).setDepth(this.hitbox.bottom - 0.01);
  }
}
