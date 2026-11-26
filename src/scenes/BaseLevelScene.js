import { CONTACT_DPS, CHARGE_TIME, DEPTH, Op, ROOM_FADE_MS } from "../config/settings.js";
import { overlaps } from "../core/utils.js";
import { selectedValue, changeValue, cycleValue } from "../core/run.js";
import InputController from "../core/input.js";
import { getProfile } from "../core/profile.js";
import Player from "../entities/Player.js";
import Bullet from "../entities/Bullet.js";
import Coin from "../entities/Coin.js";
import Hud from "../ui/Hud.js";

/** Parte comune di tutte le modalita' giocate su una mappa (level_base.py):
 *  mappa e ostacoli, player, sparo con carica di × e ÷, proiettili, monete,
 *  danno da contatto, barra della vita, camera e input.
 *  Le sottoclassi (LevelScene per la campagna, SurvivorScene, ...) aggiungono le regole. */
export default class BaseLevelScene extends Phaser.Scene {
  /** disegna la mappa e prepara gli ostacoli; ritorna il json della mappa */
  createMap(name) {
    const L = this.cache.json.get(`map_${name}`);
    this.mapW = L.width;
    this.mapH = L.height;
    this.add.image(0, 0, `map_${name}`).setOrigin(0).setDepth(DEPTH.background);
    this.obstacles = L.obstacles.map((o) => new Phaser.Geom.Rectangle(o.x, o.y, o.width, o.height));
    const water = (L.water || []).map((o) => new Phaser.Geom.Rectangle(o.x, o.y, o.width, o.height));
    this.playerObstacles = this.obstacles.concat(water); // l'acqua ferma il player, non i proiettili
    return L;
  }

  /** player, effetti, camera, suoni, HUD e input. handlers: callback extra per InputController;
   *  hud: opzioni extra per Hud (es. { coins: false }) */
  createCommon(L, { titleKey = null, handlers = {}, hud = {} } = {}) {
    const run = this.run;
    this.player = new Player(this, L.player.x, L.player.y, run.skin);
    this.enemies = [];
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

    this.hud = new Hud(this, run, { titleKey, playerName: getProfile().name, ...hud });
    this.aimDots = this.add.graphics().setDepth(DEPTH.worldFx - 40); // mira in modalita' touch

    // input: tastiera+mouse o touch, la scena riceve solo le azioni (core/input.js)
    this.controls = new InputController(this, this.hud, {
      onFirePress: (kind) => this.firePress(kind),
      onFireRelease: (kind) => this.fireRelease(kind),
      onInteract: () => {},
      onChangeValue: (dir) => (dir === null ? cycleValue(run) : changeValue(run, dir)),
      onRestart: () => this.scene.start("Menu"),
      onToggleFps: () => this.hud.toggleFps(),
      canRestart: () => this.gameState === "lost",
      ...handlers,
    });
    this.gameState = "play";
    this.elapsed = 0;
    this.charging = { add: null, sub: null }; // secondi di pressione, null = non in carica
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

  /** opzioni del proiettile (velocita', pozioni): le sottoclassi le cambiano */
  bulletOptions() {
    return {};
  }

  /** spara verso il mouse (desktop) o dove guarda il player (touch) */
  shoot(op) {
    if (!this.canAct()) return;
    const c = this.player.center;
    const aim = this.controls.getAim(c);
    const opts = this.bulletOptions();
    this.bullets.push(new Bullet(this, c.x, c.y, c.x + aim.x, c.y + aim.y, op, selectedValue(this.run), opts));
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

  /** moneta e briciole quando un nemico sparisce (lo chiama MathEnemy) */
  onEnemySolved(enemy) {
    this.debrisFx.explode(8, enemy.x, enemy.y);
    this.coins.push(new Coin(this, enemy.x, enemy.y, this.coinLifetime));
    this.run.coinsSpawned++;
  }

  /** proiettili: muri, bordi e nemici colpiti (level_base.py bullet_enemy_collision) */
  updateBullets(dt) {
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
        this.onBulletHit(b, e);
        hit = true;
      }
      if (hit) {
        this.popSound.play();
        this.popFx.setParticleTint(b.popColor);
        this.popFx.explode(6, b.x, b.y);
        b.destroy();
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  /** dopo che un proiettile ha colpito un nemico (il Survivor applica le pozioni) */
  onBulletHit(bullet, enemy) {}

  /** 40 HP/s per ogni nemico non risolto che tocca il player (check_player_enemy_collisions) */
  applyContactDamage(dt) {
    if (this.player.isDead) return;
    const n = this.enemies.filter((e) => !e.solved && overlaps(e.hitbox, this.player.hitbox)).length;
    this.run.hp -= CONTACT_DPS * dt * n;
  }

  updateCoins(dt) {
    for (const coin of this.coins) {
      if (coin.state !== "collecting" && overlaps(this.player.hitbox, coin.rect)) coin.collect();
      if (coin.update(dt, this.player.center)) {
        this.run.score += 1;
        this.coinSound.play();
        coin.destroy();
      }
    }
    this.coins = this.coins.filter((cn) => !cn.dead);
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
}
