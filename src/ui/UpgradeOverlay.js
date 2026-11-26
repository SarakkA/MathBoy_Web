import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H, BLU, ROSSO, VIOLA, DEPTH } from "../config/settings.js";
import { shadedBall, shadowText } from "../core/utils.js";
import { t } from "../core/i18n.js";

const CARD_W = 100;
const CARD_H = 100;
const SPACING = 20;
const CONFETTI_TIME = 0.5;
const DEAL_TIME = 0.3;       // scivolata di una carta
const DEAL_STAGGER = 0.15;
const REVEAL_TIME = 0.3;     // flip
const REVEAL_STAGGER = 0.35;
const EXIT_TIME = 0.4;
const BAND_TARGET = Math.max(24, Math.floor(H * 0.18));
const CONFIRM = new Phaser.Geom.Rectangle(W / 2 - 60, H - 80, 120, 40);
const CONFETTI_COLORS = [0xff5a5a, 0xffc800, 0x5ac8ff, 0x78e678, 0xe678ff, 0xffffff];
const BAND_SYMBOLS = ["0", "1", "2", "3", "5", "7", "9", "+", "-", "×", "÷", "x", "="];

const easeOut = (k) => 1 - (1 - k) ** 3;
const rand = (a, b) => a + Math.random() * (b - a);

/** Scelta del potenziamento a ogni livello del Survivor (upgrade_overlay.py).
 *  Fasi: coriandoli -> carte coperte che scivolano -> flip una alla volta -> scelta -> uscita.
 *  cards: voci di UPGRADES (config/survivor.js); onDone(card) quando l'animazione d'uscita finisce. */
export default class UpgradeOverlay {
  constructor(scene, cards, level, onDone) {
    this.scene = scene;
    this.cards = cards;
    this.onDone = onDone;
    this.selected = -1;
    this.phase = "confetti";
    this.phaseT = 0;
    this.totalT = 0;
    this.bandH = 0;
    this.objects = [];
    const fixed = (o, dz = 0) => { o.setScrollFactor(0, 0, true).setDepth(DEPTH.overlay + dz); this.objects.push(o); return o; };
    this.fixed = fixed;

    // letterbox: bande scure sopra e sotto con scie e simboli che scorrono
    this.bandGfx = fixed(scene.add.graphics());
    this.bandParticles = [];
    for (const band of [0, 1]) {
      for (let i = 0; i < 25; i++) {
        this.bandParticles.push({ band, x: rand(0, W), frac: rand(0.15, 0.85), speed: rand(30, 90),
          len: Phaser.Math.Between(4, 10), alpha: Phaser.Math.Between(50, 130) / 255 });
      }
    }
    this.bandSymbols = [];
    for (const band of [0, 1]) {
      for (let i = 0; i < 8; i++) {
        const txt = fixed(scene.add.bitmapText(0, 0, "gold12", Phaser.Utils.Array.GetRandom(BAND_SYMBOLS))
          .setOrigin(0.5).setTint(0xffdc82), 0.1);
        this.bandSymbols.push({ band, txt, x: rand(0, W), frac: rand(0.2, 0.8), speed: rand(15, 45),
          angle: rand(0, 360), spin: (Math.random() < 0.5 ? -1 : 1) * rand(8, 25), alpha: Phaser.Math.Between(60, 140) / 255 });
      }
    }

    // coriandoli da due "cannoni" negli angoli in basso
    this.confettiGfx = fixed(scene.add.graphics(), 0.2);
    this.confetti = [];
    for (const side of [0, 1]) {
      for (let i = 0; i < 40; i++) {
        this.confetti.push({
          x: side === 0 ? 10 : W - 10, y: H, vx: (side === 0 ? 1 : -1) * rand(20, 90), vy: rand(-260, -140),
          color: Phaser.Utils.Array.GetRandom(CONFETTI_COLORS), size: Phaser.Math.Between(2, 3),
          spin: rand(3, 8), phase: rand(0, Math.PI * 2), life: rand(1.3, 2.4),
        });
      }
    }

    // scritta del livello in cui si entra
    this.banner = fixed(scene.add.bitmapText(W / 2, 40, "gold24", t("upgrade.level_banner", { n: level + 1 }))
      .setOrigin(0.5).setTint(0xffc800), 0.3);
    this.chooseText = shadowText(scene, W / 2, (H - CARD_H) / 2 - 16, "gold12", t("upgrade.choose"))
      .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.overlay + 0.3).setAlpha(0);
    this.objects.push(this.chooseText);

