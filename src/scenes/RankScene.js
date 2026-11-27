import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H } from "../config/settings.js";
import { t } from "../core/i18n.js";
import { getProfile } from "../core/profile.js";
import { MenuButton } from "../ui/menuBackground.js";
import { getTop, MODE } from "../net/leaderboard.js";
import { formatDuration } from "./StatsScene.js";

const ROWS = 8;
const ROW_Y = 112;
const ROW_STEP = 22;
const POS_X = 110;
const NAME_X = 145;
const TABLE_RIGHT = 530;
const COL_STEP = 62;

const CAMPAIGN = {
  sortBy: "seconds", dir: "ASCENDING",
  columns: [["Time", "seconds"], ["Coin", "coins"], ["Acc", "accuracy"], ["rank.grade_col", "grade"]],
};

// come RANK_MODES di rank_state.py: campo di ordinamento, verso e colonne [etichetta, campo].
// Le modalita' non ancora portate sul web (campagna, 1 Minuto) mostrano i punteggi del .exe.
const RANK_MODES = [
  { mode: MODE.SURVIVOR, title: "Survivor", sortBy: "level", columns: [["Lvl", "level"], ["Kills", "kills"], ["Time", "seconds"]] },
  { mode: MODE.PARAMETRIC, title: "menu.btn.literal", sortBy: "coins", columns: [["Coins", "coins"], ["Time", "seconds"]] },
  { mode: MODE.Z, title: "menu.btn.world_z", ...CAMPAIGN },
  { mode: MODE.Q, title: "menu.btn.world_q", ...CAMPAIGN },
  { mode: MODE.ZX, title: "rank.world_zx", ...CAMPAIGN },
  { mode: MODE.QX, title: "rank.world_qx", ...CAMPAIGN },
  { mode: MODE.EQ, title: "rank.world_eq", ...CAMPAIGN },
  { mode: MODE.ONE_MINUTE, title: "menu.btn.one_minute", sortBy: "kills", columns: [["Kills", "kills"]] },
];

function cell(field, value) {
  if (field === "seconds") return value == null ? "-" : formatDuration(value);
  if (field === "accuracy") return value == null ? "-" : `${Math.round(value)}%`; // record vecchi senza il campo
  if (field === "grade") return value == null ? "-" : String(value);
  return String(value ?? 0);
}

/** Classifiche online (rank_state.py): una modalita' alla volta, si sfogliano
 *  con le frecce (o A/D, o toccando < >). I dati arrivano da Firestore, gli stessi
 *  del gioco desktop. */
export default class RankScene extends Phaser.Scene {
  constructor() {
    super("Rank");
  }

  init(data) {
    const i = RANK_MODES.findIndex((m) => m.mode === data?.mode);
    this.index = Math.max(0, i);
  }

  create() {
    this.cameras.main.setBackgroundColor("#1e1e32");
    this.cameras.main.fadeIn(400);
    this.input.setDefaultCursor("default");
    this.isTouch = this.registry.get("inputMode") === "touch";
    this.blip = this.sound.add("blip_sfx", { volume: 0.25 });
    this.leaving = false;
    this.requestId = 0;
    this.myName = getProfile().name;

    this.title = this.add.bitmapText(W / 2, 40, "gold32", "").setOrigin(0.5).setTint(0xffd700);
    this.pageText = this.add.bitmapText(W / 2, 66, "gold10", "").setOrigin(0.5).setTint(0xaaaaaa);
    this.status = this.add.bitmapText(W / 2, ROW_Y + 60, "gold12", "").setOrigin(0.5).setTint(0xaaaaaa);
    this.table = null;

    this.prevBtn = new MenuButton(this, 40, 25, 30, 30, "<", { onClick: () => this.change(-1) });
    this.nextBtn = new MenuButton(this, W - 70, 25, 30, 30, ">", { onClick: () => this.change(1) });
    this.menuBtn = new MenuButton(this, W / 2 - 50, H - 45, 100, 30, "menu", { onClick: () => this.leave() });
    this.buttons = [this.prevBtn, this.nextBtn, this.menuBtn];

    this.input.on("pointerdown", (p) => {
      this.isTouch = p.wasTouch;
      const b = this.buttons.find((x) => x.contains(p.x, p.y));
      if (b) b.onClick();
    });
    const kb = this.input.keyboard;
    kb.on("keydown", () => { this.isTouch = false; });
    kb.on("keydown-LEFT", () => this.change(-1));
    kb.on("keydown-A", () => this.change(-1));
    kb.on("keydown-RIGHT", () => this.change(1));
    kb.on("keydown-D", () => this.change(1));
    kb.on("keydown-ESC", () => this.leave());

    this.show();
  }

  change(step) {
    if (this.leaving) return;
    this.blip.play();
    this.index = (this.index + step + RANK_MODES.length) % RANK_MODES.length;
    this.show();
  }

  /** titolo e intestazione subito, righe quando risponde Firestore */
  async show() {
    const cfg = RANK_MODES[this.index];
    this.title.setText(t(cfg.title));
    this.pageText.setText(`${this.index + 1} / ${RANK_MODES.length}`);
    this.drawTable(cfg, []);
    this.status.setText(t("web.loading"));

    // se nel frattempo si cambia modalita' o si esce, la risposta vecchia si butta
    const id = ++this.requestId;
    const rows = await getTop(cfg.mode, cfg.sortBy, cfg.dir || "DESCENDING", ROWS);
    if (id !== this.requestId || !this.sys.isActive()) return;

    if (rows === null) this.status.setText(t("web.rank_offline"));
    else if (rows.length === 0) this.status.setText(t("web.rank_empty"));
    else this.status.setText("");
    this.drawTable(cfg, rows || []);
  }

  drawTable(cfg, rows) {
    if (this.table) this.table.destroy();
    const objs = [];
    const n = cfg.columns.length;
    const colX = (i) => TABLE_RIGHT - (n - 1 - i) * COL_STEP;
    const text = (x, y, s, tint, ox = 0) =>
      objs.push(this.add.bitmapText(x, y, "gold12", s).setOrigin(ox, 0.5).setTint(tint));

    // intestazione
    const HEAD_Y = 90;
    text(POS_X, HEAD_Y, "Pos", 0xc8c8c8);
    text(NAME_X, HEAD_Y, "Name", 0xc8c8c8);
    cfg.columns.forEach(([label], i) => text(colX(i), HEAD_Y, t(label), 0xc8c8c8, 1));

    rows.forEach((r, row) => {
      const y = ROW_Y + row * ROW_STEP;
      const tint = r.name && r.name === this.myName ? 0xffd700 : 0xffffff; // i propri punteggi in oro
      text(POS_X, y, String(row + 1), tint);
      text(NAME_X, y, String(r.name ?? "").slice(0, 16), tint);
      cfg.columns.forEach(([, field], i) => text(colX(i), y, cell(field, r[field]), tint, 1));
    });
    this.table = this.add.container(0, 0, objs);
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.blip.play();
    this.cameras.main.fadeOut(400);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("Menu"));
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    for (const b of this.buttons) b.update(dt, this.input.activePointer, this.isTouch);
  }
}
