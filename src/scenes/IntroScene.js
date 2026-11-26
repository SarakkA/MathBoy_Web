import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H } from "../config/settings.js";
import { SKINS } from "../config/skins.js";
import { t } from "../core/i18n.js";
import { getProfile, setPlayer } from "../core/profile.js";
import { shadowText } from "../core/utils.js";
import MenuBackground, { MenuButton } from "../ui/menuBackground.js";

const MAX_LEN = 12;
const START_Y = H / 2;
const FEET_Y = 43;                              // piedi a 43 px dal top del frame, per tutti i fogli
const SLOT_X = [W / 2 - 50, W / 2, W / 2 + 50];
const GROUND_Y = START_Y + 40 + FEET_Y;
const PREVIEW_SPEED = 0.1;
// anteprima: riga idle verso il basso di ogni personaggio
const PREVIEWS = [
  { texture: "player", frames: 6 },
  { texture: "woman_idle", frames: 8 },
  { texture: "male_idle", frames: 8 },
];

/** Intro (intro_state.py): titolo -> nome -> personaggio -> menu.
 *  Il nome si scrive in un <input> HTML invisibile: e' l'unico modo per far comparire
 *  la tastiera sul telefono. Nome e personaggio restano salvati nel browser. */
export default class IntroScene extends Phaser.Scene {
  constructor() {
    super("Intro");
  }

  create() {
    const profile = getProfile();
    this.bg = new MenuBackground(this);
    this.bg.setTitleAlpha(0);
    this.cameras.main.fadeIn(2000);
    this.input.keyboard.clearCaptures(); // i tasti del livello non devono bloccare la digitazione
    this.blip = this.sound.add("blip_sfx", { volume: 0.25 });

    this.phase = "intro";
    this.timer = 0;
    this.name = profile.name || "";
    this.skin = profile.skin || 0;
    this.isTouch = this.registry.get("inputMode") === "touch";

    // --- intro ---
    this.press = shadowText(this, W / 2, START_Y, "gold12", "").setOrigin(0.5, 0).setAlpha(0);

    // --- nome ---
    this.nameLabel = shadowText(this, W / 2, START_Y, "gold12", t("intro.enter_name")).setOrigin(0.5, 0);
    this.nameText = shadowText(this, W / 2, START_Y + 30, "gold12", "").setOrigin(0.5, 0);
    this.caret = this.add.bitmapText(0, START_Y + 30, "gold12", "|");
    this.error = this.add.bitmapText(W / 2, START_Y + 60, "gold12", "").setOrigin(0.5).setTint(0xff0000);
    this.errorTimer = 0;
    this.domInput = document.getElementById("name-input");
    this.onDomInput = () => this.setName(this.domInput.value);
    this.onDomKey = (e) => { if (e.key === "Enter") { e.preventDefault(); this.confirm(); } };
    if (this.domInput) {
      this.domInput.addEventListener("input", this.onDomInput);
      this.domInput.addEventListener("keydown", this.onDomKey);
    }
    this.events.once("shutdown", () => {
      if (!this.domInput) return;
      this.domInput.removeEventListener("input", this.onDomInput);
      this.domInput.removeEventListener("keydown", this.onDomKey);
      this.domInput.blur();
    });

    // --- personaggio ---
    this.pickLabel = shadowText(this, W / 2, START_Y, "gold12", t("intro.pick_character")).setOrigin(0.5, 0);
    this.lift = [0, 0, 0];
    this.previewFrame = [0, 0, 0];
    this.previewTimer = 0;
    this.charTime = 0;
    this.shadows = SLOT_X.map((x) => this.add.ellipse(x, GROUND_Y, 26, 9, 0x000000, 0.24));
    this.pad = this.add.ellipse(0, GROUND_Y, 24, 8, 0xffc800, 55 / 255).setStrokeStyle(1, 0xffe65a, 150 / 255);
    this.skinShadow = SLOT_X.map((x, i) => (SKINS[i].shadow ? this.add.image(x, 0, "shadow").setOrigin(0.5, 0) : null));
    this.chars = SLOT_X.map((x, i) => this.add.sprite(x, 0, PREVIEWS[i].texture, 0).setOrigin(0.5, 0));
    this.aura = this.add.particles(0, 0, "px", {
      emitZone: { type: "random", source: new Phaser.Geom.Ellipse(0, 0, 30, 8) },
      speedY: { min: -24, max: -14 }, speedX: 0, lifespan: { min: 500, max: 900 },
      scale: { start: 1, end: 0.5 }, alpha: { start: 0.67, end: 0 }, tint: 0xffe65a, frequency: 66,
    });
    this.arrows = this.add.graphics();
    this.arrowRects = [
      new Phaser.Geom.Rectangle(SLOT_X[0] - 40, GROUND_Y - 21, 9, 14),
      new Phaser.Geom.Rectangle(SLOT_X[2] + 31, GROUND_Y - 21, 9, 14),
    ];
    this.okButton = new MenuButton(this, W / 2 - 30, H - 50, 60, 24, t("web.confirm"), { onClick: () => this.confirm() });

    // --- input ---
    this.input.keyboard.on("keydown", (e) => this.onKey(e));
    this.input.on("pointerdown", (p) => this.onPointer(p));
    this.setPhase("intro");
  }

