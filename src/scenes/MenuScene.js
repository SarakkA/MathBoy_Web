import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H } from "../config/settings.js";
import { WORLDS, STORY_ROW } from "../config/worlds.js";
import { SKINS } from "../config/skins.js";
import { t, LANGS, getLanguage, setLanguage } from "../core/i18n.js";
import { getProfile, isUnlocked, setPlayer, unlockAll } from "../core/profile.js";
import { newRun } from "../core/run.js";
import { shadowText } from "../core/utils.js";
import MenuBackground, { MenuButton } from "../ui/menuBackground.js";

const BTN_W = 80;
const BTN_H = 30;
const SPACING_X = 20;
const SPACING_Y = 40;
const START_Y = H / 2;
// modalita' extra del desktop: scene = scena gia' portata sul web, null = ancora da portare
const EXTRA_ROW = [
  { label: "menu.btn.one_minute", scene: null },
  { label: "Survivor", scene: "Survivor" },
  { label: "MultiPlayer", scene: null },
  { label: "menu.btn.literal", scene: "Parametric" },
  { label: "menu.btn.leaderboards", scene: null },
];
// personaggio in alto a sinistra che guarda il mouse (menu_state.py animate_skin)
const DIRS = ["idle_left_up", "idle_up", "idle_right_up", "idle_right", "idle_down", "idle_left"];

