import { BLU, ROSSO, VIOLA } from "../config/settings.js";
import { shadedBall } from "../core/utils.js";

// hud.py weapon_icons: ball = colore, r = raggio, ball/testo spostati rispetto al centro dell'icona 42x32
export const WEAPON_ICONS = [
  { color: ROSSO, symbol: "-", r: 12, text: 0xffffff, font: "gold32", ball: [9, -2], textOffset: [1, -2] },
  { color: BLU, symbol: "+", r: 12, text: 0xffffff, font: "gold32", ball: [9, -2], textOffset: [1, -2] },
  { color: 0xffffff, symbol: "2", r: 10, text: 0x000000, font: "gold12", ball: [8, 0], ring: true },
  { color: BLU, symbol: "×", r: 12, text: 0xffffff, font: "gold24", ball: [9, -2], textOffset: [1, -2] },
  { color: 0xffffff, symbol: "3", r: 10, text: 0x000000, font: "gold12", ball: [8, 0], ring: true },
  { color: ROSSO, symbol: "÷", r: 12, text: 0xffffff, font: "gold32", ball: [9, -2], textOffset: [1, -2] },
  { color: 0xffffff, symbol: "5", r: 10, text: 0x000000, font: "gold12", ball: [8, 0], ring: true },
];

/** Icona di un'arma/proiettile (hud.py make_weapon_icon) come Container centrato in (x, y). */
export function weaponIcon(scene, x, y, id) {
  const d = WEAPON_ICONS[id];
  const [bx, by] = d.ball;
  const [ox, oy] = d.textOffset || [0, 0];
  const parts = [];
  if (d.ring) parts.push(scene.add.circle(bx, by, d.r + 2).setStrokeStyle(3, VIOLA));
  parts.push(scene.add.image(bx, by, shadedBall(scene, `ball_icon_${d.color}_${d.r}`, d.r, d.color)));
  parts.push(scene.add.bitmapText(bx + ox, by + oy, d.font, d.symbol).setOrigin(0.5).setTint(d.text));
  return scene.add.container(x, y, parts);
}
