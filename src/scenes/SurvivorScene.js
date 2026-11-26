import { LOGICAL_WIDTH as W, DEPTH } from "../config/settings.js";
import { SURVIVOR, WAVES, applyUpgrade, drawUpgrades } from "../config/survivor.js";
import { overlaps, shadowText } from "../core/utils.js";
import { newSurvivorRun } from "../core/run.js";
import { getProfile } from "../core/profile.js";
import { survivorNumber, survivorEquation } from "../math/generators.js";
import Frac from "../math/fraction.js";
import MathEnemy from "../entities/enemies/MathEnemy.js";
import Potion from "../entities/Potion.js";
import { AURA } from "../entities/Bullet.js";
import UpgradeOverlay from "../ui/UpgradeOverlay.js";
import BaseLevelScene from "./BaseLevelScene.js";

const POTIONS = ["ice", "electric", "fire"];
// icone dei potenziamenti presi, in alto a sinistra (survivor_state.py upgrade_icons)
const UPGRADE_ICONS = [
  ["speedLevel", 0], ["bulletSpeedLevel", 1], ["ice", 2], ["electric", 3], ["fire", 4],
];
const FIRE_COLORS = [0xff8c28, 0xffc83c, 0xff5a1e];

/** Modalita' Survivor (survivor_state.py): ondate infinite di numeri che inseguono il player,
 *  boss-equazione che generano minion, carte potenziamento a ogni livello e pozioni
 *  ghiaccio / elettrico / fuoco. Una vita sola: quando finisce si va alle statistiche. */
export default class SurvivorScene extends BaseLevelScene {
  constructor() {
    super("Survivor");
  }

  init() {
    this.run = newSurvivorRun(getProfile().skin);
  }

  create() {
    const L = this.createMap(SURVIVOR.map);
    this.spawnPoints = L.enemies;
    this.potionPoints = L.potions && L.potions.length ? L.potions : L.enemies;
    this.createCommon(L);
    this.player.speed = this.run.speed;
    this.coinLifetime = SURVIVOR.coinLifetime;

    // ondate
    this.waveIndex = 0;
    this.wave = WAVES[0];
    this.waveTimer = 0;
    this.spawnTimers = {};
    this.cycleScale = 1;

    // barra del livello (score_bar.py) e carte
    this.bar = { value: 0, max: SURVIVOR.scoreBarStart, level: 1, lastScore: 0 };
    this.levelUps = 0;     // game_manager.current_level_index
    this.overlay = null;

    this.potions = [];
    this.potionTimer = 0;
    this.prevPotionLevel = { ice: 0, electric: 0, fire: 0 };

    this.createSurvivorHud();
    this.createFx();
  }

  createSurvivorHud() {
    const fixed = (o) => o.setScrollFactor(0).setDepth(DEPTH.hud);
    this.timerText = shadowText(this, W - 50, 30, "gold12", "0:00").setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    this.waveText = shadowText(this, W - 50, 55, "gold12", "Wave 1").setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    this.levelText = shadowText(this, W / 2, 14, "gold12", "Level 1").setOrigin(0.5, 1).setScrollFactor(0).setDepth(DEPTH.hud);
    this.barsGfx = fixed(this.add.graphics());
    this.iconRow = [];
  }

  createFx() {
    this.fxGfx = this.add.graphics().setDepth(DEPTH.worldFx - 10);   // ghiaccio, fulmini, cerchi di fuoco
    this.auraGfx = this.add.graphics();                                // ombre colorate sotto il player
    this.iceFx = [];
    this.lightningFx = [];
    this.fireRings = [];
    this.flames = this.add.particles(0, 0, "px", {
      speedY: { min: -14, max: -6 }, speedX: { min: -3, max: 3 }, lifespan: { min: 400, max: 700 },
      scale: { start: 1, end: 0.5 }, alpha: { start: 1, end: 0 }, tint: FIRE_COLORS, emitting: false,
    }).setDepth(DEPTH.worldFx - 5);
    this.auraFx = this.add.particles(0, 0, "px", {
      speedY: { min: -20, max: -10 }, lifespan: { min: 500, max: 900 }, scale: { start: 1, end: 0.5 },
      alpha: { start: 0.7, end: 0 }, emitting: false,
    });
  }

