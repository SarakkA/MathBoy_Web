// Impaginatore di formule con i font bitmap, al posto del LaTeX (matplotlib) del desktop.
//
// Riceve un'espressione (Frac, Linear, Equation: vedi src/math/) e ne dispone i pezzi
// (src/math/tokens.js) su una riga, tutti allineati sullo stesso asse orizzontale:
//
//        3x                  x
//   -    ── + 5      oppure  ─ - 7 = 0
//        2                   4
//
// - testo (cifre, x, segni) centrato sull'inchiostro delle cifre;
// - frazioni con numeratore e denominatore piu' piccoli, impilati attorno a una barra di 1 px
//   che sta proprio sull'asse;
// - operatori (+, -, =) con qualche pixel d'aria ai lati, il meno iniziale attaccato.
//
// L'allineamento usa le misure dell'inchiostro delle cifre (assets/fonts/metrics.json):
// i font hanno spazio vuoto sopra e sotto, che impilando le righe sprecherebbe pixel.

let METRICS = {};

export function setFontMetrics(metrics) {
  METRICS = metrics || {};
}

const GAP = 1;      // pixel tra le cifre di una frazione e la barra
const OP_SPACE = 3; // aria ai lati di + - =
const SIGN_SPACE = 1;

export default class MathText extends Phaser.GameObjects.Container {
  /** opzioni: color, intFont (testo sulla riga), fracFont (numeratore/denominatore) */
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

  text(font, str, x, y) {
    const t = this.scene.add.bitmapText(x, y, font, str).setTint(this.color);
    this.add(t);
    return t;
  }

  /** expr: qualsiasi oggetto con toTokens() (Frac, Linear, Equation) */
  setValue(expr) {
    this.removeAll(true);
    const im = this.metrics(this.intFont);
    const fm = this.metrics(this.fracFont);
    const textY = Math.round(-(im.digitTop + im.digitBottom) / 2);
    let x = 0;
    let hasFrac = false;

    for (const tok of expr.toTokens()) {
      if (tok.t === "text") {
        x += this.text(this.intFont, tok.s, x, textY).width;
      } else if (tok.t === "sign") {
        x += this.text(this.intFont, tok.s, x, textY).width + SIGN_SPACE;
      } else if (tok.t === "op") {
        x += OP_SPACE;
        x += this.text(this.intFont, tok.s, x, textY).width + OP_SPACE;
      } else if (tok.t === "frac") {
        hasFrac = true;
        const num = this.text(this.fracFont, tok.num, 0, -GAP - fm.digitBottom);
        const den = this.text(this.fracFont, tok.den, 0, 1 + GAP - fm.digitTop);
        const barW = Math.max(num.width, den.width) + 2;
        num.x = x + Math.round((barW - num.width) / 2);
        den.x = x + Math.round((barW - den.width) / 2);
        this.add(this.scene.add.rectangle(x, 0, barW, 1, this.color).setOrigin(0, 0));
        x += barW;
      }
    }

    // centra la riga in (0, 0)
    const shift = Math.round(-x / 2);
    for (const child of this.list) child.x += shift;
    this.textW = x;
    this.textH = hasFrac ? 2 * (fm.digitBottom - fm.digitTop + GAP) + 1 : im.digitBottom - im.digitTop;
    return this;
  }

  setColor(color) {
    this.color = color;
    for (const child of this.list) {
      if (child.type === "BitmapText") child.setTint(color);
      else if (child.setFillStyle) child.setFillStyle(color);
    }
    return this;
  }
}
