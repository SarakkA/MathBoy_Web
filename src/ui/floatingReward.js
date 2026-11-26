import { DEPTH } from "../config/settings.js";
import { weaponIcon } from "./weaponIcon.js";

const RISE_H = 40;      // px di salita
const RISE_MS = 900;
const POP_MS = 250;
const FADE_MS = 800;
const DURATION_MS = 5000;

/** Icona dell'arma sbloccata che esce dal baule e resta a mezz'aria (tesoro.py FloatingReward). */
export function floatingReward(scene, x, y, iconId) {
  const icon = weaponIcon(scene, x, y, iconId).setDepth(DEPTH.worldFx);
  icon.setScale(0.4);
  scene.tweens.add({ targets: icon, scale: 1, duration: POP_MS, ease: "Back.easeOut" });
  scene.tweens.add({
    targets: icon, y: y - RISE_H, duration: RISE_MS, ease: "Cubic.easeOut",
    onComplete: () => {
      // fluttuazione leggera
      scene.tweens.add({ targets: icon, y: y - RISE_H + 2, duration: 1000, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
    },
  });
  scene.tweens.add({
    targets: icon, alpha: 0, delay: DURATION_MS - FADE_MS, duration: FADE_MS,
    onComplete: () => icon.destroy(),
  });
  return icon;
}
