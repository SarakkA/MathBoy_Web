import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H } from "../config/settings.js";
import { ALL_MAPS } from "../config/worlds.js";
import { preloadLocales, initI18n } from "../core/i18n.js";
import { newRun } from "../core/run.js";

/** Carica tutti gli asset una volta sola, poi avvia la partita.
 *  Quando arriveranno intro e menu, partira' da qui verso di loro. */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    // barra di caricamento (i font non sono ancora pronti: solo rettangoli)
    const bar = this.add.rectangle(W / 2 - 100, H / 2, 0, 6, 0xffffff).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2, 204, 10).setStrokeStyle(1, 0xffffff);
    this.load.on("progress", (p) => { bar.width = 200 * p; });

    for (const name of ALL_MAPS) {
      this.load.image(`map_${name}`, `assets/maps/${name}.png`);
      this.load.json(`map_${name}`, `assets/maps/${name}.json`);
    }
    const sheet = (key, file, size) =>
      this.load.spritesheet(key, `assets/sprites/${file}`, { frameWidth: size, frameHeight: size });
    sheet("player", "player_sprite_sheet.png", 48);
    sheet("coin", "coin2.png", 16);
    sheet("door", "door.png", 16);
    sheet("chest", "chest.png", 16);
    sheet("keys", "keyboard_letters.png", 16);
    sheet("mouse", "mouse_input.png", 16);
    this.load.image("heart", "assets/sprites/heart.png");
    for (const size of [12, 16, 24, 32]) {
      this.load.bitmapFont(`gold${size}`, `assets/fonts/gold${size}.png`, `assets/fonts/gold${size}.xml`);
    }
    this.load.audio("pop_sfx", "assets/sfx/pop.ogg");
    this.load.audio("coin_sfx", "assets/sfx/coin.ogg");
    this.load.audio("text_sfx", "assets/sfx/text.ogg");
    preloadLocales(this);
  }

  create() {
    initI18n(this);

    // texture condivise generate a runtime
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 2, 2);
    g.generateTexture("px", 2, 2);
    g.destroy();

    this.scene.start("Level", { run: newRun("Z") });
  }
}
