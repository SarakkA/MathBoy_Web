import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H, CONTACT_DPS, DEATH_DURATION, Op } from "../settings.js";
import { overlaps } from "../utils.js";
import Player from "../entities/Player.js";
import Bullet from "../entities/Bullet.js";
import EnemyNumber from "../entities/EnemyNumber.js";
import Coin from "../entities/Coin.js";
import Hud from "../ui/Hud.js";

/** Mondo Z, stanza 1 (level_Z.py + level_base.py), solo meccaniche principali:
 *  movimento, sparo +/-, nemici-numero da portare a 0, monete, vite, porta. */
export default class Level1Scene extends Phaser.Scene {
  constructor() {
    super("Level1");
  }

  preload() {
    this.load.image("bg", "assets/level1_bg.png");
    this.load.json("level", "assets/level1.json");
    this.load.spritesheet("player", "assets/player_sprite_sheet.png", { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet("coin", "assets/coin2.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("door", "assets/door.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("chest", "assets/chest.png", { frameWidth: 16, frameHeight: 16 });
    this.load.image("heart", "assets/heart.png");
    for (const size of [12, 16, 24, 32]) {
      this.load.bitmapFont(`gold${size}`, `assets/gold${size}.png`, `assets/gold${size}.xml`);
    }
    this.load.audio("pop", "assets/sfx/pop.ogg");
    this.load.audio("coin_sfx", "assets/sfx/coin.ogg");
  }

  create() {
    const L = this.cache.json.get("level");
    this.mapW = L.width;
    this.mapH = L.height;

    if (!this.textures.exists("px")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1).fillRect(0, 0, 2, 2);
      g.generateTexture("px", 2, 2);
      g.destroy();
    }

    this.add.image(0, 0, "bg").setOrigin(0).setDepth(-10);
    this.obstacles = L.obstacles.map((o) => new Phaser.Geom.Rectangle(o.x, o.y, o.width, o.height));

    // porta (chiusa finche' ci sono nemici) e baule decorativo
    this.door = {
      rect: new Phaser.Geom.Rectangle(L.door.x, L.door.y, 16, 16),
      sprite: this.add.sprite(L.door.x, L.door.y, "door", 0).setOrigin(0).setDepth(L.door.y + 16),
      open: false,
    };
    if (L.chest) this.add.image(L.chest.x, L.chest.y, "chest", 0).setOrigin(0).setDepth(L.chest.y + 16);

    // istruzioni sul pavimento
    if (L.tutorial) {
      const lines = ["Muovi con  W A S D", "Mira con il mouse", "Click sinistro: +1", "Click destro: -1"];
      this.add.bitmapText(L.tutorial.x, L.tutorial.y, "gold12", lines.join("\n\n")).setAlpha(0.47).setDepth(-5);
    }

    this.player = new Player(this, L.player.x, L.player.y);
    this.enemies = L.enemies.map((e) => new EnemyNumber(this, e.x, e.y));
    this.bullets = [];
    this.coins = [];
    this.hpBar = this.add.graphics().setDepth(900);

    // effetti
    this.popFx = this.add.particles(0, 0, "px", {
      speed: { min: 60, max: 90 }, lifespan: { min: 150, max: 250 }, scale: { start: 1, end: 0.5 },
      alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(950);
    this.debrisFx = this.add.particles(0, 0, "px", {
      speedX: { min: -40, max: 40 }, speedY: { min: -25, max: 15 }, lifespan: { min: 500, max: 900 },
      scale: { min: 0.5, max: 1 }, alpha: { start: 1, end: 0 }, tint: [0x191919, 0x2d2d2d, 0x3c3c3c],
      emitting: false,
    }).setDepth(-1);
    this.doorFx = this.add.particles(0, 0, "px", {
      x: { min: L.door.x, max: L.door.x + 16 }, y: { min: L.door.y + 10, max: L.door.y + 16 },
      speedY: { min: -25, max: -10 }, speedX: { min: -4, max: 4 }, lifespan: 900,
      scale: { min: 0.5, max: 1 }, alpha: { start: 0.9, end: 0 }, tint: 0xffd700, frequency: 40,
      emitting: false,
    }).setDepth(L.door.y + 17);

    // camera: segue il player con lerp 0.1 dentro i bordi della mappa (camera.py)
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.mapW, this.mapH);
    cam.startFollow(this.player.sprite, true, 0.1, 0.1);
    cam.setRoundPixels(true);

    // input
    this.keys = this.input.keyboard.addKeys("W,A,S,D,R,F3");
    this.keys.F3.on("down", () => this.hud.toggleFps());
    this.keys.R.on("down", () => { if (this.gameState !== "play") this.scene.restart(); });
    this.input.mouse.disableContextMenu();
    this.input.setDefaultCursor("none");
    this.input.on("pointerdown", (p) => this.onPointerDown(p));
    this.input.on("pointerup", (p) => this.hud.notifyRelease(p.button));
    this.input.on("wheel", (p, objs, dx, dy) => this.player.changeValue(dy < 0 ? 1 : -1));

    this.popSound = this.sound.add("pop", { volume: 0.35 });
    this.coinSound = this.sound.add("coin_sfx", { volume: 0.25 });

    this.hud = new Hud(this, this.player);
    this.gameState = "play"; // play | won | lost
    this.elapsed = 0;
    this.rush = false;
    this.deathTimer = 0;
  }

  mouseWorld() {
    const p = this.input.activePointer;
    return this.cameras.main.getWorldPoint(p.x, p.y);
  }

  onPointerDown(pointer) {
    this.hud.notifyClick(pointer.button);
    if (this.gameState !== "play" || this.player.isDead) return;
    let op = null;
    if (pointer.button === 0) op = Op.ADD;
    else if (pointer.button === 2) op = Op.SUB;
    if (!op) return;
    const target = this.mouseWorld();
    const c = this.player.center;
    this.bullets.push(new Bullet(this, c.x, c.y, target.x, target.y, op, this.player.selectedValue));
    this.player.bulletsFired++;
  }

  onEnemySolved(enemy) {
    this.debrisFx.explode(8, enemy.x, enemy.y);
    this.coins.push(new Coin(this, enemy.x, enemy.y));
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.hud.update(dt, this.input.activePointer);
    if (this.gameState !== "play") return;
    this.elapsed += dt;

    // --- player ---
    const k = this.keys;
    const dir = { x: 0, y: 0 };
    if (k.W.isDown) dir.y = -1; else if (k.S.isDown) dir.y = 1;
    if (k.D.isDown) dir.x = 1; else if (k.A.isDown) dir.x = -1;
    const m = this.mouseWorld();
    const c = this.player.center;
    this.player.update(dt, dir, { x: m.x - c.x, y: m.y - c.y }, this.obstacles);

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

    let touching = false;
    for (const e of this.enemies) {
      if (!e.solved && overlaps(e.hitbox, this.player.hitbox)) touching = true;
    }
    if (touching && !this.player.isDead) this.player.hp -= CONTACT_DPS * dt;
    this.checkDeath(dt);

    // --- monete ---
    for (const coin of this.coins) {
      if (coin.state !== "collecting" && overlaps(this.player.hitbox, coin.rect)) coin.collect();
      if (coin.update(dt, this.player.center)) {
        this.player.score += 1;
        this.coinSound.play();
        coin.destroy();
      }
    }
    this.coins = this.coins.filter((cn) => !cn.dead);

    // --- fine livello: tutti risolti -> velocita' doppia e porta aperta ---
    if (!this.rush && this.enemies.length === 0) {
      this.rush = true;
      this.player.speed *= 2;
      this.door.open = true;
      this.door.sprite.setFrame(1);
      this.doorFx.start();
    }
    if (this.door.open && overlaps(this.door.rect, this.player.hitbox)) this.endGame("won");

    this.drawHpBar();
  }

  checkDeath(dt) {
    const p = this.player;
    if (!p.isDead) {
      if (p.hp > 0) return;
      p.hp = 0;
      p.startDeath();
      this.deathTimer = 0;
      this.hud.blinkHeart(p.lives - 1);
      return;
    }
    this.deathTimer += dt;
    if (p.lives <= 1 && this.deathTimer >= 2) {
      p.lives = 0;
      this.endGame("lost");
    } else if (this.deathTimer >= DEATH_DURATION) {
      p.lives -= 1;
      p.revive();
    }
  }

  drawHpBar() {
    const p = this.player;
    const w = 15;
    const h = 4;
    const x = Math.round(p.sprite.x - w / 2);
    const y = Math.round(p.sprite.y + 24);
    const ratio = Math.max(0, p.hp / p.hpMax);
    this.hpBar.clear();
    this.hpBar.fillStyle(0x780000, 0.55).fillRect(x, y, w, h);
    this.hpBar.fillStyle(0x00b400, 0.67).fillRect(x, y, Math.floor(w * ratio), h);
    this.hpBar.lineStyle(1, 0xffffff, 0.7).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  floatingText(pos, text, color) {
    const t = this.add.bitmapText(pos.x, pos.y, "gold12", text).setOrigin(0.5).setTint(color).setDepth(960);
    this.tweens.add({ targets: t, y: pos.y - 14, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  endGame(result) {
    this.gameState = result;
    this.hpBar.clear();
    const fixed = (o) => o.setScrollFactor(0).setDepth(1100);
    fixed(this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0));
    const title = result === "won" ? "Livello completato!" : "Game over";
    fixed(this.add.bitmapText(W / 2, H / 2 - 50, "gold24", title).setOrigin(0.5));
    const lines = result === "won"
      ? [`Tempo: ${this.elapsed.toFixed(1)} s`, `Monete: ${this.player.score}`, `Colpi sparati: ${this.player.bulletsFired}`]
      : [`Nemici rimasti: ${this.enemies.length}`];
    lines.push("", "Premi R per rigiocare");
    fixed(this.add.bitmapText(W / 2, H / 2 + 10, "gold12", lines.join("\n"), 12, 1).setOrigin(0.5));
  }
}
