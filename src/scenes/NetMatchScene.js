import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H, DEPTH, Op, PLAYER_SPEED } from "../config/settings.js";
import { SKINS, DEATH_FRAME_TIME, SPRITE_TOP } from "../config/skins.js";
import { t } from "../core/i18n.js";
import { newNetRun, selectedValue } from "../core/run.js";
import { getProfile } from "../core/profile.js";
import { shadowText } from "../core/utils.js";
import Player from "../entities/Player.js";
import Bullet from "../entities/Bullet.js";
import BaseLevelScene from "./BaseLevelScene.js";

export const NET_MAP = "multiplayer_map";
const OPS = { "Operation.ADD": Op.ADD, "Operation.SUB": Op.SUB, "Operation.MUL": Op.MUL, "Operation.DIV": Op.DIV };
const OP_NAMES = Object.fromEntries(Object.entries(OPS).map(([k, v]) => [v, k]));
const SNAP_DIST = 50;          // errore oltre il quale il player scatta alla posizione del server
const SOFT_DIST = 6;           // sopra: recupera il 20% dell'errore (multiplayer_state3.py)
const INPUT_KEEPALIVE = 0.1;   // s: INPUT anche senza cambi, ogni tanto
const MATCH_OVER_HOLD = 1;     // s di "match terminato" prima delle statistiche

/** Parte comune delle partite online (multiplayer_state3.py / multiplayer_coop_state.py):
 *  il server decide tutto (posizioni, colpi, soluzioni, morti); il client
 *  - prevede il proprio movimento e lo corregge con lo SNAPSHOT,
 *  - mostra gli altri giocatori dove dice lo snapshot (con un leggero ammorbidimento),
 *  - crea i proiettili quando il server li annuncia e li fa volare fino a DESTROY_BULLET,
 *  - conta alla rovescia il tempo della partita.
 *  Le sottoclassi gestiscono i messaggi della loro modalita' (handleMessage). */
export default class NetMatchScene extends BaseLevelScene {
  init(data) {
    this.net = data.net;
    this.myId = data.myId;
    this.duration = data.duration || 300;
    this.role = data.role || "all";
    this.names = { ...(data.names || {}) };
    this.skins = { ...(data.skins || {}) };
    this.run = newNetRun(getProfile().skin, this.role);
    // la mappa della stanza, decisa dal server (messaggio MAP in lobby)
    this.mapName = data.map || NET_MAP;
  }

  createNet() {
    // una mappa che questa versione non conosce: meglio quella di sempre che un crash
    const name = this.cache.json.exists(`map_${this.mapName}`) ? this.mapName : NET_MAP;
    const L = this.createMap(name);
    this.createCommon(L, {
      hud: { coins: false },
      handlers: { canRestart: () => false },
    });
    this.hpBar.setVisible(false);

    this.others = new Map();       // pid -> { player, tx, ty, state, dead, label }
    this.netBullets = new Map();   // bid -> Bullet
    this.scores = {};              // pid -> { kills, deaths }
    this.labels = new Map();       // pid -> nome sotto i piedi
    this.matchTimer = this.duration;
    this.pingTimer = 0;
    this.inputId = 0;
    this.inputTimer = 0;
    this.lastInput = "";
    this.baseSpeed = PLAYER_SPEED;
    this.speedMult = 1;
    this.slowTimer = 0;
    this.ended = false;
    this.lost = false;

    const hudText = (x, y, font) => shadowText(this, x, y, font, "").setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    this.timerText = hudText(W - 50, 8, "gold16");
    this.pingText = hudText(W - 50, 28, "gold10");
    this.kdText = hudText(W - 50, 40, "gold12");
    this.bigCount = this.add.bitmapText(W / 2, H / 2 - 40, "gold48", "").setOrigin(0.5).setScrollFactor(0)
      .setDepth(DEPTH.overlay - 1).setAlpha(0.6);
    this.banner = shadowText(this, W / 2, H / 2 - 10, "gold24", "").setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.overlay);