  // --- sparo potenziato e pozioni ---

  bulletOptions() {
    const run = this.run;
    const effects = {};
    for (const k of POTIONS) effects[k] = run.potionTimer[k] > 0 ? Math.max(1, run.potionLevel[k]) : 0;
    return { speed: run.bulletSpeed, effects };
  }

  onBulletHit(bullet, enemy) {
    const fx = bullet.effects;
    if (fx.ice) this.iceSplash(bullet, enemy, fx.ice);
    if (fx.electric) this.electricChain(enemy, fx.electric);
    if (fx.fire) this.fireSplash(enemy, fx.fire);
  }

  /** rallenta il colpito e chi e' nel cono di ±60° dietro di lui (apply_ice_splash) */
  iceSplash(bullet, hit, level) {
    const radius = 30 + 20 * level;
    hit.applySlow(0.5, 3);
    for (const e of this.enemies) {
      if (e === hit || e.solved) continue;
      const ox = e.x - hit.x;
      const oy = e.y - hit.y;
      const dist = Math.hypot(ox, oy);
      if (dist > 0 && dist <= radius && (ox * bullet.dirX + oy * bullet.dirY) / dist > 0.5) e.applySlow(0.5, 3);
    }
    const base = Math.atan2(bullet.dirY, bullet.dirX);
    for (let i = 0; i < 14; i++) {
      const a = base + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-60, 60));
      const sp = 6 * Phaser.Math.FloatBetween(radius * 0.4, radius);
      this.iceFx.push({ x: hit.x, y: hit.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ttl: Phaser.Math.FloatBetween(0.4, 0.7) });
    }
  }

  /** blocca il colpito; la scarica salta al nemico piu' vicino entro 100 px, fino a 2^livello (apply_electric_chain) */
  electricChain(hit, level) {
    const maxTargets = Math.min(16, 2 ** level);
    hit.applyStop(2);
    const chained = [hit];
    let current = hit;
    while (chained.length < maxTargets) {
      let nearest = null;
      let best = Infinity;
      for (const e of this.enemies) {
        if (chained.includes(e) || e.solved) continue;
        const d = Math.hypot(e.x - current.x, e.y - current.y);
        if (d <= 100 && d < best) { nearest = e; best = d; }
      }
      if (!nearest) break;
      nearest.applyStop(2);
      this.lightningFx.push({ x1: current.x, y1: current.y, x2: nearest.x, y2: nearest.y, ttl: 0.25 });
      chained.push(nearest);
      current = nearest;
    }
  }

  /** tutti i nemici nel raggio prendono fuoco, colpito compreso (apply_fire_splash) */
  fireSplash(hit, level) {
    const radius = 30 + 20 * level;
    hit.applyBurn(3);
    for (const e of this.enemies) {
      if (e !== hit && !e.solved && Math.hypot(e.x - hit.x, e.y - hit.y) <= radius) e.applyBurn(3);
    }
    this.fireRings.push({ x: hit.x, y: hit.y, r: radius, ttl: 0.4, max: 0.4, delay: 0 });
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Phaser.Math.FloatBetween(6, radius * 0.7);
      this.fireRings.push({ x: hit.x + Math.cos(a) * d, y: hit.y + Math.sin(a) * d, r: Phaser.Math.FloatBetween(6, 12),
        ttl: 0.3, max: 0.3, delay: 0.06 + i * 0.07 });
    }
  }

  /** pozione che cade su un punto "potion" (il piu' vicino al player, o a caso) (spawn_potion) */
  spawnPotion(kind, nearest = false) {
    const c = this.player.center;
    const pool = this.potionPoints;
    const base = nearest
      ? pool.reduce((a, b) => (Math.hypot(b.x - c.x, b.y - c.y) < Math.hypot(a.x - c.x, a.y - c.y) ? b : a))
      : Phaser.Utils.Array.GetRandom(pool);
    const s = SURVIVOR.potionSpread;
    this.potions.push(new Potion(this, base.x + Phaser.Math.FloatBetween(-s, s), base.y + Phaser.Math.FloatBetween(-s, s), kind));
  }

  updatePotions(dt) {
    const run = this.run;
    // carta appena presa o livellata: pozione subito, vicino al player
    for (const k of POTIONS) {
      if (run.potionLevel[k] > this.prevPotionLevel[k]) {
        this.prevPotionLevel[k] = run.potionLevel[k];
        this.spawnPotion(k, true);
        this.potionTimer = 0;
      }
    }
    // poi una ogni tanto, tra i tipi presi (piu' livelli, piu' spesso)
    const unlocked = POTIONS.filter((k) => run.potionLevel[k] > 0);
    if (unlocked.length) {
      const total = unlocked.reduce((s, k) => s + run.potionLevel[k], 0);
      const { base, min } = SURVIVOR.potionInterval;
      const interval = Math.max(min, base - 2 * (total - 1));
      this.potionTimer += dt;
      if (this.potionTimer >= interval) {
        this.potionTimer = 0;
        const weights = unlocked.map((k) => SURVIVOR.potionWeights[k]);
        let r = Math.random() * weights.reduce((a, b) => a + b, 0);
        const kind = unlocked.find((k, i) => (r -= weights[i]) < 0) ?? unlocked[0];
        this.spawnPotion(kind);
      }
    }
    for (const p of this.potions) {
      if (p.touchable && overlaps(this.player.hitbox, p.rect)) p.collect(this.player.center);
      if (p.update(dt, this.player.center)) {
        run.potionTimer[p.kind] = SURVIVOR.potionEffect;
        this.coinSound.play();
        p.destroy();
      }
    }
    this.potions = this.potions.filter((p) => !p.dead);
    for (const k of POTIONS) if (run.potionTimer[k] > 0) run.potionTimer[k] = Math.max(0, run.potionTimer[k] - dt);
  }

  // --- ondate ---

  spawnEnemy(spawn) {
    const pos = Phaser.Utils.Array.GetRandom(this.spawnPoints);
    const values = this.run.values;
    if (spawn.enemy === "boss") {
      const expr = survivorEquation(spawn.difficulty, values);
      const boss = new MathEnemy(this, pos.x, pos.y, expr, 2, { speed: spawn.speed });
      boss.isBoss = true;
      boss.minionTimer = 0;
      boss.minionValue = expr.solution();
      this.enemies.push(boss);
    } else {
      const expr = survivorNumber(spawn.difficulty, values);
      this.enemies.push(new MathEnemy(this, pos.x, pos.y, expr, 1, { speed: spawn.speed }));
    }
  }

  /** il boss genera un numero (la sua soluzione) ogni 4 s (enemy_equation_super.py) */
  spawnMinion(boss) {
    const expr = Frac.from(boss.minionValue);
    this.enemies.push(new MathEnemy(this, boss.x, boss.y, expr, 1, { speed: SURVIVOR.minionSpeed, isMinion: true }));
  }

  updateWaves(dt) {
    // troppi nemici in campo: tempo dell'ondata e spawn fermi
    const tooMany = this.enemies.filter((e) => !e.isMinion).length >= SURVIVOR.maxEnemies;
    const eff = tooMany ? 0 : dt;
    this.waveTimer += eff;
    if (this.waveTimer >= this.wave.duration) {
      this.waveTimer = 0;
      this.waveIndex++;
      if (this.waveIndex < WAVES.length) {
        this.wave = WAVES[this.waveIndex];
      } else {
        const nf = SURVIVOR.finalWaves;
        const base = WAVES[WAVES.length - nf + ((this.waveIndex - WAVES.length) % nf)];
        this.cycleScale *= SURVIVOR.cycleRateScale;
        this.wave = { ...base, spawns: base.spawns.map((s) => ({ ...s, rate: s.rate * this.cycleScale })) };
      }
    }
    if (this.waveTimer >= this.wave.spawnPhase) return;
    this.wave.spawns.forEach((spawn, i) => {
      const key = `${spawn.enemy}_${i}`;
      this.spawnTimers[key] = (this.spawnTimers[key] || 0) + eff;
      if (this.spawnTimers[key] >= 1 / spawn.rate) {
        this.spawnTimers[key] = 0;
        this.spawnEnemy(spawn);
      }
    });
  }

  onEnemySolved(enemy) {
    super.onEnemySolved(enemy);
    this.run.kills++;
  }

  // --- livelli e carte ---

  /** monete -> barra; a barra piena si sale di livello (score_bar.py update) */
  updateScoreBar() {
    const bar = this.bar;
    bar.value += this.run.score - bar.lastScore;
    bar.lastScore = this.run.score;
    let leveled = false;
    while (bar.value >= bar.max) {
      bar.value -= bar.max;
      bar.level++;
      if (Math.random() < 0.5) bar.max++;
      leveled = true;
    }
    return leveled;
  }

  openUpgrades() {
    this.levelUps++;
    this.gameState = "upgrade";
    this.aimDots.clear();
    const cards = drawUpgrades(this.run, this.levelUps);
    this.overlay = new UpgradeOverlay(this, cards, this.levelUps, (card) => {
      if (card) applyUpgrade(this.run, card.id);
      this.player.speed = this.run.speed;
      this.overlay = null;
      this.gameState = "play";
    });
  }

  // --- ciclo ---

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const run = this.run;
    this.hud.update(dt, this.input.activePointer);

    if (this.gameState === "upgrade") {
      // in pausa si anima solo il player (update_pause)
      if (!this.player.isDead) this.player.animate(dt, 1, this.player.skin.frameTime);
      this.overlay?.update(dt, this.input.activePointer);
      this.controls.update(false);
      this.updateCharge(dt);
      return;
    }
    if (this.gameState !== "play" && this.gameState !== "dying") return;

    if (this.gameState === "play") this.elapsed += dt;
    const c = this.player.center;
    this.player.update(dt, this.controls.getMove(), this.controls.getAim(c), this.playerObstacles);
    this.controls.update(false);
    this.updateCharge(dt);

    this.updateBullets(dt);

    for (const e of this.enemies) {
      e.update(dt);
      if (e.dead) continue;
      e.updateEffects(dt);
      e.chase(dt, this.player.center, this.enemies, this.obstacles);
      if (e.isBoss) {
        e.minionTimer += dt;
        if (e.minionTimer >= SURVIVOR.bossMinionInterval) {
          e.minionTimer = 0;
          this.spawnMinion(e);
        }
      }
      if (e.burning && Math.random() < dt * 10) {
        this.flames.emitParticleAt(e.x + Phaser.Math.FloatBetween(-e.text.textW / 2, e.text.textW / 2), e.y + Phaser.Math.FloatBetween(-2, 4));
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    this.applyContactDamage(dt);
    if (this.gameState === "play") this.checkDeath();
    if (this.gameState === "play") {
      this.updateWaves(dt);
      this.updatePotions(dt);
    }
    this.updateCoins(dt);
    if (this.gameState === "play" && this.updateScoreBar()) this.openUpgrades();

    this.drawHpBar();
    this.drawAimDots();
    this.drawFx(dt);
    this.drawSurvivorHud();
  }

  /** una vita sola: animazione di morte, dissolvenza e statistiche (check_death_campagna) */
  checkDeath() {
    const run = this.run;
    if (run.hp > 0) return;
    run.hp = 0;
    this.player.startDeath();
    this.gameState = "dying";
    this.cameras.main.fadeOut(850);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.gameState = "over";
      this.scene.start("Stats", {
        mode: "survivor", score: run.score, runTime: this.elapsed, level: this.bar.level, kills: run.kills,
      });
    });
  }

  drawFx(dt) {
    const g = this.fxGfx.clear();
    // cubetti di ghiaccio che rallentano fino a sparire
    for (const p of this.iceFx) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const damp = Math.max(0, 1 - 6 * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.ttl -= dt;
      g.fillStyle(0xc8ebff, Math.min(1, p.ttl * 3)).fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
    }
    this.iceFx = this.iceFx.filter((p) => p.ttl > 0);

    // fulmini a zig-zag tra i nemici della catena
    for (const l of this.lightningFx) {
      l.ttl -= dt;
      const steps = 5;
      g.lineStyle(1, 0xfff5b4, Math.max(0, l.ttl / 0.25));
      g.beginPath().moveTo(l.x1, l.y1);
      for (let i = 1; i < steps; i++) {
        const k = i / steps;
        g.lineTo(l.x1 + (l.x2 - l.x1) * k + Phaser.Math.Between(-3, 3), l.y1 + (l.y2 - l.y1) * k + Phaser.Math.Between(-3, 3));
      }
      g.lineTo(l.x2, l.y2).strokePath();
    }
    this.lightningFx = this.lightningFx.filter((l) => l.ttl > 0);

    // cerchi di fuoco che si allargano
    for (const r of this.fireRings) {
      if (r.delay > 0) { r.delay -= dt; continue; }
      r.ttl -= dt;
      const k = 1 - Math.max(0, r.ttl) / r.max;
      g.fillStyle(0xff8c28, 0.35 * (1 - k)).fillCircle(r.x, r.y, r.r * easeOutQuad(k));
      g.lineStyle(1, 0xffc83c, 0.8 * (1 - k)).strokeCircle(r.x, r.y, r.r * easeOutQuad(k));
    }
    this.fireRings = this.fireRings.filter((r) => r.delay > 0 || r.ttl > 0);

    // ombre colorate sotto il player con una pozione attiva (ghiaccio sotto, elettrico sopra)
    const a = this.auraGfx.clear();
    const run = this.run;
    const p = this.player;
    const active = [
      ["ice", AURA.ice, 90, 40, 12], ["fire", AURA.fire, 100, 34, 10], ["electric", AURA.electric, 120, 28, 8],
    ].filter(([k]) => run.potionTimer[k] > 0);
    if (!active.length || p.isDead) return;
    const breathe = 1 + 0.06 * Math.sin(time() * 3);
    const feet = p.hitbox.bottom - 2;
    a.setDepth(p.hitbox.bottom - 0.02);
    for (const [kind, color, alpha, w, h] of active) {
      a.fillStyle(color, alpha / 255).fillEllipse(p.hitbox.centerX, feet, Math.round(w * breathe), h);
      if (Math.random() < dt * 15) {
        this.auraFx.setParticleTint(color);
        this.auraFx.setDepth(p.hitbox.bottom - 0.01);
        this.auraFx.emitParticleAt(p.hitbox.centerX + Phaser.Math.FloatBetween(-w / 2, w / 2) * 0.8, feet + Phaser.Math.FloatBetween(-h / 2, h / 2) * 0.6);
      }
    }
  }

  drawSurvivorHud() {
    const s = Math.floor(this.elapsed);
    this.timerText.setText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
    this.waveText.setText(`Wave ${this.waveIndex + 1}`);
    this.levelText.setText(`Level ${this.bar.level}`);

    const g = this.barsGfx.clear();
    // durata dell'ondata, sotto al numero
    const remaining = Math.max(0, 1 - this.waveTimer / this.wave.duration);
    g.fillStyle(0x282828, 1).fillRect(W - 100, 71, 50, 4);
    g.fillStyle(0xdcdcdc, 1).fillRect(W - 100, 71, Math.floor(50 * remaining), 4);
    // barra del livello in alto al centro
    const bw = Math.floor(W / 3);
    const bx = Math.floor((W - bw) / 2);
    g.fillStyle(0x282828, 1).fillRect(bx, 16, bw, 5);
    g.fillStyle(0xc8b428, 1).fillRect(bx, 16, Math.floor(bw * (this.bar.value / this.bar.max)), 5);
    g.lineStyle(1, 0x0f0f0f, 1).strokeRect(bx + 0.5, 16.5, bw - 1, 4);

    // potenziamenti presi: icona + livello
    const run = this.run;
    const levels = UPGRADE_ICONS.map(([k, frame]) => [run[k] ?? run.potionLevel[k], frame]).filter(([lvl]) => lvl > 0);
    const key = levels.map(([l, f]) => `${f}:${l}`).join(",");
    if (key !== this.iconKey) {
      this.iconKey = key;
      this.iconRow.forEach((o) => o.destroy());
      this.iconRow = [];
      levels.forEach(([lvl, frame], i) => {
        const x = 10 + i * 28;
        this.iconRow.push(this.add.image(x, 64, "upgrade_icons", frame).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.hud));
        this.iconRow.push(shadowText(this, x + 14, 72, "gold10", String(lvl)).setScrollFactor(0).setDepth(DEPTH.hud));
      });
    }
  }
}

const easeOutQuad = (k) => 1 - (1 - k) * (1 - k);
const time = () => performance.now() / 1000;
