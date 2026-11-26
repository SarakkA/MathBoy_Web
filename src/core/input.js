// Strato di input unico: la scena chiede "dove mi muovo / dove miro" e riceve le azioni
// (sparo, interazione, cambio valore, ricomincia) senza sapere se arrivano da
// tastiera+mouse o dal touch.
//
// Modalita' decisa dall'ultimo input usato: un tocco passa a "touch", un tasto o il
// mouse passano a "desktop". Resta salvata nel registry, quindi vale tra le stanze.
import { Op } from "../config/settings.js";
import TouchControls from "../ui/TouchControls.js";

export default class InputController {
  /**
   * handlers: { onShoot(op), onInteract(), onChangeValue(dir), onRestart(), onToggleFps(),
   *             canRestart() -> bool }
   */
  constructor(scene, hud, handlers) {
    this.scene = scene;
    this.hud = hud;
    this.h = handlers;
    this.lastAim = { x: 0, y: -1 }; // il player parte girato in su

    this.keys = scene.input.keyboard.addKeys("W,A,S,D,E,R,F3");
    this.keys.E.on("down", () => this.h.onInteract());
    this.keys.R.on("down", () => { if (this.h.canRestart()) this.h.onRestart(); });
    this.keys.F3.on("down", () => this.h.onToggleFps());
    scene.input.keyboard.on("keydown", () => this.setMode("desktop"));

    scene.input.mouse.disableContextMenu();
    scene.input.on("pointerdown", (p) => this.onDown(p));
    scene.input.on("pointermove", (p) => this.onMove(p));
    scene.input.on("pointerup", (p) => this.onUp(p));
    scene.input.on("wheel", (p, objs, dx, dy) => this.h.onChangeValue(dy < 0 ? 1 : -1));

    this.touch = new TouchControls(scene, hud);
    this.setMode(scene.registry.get("inputMode") || "desktop", true);
  }

  get isTouch() {
    return this.mode === "touch";
  }

  setMode(mode, force = false) {
    if (mode === this.mode && !force) return;
    this.mode = mode;
    this.scene.registry.set("inputMode", mode);
    this.touch.setEnabled(mode === "touch");
    this.hud.setTouchMode(mode === "touch");
    this.scene.input.setDefaultCursor(mode === "touch" ? "default" : "none");
  }

  onDown(p) {
    this.setMode(p.wasTouch ? "touch" : "desktop");
    if (this.h.canRestart()) {
      this.h.onRestart();
      return;
    }
    if (this.isTouch) {
      const action = this.touch.down(p);
      if (action === "add") this.h.onShoot(Op.ADD);
      else if (action === "sub") this.h.onShoot(Op.SUB);
      else if (action === "interact") this.h.onInteract();
      else if (action === "value") this.h.onChangeValue(null); // null = valore successivo, ciclico
      return;
    }
    this.hud.notifyClick(p.button);
    if (p.button === 0) this.h.onShoot(Op.ADD);
    else if (p.button === 2) this.h.onShoot(Op.SUB);
  }

  onMove(p) {
    if (p.wasTouch) this.touch.move(p);
    else if (p.isDown || p.velocity.x || p.velocity.y) this.setMode("desktop");
  }

  onUp(p) {
    if (p.wasTouch) {
      this.touch.up(p);
      this.tryFullscreen();
    } else {
      this.hud.notifyRelease(p.button);
    }
  }

  /** schermo intero + orizzontale al primo tocco (Android; su iPhone non e' supportato) */
  tryFullscreen() {
    const reg = this.scene.registry;
    if (reg.get("triedFullscreen")) return;
    reg.set("triedFullscreen", true);
    // richiesta fatta a mano: startFullscreen di Phaser non gestisce il rifiuto del browser.
    // L'orientamento si puo' bloccare solo dopo essere entrati a schermo intero.
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request || document.fullscreenElement || document.webkitFullscreenElement) return;
    try {
      Promise.resolve(request.call(el, { navigationUI: "hide" }))
        .then(() => window.screen?.orientation?.lock?.("landscape"))
        .catch(() => { /* negato o non supportato: si gioca senza schermo intero */ });
    } catch { /* non supportato */ }
  }

  /** direzione di movimento {x, y} (non per forza normalizzata) */
  getMove() {
    if (this.isTouch) return this.touch.direction;
    const k = this.keys;
    const dir = { x: 0, y: 0 };
    if (k.W.isDown) dir.y = -1; else if (k.S.isDown) dir.y = 1;
    if (k.D.isDown) dir.x = 1; else if (k.A.isDown) dir.x = -1;
    return dir;
  }

  /** vettore di mira dal centro del player: verso il mouse, oppure dove guarda il player */
  getAim(center) {
    if (this.isTouch) {
      const d = this.touch.direction;
      if (d.x || d.y) this.lastAim = { x: d.x, y: d.y };
      return { x: this.lastAim.x * 100, y: this.lastAim.y * 100 };
    }
    const p = this.scene.input.activePointer;
    const m = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    return { x: m.x - center.x, y: m.y - center.y };
  }

  /** bottone E touch visibile solo quando serve */
  update(showInteract) {
    this.touch.update(showInteract);
  }
}
