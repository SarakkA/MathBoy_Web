import { LOGICAL_WIDTH as W } from "../config/settings.js";

const SCROLL_SPEED = 30;  // px/s (0.5 px per frame a 60 FPS, intro_state.py)
const TITLE_Y = 70;

/** Sfondo di intro e menu: la mappa menu_map che scorre in verticale e il titolo
 *  "MathBoy" che ondeggia con l'ombra (intro_state.py / menu_state.py).
 *  Lo scorrimento continua da una scena all'altra grazie al registry. */
export default class MenuBackground {
  constructor(scene) {
    this.scene = scene;
    scene.cameras.main.setBackgroundColor("#53a03b");
    const tex = scene.textures.get("map_menu_map").getSourceImage();
    this.mapH = tex.height;
    const x = Math.round((W - tex.width) / 2);
    this.maps = [0, 1].map(() => scene.add.image(x, 0, "map_menu_map").setOrigin(0));
    this.scroll = scene.registry.get("menuScroll") || 0;
    this.time = scene.registry.get("menuTitleTime") || 0;

    this.titleShadow = scene.add.bitmapText(W / 2, TITLE_Y, "gold48", "MathBoy").setOrigin(0.5, 0).setTint(0x191919);
    this.title = scene.add.bitmapText(W / 2, TITLE_Y, "gold48", "MathBoy").setOrigin(0.5, 0);
    this.titleAlpha = 1;
  }

  setTitleAlpha(a) {
    this.titleAlpha = a;
  }

  update(dt) {
    this.scroll = (this.scroll + SCROLL_SPEED * dt) % this.mapH;
    this.maps[0].y = Math.round(this.scroll);
    this.maps[1].y = Math.round(this.scroll - this.mapH);
    this.time += dt;
    this.scene.registry.set("menuScroll", this.scroll);
    this.scene.registry.set("menuTitleTime", this.time);

    // il titolo ondeggia; l'ombra si allontana quando sale
    const offset = 5 * Math.sin(this.time * 2);
    const shadowOff = 3 - offset * 0.5;
    this.title.setY(Math.round(TITLE_Y + offset)).setAlpha(this.titleAlpha);
    this.titleShadow.setPosition(Math.round(W / 2 + shadowOff), Math.round(TITLE_Y + offset + shadowOff))
      .setAlpha(Math.min(150 / 255, this.titleAlpha * 0.6));
  }
}

/** Bottone in stile menu (draw_utils.py draw_menu_button): ombra morbida fissa,
 *  faccia che si ingrandisce su hover, testo bianco con ombra. */
export class MenuButton {
  constructor(scene, x, y, w, h, label, { active = true, onClick = null } = {}) {
    this.scene = scene;
    this.rect = new Phaser.Geom.Rectangle(x, y, w, h);
    this.active = active;
    this.onClick = onClick;
    this.hover = false;
    this.lift = 0;
    this.shadow = scene.add.rectangle(x + 2, y + 2, w, h, 0x000000, 90 / 255).setOrigin(0);
    this.face = scene.add.rectangle(x, y, w, h, 0x6464c8).setOrigin(0);
    this.textShadow = scene.add.bitmapText(x + w / 2 + 1, y + h / 2 + 1, "gold12", label).setOrigin(0.5).setTint(0x191919);
    this.text = scene.add.bitmapText(x + w / 2, y + h / 2, "gold12", label).setOrigin(0.5);
  }

  contains(px, py) {
    return Phaser.Geom.Rectangle.Contains(this.rect, px, py);
  }

  update(dt, pointer, isTouch) {
    this.hover = this.active && !isTouch && this.contains(pointer.x, pointer.y);
    const target = this.hover ? 2 : 0;
    this.lift += (target - this.lift) * Math.min(1, dt * 12);
    const grow = (pointer.isDown && this.hover) ? 0 : Math.round(this.lift) * 2;
    const r = this.rect;
    const color = !this.active ? 0x505050 : this.hover ? 0xc8c832 : 0x6464c8;
    this.face.setPosition(r.x - grow / 2, r.y - grow / 2).setSize(r.width + grow, r.height + grow).setFillStyle(color);
    this.shadow.setPosition(r.x - grow / 2 + 2, r.y - grow / 2 + 2).setSize(r.width + grow, r.height + grow);
  }
}