  setPhase(phase) {
    this.phase = phase;
    const show = (list, v) => list.forEach((o) => o.setVisible(v));
    this.press.main.setVisible(phase === "intro");
    this.press.shadow.setVisible(phase === "intro");
    show([this.nameLabel.main, this.nameLabel.shadow, this.nameText.main, this.nameText.shadow, this.caret], phase === "input");
    show([this.pickLabel.main, this.pickLabel.shadow, ...this.shadows, this.pad, ...this.chars, this.arrows],
      phase === "character");
    this.skinShadow.forEach((s) => s && s.setVisible(phase === "character"));
    this.aura.setVisible(phase === "character");
    if (phase === "character") this.aura.start(); else this.aura.stop();
    const okVisible = phase !== "intro";
    [this.okButton.face, this.okButton.shadow, this.okButton.text, this.okButton.textShadow].forEach((o) => o.setVisible(okVisible));

    if (phase === "input") {
      this.bg.setTitleAlpha(1);
      this.setName(this.name);
      if (this.domInput) {
        this.domInput.value = this.name;
        this.domInput.focus(); // sul telefono la tastiera compare solo dopo un tocco (vedi onPointer)
      }
    } else if (this.domInput) {
      this.domInput.blur();
    }
  }

  setName(value) {
    // come il desktop: solo lettere e cifre, massimo 12
    this.name = String(value).replace(/[^\p{L}\p{N}]/gu, "").slice(0, MAX_LEN);
    if (this.domInput && this.domInput.value !== this.name) this.domInput.value = this.name;
    this.nameText.setText(this.name);
    if (this.name) this.error.setText("");
  }

  showError(text) {
    this.error.setText(text);
    this.errorTimer = 2;
  }

  selectSkin(i) {
    i = Phaser.Math.Clamp(i, 0, SKINS.length - 1);
    if (i !== this.skin) {
      this.skin = i;
      this.blip.play();
    }
  }

