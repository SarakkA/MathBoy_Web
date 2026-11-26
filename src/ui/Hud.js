import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H, BLU, ROSSO, VIOLA } from "../settings.js";
import { shadedBall, shadowText } from "../utils.js";

const DEPTH = 1000;
const CHAPTER_FADE_IN = 0.8;
const CHAPTER_HOLD = 2.5;
const CHAPTER_FADE_OUT = 1.0;

/** HUD a schermo fisso (hud.py + cuori + titolo del capitolo + contatore FPS). */
export default class Hud {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    const fixed = (o) => o.setScrollFactor(0).setDepth(DEPTH);

    // cuori in alto a sinistra (level_Z.py: pos = (10 + i*20, 25))
    this.hearts = [];
    for (let i = 0; i < player.lives; i++) {
      this.hearts.push(fixed(scene.add.image(10 + i * 20, 25, "heart").setOrigin(0)));
    }

    // monete
    fixed(scene.add.image(11, 50, "coin", 0).setOrigin(0, 0.5));
    this.score = shadowText(scene, 28, 50, "gold12", ": 0").setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH);

    // selettore valori (colonna a destra)
    this.selector = [];
    const startY = H / 2 - ((player.values.length - 1) * 30) / 2;
    player.values.forEach((v, i) => {
      const cx = W - 30;
      const cy = startY + i * 30;
      const ring = fixed(scene.add.circle(cx, cy, 12).setStrokeStyle(3, VIOLA));
      const ball = fixed(scene.add.image(cx, cy, shadedBall(scene, "ball_sel", 11, 0xebebeb)));
      const label = fixed(scene.add.bitmapText(cx, cy, "gold12", String(v)).setOrigin(0.5).setTint(0x000000));
      this.selector.push({ ring, ball, label });
    });

    // bottoni + e - in basso a destra; si abbassano quando il tasto e' premuto
    this.buttonOffset = [4, 4];
    const by = H - 24 - 20;
    this.buttons = [
      { x: W - 84, color: BLU, key: "ball_btn_add", sym: "+" },
      { x: W - 44, color: ROSSO, key: "ball_btn_sub", sym: "-" },
    ].map((b) => {
      fixed(scene.add.circle(b.x, by, 12, 0x282828, 0.55));
      const ball = fixed(scene.add.image(b.x, by, shadedBall(scene, b.key, 12, b.color)));
      const label = fixed(scene.add.bitmapText(b.x + 1, by - 2, "gold32", b.sym).setOrigin(0.5));
      return { ball, label, baseY: by };
    });

    // FPS + renderer: serve a misurare il lag dal lab (F3 per nascondere)
    const renderer = scene.game.renderer.type === Phaser.WEBGL ? "WebGL" : "Canvas";
    this.renderer = renderer;
    this.fps = fixed(scene.add.bitmapText(4, H - 4, "gold12", "").setOrigin(0, 1));
    this.fpsTimer = 0;

    // titolo del capitolo in alto al centro
    this.chapter = shadowText(scene, W / 2, 26, "gold24", "Mondo Z: I Numeri Interi")
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH).setAlpha(0);
    this.chapterTimer = 0;

    // cursore: 4 tacche di mirino (ui/cursor.py)
    this.cursor = scene.add.graphics().setScrollFactor(0).setDepth(2000);
    this.clickT = 0;
  }

  notifyClick(button) {
    this.clickT = 0.12;
    if (button === 0) this.buttonOffset[0] = 0;
    if (button === 2) this.buttonOffset[1] = 0;
  }

  notifyRelease(button) {
    if (button === 0) this.buttonOffset[0] = 4;
    if (button === 2) this.buttonOffset[1] = 4;
  }

  toggleFps() {
    this.fps.setVisible(!this.fps.visible);
  }

  blinkHeart(index) {
    const heart = this.hearts[index];
    if (!heart) return;
    this.scene.tweens.add({
      targets: heart, alpha: 0, duration: 200, yoyo: true, repeat: 9,
      onComplete: () => heart.destroy(),
    });
  }

  update(dt, pointer) {
    this.score.setText(`: ${this.player.score}`);

    this.selector.forEach((s, i) => {
      const selected = i === this.player.valueIndex;
      s.ring.setVisible(selected);
      s.ball.setScale(selected ? 1 : 0.75).setAlpha(selected ? 1 : 0.6);
      s.label.setTint(selected ? 0x000000 : 0x464646);
    });

    this.buttons.forEach((b, i) => {
      b.ball.y = b.baseY - this.buttonOffset[i];
      b.label.y = b.baseY - 2 - this.buttonOffset[i];
    });

    this.fpsTimer -= dt;
    if (this.fpsTimer <= 0) {
      this.fpsTimer = 0.25;
      this.fps.setText(`FPS ${Math.round(this.scene.game.loop.actualFps)}  ${this.renderer}`);
    }

    // titolo: dissolvenza con smoothstep (level_base.py chapter_title_alpha)
    this.chapterTimer += dt;
    const t = this.chapterTimer;
    let k;
    if (t < CHAPTER_FADE_IN) k = t / CHAPTER_FADE_IN;
    else if (t < CHAPTER_FADE_IN + CHAPTER_HOLD) k = 1;
    else k = 1 - (t - CHAPTER_FADE_IN - CHAPTER_HOLD) / CHAPTER_FADE_OUT;
    k = Phaser.Math.Clamp(k, 0, 1);
    this.chapter.setAlpha(k * k * (3 - 2 * k));

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
