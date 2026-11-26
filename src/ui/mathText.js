// Numeri e frazioni disegnati "come sul libro" con i font bitmap, al posto del LaTeX
// (matplotlib) del gioco desktop:
//
//     7          interi: una riga centrata sull'inchiostro delle cifre
//   - ─          frazioni: numeratore sopra, barra, denominatore sotto,
//     2          segno meno davanti, cifre piu' piccole come il \frac di LaTeX
//
// L'allineamento usa le misure dell'inchiostro delle cifre (assets/fonts/metrics.json):
// i font hanno spazio vuoto sopra e sotto, che impilando le righe sprecherebbe pixel.
// Quando arriveranno le equazioni (Z[x], Q[x]) questo diventera' un piccolo motore
// di impaginazione: "2x + 3/4", potenze, ecc. componendo gli stessi pezzi.

let METRICS = {};

export function setFontMetrics(metrics) {
  METRICS = metrics || {};
}

const GAP = 1; // pixel tra le cifre e la barra di frazione

export default class MathText extends Phaser.GameObjects.Container {
  /** opzioni: color, intFont (interi e segno), fracFont (numeratore/denominatore) */
  constructor(scene, x, y, { color = 0x000000, intFont = "gold16", fracFont = "gold12" } = {}) {
    super(scene, x, y);
    scene.add.existing(this);
    this.color = color;
    this.intFont = intFont;
    this.fracFont = fracFont;
    this.textW = 0; // ingombro dell'inchiostro, centrato in (0, 0)
    this.textH = 0;
  }

  metrics(font) {
    return METRICS[font] || { digitTop: 0, digitBottom: 12 };
  }

  text(font, str) {
    const t = this.scene.add.bitmapText(0, 0, font, str).setTint(this.color);
    this.add(t);
    return t;
  }

  /** value: Frac */
  setValue(value) {
    this.removeAll(true);
    const im = this.metrics(this.intFont);

    if (value.isInteger()) {
      const t = this.text(this.intFont, String(value.num));
      t.setPosition(Math.round(-t.width / 2), Math.round(-(im.digitTop + im.digitBottom) / 2));
      this.textW = t.width;
      this.textH = im.digitBottom - im.digitTop;
      return this;
    }

    const fm = this.metrics(this.fracFont);
    const num = this.text(this.fracFont, String(Math.abs(value.num)));
    const den = this.text(this.fracFont, String(value.den));
    const barW = Math.max(num.width, den.width) + 2;

    let signW = 0;
    let sign = null;
    if (value.num < 0) {
      sign = this.text(this.intFont, "-");
      signW = sign.width + 1;
    }
    const total = signW + barW;
    const left = Math.round(-total / 2);

    if (sign) sign.setPosition(left, Math.round(-(im.digitTop + im.digitBottom) / 2));
    const barX = left + signW;
    this.bar = this.scene.add.rectangle(barX, 0, barW, 1, this.color).setOrigin(0, 0);
    this.add(this.bar);
    // inchiostro del numeratore che finisce GAP px sopra la barra, denominatore GAP px sotto
    num.setPosition(barX + Math.round((barW - num.width) / 2), -GAP - fm.digitBottom);
    den.setPosition(barX + Math.round((barW - den.width) / 2), 1 + GAP - fm.digitTop);

    const digitH = fm.digitBottom - fm.digitTop;
    this.textW = total;
    this.textH = 2 * (digitH + GAP) + 1;
    return this;
  }

  setColor(color) {
    this.color = color;
    for (const child of this.list) {
      if (child.setTint && child.type === "BitmapText") child.setTint(color);
      else if (child.setFillStyle) child.setFillStyle(color);
    }
    return this;
  }
}
