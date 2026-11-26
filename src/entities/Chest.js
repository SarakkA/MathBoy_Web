import { CHEST_FRAME_TIME } from "../config/settings.js";

// keyboard_letters.png: griglia 8 colonne di tasti 16x16
const KEY_E_UP = 2 * 8 + 4;   // (64, 32)
const KEY_E_DOWN = 9 * 8 + 4; // (64, 144)
const FRAMES = 4;

/** Baule (ui/tesoro.py Treasure): si apre con E stando nell'area, sblocca un'arma.
 *  area = rettangolo Tiled "dialog_and_chest_rect"; lo sprite sta a area + (32, 16). */
export default class Chest {
  constructor(scene, area, config) {
    this.scene = scene;
    this.config = config;
    this.area = new Phaser.Geom.Rectangle(area.x, area.y, area.width, area.height);
    const x = area.x + 32;
    const y = area.y + 16;
    this.sprite = scene.add.sprite(x, y, "chest", 0).setOrigin(0).setDepth(y + 16);

    this.opened = false;
    this.animating = false;
    this.justOpened = false;  // l'apertura e' finita in questo frame
    this.read = false;        // dialogo gia' letto: le volte dopo compare subito intero
    this.frame = 0;
    this.frameTimer = 0;

    // tasto E lampeggiante sopra il baule (KeyboardButton_interaction_intermittente)
    this.prompt = scene.add.sprite(area.x + 33, area.y + 10, "keys", KEY_E_UP).setDepth(y + 100);
    this.promptTimer = 0;

    // aura dorata alla base finche' e' chiuso
    this.aura = scene.add.particles(0, 0, "px", {
      emitZone: { type: "random", source: new Phaser.Geom.Ellipse(x + 8, y + 14, 30, 8) },
      speedY: { min: -24, max: -14 }, speedX: 0, lifespan: { min: 500, max: 900 },
      scale: { start: 1, end: 0.5 }, alpha: { start: 0.67, end: 0 }, tint: 0xffe65a,
      frequency: 66,
    }).setDepth(y + 15);
  }

  get center() {
    return { x: this.area.centerX, y: this.area.centerY };
  }

  hidePrompt() {
    if (this.prompt) {
      this.prompt.destroy();
      this.prompt = null;
    }
  }

  startOpening() {
    if (this.opened || this.animating) return;
    this.animating = true;
    this.frame = 0;
    this.frameTimer = 0;
    this.aura.stop();
  }

  update(dt) {
    if (this.prompt) {
      this.promptTimer += dt * 2;
      if (this.promptTimer > 1) {
        this.promptTimer = 0;
        this.prompt.setFrame(this.prompt.frame.name === KEY_E_UP ? KEY_E_DOWN : KEY_E_UP);
      }
    }
    if (!this.animating) return;
    this.frameTimer += dt;
    if (this.frameTimer >= CHEST_FRAME_TIME) {
      this.frameTimer = 0;
      this.frame += 1;
      if (this.frame >= FRAMES - 1) {
        this.frame = FRAMES - 1;
        this.animating = false;
        this.opened = true;
        this.justOpened = true;
      }
      this.sprite.setFrame(this.frame);
    }
  }
}
