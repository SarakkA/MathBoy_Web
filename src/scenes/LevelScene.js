import {
  LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H, CONTACT_DPS, DEATH_DURATION, ROOM_FADE_MS, CHARGE_TIME, DEPTH, Op,
} from "../config/settings.js";
import { WORLDS } from "../config/worlds.js";
import { overlaps } from "../core/utils.js";
import { t } from "../core/i18n.js";
import { newRun, selectedValue, changeValue, cycleValue, applyChestEffect } from "../core/run.js";
import InputController from "../core/input.js";
import { getProfile } from "../core/profile.js";
import { generateEnemy } from "../math/generators.js";
import Player from "../entities/Player.js";
import Bullet from "../entities/Bullet.js";
import MathEnemy from "../entities/enemies/MathEnemy.js";
import Coin from "../entities/Coin.js";
import Chest from "../entities/Chest.js";
import Door from "../entities/Door.js";
import Hud from "../ui/Hud.js";
import DialogBox from "../ui/DialogBox.js";
import { floatingReward } from "../ui/floatingReward.js";

// keyboard_letters.png (8 colonne) e mouse_input.png (13 colonne)
const KEY_FRAMES = { W: 4 * 8 + 6, A: 2 * 8 + 0, S: 4 * 8 + 2, D: 2 * 8 + 3, E: 2 * 8 + 4 };

/** Una stanza di un mondo della campagna (level_base.py + level_Z.py).
 *  Riceve la run in init(): mondo, indice della stanza e dati del player. */
export default class LevelScene extends Phaser.Scene {
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
    const L = this.cache.json.get(`map_${this.room.map}`);
    this.mapW = L.width;
    this.mapH = L.height;

    this.add.image(0, 0, `map_${this.room.map}`).setOrigin(0).setDepth(DEPTH.background);
    this.obstacles = L.obstacles.map((o) => new Phaser.Geom.Rectangle(o.x, o.y, o.width, o.height));
    const water = (L.water || []).map((o) => new Phaser.Geom.Rectangle(o.x, o.y, o.width, o.height));
    this.playerObstacles = this.obstacles.concat(water); // l'acqua ferma il player, non i proiettili

    this.door = new Door(this, L.door.x, L.door.y);
    this.chest = this.room.chest && L.chest ? new Chest(this, L.chest, this.room.chest) : null;
    if (this.room.tutorial && L.tutorial) this.createTutorial(L.tutorial);

    this.player = new Player(this, L.player.x, L.player.y, run.skin);
    this.enemies = L.enemies.map((e) => {
      const { expr, solveDelay } = generateEnemy(this.room.enemy);
      return new MathEnemy(this, e.x, e.y, expr, solveDelay);
    });
    this.bullets = [];
    this.coins = [];
    this.hpBar = this.add.graphics().setDepth(DEPTH.worldFx - 50);

