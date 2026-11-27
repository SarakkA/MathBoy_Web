import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H, DEPTH } from "../config/settings.js";
import { parseSympy } from "../math/sympyParse.js";
import MathEnemy from "../entities/enemies/MathEnemy.js";
import NetMatchScene from "./NetMatchScene.js";

const KEY_E = 2 * 8 + 4;        // keyboard_letters.png
const REVIVE_RANGE = 22;        // px (coop.py), il server lo ripete con REVIVE_INFO
const WARNING_TIME = 1.2;       // s di preavviso prima che compaia un nemico

/** Coop online (multiplayer_coop_state.py): due giocatori contro ondate condivise di numeri
 *  ed equazioni. Ruoli complementari: uno ha + e ×, l'altro - e ÷, quindi molti nemici
 *  si risolvono solo insieme. Chi viene toccato va a terra e il compagno lo rianima
 *  tenendo premuto E vicino a lui; se cadono tutti e due, ondata persa ("ace"). */
export default class CoopScene extends NetMatchScene {
  constructor() {
    super("Coop");
  }

  create() {
    this.createNet();
    this.waveEnemies = new Map();  // eid -> { enemy: MathEnemy, tx, ty }
    this.warnings = [];            // { x, y, t, max, gfx, mark }
    this.downed = new Set();
    this.reviveBars = new Map();   // pid -> ratio
    this.reviveRange = REVIVE_RANGE;
    this.reviveHeld = false;
    this.spawnGfx = this.add.graphics().setDepth(DEPTH.floor);
    this.overlayGfx = this.add.graphics().setDepth(DEPTH.worldFx - 15);
    this.eMarks = new Map();       // pid -> icona E sopra il compagno a terra
    this.roleText = this.add.bitmapText(W / 2, H - 14, "gold10",
      this.role === "add_mul" ? "+  ×" : this.role === "sub_div" ? "-  ÷" : "").setOrigin(0.5).setScrollFactor(0)
      .setDepth(DEPTH.hud).setAlpha(0.7);
    this.correctWhileDead = false;

    // E tenuto premuto = rianima (il server decide vicinanza e tempo)
    this.controls.h.onInteract = () => this.setRevive(true);
    this.controls.h.onInteractRelease = () => this.setRevive(false);
  }

  setRevive(on) {
    if (on === this.reviveHeld) return;
    this.reviveHeld = on;
    this.net.send("REVIVE", on ? 1 : 0);
  }

  onPauseOpen() {
    super.onPauseOpen();
    this.setRevive(false); // il rilascio di E non arriverebbe
  }

  statsData(rank, f) {
    return { mode: "coop", teamKills: Number(f[1]) || 0, wipes: Number(f[2]) || 0 };
  }

  kdLabel(me) {
    return `K ${me.kills}  D ${me.deaths}`;
  }

  // --- messaggi ---

  handleMessage(type, f) {
    if (this.handleCommon(type, f)) return;
    const id = Number(f[0]);
    switch (type) {
      case "WAVE_SPAWN_POINTS": this.drawSpawnPoints(f[0] || ""); break;
      case "REVIVE_INFO": this.reviveRange = Number(f[0]) || REVIVE_RANGE; break;
      case "WAVE_SPAWN_WARNING": this.addWarning(Number(f[0]), Number(f[1]), Number(f[2]) || WARNING_TIME); break;
      case "SPAWN_WAVE_ENEMY": this.spawnWaveEnemy(id, f[2], Number(f[5]), Number(f[6])); break;
      case "WAVE_SNAPSHOT": this.onWaveSnapshot(f[0] || ""); break;
      case "WAVE_ENEMY_TAKE_VALUE": this.waveEnemyValue(id, f[1]); break;
      case "WAVE_ENEMY_SOLVED": this.removeWaveEnemy(id, true); break;
      case "WAVE_ENEMIES_CLEAR":
        for (const eid of [...this.waveEnemies.keys()]) this.removeWaveEnemy(eid, false);
        this.warnings.forEach((w) => { w.gfx.destroy(); w.mark.destroy(); });
        this.warnings = [];
        break;
      case "DOWN": this.setDown(id, true); break;
      case "REVIVED": this.setDown(id, false); break;
      case "REVIVE_PROGRESS": {
        const reviver = Number(f[1]);
        const ratio = Number(f[2]);
        if (reviver < 0 || !(ratio > 0)) this.reviveBars.delete(id);
        else this.reviveBars.set(id, ratio);
        break;
      }
      case "DEATH": this.setDown(id, true); break;          // squadra spazzata via
      case "PLAYER_ALIVE": this.setDown(id, false); break;  // rinascita dopo l'ace
      default: break;
    }
  }

  drawSpawnPoints(text) {
    this.spawnGfx.clear();
    for (const entry of text.split(";").filter(Boolean)) {
      const [x, y] = entry.split(",").map(Number);
      this.spawnGfx.fillStyle(0x000000, 0.15).fillEllipse(x, y + 4, 22, 9);
      this.spawnGfx.lineStyle(1, 0x501414, 0.35).strokeEllipse(x, y + 4, 22, 9);
    }
  }

