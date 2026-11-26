import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H } from "../config/settings.js";
import { t } from "../core/i18n.js";
import { newRun } from "../core/run.js";

/** Riepilogo a fine mondo (stats_state.py, in versione ridotta: niente voto,
 *  precisione e classifica online per ora). */
export default class StatsScene extends Phaser.Scene {
  constructor() {
    super("Stats");
  }

  init(data) {
    this.run = data.run;
  }

  create() {
    const run = this.run;
    this.cameras.main.setBackgroundColor("#1e1e1e");
    this.cameras.main.fadeIn(400);
    this.input.setDefaultCursor("default");

    this.add.bitmapText(W / 2, 70, "gold32", t("stats.level_complete")).setOrigin(0.5);
    this.add.bitmapText(W / 2, 105, "gold12", t("web.demo_end")).setOrigin(0.5).setTint(0xaaaaaa);

    const lines = [
      t("stats.time", { v: `${run.runTime.toFixed(1)} s` }),
      t("stats.coins", { v: `${run.score} / ${run.coinsSpawned}` }),
      t("web.shots", { v: run.bulletsFired }),
    ];
    this.add.bitmapText(W / 2, 170, "gold16", lines.join("\n"), 16, 1).setOrigin(0.5);
    const touch = this.registry.get("inputMode") === "touch";
    this.add.bitmapText(W / 2, H - 60, "gold12", t(touch ? "web.restart_touch" : "web.restart")).setOrigin(0.5);

    // R oppure un tocco/click qualsiasi
    const restart = () => this.scene.start("Level", { run: newRun(run.world) });
    this.input.keyboard.once("keydown-R", restart);
    this.time.delayedCall(500, () => this.input.once("pointerdown", restart));
  }
}
