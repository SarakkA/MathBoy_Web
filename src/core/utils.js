// Helper condivisi.

/** Sovrapposizione stretta come pygame colliderect: i bordi che si toccano NON contano
 *  (Phaser.Geom.Intersects li conta, e il player resterebbe incollato ai muri). */
export function overlaps(a, b) {
  return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}

function rgb(c) {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

/** Pallina sfumata (centro chiaro, bordo scuro) come draw_shaded_ball in draw_utils.py.
 *  Crea la texture una volta sola e ne restituisce la chiave. */
export function shadedBall(scene, key, radius, color) {
  if (scene.textures.exists(key)) return key;
  const base = rgb(color);
  const dark = base.map((c) => Math.floor(c * 0.85));
  const light = base.map((c) => Math.min(255, Math.floor(c * 0.55 + 140)));
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let i = radius; i > 0; i--) {
    const t = i / radius; // 1 sul bordo, verso 0 al centro
    const col = light.map((l, k) => Math.floor(l + (dark[k] - l) * t));
    g.fillStyle((col[0] << 16) | (col[1] << 8) | col[2], 1);
    g.fillCircle(radius, radius, i);
  }
  g.generateTexture(key, radius * 2, radius * 2);
  g.destroy();
  return key;
}

/** Testo bitmap con ombra spostata di 1px, come render_text_shadow. */
export function shadowText(scene, x, y, font, text, color = 0xffffff) {
  const shadow = scene.add.bitmapText(x + 1, y + 1, font, text).setTint(0x191919);
  const main = scene.add.bitmapText(x, y, font, text).setTint(color);
  return {
    shadow,
    main,
    setText(t) { shadow.setText(t); main.setText(t); return this; },
    setOrigin(ox, oy) { shadow.setOrigin(ox, oy); main.setOrigin(ox, oy); return this; },
    setAlpha(a) { shadow.setAlpha(a); main.setAlpha(a); return this; },
    setDepth(d) { shadow.setDepth(d); main.setDepth(d + 0.01); return this; },
    setScrollFactor(f) { shadow.setScrollFactor(f); main.setScrollFactor(f); return this; },
    destroy() { shadow.destroy(); main.destroy(); },
  };
}