    this.net.send("SEND_ME_NAMES");
    this.net.sendPing();
    this.labelFor(this.myId);
  }

  // --- giocatori ---

  skinOf(pid) {
    return Number(this.skins[pid]) || 0;
  }

  /** il giocatore remoto, creato al primo snapshot (o ricreato se cambia personaggio) */
  other(pid, x = 450, y = 450) {
    let o = this.others.get(pid);
    if (o && o.skin !== this.skinOf(pid)) {
      o.player.sprite.destroy();
      o.player.shadow?.destroy();
      const p = new Player(this, o.player.center.x, o.player.center.y, this.skinOf(pid));
      o.player = p;
      o.skin = this.skinOf(pid);
      if (o.dead) p.startDeath();
    }
    if (!o) {
      o = { player: new Player(this, x, y, this.skinOf(pid)), tx: x, ty: y, state: "idle_down", dead: false, skin: this.skinOf(pid) };
      this.others.set(pid, o);
      this.labelFor(pid);
    }
    return o;
  }

  playerOf(pid) {
    return pid === this.myId ? this.player : this.others.get(pid)?.player;
  }

  labelFor(pid) {
    if (this.labels.has(pid)) this.labels.get(pid).destroy();
    const txt = this.add.bitmapText(0, 0, "gold10", this.names[pid] || "").setOrigin(0.5, 0).setAlpha(0.8)
      .setDepth(DEPTH.worldFx - 30).setTint(pid === this.myId ? 0xffe68c : 0xffffff);
    this.labels.set(pid, txt);
  }

  removeOther(pid) {
    const o = this.others.get(pid);
    if (o) {
      o.player.sprite.destroy();
      o.player.shadow?.destroy();
      this.others.delete(pid);
    }
    this.labels.get(pid)?.destroy();
    this.labels.delete(pid);
  }

  // --- input e sparo ---

  canAct() {
    return this.gameState === "play" && !this.player.isDead && !this.ended;
  }

  /** il colpo lo crea il server: qui si manda solo la richiesta (SHOOT) */
  shoot(op) {
    if (!this.canAct()) return;
    const c = this.player.center;
    const aim = this.controls.getAim(c);
    const len = Math.hypot(aim.x, aim.y) || 1;
    this.net.send("SHOOT", this.myId, c.x.toFixed(1), c.y.toFixed(1), (aim.x / len).toFixed(3), (aim.y / len).toFixed(3),
      OP_NAMES[op], selectedValue(this.run));
    this.run.bulletsFired++;
  }

  /** stato mandato al server: direzione della mira su 4 lati, idle_ se fermo */
  static stateFrom(aim, moving) {
    const d = Math.abs(aim.x) >= Math.abs(aim.y) ? (aim.x >= 0 ? "right" : "left") : (aim.y >= 0 ? "down" : "up");
    return moving ? d : `idle_${d}`;
  }

  sendInput(dt, dir, aim) {
    let dx = dir.x;
    let dy = dir.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }
    const state = NetMatchScene.stateFrom(aim, len > 0);
    const key = `${dx.toFixed(3)}|${dy.toFixed(3)}|${state}`;
    this.inputTimer += dt;
    if (key === this.lastInput && this.inputTimer < INPUT_KEEPALIVE) return;
    this.lastInput = key;
    this.inputTimer = 0;
    this.net.send("INPUT", dx.toFixed(4), dy.toFixed(4), state, this.inputId++);
  }

  stopInput() {
    this.lastInput = "";
    this.net.send("INPUT", "0.0", "0.0", "idle_down", this.inputId++);
  }

  // --- messaggi ---

  /** messaggi comuni; ritorna true se gestito */
  handleCommon(type, f) {
    switch (type) {
      case "SNAPSHOT": this.onSnapshot(f[0] || ""); return true;
      case "SPAWN_BULLET": this.onSpawnBullet(f); return true;
      case "DESTROY_BULLET": this.onDestroyBullet(Number(f[0]), f[1] === "1"); return true;
      case "SCORES":
        for (const entry of (f[0] || "").split(";").filter(Boolean)) {
          const [pid, kills, deaths] = entry.split(":").map(Number);
          this.scores[pid] = { kills, deaths };
        }
        return true;
      case "NAMES":
        for (const entry of (f[0] || "").split(";").filter(Boolean)) {
          const a = entry.indexOf(":");
          const pid = Number(entry.slice(0, a));
          this.names[pid] = entry.slice(a + 1);
          this.labelFor(pid);
        }
        return true;
      case "SKINS":
        for (const entry of (f[0] || "").split(";").filter(Boolean)) {
          const [pid, skin] = entry.split(":").map(Number);
          this.skins[pid] = skin;
          if (this.others.has(pid)) this.other(pid);
        }
        return true;
      case "PLAYER_LEFT": this.removeOther(Number(f[0])); return true;
      case "MATCH_ENDED": this.onMatchEnded(f); return true;
      case "RESET":
        // dopo MATCH_ENDED arriva sempre: va ignorato. Prima vuol dire stanza chiusa (qualcuno e' uscito)
        if (!this.ended) this.connectionLost(t("web.opponent_left"));
        return true;
      default: return false;
    }
  }

  /** le sottoclassi aggiungono i loro messaggi */
  handleMessage(type, f) {
    this.handleCommon(type, f);
  }

  onSnapshot(text) {
    for (const entry of text.split(";")) {
      if (!entry) continue;
      const [pidS, xS, yS, state] = entry.split(",");
      const pid = Number(pidS);
      const x = Number(xS);
      const y = Number(yS);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (pid === this.myId) {
        this.reconcile(x, y);
      } else {
        const o = this.other(pid, x, y);
        o.tx = x;
        o.ty = y;
        if (state) o.state = state;
      }
    }
  }

  /** correzione della predizione: scatto oltre 50 px, altrimenti recupero del 20% */
  reconcile(x, y) {
    const p = this.player;
    if (p.isDead && !this.correctWhileDead) return;
    const c = p.center;
    const ex = x - c.x;
    const ey = y - c.y;
    const err = Math.hypot(ex, ey);
    if (err > SNAP_DIST) {
      p.hitbox.x = x - p.hitbox.width / 2;
      p.hitbox.y = y - p.hitbox.height / 2;
    } else if (err > SOFT_DIST) {
      p.hitbox.x += ex * 0.2;
      p.hitbox.y += ey * 0.2;
    } else {
      return;
    }
    p.sync();
  }

  onSpawnBullet(f) {
    const [bid, x, y, dx, dy, opName, value, speed, ice] = f;
    const op = OPS[opName];
    const nx = Number(x);
    const ny = Number(y);
    if (op === undefined || !Number.isFinite(nx) || !Number.isFinite(ny)) return;
    const b = new Bullet(this, nx, ny, nx + Number(dx), ny + Number(dy), op, Number(value),
      { speed: Number(speed) || 150, effects: { ice: ice === "1" ? 1 : 0, electric: 0, fire: 0 } });
    this.netBullets.set(Number(bid), b);
  }

  onDestroyBullet(bid, hit) {
    const b = this.netBullets.get(bid);
    if (!b) return;
    this.netBullets.delete(bid);
    this.popFx.setParticleTint(b.popColor);
    this.popFx.explode(6, b.x, b.y);
    if (hit) {
      this.popSound.play();
      this.floatingText({ x: b.x, y: b.y - 8 }, `${b.op}${b.value}`, b.color);
    }
    b.destroy();
  }

  onMatchEnded(f) {
    if (this.ended) return;
    this.ended = true;
    this.gameState = "ended";
    this.stopInput();
    const rank = (f[0] || "").split(";").filter(Boolean).map((entry) => {
      const i = entry.lastIndexOf(":");
      return { name: entry.slice(0, i), deaths: Number(entry.slice(i + 1)) };
    });
    this.banner.setText(t("multiplayer.match_over"));
    this.bigCount.setText("");
    this.time.delayedCall(MATCH_OVER_HOLD * 1000, () => {
      this.net.close();
      this.cameras.main.fadeOut(400);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("Stats", this.statsData(rank, f)));
    });
  }

  statsData(rank) {
    return { mode: "versus", rank };
  }

  /** server spento o stanza chiusa: messaggio e ritorno al menu */
  connectionLost(text) {
    if (this.lost || this.ended) return;
    this.lost = true;
    this.gameState = "ended";
    this.net.close();
    this.banner.setText(text);
    this.time.delayedCall(2500, () => {
      this.cameras.main.fadeOut(400);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("Menu"));
    });
  }

  // --- ciclo ---

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.hud.update(dt, this.input.activePointer);

    for (const [type, ...f] of this.net.drain()) this.handleMessage(type, f);
    if (this.net.status === "closed" && !this.ended) this.connectionLost(t("web.net_lost"));

    // proprio player: predizione locale (il server ha comunque l'ultima parola)
    const c = this.player.center;
    const aim = this.controls.getAim(c);
    const move = this.canAct() ? this.controls.getMove() : { x: 0, y: 0 };
    if (this.slowTimer > 0) this.slowTimer = Math.max(0, this.slowTimer - dt);
    this.player.speed = this.baseSpeed * this.speedMult * (this.slowTimer > 0 ? 0.5 : 1);
    this.player.update(dt, move, aim, this.playerObstacles);
    if (this.canAct()) this.sendInput(dt, move, aim);
    this.controls.update(false);
    this.updateCharge(dt);

    for (const [bid, b] of this.netBullets) {
      b.update(dt);
      if (b.x < -60 || b.y < -60 || b.x > this.mapW + 60 || b.y > this.mapH + 60) {
        b.destroy();
        this.netBullets.delete(bid);
      }
    }
    this.updateOthers(dt);
    this.updateLabels();
    this.updateMode(dt);
    this.updateNetHud(dt);
    this.drawAimDots();
  }

  /** per le sottoclassi */
  updateMode() {}

  updateOthers(dt) {
    const k = Math.min(1, dt * 20);
    for (const o of this.others.values()) {
      const p = o.player;
      const c = p.center;
      let x = c.x + (o.tx - c.x) * k;
      let y = c.y + (o.ty - c.y) * k;
      if (Math.hypot(o.tx - c.x, o.ty - c.y) > 64) { x = o.tx; y = o.ty; }
      p.hitbox.x = x - p.hitbox.width / 2;
      p.hitbox.y = y - p.hitbox.height / 2;
      p.sync();
      if (o.dead) {
        p.state = "death";
        p.animate(dt, 1, DEATH_FRAME_TIME);
      } else {
        p.state = p.skin.anims[o.state] ? o.state : "idle_down";
        p.animate(dt, 1, p.skin.frameTime);
      }
    }
  }

  updateLabels() {
    for (const [pid, txt] of this.labels) {
      const p = this.playerOf(pid);
      if (!p) { txt.setVisible(false); continue; }
      txt.setVisible(true).setPosition(Math.round(p.sprite.x), Math.round(p.spriteBottom - 2));
    }
  }

  /** y appena sopra la testa di un giocatore (il frame ha qualche pixel vuoto in alto) */
  static headY(p) {
    return p.hitbox.centerY - SPRITE_TOP + 9;
  }

  updateNetHud(dt) {
    if (!this.ended) this.matchTimer = Math.max(0, this.matchTimer - dt);
    const s = Math.ceil(this.matchTimer);
    this.timerText.setText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
    if (!this.ended && this.matchTimer > 0 && this.matchTimer <= 10) this.bigCount.setText(String(s));
    else this.bigCount.setText("");
    if (!this.ended && this.matchTimer <= 0) this.banner.setText(t("multiplayer.match_over"));

    this.pingTimer += dt;
    if (this.pingTimer >= 1) { this.pingTimer = 0; this.net.sendPing(); }
    const ping = this.net.ping;
    if (ping !== null) {
      this.pingText.setText(`${ping} ms`);
      this.pingText.main.setTint(ping < 80 ? 0x64dc64 : ping < 150 ? 0xffdc50 : 0xff5050);
    }
    const me = this.scores[this.myId];
    this.kdText.setText(me ? this.kdLabel(me) : "");
  }

  kdLabel(me) {
    return `K ${me.kills}  D ${me.deaths}`;
  }
}

export { SKINS };