    // carte: fronte e dorso, centrati sul proprio slot (cosi' il flip scala attorno al centro)
    const startX = (W - (cards.length * CARD_W + (cards.length - 1) * SPACING)) / 2;
    const y = (H - CARD_H) / 2;
    this.slots = cards.map((card, i) => {
      const cx = startX + i * (CARD_W + SPACING) + CARD_W / 2;
      const cy = y + CARD_H / 2;
      const front = fixed(this.makeFront(card), 0.4).setPosition(cx, cy).setVisible(false);
      const back = fixed(this.makeBack(), 0.4).setPosition(cx, H + CARD_H).setVisible(false);
      const rect = new Phaser.Geom.Rectangle(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H);
      return { card, front, back, cx, cy, rect, lift: 0, tag: front.getByName("tag") };
    });
    this.selGfx = fixed(scene.add.graphics(), 0.5);

    // bottone conferma
    this.confirmGfx = fixed(scene.add.graphics(), 0.4).setVisible(false);
    this.confirmText = fixed(scene.add.bitmapText(CONFIRM.centerX, CONFIRM.centerY, "gold12", t("upgrade.confirm"))
      .setOrigin(0.5).setTint(0x000000), 0.45).setVisible(false);

    this.onPointer = (p) => this.pointerDown(p);
    scene.input.on("pointerdown", this.onPointer);
  }

  makeFront(card) {
    const s = this.scene;
    const c = s.add.container(0, 0);
    const border = card.recommended ? 0xffc800 : 0xffffff;
    c.add(s.add.rectangle(0, 0, CARD_W, CARD_H, 0x282828).setStrokeStyle(2, border));
    if (card.recommended) {
      c.add(s.add.bitmapText(0, -CARD_H / 2 + 9, "gold12", t("upgrade.recommended")).setOrigin(0.5).setTint(0xffc800).setName("tag"));
    }
    const label = card.labelKey ? t(card.labelKey) : card.label;
    const lines = label.split("\n").map((l) => l.trim());
    // 4 px piu' in basso del desktop: su due righe toccherebbe la scritta "Consigliata"
    c.add(s.add.bitmapText(0, -21, "gold12", lines.join("\n"), 12, 1).setOrigin(0.5));
    c.add(this.makeIcon(card.icon).setPosition(0, 20));
    return c;
  }

  makeIcon(icon) {
    const s = this.scene;
    if (icon.kind === "sprite") return s.add.image(0, 0, "upgrade_icons", icon.frame);
    if (icon.kind === "heart") return s.add.image(0, 0, "heart");
    const c = s.add.container(0, 0);
    if (icon.kind === "op") {
      const color = icon.op === "×" ? BLU : ROSSO;
      c.add(s.add.image(0, 0, shadedBall(s, icon.op === "×" ? "ball_icon_mul" : "ball_icon_div", 12, color)));
      c.add(s.add.bitmapText(1, -1, "gold24", icon.op).setOrigin(0.5));
    } else {
      c.add(s.add.image(0, 0, shadedBall(s, "ball_icon_ammo", 10, 0xffffff)));
      c.add(s.add.circle(0, 0, 9).setStrokeStyle(2, VIOLA));
      c.add(s.add.bitmapText(0, 0, "gold12", String(icon.value)).setOrigin(0.5).setTint(0x000000));
    }
    return c;
  }

  makeBack() {
    const s = this.scene;
    const c = s.add.container(0, 0);
    c.add(s.add.rectangle(0, 0, CARD_W, CARD_H, 0x1e1e37).setStrokeStyle(2, 0xd2d2e6));
    const dots = s.add.graphics().fillStyle(0x3c3c64, 1);
    for (let yy = 10; yy < CARD_H; yy += 20) {
      for (let xx = 10; xx < CARD_W; xx += 20) dots.fillCircle(xx - CARD_W / 2, yy - CARD_H / 2, 2);
    }
    c.add(dots);
    c.add(s.add.bitmapText(0, 0, "gold24", "?").setOrigin(0.5).setTint(0xd2d2e6));
    return c;
  }

  setPhase(phase) {
    this.phase = phase;
    this.phaseT = 0;
  }

  pointerDown(p) {
    if (this.phase !== "choose") return;
    const i = this.slots.findIndex((sl) => sl.rect.contains(p.x, p.y));
    if (i >= 0) {
      this.selected = i;
      this.scene.sound.play("blip_sfx", { volume: 0.25 });
      return;
    }
    if (this.selected >= 0 && CONFIRM.contains(p.x, p.y)) this.setPhase("exit");
  }

  update(dt, pointer) {
    this.totalT += dt;
    this.phaseT += dt;
    const n = this.slots.length;

    // bande: entrano all'apertura, si ritirano nell'uscita
    const target = this.phase === "exit" ? 0 : BAND_TARGET;
    this.bandH += (target - this.bandH) * Math.min(1, 8 * dt);
    this.drawBands(dt);
    this.drawConfetti(dt);

    if (this.phase === "confetti" && this.phaseT >= CONFETTI_TIME) this.setPhase("deal");
    else if (this.phase === "deal" && this.phaseT >= DEAL_TIME + DEAL_STAGGER * Math.max(0, n - 1)) this.setPhase("reveal");
    else if (this.phase === "reveal" && this.phaseT >= REVEAL_TIME + REVEAL_STAGGER * Math.max(0, n - 1)) this.setPhase("choose");
    else if (this.phase === "exit" && this.phaseT >= EXIT_TIME) {
      this.close();
      return;
    }

    this.banner.setVisible(["confetti", "deal", "reveal"].includes(this.phase));
    this.chooseText.setAlpha(this.phase === "choose" ? 1 : 0);
    this.selGfx.clear();
    this.slots.forEach((sl, i) => this.drawCard(sl, i, dt));
    this.drawConfirm(pointer);
  }

  drawCard(sl, i, dt) {
    const { front, back } = sl;
    front.setVisible(false).setScale(1).setAlpha(1);
    back.setVisible(false).setScale(1);
    if (sl.tag) sl.tag.setAlpha((130 + 125 * (Math.sin(this.totalT * 2.5) + 1) / 2) / 255);
    if (this.phase === "confetti") return;

    if (this.phase === "deal") {
      const k = (this.phaseT - i * DEAL_STAGGER) / DEAL_TIME;
      if (k <= 0) return;
      const y = H + CARD_H / 2 + (sl.cy - H - CARD_H / 2) * easeOut(Math.min(1, k));
      back.setVisible(true).setPosition(sl.cx, y);
      return;
    }
    if (this.phase === "reveal") {
      const k = (this.phaseT - i * REVEAL_STAGGER) / REVEAL_TIME;
      back.setPosition(sl.cx, sl.cy);
      if (k <= 0) back.setVisible(true);
      else if (k >= 1) front.setVisible(true).setPosition(sl.cx, sl.cy);
      else if (k < 0.5) back.setVisible(true).setScale(Math.max(0.01, 1 - k * 2), 1);   // il dorso si stringe...
      else front.setVisible(true).setPosition(sl.cx, sl.cy).setScale(Math.max(0.01, k * 2 - 1), 1); // ...il fronte si allarga
      return;
    }

    // choose / exit: la carta selezionata si solleva, le altre tornano giu'
    const selected = i === this.selected;
    sl.lift += ((selected ? -14 : 0) - sl.lift) * Math.min(1, 12 * dt);
    let y = sl.cy + sl.lift;
    if (this.phase === "exit") {
      const k = this.phaseT / EXIT_TIME;
      y += selected ? -30 * k : 120 * k * k; // la scelta vola in alto, le altre cadono
      front.setAlpha(1 - k);
    }
    front.setVisible(true).setPosition(sl.cx, y);
    if (selected && this.phase === "choose") {
      this.selGfx.lineStyle(3, 0xffc800, 1).strokeRect(sl.cx - CARD_W / 2 + 1, y - CARD_H / 2 + 1, CARD_W - 2, CARD_H - 2);
    }
  }

  drawConfirm(pointer) {
    const show = this.phase === "choose";
    this.confirmGfx.setVisible(show).clear();
    this.confirmText.setVisible(show);
    if (!show) return;
    const g = this.confirmGfx;
    const r = CONFIRM;
    if (this.selected >= 0) {
      const hover = r.contains(pointer.x, pointer.y);
      g.fillStyle(hover ? 0xfff096 : 0xebd75a, 1).fillRect(r.x, r.y, r.width, r.height);
      const pulse = (Math.sin(this.totalT * 1000 / 150) + 1) / 2;
      const grow = 2 + Math.floor(4 * pulse);
      g.lineStyle(2, 0xffc800, 1).strokeRect(r.x - grow / 2, r.y - grow / 2, r.width + grow, r.height + grow);
    } else {
      g.fillStyle(0xc8c8c8, 1).fillRect(r.x, r.y, r.width, r.height);
    }
  }

  drawBands(dt) {
    const g = this.bandGfx.clear();
    const bh = Math.floor(this.bandH);
    for (const p of this.bandParticles) {
      p.x += p.speed * dt;
      if (p.x > W + p.len) p.x = -p.len;
    }
    for (const s of this.bandSymbols) {
      s.x += s.speed * dt;
      s.angle = (s.angle + s.spin * dt) % 360;
      if (s.x > W + 12) s.x = -12;
      const top = s.band === 0 ? 0 : H - bh;
      s.txt.setVisible(bh > 1).setPosition(s.x, top + s.frac * bh).setAngle(-s.angle).setAlpha(s.alpha);
    }
    if (bh <= 1) return;
    for (const band of [0, 1]) {
      const top = band === 0 ? 0 : H - bh;
      g.fillStyle(0x0a0a16, 185 / 255).fillRect(0, top, W, bh);
      for (const p of this.bandParticles) {
        if (p.band !== band) continue;
        g.fillStyle(0xffdc82, p.alpha).fillRect(Math.round(p.x), Math.round(top + p.frac * bh), p.len, 1);
      }
      const edge = band === 0 ? bh - 1 : top;
      g.fillStyle(0xffc800, 120 / 255).fillRect(0, edge, W, 1);
    }
  }

  drawConfetti(dt) {
    const g = this.confettiGfx.clear();
    for (const p of this.confetti) {
      p.vy += 260 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.confetti = this.confetti.filter((p) => p.life > 0 && p.y < H + 10);
    for (const p of this.confetti) {
      // larghezza oscillante: il coriandolo ruota
      const w = Math.max(1, Math.floor(p.size * Math.abs(Math.sin(this.totalT * p.spin + p.phase)) + 0.5));
      g.fillStyle(p.color, 1).fillRect(Math.floor(p.x), Math.floor(p.y), w, p.size);
    }
  }

  close() {
    this.scene.input.off("pointerdown", this.onPointer);
    this.objects.forEach((o) => o.destroy());
    this.onDone(this.slots[this.selected]?.card ?? null);
  }
}
