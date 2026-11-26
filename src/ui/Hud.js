import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H, BLU, ROSSO, VIOLA, DEPTH } from "../config/settings.js";
import { shadedBall, shadowText } from "../core/utils.js";
import { t } from "../core/i18n.js";

const CHAPTER_FADE_IN = 0.8;
const CHAPTER_HOLD = 2.5;
const CHAPTER_FADE_OUT = 1.0;
const BUTTON_UP = 4;   // offset dei bottoni +/- da rilasciati (level_base.py button_offset)
const CHARGE_RADIUS = 14; // charge_circle.py, attorno ai bottoni +/-

/** HUD a schermo fisso (hud.py + cuori + titolo del capitolo + contatore FPS + cursore).
 *  Legge tutto dalla run, cosi' resta allineato quando un baule sblocca qualcosa. */
export default class Hud {
  constructor(scene, run, { titleKey = null, playerName = "" } = {}) {
    this.scene = scene;
    this.run = run;
    const fixed = (o) => o.setScrollFactor(0).setDepth(DEPTH.hud);
    this.fixed = fixed;

    // nome del giocatore (hud.py: topleft 12, 12)
    if (playerName) shadowText(scene, 12, 12, "gold12", playerName).setScrollFactor(0).setDepth(DEPTH.hud);

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

    // bottoni + e - in basso a destra: visibili solo se sbloccati, si abbassano col tasto premuto.
    // In modalita' touch diventano piu' grandi e distanziati, da premere col pollice.
    this.buttonOffset = [BUTTON_UP, BUTTON_UP];
    this.touchMode = false;
    this.buttons = [
      { desk: { x: W - 84, y: H - 44 }, touch: { x: W - 112, y: H - 46 }, color: BLU, key: "ball_btn_add", sym: "+", full: "×" },
      { desk: { x: W - 44, y: H - 44 }, touch: { x: W - 50, y: H - 46 }, color: ROSSO, key: "ball_btn_sub", sym: "-", full: "÷" },
    ].map((b) => ({
      ...b,
      x: b.desk.x,
      baseY: b.desk.y,
      bg: fixed(scene.add.circle(b.desk.x, b.desk.y, 12, 0x282828, 0.55)),
      ball: fixed(scene.add.image(b.desk.x, b.desk.y, shadedBall(scene, b.key, 12, b.color))),
      label: fixed(scene.add.bitmapText(b.desk.x + 1, b.desk.y - 2, "gold32", b.sym).setOrigin(0.5)),
    }));

    // carica di × e ÷: arco che si riempie, poi anello che pulsa (charge_circle.py)
    this.charge = [0, 0];
    this.pulse = 0;
    this.chargeGfx = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud + 1);

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

  /** bottoni grandi per il pollice e niente cursore (input.js decide la modalita') */
  setTouchMode(on) {
    this.touchMode = on;
    const scale = on ? 22 / 12 : 1;
    for (const b of this.buttons) {
      const pos = on ? b.touch : b.desk;
      b.x = pos.x;
      b.baseY = pos.y;
      b.bg.setPosition(pos.x, pos.y).setScale(scale);
      b.ball.setX(pos.x).setScale(scale);
      b.label.setX(pos.x + 1).setScale(on ? 1.6 : 1);
    }
    if (on) this.cursor.clear();
  }

  /** centri dei bottoni +/- (per le aree di tocco) */
  buttonPositions() {
    return this.buttons.map((b) => ({ x: b.x, y: b.baseY }));
  }

  /** centri delle palline del selettore valori (per le aree di tocco) */
  selectorPositions() {
    return this.selector.map((s) => ({ x: s.ball.x, y: s.ball.y }));
  }

  /** i: 0 = bottone +/×, 1 = bottone -/÷; ratio da 0 a 1 (0 = non in carica) */
  setCharge(i, ratio) {
    this.charge[i] = ratio;
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
    const scale = this.touchMode ? 22 / 12 : 1;
    this.chargeGfx.clear();
    this.pulse += dt * 30;
    this.buttons.forEach((b, i) => {
      b.ball.setVisible(allowed[i]).setY(b.baseY - this.buttonOffset[i]);
      const full = this.charge[i] >= 1;
      // a carica piena + diventa × (font 24 come big_fontx di hud.py) e - diventa ÷
      b.label.setFont(full && b.full === "×" ? "gold24" : "gold32").setText(full ? b.full : b.sym)
        .setVisible(allowed[i]).setY(b.baseY - 2 - this.buttonOffset[i]);
      const ratio = this.charge[i];
      if (ratio <= 0 || !allowed[i]) return;
      const r = CHARGE_RADIUS * scale;
      if (!full) {
        const start = -Math.PI / 2;
        this.chargeGfx.lineStyle(2, 0xffffff, 1).beginPath()
          .arc(b.x, b.baseY - 1, r, start, start + ratio * Math.PI * 2).strokePath();
      } else {
        const p = (Math.sin(this.pulse) + 1) / 2;
        const thick = Math.floor(p * 3) + 2;
        this.chargeGfx.lineStyle(thick, 0xffffff, 1).strokeCircle(b.x, b.baseY, r - 1 + thick / 2);
      }
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

    // cursore (solo con il mouse)
    if (this.clickT > 0) this.clickT = Math.max(0, this.clickT - dt);
    if (this.touchMode) return;
    const pop = this.clickT / 0.12;
    const g = 8 - 4 * Math.max(this.charge[0], this.charge[1]) + 4 * pop; // si stringe in carica
    const tick = 4;
    const px = Math.round(pointer.x);
    const py = Math.round(pointer.y);
    this.cursor.clear().lineStyle(1, 0xf0f0f0, 1);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      this.cursor.lineBetween(px + dx * g, py + dy * g, px + dx * (g + tick), py + dy * (g + tick));
    }
  }
}
