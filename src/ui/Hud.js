import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H, BLU, ROSSO, VIOLA, DEPTH } from "../config/settings.js";
import { shadedBall, shadowText } from "../core/utils.js";
import { t } from "../core/i18n.js";

const CHAPTER_FADE_IN = 0.8;
const CHAPTER_HOLD = 2.5;
const CHAPTER_FADE_OUT = 1.0;
const BUTTON_UP = 4;   // offset dei bottoni +/- da rilasciati (level_base.py button_offset)

/** HUD a schermo fisso (hud.py + cuori + titolo del capitolo + contatore FPS + cursore).
 *  Legge tutto dalla run, cosi' resta allineato quando un baule sblocca qualcosa. */
export default class Hud {
  constructor(scene, run, { titleKey = null } = {}) {
    this.scene = scene;
    this.run = run;
    const fixed = (o) => o.setScrollFactor(0).setDepth(DEPTH.hud);
    this.fixed = fixed;

    // cuori in alto a sinistra (level_Z.py: pos = (10 + i*20, 25))
    this.hearts = [];
    for (let i = 0; i < run.lives; i++) {
      this.hearts.push(fixed(scene.add.image(10 + i * 20, 25, "heart").setOrigin(0)));
    }

    // monete
    fixed(scene.add.image(11, 50, "coin", 0).setOrigin(0, 0.5));
    this.score = shadowText(scene, 28, 50, "gold12", ": 0").setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH.hud);

    // selettore valori (colonna a destra), ricostruito se cambiano i valori
    this.selector = [];
    this.selectorValues = "";

    // bottoni + e - in basso a destra: visibili solo se sbloccati, si abbassano col tasto premuto
    this.buttonOffset = [BUTTON_UP, BUTTON_UP];
    const by = H - 24 - 20;
    this.buttons = [
      { x: W - 84, color: BLU, key: "ball_btn_add", sym: "+" },
      { x: W - 44, color: ROSSO, key: "ball_btn_sub", sym: "-" },
    ].map((b) => ({
      bg: fixed(scene.add.circle(b.x, by, 12, 0x282828, 0.55)),
      ball: fixed(scene.add.image(b.x, by, shadedBall(scene, b.key, 12, b.color))),
      label: fixed(scene.add.bitmapText(b.x + 1, by - 2, "gold32", b.sym).setOrigin(0.5)),
      baseY: by,
    }));

    // FPS + renderer: serve a misurare il lag (F3 per nascondere)
    this.renderer = scene.game.renderer.type === Phaser.WEBGL ? "WebGL" : "Canvas";
    this.fps = fixed(scene.add.bitmapText(4, H - 4, "gold12", "").setOrigin(0, 1));
    this.fps.setVisible(scene.registry.get("showFps") !== false);
    this.fpsTimer = 0;

    // titolo del capitolo in alto al centro (solo entrando nel mondo)
    this.chapter = null;
    if (titleKey) {
      this.chapter = shadowText(scene, W / 2, 26, "gold24", t(titleKey))
        .setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud).setAlpha(0);
    }
    this.chapterTimer = 0;

    // cursore: 4 tacche di mirino (ui/cursor.py)
    this.cursor = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.cursor);
    this.clickT = 0;
  }

  notifyClick(button) {
    this.clickT = 0.12;
    if (button === 0) this.buttonOffset[0] = 0;
    if (button === 2) this.buttonOffset[1] = 0;
  }

  notifyRelease(button) {
    if (button === 0) this.buttonOffset[0] = BUTTON_UP;
    if (button === 2) this.buttonOffset[1] = BUTTON_UP;
  }

  toggleFps() {
    this.fps.setVisible(!this.fps.visible);
    this.scene.registry.set("showFps", this.fps.visible);
  }

  blinkHeart(index) {
    const heart = this.hearts[index];
    if (!heart) return;
    this.scene.tweens.add({
      targets: heart, alpha: 0, duration: 200, yoyo: true, repeat: 9,
      onComplete: () => heart.destroy(),
    });
  }

  buildSelector() {
    this.selector.forEach((s) => { s.ring.destroy(); s.ball.destroy(); s.label.destroy(); });
    const values = this.run.values;
    const startY = H / 2 - ((values.length - 1) * 30) / 2;
    this.selector = values.map((v, i) => {
      const cx = W - 30;
      const cy = startY + i * 30;
      return {
        ring: this.fixed(this.scene.add.circle(cx, cy, 12).setStrokeStyle(3, VIOLA)),
        ball: this.fixed(this.scene.add.image(cx, cy, shadedBall(this.scene, "ball_sel", 11, 0xebebeb))),
        label: this.fixed(this.scene.add.bitmapText(cx, cy, "gold12", String(v)).setOrigin(0.5)),
      };
    });
    this.selectorValues = values.join(",");
  }

  update(dt, pointer) {
    const run = this.run;
    this.score.setText(`: ${run.score}`);

    if (run.values.join(",") !== this.selectorValues) this.buildSelector();
    this.selector.forEach((s, i) => {
      const selected = i === run.valueIndex;
      s.ring.setVisible(selected);
      s.ball.setScale(selected ? 1 : 0.75).setAlpha(selected ? 1 : 0.6);
      s.label.setTint(selected ? 0x000000 : 0x464646);
    });

    const allowed = [run.canAdd, run.canSub];
    this.buttons.forEach((b, i) => {
      b.ball.setVisible(allowed[i]).setY(b.baseY - this.buttonOffset[i]);
      b.label.setVisible(allowed[i]).setY(b.baseY - 2 - this.buttonOffset[i]);
    });

    this.fpsTimer -= dt;
    if (this.fpsTimer <= 0) {
      this.fpsTimer = 0.25;
      this.fps.setText(`FPS ${Math.round(this.scene.game.loop.actualFps)}  ${this.renderer}`);
    }

    // titolo: dissolvenza con smoothstep (level_base.py chapter_title_alpha)
    if (this.chapter) {
      this.chapterTimer += dt;
      const ct = this.chapterTimer;
      let k;
      if (ct < CHAPTER_FADE_IN) k = ct / CHAPTER_FADE_IN;
      else if (ct < CHAPTER_FADE_IN + CHAPTER_HOLD) k = 1;
      else k = 1 - (ct - CHAPTER_FADE_IN - CHAPTER_HOLD) / CHAPTER_FADE_OUT;
      k = Phaser.Math.Clamp(k, 0, 1);
      this.chapter.setAlpha(k * k * (3 - 2 * k));
    }

    // cursore
    if (this.clickT > 0) this.clickT = Math.max(0, this.clickT - dt);
    const pop = this.clickT / 0.12;
    const g = 8 + 4 * pop;
    const tick = 4;
    const px = Math.round(pointer.x);
    const py = Math.round(pointer.y);
    this.cursor.clear().lineStyle(1, 0xf0f0f0, 1);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      this.cursor.lineBetween(px + dx * g, py + dy * g, px + dx * (g + tick), py + dy * (g + tick));
    }
  }
}
