import { overlaps } from "../core/utils.js";

/** Porta d'uscita della stanza (ui/door.py): chiusa finche' la stanza non e' risolta,
 *  poi si apre con l'aura dorata (level_base.py _update_rush). */
export default class Door {
  constructor(scene, x, y) {
    this.rect = new Phaser.Geom.Rectangle(x, y, 16, 16);
    this.sprite = scene.add.sprite(x, y, "door", 0).setOrigin(0).setDepth(y + 16);
    this.isOpen = false;
    this.fx = scene.add.particles(0, 0, "px", {
      x: { min: x, max: x + 16 }, y: { min: y + 10, max: y + 16 },
      speedY: { min: -25, max: -10 }, speedX: { min: -4, max: 4 }, lifespan: 900,
      scale: { min: 0.5, max: 1 }, alpha: { start: 0.9, end: 0 }, tint: 0xffd700, frequency: 40,
      emitting: false,
    }).setDepth(y + 17);
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.sprite.setFrame(1);
    this.fx.start();
  }

  touches(rect) {
    return this.isOpen && overlaps(this.rect, rect);
  }
}
