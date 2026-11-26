import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H, DEATH_DURATION, ROOM_FADE_MS, DEPTH } from "../config/settings.js";
import { WORLDS } from "../config/worlds.js";
import { overlaps } from "../core/utils.js";
import { t } from "../core/i18n.js";
import { newRun, applyChestEffect } from "../core/run.js";
import { generateEnemy } from "../math/generators.js";
import MathEnemy from "../entities/enemies/MathEnemy.js";
import Chest from "../entities/Chest.js";
import Door from "../entities/Door.js";
import DialogBox from "../ui/DialogBox.js";
import { floatingReward } from "../ui/floatingReward.js";
import BaseLevelScene from "./BaseLevelScene.js";

// keyboard_letters.png (8 colonne) e mouse_input.png (13 colonne)
const KEY_FRAMES = { W: 4 * 8 + 6, A: 2 * 8 + 0, S: 4 * 8 + 2, D: 2 * 8 + 3, E: 2 * 8 + 4 };

/** Una stanza di un mondo della campagna (level_base.py + level_Z.py).
 *  Riceve la run in init(): mondo, indice della stanza e dati del player. */
export default class LevelScene extends BaseLevelScene {
  constructor() {
    super("Level");
  }

  init(data) {
    this.run = data.run || newRun();
    this.world = WORLDS[this.run.world];
    this.room = this.world.rooms[this.run.room];
  }

  create() {
    const run = this.run;
    const L = this.createMap(this.room.map);

    this.door = new Door(this, L.door.x, L.door.y);
    this.chest = this.room.chest && L.chest ? new Chest(this, L.chest, this.room.chest) : null;
    if (this.room.tutorial && L.tutorial) this.createTutorial(L.tutorial);

    this.createCommon(L, {
      titleKey: run.room === 0 ? this.world.titleKey : null,
      handlers: { onInteract: () => this.interact() },
    });
    this.enemies = L.enemies.map((e) => {
      const { expr, solveDelay } = generateEnemy(this.room.enemy);
      return new MathEnemy(this, e.x, e.y, expr, solveDelay);
    });
    this.dialog = new DialogBox(this);
    this.rush = false;
    this.deathTimer = 0;
  }

  /** scritte e tasti a terra della prima stanza (level_Z.py load_ground_instructions) */
  createTutorial(pos) {
    const lines = [t("tutorial.move"), t("tutorial.aim"), t("tutorial.interact")];
    const measure = this.add.bitmapText(0, 0, "gold12", "");
    const [wMove, wAim, wInteract] = lines.map((l) => measure.setText(l).width);
    measure.destroy();
    this.add.bitmapText(pos.x, pos.y, "gold12", lines.join("\n\n")).setAlpha(120 / 255).setDepth(DEPTH.floor);

    // ogni icona si aggancia alla fine della sua riga
    const PAD = 5, SP = 12, HALF = 8;
    const move = pos.x + wMove + PAD + SP + HALF;
    const icons = [
      ["keys", KEY_FRAMES.W, move, pos.y],
      ["keys", KEY_FRAMES.A, move - SP, pos.y + SP],
      ["keys", KEY_FRAMES.S, move, pos.y + SP],
      ["keys", KEY_FRAMES.D, move + SP, pos.y + SP],
      ["mouse", 0, pos.x + wAim + PAD + HALF, pos.y + 2 * SP + 5],
      ["keys", KEY_FRAMES.E, pos.x + wInteract + PAD + HALF, pos.y + 4 * SP + 5],
    ];
    for (const [tex, frame, x, y] of icons) this.add.image(x, y, tex, frame).setDepth(DEPTH.floor + 1);
  }

  /** tasto E (level_Z.py handle_specific_event) */
  interact() {
    const chest = this.chest;
    if (!chest || this.gameState !== "play" || this.player.isDead) return;
    if (!overlaps(this.player.hitbox, chest.area)) return;
    chest.hidePrompt();

    if (!chest.opened) {
      if (!chest.animating) {
        chest.startOpening();
        this.player.lockFacing(chest.center.x, chest.center.y);
      }
      return;
    }
    if (!this.dialog.active) {
      this.openChestDialog(chest.read);
    } else if (this.dialog.finished) {
      this.dialog.close();
      this.player.locked = false;
    }
  }

