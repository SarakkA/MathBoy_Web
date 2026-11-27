import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H } from "../config/settings.js";
import { t } from "../core/i18n.js";
import { MenuButton } from "../ui/menuBackground.js";

const BOX_W = 300;
const BOX_H = 130;

/** "Tornare al menu?" sopra una partita in corso (bottone in alto a destra o ESC).
 *  E' una scena a parte, lanciata sopra quella di gioco (BaseLevelScene.openPauseMenu):
 *  - da soli la scena sotto e' in pausa (scene.pause), quindi si ferma tutto;
 *  - online no: il server va avanti comunque, la scena sotto continua a ricevere i messaggi.
 *  Il velo a tutto schermo e' interattivo e assorbe i tocchi, cosi' alla scena sotto
 *  non arrivano (niente spari o joystick mentre si sceglie). */
export default class PauseScene extends Phaser.Scene {
  constructor() {
    super("Pause");
  }

  init(data) {
    this.targetKey = data.target;
    this.online = Boolean(data.online);
    this.paused = Boolean(data.paused);
  }

  create() {
    this.done = false;
    this.input.setDefaultCursor("default");
    this.isTouch = this.registry.get("inputMode") === "touch";
    this.blip = this.sound.add("blip_sfx", { volume: 0.25 });

    this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive();
    this.box = new Phaser.Geom.Rectangle(W / 2 - BOX_W / 2, H / 2 - BOX_H / 2, BOX_W, BOX_H);
    this.add.rectangle(W / 2, H / 2, BOX_W, BOX_H, 0x1e1e37, 0.95).setStrokeStyle(2, 0xd2d2e6);
    this.add.bitmapText(W / 2, H / 2 - 40, "gold16", t("web.pause_title")).setOrigin(0.5);
    this.add.bitmapText(W / 2, H / 2 - 16, "gold10", t(this.online ? "web.pause_online" : "web.pause_lost"))
      .setOrigin(0.5).setTint(0xaaaaaa);
    this.yes = new MenuButton(this, W / 2 - 110, H / 2 + 10, 100, 34, t("quit.yes"), { onClick: () => this.confirm() });
    this.no = new MenuButton(this, W / 2 + 10, H / 2 + 10, 100, 34, t("quit.no"), { onClick: () => this.cancel() });

    this.input.on("pointerdown", (p) => {
      this.isTouch = p.wasTouch;
      if (this.yes.contains(p.x, p.y)) this.yes.onClick();
      else if (this.no.contains(p.x, p.y)) this.no.onClick();
      else if (!this.box.contains(p.x, p.y)) this.cancel(); // tocco fuori dal riquadro = annulla
    });
    const kb = this.input.keyboard;
    kb.on("keydown", () => { this.isTouch = false; });
    kb.on("keydown-ENTER", () => this.confirm());
    // online la scena sotto non e' in pausa e gestisce lei ESC (apre / chiude):
    // ascoltarlo anche qui lo farebbe scattare due volte
    if (this.paused) kb.on("keydown-ESC", (e) => { if (!e.repeat) this.cancel(); });
  }

  target() {
    return this.scene.get(this.targetKey);
  }

  confirm() {
    if (this.done) return;
    this.done = true;
    this.blip.play();
    this.cameras.main.fadeOut(250);
    this.cameras.main.once("camerafadeoutcomplete", () => this.target().leaveToMenu());
  }

  cancel() {
    if (this.done) return;
    this.done = true;
    this.blip.play();
    this.target().closePauseMenu();
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const p = this.input.activePointer;
    this.yes.update(dt, p, this.isTouch);
    this.no.update(dt, p, this.isTouch);
  }
}
