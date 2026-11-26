import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H } from "../config/settings.js";
import { ALL_MAPS } from "../config/worlds.js";
import { preloadLocales, initI18n, t } from "../core/i18n.js";
import { setFontMetrics } from "../ui/mathText.js";

/** Carica tutti gli asset una volta sola, poi passa all'intro. */
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
    const sheet = (key, file, w, h = w) =>
      this.load.spritesheet(key, `assets/sprites/${file}`, { frameWidth: w, frameHeight: h });
    sheet("player", "player_sprite_sheet.png", 48);
    for (const who of ["woman", "male"]) {
      for (const anim of ["idle", "walk", "death"]) sheet(`${who}_${anim}`, `${who}_${anim}.png`, 48, 64);
    }
    sheet("coin", "coin2.png", 16);
    sheet("door", "door.png", 16);
    sheet("chest", "chest.png", 16);
    sheet("keys", "keyboard_letters.png", 16);
    sheet("mouse", "mouse_input.png", 16);
    sheet("upgrade_icons", "upgrade_icons.png", 16); // carte e pozioni del Survivor
    this.load.image("heart", "assets/sprites/heart.png");
    this.load.image("shadow", "assets/sprites/shadow.png");
    for (const lang of ["it", "en", "es", "fr", "de"]) this.load.image(`flag_${lang}`, `assets/sprites/flag_${lang}.png`);
    for (const size of [10, 12, 16, 24, 32, 48]) {
      this.load.bitmapFont(`gold${size}`, `assets/fonts/gold${size}.png`, `assets/fonts/gold${size}.xml`);
    }
    this.load.json("font_metrics", "assets/fonts/metrics.json");
    this.load.audio("pop_sfx", "assets/sfx/pop.ogg");
    this.load.audio("coin_sfx", "assets/sfx/coin.ogg");
    this.load.audio("text_sfx", "assets/sfx/text.ogg");
    this.load.audio("blip_sfx", "assets/sfx/blip.ogg");
    preloadLocales(this);
  }

  create() {
    initI18n(this);
    setFontMetrics(this.cache.json.get("font_metrics"));
    const rotate = document.getElementById("rotate");
    if (rotate) rotate.textContent = t("web.rotate");

    // texture condivise generate a runtime
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 2, 2);
    g.generateTexture("px", 2, 2);
    g.destroy();

    this.scene.start("Intro");
  }
}