  openChestDialog(instant) {
    const cfg = this.chest.config;
    this.dialog.open(t(cfg.dialogKey), cfg.mouse, instant);
    this.chest.read = true;
    this.player.lockFacing(this.chest.center.x, this.chest.center.y);
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.hud.update(dt, this.input.activePointer);
    this.dialog.update(dt);
    if (this.gameState !== "play") return;
    this.elapsed += dt;
    const run = this.run;

    // --- player ---
    const c = this.player.center;
    this.player.update(dt, this.controls.getMove(), this.controls.getAim(c), this.playerObstacles);
    const nearChest = this.chest && !this.player.isDead && overlaps(this.player.hitbox, this.chest.area);
    this.controls.update(Boolean(nearChest || this.dialog.active));
    this.updateCharge(dt);

    // --- baule ---
    if (this.chest) {
      this.chest.update(dt);
      if (this.chest.justOpened) {
        this.chest.justOpened = false;
        applyChestEffect(run, this.chest.config.effect);
        this.openChestDialog(false);
        floatingReward(this, this.chest.center.x, this.chest.center.y, this.chest.config.icon);
      }
    }

    this.updateBullets(dt);

    // --- nemici ---
    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);

    this.applyContactDamage(dt);
    this.checkDeath(dt);
    if (this.gameState !== "play") return;

    this.updateCoins(dt);

    // --- fine stanza: nemici finiti -> velocita' doppia; porta aperta se anche il baule e' aperto ---
    if (!this.rush && this.enemies.length === 0) {
      this.rush = true;
      this.player.speed *= 2;
    }
    const chestDone = !this.world.doorNeedsChest || !this.chest || this.chest.opened;
    if (!this.door.isOpen && this.enemies.length === 0 && chestDone) this.door.open();
    if (this.door.touches(this.player.hitbox)) this.leaveRoom();

    this.drawHpBar();
    this.drawAimDots();
  }

  checkDeath(dt) {
    const p = this.player;
    const run = this.run;
    if (!p.isDead) {
      if (run.hp > 0) return;
      run.hp = 0;
      p.startDeath();
      this.dialog.close();
      p.locked = false;
      this.deathTimer = 0;
      this.hud.blinkHeart(run.lives - 1);
      return;
    }
    this.deathTimer += dt;
    if (run.lives <= 1 && this.deathTimer >= 2) {
      run.lives = 0;
      this.showGameOver();
    } else if (run.lives > 1 && this.deathTimer >= DEATH_DURATION) {
      run.lives -= 1;
      run.hp = run.hpMax;
      p.revive();
    }
  }

  /** porta: salva i dati e passa alla stanza dopo (level_Z.py load_next_state) */
  leaveRoom() {
    this.gameState = "leaving";
    this.hpBar.clear();
    this.aimDots.clear();
    const run = this.run;
    run.runTime += this.elapsed;
    run.room += 1;
    this.cameras.main.fadeOut(ROOM_FADE_MS);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      if (run.room >= this.world.rooms.length) this.scene.start("Stats", { run });
      else this.scene.restart({ run });
    });
  }

  showGameOver() {
    this.gameState = "lost";
    this.hpBar.clear();
    this.aimDots.clear();
    const fixed = (o) => o.setScrollFactor(0).setDepth(DEPTH.overlay);
    fixed(this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0));
    fixed(this.add.bitmapText(W / 2, H / 2 - 40, "gold24", t("stats.game_over")).setOrigin(0.5));
    const restart = t(this.controls.isTouch ? "web.continue_touch" : "web.continue");
    const lines = [t("web.enemies_left", { v: this.enemies.length }), "", restart];
    fixed(this.add.bitmapText(W / 2, H / 2 + 10, "gold12", lines.join("\n"), 12, 1).setOrigin(0.5));
  }
}
