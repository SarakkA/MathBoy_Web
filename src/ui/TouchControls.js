import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H, DEPTH } from "../config/settings.js";

const DEPTH_TOUCH = DEPTH.hud + 50;
const JOY_RADIUS = 26;
const KNOB_RADIUS = 10;
const DEAD_ZONE = 0.25;
const BUTTON_HIT = 30;       // raggio dell'area di tocco dei bottoni +/-
const KEY_E = 2 * 8 + 4;     // keyboard_letters.png
export const E_BUTTON = { x: W - 81, y: H - 106, r: 16 };

/** Controlli per telefono: joystick flottante a sinistra, bottoni a destra.
 *  I bottoni + e - li disegna l'Hud (gli stessi del desktop, ingranditi);
 *  qui ci sono le aree di tocco, il joystick e il bottone E. */
export default class TouchControls {
  constructor(scene, hud) {
    this.scene = scene;
    this.hud = hud;
    const fixed = (o) => o.setScrollFactor(0).setDepth(DEPTH_TOUCH).setVisible(false);
    this.base = fixed(scene.add.circle(0, 0, JOY_RADIUS, 0xffffff, 0.18).setStrokeStyle(1, 0xffffff, 0.3));
    this.knob = fixed(scene.add.circle(0, 0, KNOB_RADIUS, 0xffffff, 0.35));
    this.eBg = fixed(scene.add.circle(E_BUTTON.x, E_BUTTON.y, E_BUTTON.r, 0x282828, 0.6).setStrokeStyle(2, 0xffffff, 0.6));
    this.eKey = fixed(scene.add.image(E_BUTTON.x, E_BUTTON.y, "keys", KEY_E).setScale(1.5));

    this.enabled = false;
    this.joyId = null;
    this.joyCenter = { x: 0, y: 0 };
    this.direction = { x: 0, y: 0 };
    this.buttonPointers = new Map(); // pointer.id -> indice bottone (per l'animazione di rilascio)
    this.showE = false;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.releaseJoystick();
    this.update(this.showE);
  }

  /** ritorna l'azione del tocco: "add" | "sub" | "interact" | "value" | null (joystick o niente) */
  down(p) {
    const near = (x, y, r) => Math.hypot(p.x - x, p.y - y) <= r;
    const run = this.hud.run;
    const buttons = this.hud.buttonPositions();
    const allowed = [run.canAdd, run.canSub];
    for (let i = 0; i < buttons.length; i++) {
      if (allowed[i] && near(buttons[i].x, buttons[i].y, BUTTON_HIT)) {
        this.buttonPointers.set(p.id, i);
        this.hud.notifyClick(i === 0 ? 0 : 2);
        return i === 0 ? "add" : "sub";
      }
    }
    if (this.showE && near(E_BUTTON.x, E_BUTTON.y, E_BUTTON.r + 8)) {
      this.ePointer = p.id; // per il rilascio (coop: E si tiene premuto per rianimare)
      return "interact";
    }
    for (const s of this.hud.selectorPositions()) {
      if (near(s.x, s.y, 16)) return "value";
    }
    if (p.x < W / 2 && this.joyId === null) {
      this.joyId = p.id;
      this.joyCenter = { x: p.x, y: p.y };
      this.base.setPosition(p.x, p.y).setVisible(true);
      this.knob.setPosition(p.x, p.y).setVisible(true);
      this.direction = { x: 0, y: 0 };
    }
    return null;
  }

  move(p) {
    if (p.id !== this.joyId) return;
    let dx = p.x - this.joyCenter.x;
    let dy = p.y - this.joyCenter.y;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      dx = (dx / len) * JOY_RADIUS;
      dy = (dy / len) * JOY_RADIUS;
    }
    this.knob.setPosition(this.joyCenter.x + dx, this.joyCenter.y + dy);
    // fuori dalla zona morta: direzione normalizzata (velocita' costante, come WASD)
    this.direction = len / JOY_RADIUS < DEAD_ZONE ? { x: 0, y: 0 } : { x: dx / Math.hypot(dx, dy), y: dy / Math.hypot(dx, dy) };
  }

  /** ritorna "add" | "sub" se e' stato rilasciato un bottone di sparo (per la carica) */
  up(p) {
    if (p.id === this.ePointer) {
      this.ePointer = null;
      return "interact_up";
    }
    if (p.id === this.joyId) this.releaseJoystick();
    if (!this.buttonPointers.has(p.id)) return null;
    const i = this.buttonPointers.get(p.id);
    this.buttonPointers.delete(p.id);
    this.hud.notifyRelease(i === 0 ? 0 : 2);
    return i === 0 ? "add" : "sub";
  }

  /** rilascia tutto (joystick, bottoni, E) senza generare azioni */
  reset() {
    this.releaseJoystick();
    this.buttonPointers.clear();
    this.ePointer = null;
  }

  releaseJoystick() {
    this.joyId = null;
    this.direction = { x: 0, y: 0 };
    this.base.setVisible(false);
    this.knob.setVisible(false);
  }

  update(showInteract) {
    this.showE = showInteract;
    const visible = this.enabled && showInteract;
    this.eBg.setVisible(visible);
    this.eKey.setVisible(visible);
  }
}