    this.popFx = this.add.particles(0, 0, "px", {
      speed: { min: 60, max: 90 }, lifespan: { min: 150, max: 250 }, scale: { start: 1, end: 0.5 },
      alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(DEPTH.worldFx);
    this.debrisFx = this.add.particles(0, 0, "px", {
      speedX: { min: -40, max: 40 }, speedY: { min: -25, max: 15 }, lifespan: { min: 500, max: 900 },
      scale: { min: 0.5, max: 1 }, alpha: { start: 1, end: 0 }, tint: [0x191919, 0x2d2d2d, 0x3c3c3c],
      emitting: false,
    }).setDepth(DEPTH.shadow);

    // camera: segue il player con lerp 0.1 dentro i bordi della mappa (camera.py)
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.mapW, this.mapH);
    cam.startFollow(this.player.sprite, true, 0.1, 0.1);
    cam.setRoundPixels(true);
    cam.fadeIn(ROOM_FADE_MS);

    this.popSound = this.sound.add("pop_sfx", { volume: 0.35 });
    this.coinSound = this.sound.add("coin_sfx", { volume: 0.25 });

    this.hud = new Hud(this, run, {
      titleKey: run.room === 0 ? this.world.titleKey : null,
      playerName: getProfile().name,
    });
    this.dialog = new DialogBox(this);
    this.aimDots = this.add.graphics().setDepth(DEPTH.worldFx - 40); // mira in modalita' touch

    // input: tastiera+mouse o touch, la scena riceve solo le azioni (core/input.js)
    this.controls = new InputController(this, this.hud, {
      onFirePress: (kind) => this.firePress(kind),
      onFireRelease: (kind) => this.fireRelease(kind),
      onInteract: () => this.interact(),
      onChangeValue: (dir) => (dir === null ? cycleValue(run) : changeValue(run, dir)),
      onRestart: () => this.scene.start("Menu"),
      onToggleFps: () => this.hud.toggleFps(),
      canRestart: () => this.gameState === "lost",
    });
    this.gameState = "play"; // play | leaving | lost
    this.elapsed = 0;
    this.rush = false;
    this.deathTimer = 0;
    this.charging = { add: null, sub: null }; // secondi di pressione, null = non in carica
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

  canAct() {
    return this.gameState === "play" && !this.player.isDead && !this.player.locked;
  }

  /** tasto sinistro / bottone + ("add"), tasto destro / bottone - ("sub") premuto.
   *  Se × (o ÷) e' sbloccato parte la carica, altrimenti spara subito (level_base.py). */
  firePress(kind) {
    if (!this.canAct()) return;
    const run = this.run;
    const allowed = kind === "add" ? run.canAdd : run.canSub;
    const canCharge = kind === "add" ? run.canMul : run.canDiv;
    if (!allowed) return;
    if (canCharge) this.charging[kind] = 0;
    else this.shoot(kind === "add" ? Op.ADD : Op.SUB);
  }

  /** rilascio: carica piena -> × o ÷, altrimenti + o - */
  fireRelease(kind) {
    const t0 = this.charging[kind];
    this.charging[kind] = null;
    if (t0 === null || !this.canAct()) return;
    const full = t0 >= CHARGE_TIME;
    if (kind === "add") this.shoot(full ? Op.MUL : Op.ADD);
    else this.shoot(full ? Op.DIV : Op.SUB);
  }

  updateCharge(dt) {
    ["add", "sub"].forEach((kind, i) => {
      if (this.charging[kind] !== null && !this.canAct()) this.charging[kind] = null;
      if (this.charging[kind] !== null) this.charging[kind] += dt;
      const t0 = this.charging[kind];
      this.hud.setCharge(i, t0 === null ? 0 : Math.min(1, t0 / CHARGE_TIME));
    });
  }

  /** spara verso il mouse (desktop) o dove guarda il player (touch) */
  shoot(op) {
    if (!this.canAct()) return;
    const c = this.player.center;
    const aim = this.controls.getAim(c);
    this.bullets.push(new Bullet(this, c.x, c.y, c.x + aim.x, c.y + aim.y, op, selectedValue(this.run)));
    this.run.bulletsFired++;
  }

  /** tre puntini davanti al player: dove partira' il colpo (solo touch) */
  drawAimDots() {
    this.aimDots.clear();
    if (!this.controls.isTouch || this.player.isDead || this.gameState !== "play") return;
    const c = this.player.center;
    const aim = this.controls.getAim(c);
    const len = Math.hypot(aim.x, aim.y) || 1;
    this.aimDots.fillStyle(0xffffff, 0.5);
    for (const d of [14, 20, 26]) {
      this.aimDots.fillRect(Math.round(c.x + (aim.x / len) * d) - 1, Math.round(c.y + (aim.y / len) * d) - 1, 2, 2);
    }
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

  onEnemySolved(enemy) {
    this.debrisFx.explode(8, enemy.x, enemy.y);
    this.coins.push(new Coin(this, enemy.x, enemy.y));
    this.run.coinsSpawned++;
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

    // --- proiettili ---
    for (const b of this.bullets) {
      b.update(dt);
      const outside = b.x < -16 || b.y < -16 || b.x > this.mapW + 16 || b.y > this.mapH + 16;
      if (outside || this.obstacles.some((o) => overlaps(b.rect, o))) {
        b.destroy();
        continue;
      }
      let hit = false;
      for (const e of this.enemies) {
        if (e.solved || !overlaps(b.rect, e.hitbox)) continue;
        e.takeValue(b.value, b.op);
        this.floatingText(e.topRight, `${b.op}${b.value}`, b.color);
        hit = true;
      }
      if (hit) {
        this.popSound.play();
        this.popFx.setParticleTint(b.color);
        this.popFx.explode(6, b.x, b.y);
        b.destroy();
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);

    // --- nemici ---
    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);

    const touching = this.enemies.some((e) => !e.solved && overlaps(e.hitbox, this.player.hitbox));
    if (touching && !this.player.isDead) run.hp -= CONTACT_DPS * dt;
    this.checkDeath(dt);
    if (this.gameState !== "play") return;

    // --- monete ---
    for (const coin of this.coins) {
      if (coin.state !== "collecting" && overlaps(this.player.hitbox, coin.rect)) coin.collect();
      if (coin.update(dt, this.player.center)) {
        run.score += 1;
        this.coinSound.play();
        coin.destroy();
      }
    }
    this.coins = this.coins.filter((cn) => !cn.dead);

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

  drawHpBar() {
    const p = this.player;
    const w = 15;
    const h = 4;
    const x = Math.round(p.sprite.x - w / 2);
    const y = Math.round(p.spriteBottom);
    const ratio = Math.max(0, this.run.hp / this.run.hpMax);
    this.hpBar.clear();
    this.hpBar.fillStyle(0x780000, 0.55).fillRect(x, y, w, h);
    this.hpBar.fillStyle(0x00b400, 0.67).fillRect(x, y, Math.floor(w * ratio), h);
    this.hpBar.lineStyle(1, 0xffffff, 0.7).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  floatingText(pos, text, color) {
    const ft = this.add.bitmapText(pos.x, pos.y, "gold12", text).setOrigin(0.5).setTint(color).setDepth(DEPTH.worldFx);
    this.tweens.add({ targets: ft, y: pos.y - 14, alpha: 0, duration: 700, onComplete: () => ft.destroy() });
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
