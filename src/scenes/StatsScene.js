import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H } from "../config/settings.js";
import { WORLDS } from "../config/worlds.js";
import { t } from "../core/i18n.js";
import { completeWorld } from "../core/profile.js";

const WORLD_LABELS = {
  Q: "menu.btn.world_q", ZX: "menu.btn.world_zx", QX: "menu.btn.world_qx", EQ: "menu.btn.world_eq",
  EXTRA: "stats.extra_modes",
};

/** Riepilogo a fine mondo (stats_state.py, in versione ridotta: niente voto,
 *  precisione e classifica online per ora). Sblocca il mondo successivo e torna al menu. */
export default class StatsScene extends Phaser.Scene {
  constructor() {
    super("Stats");
  }

  init(data) {
    this.run = data.run;
  }

  create() {
    const run = this.run;
    const world = WORLDS[run.world];
    const unlocked = completeWorld(world.unlocks, run.score);

    this.cameras.main.setBackgroundColor("#1e1e1e");
    this.cameras.main.fadeIn(400);
    this.input.setDefaultCursor("default");

    this.add.bitmapText(W / 2, 60, "gold32", t("stats.level_complete")).setOrigin(0.5);
    this.add.bitmapText(W / 2, 95, "gold12", t(world.titleKey)).setOrigin(0.5).setTint(0xaaaaaa);

    const lines = [
      t("stats.time", { v: `${run.runTime.toFixed(1)} s` }),
      t("stats.coins", { v: `${run.score} / ${run.coinsSpawned}` }),
      t("web.shots", { v: run.bulletsFired }),
    ];
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
}
