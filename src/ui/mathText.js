// Impaginatore di formule con i font bitmap, al posto del LaTeX (matplotlib) del desktop.
//
// Riceve un'espressione (Frac, Linear, Equation, ParamEquation: vedi src/math/) e ne dispone
// i pezzi (src/math/tokens.js) su una riga, tutti allineati sullo stesso asse orizzontale:
//
//        3x                  x               x + 1
//   -    ── + 5      oppure  ─ - 7 = 0       ───── = a²
//        2                   4                 b
//
// - testo (cifre, lettere, segni) centrato sull'inchiostro delle cifre;
// - frazioni con numeratore e denominatore piu' piccoli, impilati attorno a una barra di 1 px
//   che sta proprio sull'asse; numeratore e denominatore sono a loro volta righe di pezzi,
//   quindi le frazioni si possono annidare (ogni livello usa un font piu' piccolo);
// - esponenti piccoli, in alto a destra;
// - operatori (+, -, =) con qualche pixel d'aria ai lati, il meno iniziale attaccato.
//
// L'allineamento usa le misure dell'inchiostro delle cifre (assets/fonts/metrics.json):
// i font hanno spazio vuoto sopra e sotto, che impilando le righe sprecherebbe pixel.

let METRICS = {};

export function setFontMetrics(metrics) {
  METRICS = metrics || {};
}

const GAP = 1;      // pixel tra le cifre di una frazione e la barra
const OP_SPACE = 3; // aria ai lati di + - = (2 dentro le frazioni)
const SIGN_SPACE = 1;
const SUP_FONT = "gold10";

export default class MathText extends Phaser.GameObjects.Container {
  /** opzioni: color, intFont (testo sulla riga), fracFont (numeratore/denominatore) */
  constructor(scene, x, y, { color = 0x000000, intFont = "gold16", fracFont = "gold12" } = {}) {
    super(scene, x, y);
    scene.add.existing(this);
    this.color = color;
    this.fonts = [intFont, fracFont, "gold10"]; // font per livello di annidamento
    this.textW = 0; // ingombro dell'inchiostro, centrato in (0, 0)
    this.textH = 0;
  }

  metrics(font) {
    return METRICS[font] || { digitTop: 0, digitBottom: 12 };
  }

  font(depth) {
    return this.fonts[Math.min(depth, this.fonts.length - 1)];
  }

  /** expr: qualsiasi oggetto con toTokens() */
  setValue(expr) {
    this.removeAll(true);
    const row = this.layout(expr.toTokens(), 0);
    // centra il riquadro in (0, 0): orizzontalmente e, se la riga non e' simmetrica, anche in verticale
    const dx = Math.round(-row.width / 2);
    const dy = Math.round(-(row.top + row.bottom) / 2);
    for (const it of row.items) this.place(it, dx, dy);
    this.textW = row.width;
    this.textH = row.bottom - row.top;
    return this;
  }

  place(it, dx, dy) {
    if (it.kind === "text") {
      this.add(this.scene.add.bitmapText(it.x + dx, Math.round(it.y + dy), it.font, it.s).setTint(this.color));
    } else {
      this.add(this.scene.add.rectangle(it.x + dx, Math.round(it.y + dy), it.w, 1, this.color).setOrigin(0, 0));
    }
  }

  /** dispone una riga di pezzi attorno all'asse y = 0; ritorna { items, width, top, bottom } */
  layout(tokens, depth) {
    if (typeof tokens === "string") tokens = [{ t: "text", s: tokens }];
    const font = this.font(depth);
    const m = this.metrics(font);
    const half = (m.digitBottom - m.digitTop) / 2;
    const textY = -(m.digitTop + m.digitBottom) / 2;
    const opSpace = depth === 0 ? OP_SPACE : 2;
    const items = [];
    let x = 0;
    let top = -half;
    let bottom = half;

    const addText = (s) => {
      items.push({ kind: "text", font, s, x, y: textY });
      x += this.measure(font, s);
    };

    for (const tok of tokens) {
      if (tok.t === "text") {
        addText(tok.s);
      } else if (tok.t === "sign") {
        addText(tok.s);
        x += SIGN_SPACE;
      } else if (tok.t === "op") {
        x += opSpace;
        addText(tok.s);
        x += opSpace;
      } else if (tok.t === "sup") {
        // esponente: centro dell'inchiostro all'altezza del bordo alto delle cifre
        const sm = this.metrics(SUP_FONT);
        items.push({ kind: "text", font: SUP_FONT, s: tok.s, x, y: -half - (sm.digitTop + sm.digitBottom) / 2 });
        x += this.measure(SUP_FONT, tok.s);
        top = Math.min(top, -half - (sm.digitBottom - sm.digitTop) / 2);
      } else if (tok.t === "frac") {
        const num = this.layout(tok.num, depth + 1);
        const den = this.layout(tok.den, depth + 1);
        const barW = Math.max(num.width, den.width) + 2;
        const numY = -GAP - num.bottom;  // asse del numeratore
        const denY = 1 + GAP - den.top;  // asse del denominatore
        const nx = x + Math.round((barW - num.width) / 2);
        const ndx = x + Math.round((barW - den.width) / 2);
        for (const it of num.items) items.push({ ...it, x: it.x + nx, y: it.y + numY });
        for (const it of den.items) items.push({ ...it, x: it.x + ndx, y: it.y + denY });
        items.push({ kind: "bar", x, y: 0, w: barW });
        top = Math.min(top, numY + num.top);
        bottom = Math.max(bottom, denY + den.bottom);
        x += barW;
      }
    }
    return { items, width: x, top, bottom };
  }

  /** larghezza di una stringa nel font bitmap (come BitmapText.width) */
  measure(font, s) {
    if (!this._probe) this._probe = this.scene.make.bitmapText({ x: 0, y: 0, font, text: "" }, false);
    this._probe.setFont(font).setText(s);
    return this._probe.width;
  }

  setColor(color) {
    this.color = color;
    for (const child of this.list) {
      if (child.type === "BitmapText") child.setTint(color);
      else if (child.setFillStyle) child.setFillStyle(color);
    }
    return this;
  }

  destroy(fromScene) {
    this._probe?.destroy();
    this._probe = null;
    super.destroy(fromScene);
  }
}
