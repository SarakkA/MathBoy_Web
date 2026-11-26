import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H, BLU, ROSSO } from "../config/settings.js";
import { t } from "../core/i18n.js";
import { shadedBall, shadowText } from "../core/utils.js";
import { MenuButton } from "../ui/menuBackground.js";

const TITLE_FADE = 0.4;
const LINE_DELAY = 0.12;
const LINE_FADE = 0.3;

/** Riconoscimenti (credits_state.py): righe che compaiono una alla volta
 *  su uno sfondo con oggetti del gioco che fluttuano piano (utils/floaters.py). */
export default class CreditsScene extends Phaser.Scene {
  constructor() {
    super("Credits");
  }

  create() {
    this.cameras.main.setBackgroundColor("#1e1e32");
    this.cameras.main.fadeIn(400);
    this.input.setDefaultCursor("default");
    this.isTouch = this.registry.get("inputMode") === "touch";
    this.animT = 0;
    this.leaving = false;

    this.floaters = this.makeFloaters(14);

    this.title = shadowText(this, W / 2, 30, "gold12", "CREDITS").setOrigin(0.5).setAlpha(0);

    // [testo, intestazione?]
    const credits = [
      [t("credits.dev"), true],
      ["Tommaso Saracchini", false],
      [t("credits.music"), true],
      [t("credits.music_menu"), false],
      [t("credits.music_worlds"), false],
      [t("credits.graphics"), true],
      [t("credits.gfx_characters"), false],
      [t("credits.gfx_tileset"), false],
      [t("credits.thanks"), true],
      [t("credits.testers"), false],
    ];
    let y = 60;
    this.lines = credits.map(([text, header]) => {
      if (header) y += 6; // spazio prima di ogni sezione
      const obj = header
        ? this.add.bitmapText(W / 2, y, "gold12", text).setTint(0xffc800)
        : this.add.bitmapText(W / 2, y, "gold10", text);
      obj.setOrigin(0.5).setAlpha(0);
      const line = { obj, y };
      y += header ? 16 : 12;
      return line;
    });

    this.menuBtn = new MenuButton(this, W / 2 - 50, H - 45, 100, 30, "menu", { onClick: () => this.leave() });
    this.blip = this.sound.add("blip_sfx", { volume: 0.25 });
    this.input.on("pointerdown", (p) => {
      this.isTouch = p.wasTouch;
      if (this.menuBtn.contains(p.x, p.y)) this.menuBtn.onClick();
    });
    this.input.keyboard.on("keydown-ESC", () => this.leave());
  }

  /** proiettili, simboli e sprite del gioco che vagano lenti e ruotano (floaters.py) */
  makeFloaters(count) {
    const makers = [
      ...[[1, BLU], [2, ROSSO], [3, BLU], [5, ROSSO]].map(([v, color]) => () => {
        const key = shadedBall(this, color === BLU ? "ball_add" : "ball_sub", 7, color);
        return this.add.container(0, 0, [
          this.add.image(0, 0, key),
          this.add.bitmapText(0, 0, "gold12", String(v)).setOrigin(0.5),
        ]);
      }),
      ...["+", "-", "×", "÷", "x"].map((s) => () => this.add.bitmapText(0, 0, "gold12", s).setOrigin(0.5).setTint(0xb4bef0)),
      () => this.add.image(0, 0, "upgrade_icons", 2),
      () => this.add.image(0, 0, "upgrade_icons", 3),
      () => this.add.image(0, 0, "coin", 0),
      () => this.add.image(0, 0, "heart"),
    ];
    return Array.from({ length: count }, () => {
      const dir = Math.random() * Math.PI * 2;
      const speed = Phaser.Math.FloatBetween(6, 18);
      return {
        obj: Phaser.Utils.Array.GetRandom(makers)().setAlpha(Phaser.Math.Between(50, 90) / 255),
        x: Math.random() * W,
        y: Math.random() * H,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        angle: Math.random() * 360,
        spin: (Math.random() < 0.5 ? -1 : 1) * Phaser.Math.FloatBetween(10, 25),
      };
    });
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.blip.play();
    this.cameras.main.fadeOut(400);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("Menu"));
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.animT += dt;

    const m = 20;
    for (const f of this.floaters) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.angle = (f.angle + f.spin * dt) % 360;
      if (f.x < -m) f.x = W + m;
      if (f.x > W + m) f.x = -m;
      if (f.y < -m) f.y = H + m;
      if (f.y > H + m) f.y = -m;
      f.obj.setPosition(Math.round(f.x), Math.round(f.y)).setAngle(-f.angle);
    }

    this.title.setAlpha(Math.min(1, this.animT / TITLE_FADE));
    this.lines.forEach((line, i) => {
      const k = Math.min(1, Math.max(0, (this.animT - TITLE_FADE - i * LINE_DELAY) / LINE_FADE));
      line.obj.setAlpha(k).setY(Math.round(line.y + (1 - k) * 8)); // sale leggermente mentre appare
    });

    this.menuBtn.update(dt, this.input.activePointer, this.isTouch);
  }
}
