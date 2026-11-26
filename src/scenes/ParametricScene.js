import { DEPTH } from "../config/settings.js";
import { newParametricRun } from "../core/run.js";
import { getProfile } from "../core/profile.js";
import { generateParametric } from "../math/symbolic.js";
import MathEnemy from "../entities/enemies/MathEnemy.js";
import BaseLevelScene from "./BaseLevelScene.js";

// letterale_state.py
const MAP = "Letterale_map";
const SPAWN_START = 8;         // s tra un'equazione e l'altra a inizio partita...
const SPAWN_END = 4;           // ...e a regime
const SPAWN_RAMP = 180;        // s per passare dall'uno all'altro
const ENEMY_SPEED = 28;        // px/s di caduta
const LEVEL_INTERVAL = 20;     // s prima di sbloccare equazioni con una mossa in piu'
const MAX_LEVEL = 5;
const DEADLINE_OFFSET = 20;    // la striscia rossa sta 20 px sopra il fondo della mappa
const STRIP_H = 10;
const SPAWN_MARGIN = 20;

/** Modalita' Parametrico (letterale_state.py): equazioni in x con i parametri a e b
 *  cadono dall'alto; le munizioni sono a, b, -1 e 2 con tutte e quattro le operazioni.
 *  Ogni equazione che tocca la striscia rossa sul fondo costa una vita (3 in tutto);
 *  il contatto con il player non fa danno. */
export default class ParametricScene extends BaseLevelScene {
  constructor() {
    super("Parametric");
  }

  init() {
    this.run = newParametricRun(getProfile().skin);
  }

  create() {
    const L = this.createMap(MAP);
    this.createCommon(L);
    this.computePlayBounds();
    this.deadline = this.mapH - DEADLINE_OFFSET;
    this.strip = this.add.graphics().setDepth(DEPTH.floor);

    this.spawnTimer = 0;
    this.level = 1;            // massimo numero di mosse sbloccato
    this.levelTimer = 0;
  }

  /** zona di spawn tra le pareti laterali (compute_play_bounds): si ignorano i muri
   *  larghi (il pavimento sotto la striscia) e quelli nella parte bassa della mappa */
  computePlayBounds() {
    let minX = 0;
    let maxX = this.mapW;
    for (const o of this.obstacles) {
      if (o.width >= this.mapW * 0.5 || o.y > this.mapH * 0.6) continue;
      if (o.centerX < this.mapW / 2) minX = Math.max(minX, o.right);
      else maxX = Math.min(maxX, o.x);
    }
    this.playMinX = minX + SPAWN_MARGIN;
    this.playMaxX = maxX - SPAWN_MARGIN;
    if (this.playMaxX <= this.playMinX) { this.playMinX = minX; this.playMaxX = maxX; }
  }

  /** livello del prossimo nemico: mai oltre quello sbloccato, i bassi piu' frequenti
   *  (pesi 5:4:3:2:1 a difficolta' massima) (draw_level) */
  drawLevel() {
    const weights = Array.from({ length: this.level }, (_, i) => this.level - i);
    let r = Math.random() * weights.reduce((s, w) => s + w, 0);
    for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i + 1;
    return 1;
  }

  spawnEquation() {
    const x = Phaser.Math.Between(Math.floor(this.playMinX), Math.max(Math.floor(this.playMinX) + 1, Math.floor(this.playMaxX)));
    this.enemies.push(new MathEnemy(this, x, -20, generateParametric(this.drawLevel()), 2, { speed: ENEMY_SPEED }));
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.hud.update(dt, this.input.activePointer);
    this.drawStrip(time);
    if (this.gameState !== "play" && this.gameState !== "over") return;

    const c = this.player.center;
    this.player.update(dt, this.controls.getMove(), this.controls.getAim(c), this.playerObstacles);
    this.controls.update(false);
    this.updateCharge(dt);
    this.updateBullets(dt);

    for (const e of this.enemies) {
      e.update(dt);
      if (e.dead || e.solved) continue; // risolta: si ferma
      e.y += e.speed * dt;
      e.place();
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.updateCoins(dt);
    this.drawHpBar();
    this.drawAimDots();
    if (this.gameState !== "play") return;

    this.elapsed += dt;
    // lo spawn accelera da 8 s a 4 s nei primi 3 minuti
    const k = Math.min(1, this.elapsed / SPAWN_RAMP);
    const interval = SPAWN_START + (SPAWN_END - SPAWN_START) * k;
    if (this.level < MAX_LEVEL) {
      this.levelTimer += dt;
      if (this.levelTimer >= LEVEL_INTERVAL) { this.levelTimer = 0; this.level++; }
    }
    this.spawnTimer += dt;
    if (this.spawnTimer >= interval) {
      this.spawnTimer = 0;
      this.spawnEquation();
    }

    // un'equazione non risolta che tocca la striscia rossa: via una vita (check_missed_enemies)
    for (const e of this.enemies) {
      if (!e.solved && e.hitbox.bottom >= this.deadline) {
        e.dead = true;
        e.destroy();
        this.loseLife();
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  loseLife() {
    if (this.gameState !== "play") return;
    const run = this.run;
    this.hud.blinkHeart(run.lives - 1);
    run.lives -= 1;
    if (run.lives > 0) return;
    this.gameState = "over";
    this.cameras.main.fadeOut(850);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.gameState = "done";
      this.scene.start("Stats", { mode: "parametric", score: run.score, runTime: this.elapsed });
    });
  }

  /** striscia rossa che pulsa piano: il limite da non far oltrepassare (draw_world) */
  drawStrip(time) {
    const pulse = (Math.sin(time / 300) + 1) / 2;
    this.strip.clear()
      .fillStyle(0xff2828, (70 + 40 * pulse) / 255).fillRect(0, this.deadline, this.mapW, STRIP_H)
      .fillStyle(0xff3c3c, 220 / 255).fillRect(0, this.deadline, this.mapW, 2);
  }
}