  confirm() {
    if (this.phase === "input") {
      if (!this.name) { this.showError(t("intro.name_error")); return; }
      this.blip.play();
      this.setPhase("character");
    } else if (this.phase === "character") {
      this.blip.play();
      setPlayer(this.name, this.skin);
      this.phase = "leaving";
      this.cameras.main.fadeOut(400);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("Menu"));
    }
  }

  skipIntro() {
    this.timer = 999;
    this.setPhase("input");
  }

  onKey(e) {
    this.isTouch = false;
    this.registry.set("inputMode", "desktop");
    if (this.phase === "intro") { this.skipIntro(); return; }
    if (this.phase === "input") {
      // con il focus sull'<input> i caratteri arrivano dall'evento "input"; questo e' il ripiego
      if (document.activeElement === this.domInput) return;
      if (e.key === "Enter") this.confirm();
      else if (e.key === "Backspace") this.setName(this.name.slice(0, -1));
      else if (e.key === "Escape") this.setName("");
      else if (e.key.length === 1) { this.setName(this.name + e.key); this.blip.play(); }
      return;
    }
    if (this.phase === "character") {
      if (e.key === "ArrowLeft") this.selectSkin(this.skin - 1);
      else if (e.key === "ArrowRight") this.selectSkin(this.skin + 1);
      else if (e.key === "Enter") this.confirm();
    }
  }

  onPointer(p) {
    this.isTouch = p.wasTouch;
    this.registry.set("inputMode", p.wasTouch ? "touch" : "desktop");
    if (this.phase === "intro") { this.skipIntro(); return; }
    if (this.phase !== "intro" && this.okButton.contains(p.x, p.y)) { this.confirm(); return; }
    if (this.phase === "input") {
      this.domInput?.focus(); // tocco = gesto dell'utente: ora il telefono apre la tastiera
      return;
    }
    if (this.phase === "character") {
      for (let i = 0; i < SLOT_X.length; i++) {
        const r = new Phaser.Geom.Rectangle(SLOT_X[i] - 20, GROUND_Y - 32, 40, 38);
        if (r.contains(p.x, p.y)) { this.selectSkin(i); return; }
      }
      if (this.arrowRects[0].contains(p.x, p.y)) this.selectSkin(this.skin - 1);
      else if (this.arrowRects[1].contains(p.x, p.y)) this.selectSkin(this.skin + 1);
    }
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.bg.update(dt);
    this.timer += dt;
    const pointer = this.input.activePointer;

    if (this.errorTimer > 0) {
      this.errorTimer -= dt;
      if (this.errorTimer <= 0) this.error.setText("");
    }

    if (this.phase === "intro") {
      if (this.timer > 1) this.bg.setTitleAlpha(Math.min(1, (this.timer - 1) * 150 / 255));
      this.press.setText(t(this.isTouch ? "web.tap_start" : "intro.press_start"));
      if (this.timer > 2) this.press.setAlpha(Math.min(1, (this.timer - 2) * 150 / 255));
      return;
    }
    this.okButton.update(dt, pointer, this.isTouch);

    if (this.phase === "input") {
      const blink = Math.floor(this.timer / 0.5) % 2 === 0;
      this.caret.setVisible(blink);
      this.caret.setX(Math.round(W / 2 + this.nameText.main.width / 2 - 1));
      return;
    }

    if (this.phase === "character") this.updateCharacters(dt, pointer);
  }

  updateCharacters(dt, pointer) {
    this.charTime += dt;
    this.previewTimer += dt;
    if (this.previewTimer >= PREVIEW_SPEED) {
      this.previewTimer = 0;
      this.previewFrame = this.previewFrame.map((f, i) => (f + 1) % PREVIEWS[i].frames);
    }

    for (let i = 0; i < SLOT_X.length; i++) {
      const selected = i === this.skin;
      const r = new Phaser.Geom.Rectangle(SLOT_X[i] - 20, GROUND_Y - 32, 40, 38);
      const hover = !this.isTouch && r.contains(pointer.x, pointer.y);
      const target = selected ? 4 : hover ? 2 : 0;
      this.lift[i] += (target - this.lift[i]) * Math.min(1, dt * 12);
      const bob = selected ? 2 * Math.sin(this.charTime * 3) : 0;
      const altitude = this.lift[i] + bob;

      const scale = Math.max(0.35, 1 - altitude / 80);
      this.shadows[i].setSize(Math.max(4, 26 * scale), Math.max(2, (26 * scale) / 3)).setAlpha(0.5 + 0.5 * scale);
      const top = Math.round(GROUND_Y - FEET_Y - altitude);
      this.chars[i].setFrame(this.previewFrame[i]).setY(top).setAlpha(selected ? 1 : 170 / 255);
      if (this.skinShadow[i]) this.skinShadow[i].setY(top).setAlpha(selected ? 1 : 170 / 255);
    }

    // pedana dorata che respira sotto il personaggio scelto + scintille
    const w = 24 * (1 + 0.08 * Math.sin(this.charTime * 3));
    this.pad.setPosition(SLOT_X[this.skin], GROUND_Y).setSize(w, Math.max(4, w / 3));
    this.aura.setPosition(SLOT_X[this.skin], GROUND_Y);

    // frecce dorate solo se c'e' un personaggio in quella direzione
    this.arrows.clear().fillStyle(0xffc800, 1);
    const push = Math.round(2 + 2 * Math.sin(this.charTime * 4));
    const [l, rr] = this.arrowRects;
    if (this.skin > 0) {
      this.arrows.fillTriangle(l.x - push, l.centerY, l.right - push, l.y, l.right - push, l.bottom);
    }
    if (this.skin < SKINS.length - 1) {
      this.arrows.fillTriangle(rr.right + push, rr.centerY, rr.x + push, rr.y, rr.x + push, rr.bottom);
    }
  }
}