  addWarning(x, y, time) {
    const gfx = this.add.graphics().setDepth(DEPTH.worldFx - 25);
    const mark = this.add.bitmapText(x, y - 1, "gold16", "!").setOrigin(0.5).setTint(0xff3c3c).setDepth(DEPTH.worldFx - 24).setVisible(false);
    this.warnings.push({ x, y, t: time, max: time, gfx, mark });
  }

  spawnWaveEnemy(eid, str, x, y) {
    const expr = parseSympy(str);
    if (!expr || this.waveEnemies.has(eid)) return;
    const enemy = new MathEnemy(this, x, y, expr, 1);
    this.waveEnemies.set(eid, { enemy, tx: x, ty: y });
  }

  onWaveSnapshot(text) {
    for (const entry of text.split(";").filter(Boolean)) {
      const [eid, x, y] = entry.split(",").map(Number);
      const we = this.waveEnemies.get(eid);
      if (we && Number.isFinite(x) && Number.isFinite(y)) { we.tx = x; we.ty = y; }
    }
  }

  waveEnemyValue(eid, str) {
    const we = this.waveEnemies.get(eid);
    const expr = parseSympy(str);
    if (!we || !expr) return;
    const e = we.enemy;
    e.expr = expr;
    e.refresh();
    this.tweens.add({ targets: e.text, scale: { from: 1.35, to: 1 }, duration: 140 });
    // risolto (lo decide il server: qui solo il colore, poi arriva WAVE_ENEMY_SOLVED)
    if (expr.isSolved()) { e.solved = true; e.text.setColor(0x2e6b1f); }
  }

  removeWaveEnemy(eid, solved) {
    const we = this.waveEnemies.get(eid);
    if (!we) return;
    if (solved) this.debrisFx.explode(8, we.enemy.x, we.enemy.y);
    we.enemy.destroy();
    this.waveEnemies.delete(eid);
  }

  setDown(pid, down) {
    if (down) this.downed.add(pid);
    else { this.downed.delete(pid); this.reviveBars.delete(pid); }
    if (pid === this.myId) {
      if (down) {
        this.player.startDeath();
        this.charging = { add: null, sub: null };
        this.stopInput();
        this.setRevive(false);
      } else {
        this.player.revive();
      }
    } else {
      const o = this.others.get(pid);
      if (o) {
        o.dead = down;
        if (down) o.player.startDeath();
        else o.player.revive();
      }
    }
  }

  // --- ciclo ---

  updateMode(dt) {
    // nemici: verso la posizione dello snapshot (30 Hz), con un leggero ammorbidimento
    const k = Math.min(1, dt * 15);
    for (const we of this.waveEnemies.values()) {
      const e = we.enemy;
      e.x += (we.tx - e.x) * k;
      e.y += (we.ty - e.y) * k;
      e.place();
    }

    for (const w of this.warnings) {
      w.t -= dt;
      const r = 4 + 12 * Math.max(0, w.t / w.max);
      w.gfx.clear().lineStyle(2, 0xff3c3c, 0.8).strokeCircle(w.x, w.y, r);
      w.mark.setVisible(w.t <= 0.5);
    }
    this.warnings = this.warnings.filter((w) => {
      if (w.t > 0) return true;
      w.gfx.destroy();
      w.mark.destroy();
      return false;
    });

    // compagni a terra: E lampeggiante sopra (anche dal bordo dello schermo) e barra della rianimazione
    const g = this.overlayGfx.clear();
    const cam = this.cameras.main;
    for (const [pid, mark] of this.eMarks) {
      if (!this.downed.has(pid)) { mark.destroy(); this.eMarks.delete(pid); }
    }
    for (const pid of this.downed) {
      if (pid === this.myId) continue;
      const p = this.playerOf(pid);
      if (!p) continue;
      let mark = this.eMarks.get(pid);
      if (!mark) {
        mark = this.add.image(0, 0, "keys", KEY_E).setScrollFactor(0).setDepth(DEPTH.hud - 1);
        this.eMarks.set(pid, mark);
      }
      const sx = Phaser.Math.Clamp(p.sprite.x - cam.worldView.x, 12, W - 12);
      const sy = Phaser.Math.Clamp(NetMatchScene.headY(p) - 8 - cam.worldView.y, 12, H - 12);
      mark.setPosition(Math.round(sx), Math.round(sy)).setVisible(Math.floor(this.time.now / 300) % 2 === 0);
      const ratio = this.reviveBars.get(pid);
      if (ratio) {
        const x = Math.round(p.sprite.x - 12);
        const y = Math.round(NetMatchScene.headY(p) - 2);
        g.fillStyle(0x282828, 0.8).fillRect(x, y, 24, 4);
        g.fillStyle(0x64dc64, 1).fillRect(x, y, Math.round(24 * Math.min(1, ratio)), 4);
      }
    }

    // bottone E su telefono: solo vicino a un compagno a terra
    const near = !this.player.isDead && [...this.downed].some((pid) => {
      const p = this.playerOf(pid);
      return pid !== this.myId && p && Math.hypot(p.center.x - this.player.center.x, p.center.y - this.player.center.y) <= this.reviveRange + 20;
    });
    this.controls.update(near);
    if (!near && this.reviveHeld && this.controls.isTouch) this.setRevive(false);
  }
}

