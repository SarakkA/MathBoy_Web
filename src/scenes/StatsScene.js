import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H } from "../config/settings.js";
import { WORLDS } from "../config/worlds.js";
import { t } from "../core/i18n.js";
import { completeWorld, addSurvivorResult, addParametricResult, getProfile } from "../core/profile.js";
import { sendScore, MODE } from "../net/leaderboard.js";

const WORLD_LABELS = {
  Q: "menu.btn.world_q", ZX: "menu.btn.world_zx", QX: "menu.btn.world_qx", EQ: "menu.btn.world_eq",
  EXTRA: "stats.extra_modes",
};

/** "M:SS", anche oltre l'ora (draw_utils.py format_duration) */
export function formatDuration(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Riepilogo a fine partita (stats_state.py, in versione ridotta: niente voto e
 *  precisione per ora). Survivor e Parametrico inviano il punteggio alla classifica
 *  online (net/leaderboard.js); la campagna no, finche' mancano precisione e voto
 *  che le regole di Firestore richiedono.
 *  Campagna: { run }  -> sblocca il mondo successivo.
 *  Survivor: { mode: "survivor", score, runTime, level, kills } -> salva il record.
 *  Parametrico: { mode: "parametric", score, runTime } -> salva il record.
 *  Versus online: { mode: "versus", rank: [{ name, deaths }] } (classifica per morti).
 *  Coop online: { mode: "coop", teamKills, wipes }. */
export default class StatsScene extends Phaser.Scene {
  constructor() {
    super("Stats");
  }

  init(data) {
    this.data_ = data;
  }

  create() {
    const d = this.data_;
    this.cameras.main.setBackgroundColor("#1e1e1e");
    this.cameras.main.fadeIn(400);
    this.input.setDefaultCursor("default");

    let title;
    let subtitle = "";
    let lines;
    let unlocked = null;
    if (d.mode === "survivor") {
      addSurvivorResult(d.score, d.level);
      this.submit(MODE.SURVIVOR, { level: d.level, seconds: Math.floor(d.runTime), kills: d.kills ?? 0 });
      title = t("stats.survivor_complete");
      lines = [
        t("stats.coins", { v: d.score }),
        t("stats.level_reached", { v: d.level }),
        t("stats.time", { v: formatDuration(d.runTime) }),
      ];
    } else if (d.mode === "versus") {
      title = t("stats.arena_over");
      lines = (d.rank || []).map((p, i) => `${i + 1}. ${p.name} - ${p.deaths}`);
    } else if (d.mode === "coop") {
      title = t("stats.coop_over");
      lines = [t("stats.team_kills", { v: d.teamKills ?? 0 }), t("stats.team_wipes", { v: d.wipes ?? 0 })];
    } else if (d.mode === "parametric") {
      addParametricResult(d.score);
      this.submit(MODE.PARAMETRIC, { coins: d.score, seconds: Math.floor(d.runTime) });
      title = t("stats.game_over");
      lines = [
        t("stats.score", { v: d.score }),
        t("stats.time", { v: formatDuration(d.runTime) }),
      ];
    } else {
      const run = d.run;
      const world = WORLDS[run.world];
      unlocked = completeWorld(world.unlocks, run.score);
      title = t("stats.level_complete");
      subtitle = t(world.titleKey);
      lines = [
        t("stats.time", { v: `${run.runTime.toFixed(1)} s` }),
        t("stats.coins", { v: `${run.score} / ${run.coinsSpawned}` }),
        t("web.shots", { v: run.bulletsFired }),
      ];
    }

    this.add.bitmapText(W / 2, 60, "gold32", title).setOrigin(0.5);
    if (subtitle) this.add.bitmapText(W / 2, 95, "gold12", subtitle).setOrigin(0.5).setTint(0xaaaaaa);
    this.add.bitmapText(W / 2, 160, "gold16", lines.join("\n"), 16, 1).setOrigin(0.5);

    if (unlocked && WORLD_LABELS[unlocked]) {
      const msg = this.add.bitmapText(W / 2, 230, "gold16", t("stats.unlocked", { name: t(WORLD_LABELS[unlocked]) }))
        .setOrigin(0.5).setTint(0xffd700);
      this.tweens.add({ targets: msg, scale: { from: 0.6, to: 1 }, duration: 400, ease: "Back.easeOut" });
    }

    const touch = this.registry.get("inputMode") === "touch";
    this.add.bitmapText(W / 2, H - 50, "gold12", t(touch ? "web.continue_touch" : "web.continue")).setOrigin(0.5);

    // R oppure un tocco/click qualsiasi: torna al menu
    const toMenu = () => this.scene.start("Menu");
    this.input.keyboard.once("keydown-R", toMenu);
    this.time.delayedCall(500, () => this.input.once("pointerdown", toMenu));
  }

  /** punteggio alla classifica online, una volta sola per partita e senza aspettare */
  submit(mode, stats) {
    if (this.data_.submitted) return;
    this.data_.submitted = true;
    sendScore(getProfile().name, mode, stats);
  }
}
