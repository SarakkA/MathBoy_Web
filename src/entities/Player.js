import { PLAYER_SPEED } from "../config/settings.js";
import { overlaps } from "../core/utils.js";

// Righe dello sprite sheet 48x48 (player.py load_animation_sprite): [riga, specchiata]
const ANIMS = {
  idle_down: [0, false],
  idle_right: [1, false],
  idle_right_up: [1, false],
  idle_up: [2, false],
  down: [3, false],
  right: [4, false],
  right_up: [4, false],
  up: [5, false],
  death: [9, false],
  left: [4, true],
  left_up: [4, true],
  idle_left: [1, true],
  idle_left_up: [1, true],
};
// settori di 60° attorno al player, da atan2 (level_base.py handle_player_input)
const SECTORS = ["left_up", "up", "right_up", "right", "down", "left"];

const FRAME_TIME = 7 / 60;   // animation_speed 7 frame a 60 FPS
const DEATH_FRAME_TIME = 30 / 60;
const HITBOX_W = 12;         // 48x48 ridotto di 36x32
const HITBOX_H = 16;
const SPRITE_ABOVE_HITBOX = 9; // reset_hitbox_to_rect_y: rect.centery = hitbox.centery - 9

/** Movimento, collisioni e animazione. HP, vite, monete e armi stanno nella run (core/run.js). */
export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.hitbox = new Phaser.Geom.Rectangle(x - HITBOX_W / 2, y - HITBOX_H / 2, HITBOX_W, HITBOX_H);
    this.sprite = scene.add.sprite(x, y - SPRITE_ABOVE_HITBOX, "player", 0);

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

  /** dir: {x,y} da WASD (non normalizzato); aim: vettore player -> mouse in coordinate mondo */
  update(dt, dir, aim, obstacles) {
    if (this.isDead) {
      this.state = "death";
      this.animate(dt, 1, DEATH_FRAME_TIME);
      return;
    }
    if (this.locked) {
      this.animate(dt, 1, FRAME_TIME);
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
    this.animate(dt, this.verso, FRAME_TIME);
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
    const [row, flip] = ANIMS[this.state];
    const count = this.state === "death" ? 3 : 6;
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
    this.sprite.setFrame(row * 6 + this.frameIndex);
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
    this.sprite.setPosition(this.hitbox.centerX, this.hitbox.centerY - SPRITE_ABOVE_HITBOX);
    this.sprite.setDepth(this.hitbox.bottom);
  }
}