/** Menu principale (menu_state.py): riga STORIA con i mondi, riga EXTRA con le modalita'
 *  (quelle non ancora portate restano grigie), Credits in basso,
 *  personaggio, nome, monete totali e bandierina della lingua. */
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("Menu");
  }

  create() {
    const profile = getProfile();
    this.bg = new MenuBackground(this);
    this.cameras.main.fadeIn(400);
    this.input.setDefaultCursor("default");
    this.blip = this.sound.add("blip_sfx", { volume: 0.25 });
    this.leaving = false;

    // personaggio, nome e monete totali
    this.skinTime = 0;
    this.skinFrame = 0;
    this.skinShadow = this.add.image(24, -5, "shadow").setOrigin(0.5, 0);
    this.skinSprite = this.add.sprite(24, -5, "player", 0).setOrigin(0.5, 0);
    this.skinRect = new Phaser.Geom.Rectangle(0, 0, 48, 48);
    shadowText(this, 40, 20, "gold12", profile.name);
    this.add.image(18, 50, "coin", 0).setOrigin(0, 0.5);
    shadowText(this, 37, 52, "gold12", String(profile.totalScore)).setOrigin(0, 0.5);

    // bandierina della lingua in alto a destra: cambia lingua e ricarica il menu
    this.flag = this.add.image(W - 14, 12, `flag_${getLanguage()}`).setOrigin(0.5);
    this.flagRect = new Phaser.Geom.Rectangle(W - 26, 2, 24, 20);

    // titoli delle sezioni
    shadowText(this, W / 2, START_Y - 10, "gold12", t("menu.story")).setOrigin(0.5, 1);
    shadowText(this, W / 2, START_Y + BTN_H + SPACING_Y - 10, "gold12", t("menu.extra")).setOrigin(0.5, 1);

    // riga STORIA, collegata da linee (blu se entrambi i mondi sono giocabili)
    const rowX = (n) => W / 2 - (n * BTN_W + (n - 1) * SPACING_X) / 2;
    const x0 = rowX(STORY_ROW.length);
    const lines = this.add.graphics();
    this.buttons = STORY_ROW.map((w, i) => {
      const playable = isUnlocked(w.id);
      const btn = new MenuButton(this, x0 + i * (BTN_W + SPACING_X), START_Y, BTN_W, BTN_H, t(w.labelKey), {
        active: playable,
        onClick: () => this.startWorld(w.id),
      });
      btn.worldId = w.id;
      return btn;
    });
    for (let i = 0; i < this.buttons.length - 1; i++) {
      const a = this.buttons[i];
      const b = this.buttons[i + 1];
      const y = START_Y + BTN_H / 2;
      lines.lineStyle(3, 0x000000, 90 / 255).lineBetween(a.rect.centerX + 2, y + 2, b.rect.centerX + 2, y + 2);
      lines.lineStyle(3, a.active && b.active ? 0x6464c8 : 0x505050, 1).lineBetween(a.rect.centerX, y, b.rect.centerX, y);
    }

    // riga EXTRA: attive solo le modalita' gia' portate (e sbloccate)
    const x1 = rowX(EXTRA_ROW.length);
    const extraOpen = isUnlocked("EXTRA");
    this.extras = EXTRA_ROW.map((m, i) =>
      new MenuButton(this, x1 + i * (BTN_W + SPACING_X), START_Y + BTN_H + SPACING_Y, BTN_W, BTN_H, t(m.label), {
        active: Boolean(m.scene) && extraOpen,
        onClick: () => this.startMode(m.scene),
      }));

    // Credits in basso al centro (sul desktop accanto c'e' Esci, che nel browser non serve)
    this.creditsBtn = new MenuButton(this, W / 2 - BTN_W / 2, H - BTN_H - 10, BTN_W, BTN_H, t("menu.btn.credits"), {
      onClick: () => this.goTo("Credits"),
    });

    this.error = this.add.bitmapText(W / 2, H - 55, "gold12", "").setOrigin(0.5).setTint(0xff4040);
    this.errorTimer = 0;

    // trucco del desktop: tenere premuto T per 2 secondi sblocca tutti i mondi
    this.tHold = null;
    this.input.keyboard.on("keydown-T", () => { if (this.tHold === null) this.tHold = 0; });
    this.input.keyboard.on("keyup-T", () => { this.tHold = null; });
    this.input.keyboard.on("keydown", () => { this.isTouch = false; });
    this.input.on("pointerdown", (p) => this.onPointer(p));
    this.isTouch = this.registry.get("inputMode") === "touch";
  }

  onPointer(p) {
    this.isTouch = p.wasTouch;
    this.registry.set("inputMode", p.wasTouch ? "touch" : "desktop");
    if (this.leaving) return;
    if (this.flagRect.contains(p.x, p.y)) {
      const next = LANGS[(LANGS.indexOf(getLanguage()) + 1) % LANGS.length];
      setLanguage(next);
      this.blip.play();
      this.scene.restart();
      return;
    }
    if (this.skinRect.contains(p.x, p.y)) {
      const profile = getProfile();
      setPlayer(profile.name, (profile.skin + 1) % SKINS.length);
      this.blip.play();
      return;
    }
    for (const b of this.buttons) {
      if (!b.contains(p.x, p.y)) continue;
      if (b.active) b.onClick();
      else if (WORLDS[b.worldId] === undefined) this.showError(t("web.coming_soon"));
      return;
    }
    for (const b of this.extras) {
      if (!b.contains(p.x, p.y)) continue;
      if (b.active) b.onClick();
      else this.showError(t("web.coming_soon"));
      return;
    }
    if (this.creditsBtn.contains(p.x, p.y)) this.creditsBtn.onClick();
  }

  showError(text) {
    this.error.setText(text);
    this.errorTimer = 2;
  }

  startWorld(id) {
    this.goTo("Level", { run: newRun(id, getProfile().skin) });
  }

  startMode(scene) {
    this.goTo(scene);
  }

  /** dissolvenza e cambio scena */
  goTo(scene, data) {
    if (this.leaving) return;
    this.leaving = true;
    this.blip.play();
    this.cameras.main.fadeOut(400);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(scene, data));
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.bg.update(dt);
    const pointer = this.input.activePointer;
    for (const b of [...this.buttons, ...this.extras, this.creditsBtn]) b.update(dt, pointer, this.isTouch);

    if (this.errorTimer > 0) {
      this.errorTimer -= dt;
      if (this.errorTimer <= 0) this.error.setText("");
    }

    if (this.tHold !== null) {
      this.tHold += dt;
      if (this.tHold >= 2) {
        this.tHold = null;
        unlockAll();
        this.scene.restart();
        return;
      }
    }

    // personaggio che guarda il mouse
    const skin = SKINS[getProfile().skin] || SKINS[0];
    this.skinTime += dt;
    if (this.skinTime >= 0.12) { this.skinTime = 0; this.skinFrame++; }
    const angle = Math.atan2(pointer.y - 20, pointer.x - 24);
    const dir = this.isTouch ? "idle_down" : DIRS[Math.floor((angle + Math.PI) / (Math.PI / 3)) % 6];
    const [texture, row, flip, count] = skin.anims[dir];
    if (this.skinSprite.texture.key !== texture) this.skinSprite.setTexture(texture);
    this.skinSprite.setFrame(row * skin.cols + (this.skinFrame % count)).setFlipX(flip);
    this.skinShadow.setVisible(skin.shadow);
  }
}
