import { LOGICAL_WIDTH as W, DEPTH, TEXT_SPEED } from "../config/settings.js";
import { t } from "../core/i18n.js";

const HEIGHT = 50;
const LINE_STEP = 20;
// mouse_input.png: griglia 13 colonne di icone 16x16
const MOUSE_FRAMES = { left: [0, 3], right: [0, 7], wheel: [0, 11] };
const MOUSE_BLINK_MS = 300;

/** Riquadro di dialogo in alto con scrittura a macchina (ui/interactable.py draw_dialog). */
export default class DialogBox {
  constructor(scene) {
    this.scene = scene;
    const fixed = (o) => o.setScrollFactor(0).setDepth(DEPTH.dialog);
    this.box = fixed(scene.add.rectangle(20, 20, W - 40, HEIGHT, 0x282828).setOrigin(0).setStrokeStyle(3, 0xfafafa));
    this.lines = [];
    this.hint = fixed(scene.add.bitmapText(0, HEIGHT - 3, "gold12", "").setTint(0xc8c8ff));
    this.mouse = fixed(scene.add.sprite(30, 40, "mouse", 0).setOrigin(0));
    this.active = false;
    this.text = "";
    this.shown = 0;
    this.charTimer = 0;
    this.mouseKind = null;
    this.setVisible(false);
  }

  get finished() {
    return this.shown >= this.text.length;
  }

  /** instant: dialogo gia' letto, compare subito intero */
  open(text, mouseKind = null, instant = false) {
    this.active = true;
    this.text = text;
    this.shown = instant ? text.length : 0;
    this.charTimer = 0;
    this.mouseKind = mouseKind;
    this.box.setVisible(true);
    this.render();
  }

  close() {
    this.active = false;
    this.setVisible(false);
  }

  setVisible(v) {
    this.box.setVisible(v);
    this.lines.forEach((l) => l.setVisible(v));
    this.hint.setVisible(v);
    this.mouse.setVisible(v);
  }

  update(dt) {
    if (!this.active) return;
    if (!this.finished) {
      // al massimo un carattere per frame, come il desktop
      this.charTimer += dt;
      if (this.charTimer >= TEXT_SPEED) {
        this.charTimer = 0;
        this.shown += 1;
        this.scene.sound.play("text_sfx", { volume: 0.25 });
        this.render();
      }
    }
    if (this.finished && this.mouseKind) {
      const frames = MOUSE_FRAMES[this.mouseKind];
      this.mouse.setFrame(frames[Math.floor(this.scene.time.now / MOUSE_BLINK_MS) % frames.length]);
    }
  }

  render() {
    const rows = this.text.slice(0, this.shown).split("\n");
    while (this.lines.length < rows.length) {
      this.lines.push(this.scene.add.bitmapText(60, 30 + this.lines.length * LINE_STEP, "gold12", "")
        .setScrollFactor(0).setDepth(DEPTH.dialog));
    }
    this.lines.forEach((l, i) => l.setText(rows[i] ?? "").setVisible(true));

    const done = this.finished;
    this.hint.setText(done ? t("hud.press_e") : "").setVisible(done);
    this.hint.x = W - 40 - this.hint.width;
    this.mouse.setVisible(done && !!this.mouseKind);
  }
}
