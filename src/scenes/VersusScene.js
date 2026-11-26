import { LOGICAL_HEIGHT as H, DEPTH } from "../config/settings.js";
import { parseSympy } from "../math/sympyParse.js";
import MathText from "../ui/mathText.js";
import { shadowText } from "../core/utils.js";
import NetMatchScene from "./NetMatchScene.js";

const SPEED_CAP = 130;          // velocita' massima dopo i bonus da respawn (bullet.py)
const RESPAWN_BONUS = 1.18;
const CHEST_FRAME_TIME = 0.15;
const POWERUP_BOUNCES = [[0.34, 20], [0.18, 7], [0.10, 2]]; // (durata, altezza): versus_chest.py
const POWERUP_ICON = { move_speed: 0, bullet_speed: 1, ice: 2 }; // frame in upgrade_icons.png
const BLINK_TIME = 3;

/** Versus online (multiplayer_state3.py): ognuno ha un'equazione sopra la testa e la
 *  risolve sparando all'avversario. Chi risolve l'equazione dell'altro fa una kill;
 *  dopo 5 s il morto rinasce con un'equazione piu' difficile e un po' piu' veloce.
 *  Forzieri con equazioni lasciano power-up (velocita', proiettili veloci, ghiaccio,
 *  oppure un'operazione sulla propria equazione). */
export default class VersusScene extends NetMatchScene {
  constructor() {
    super("Versus");
  }

  create() {
    this.createNet();
    this.equations = new Map();   // pid -> MathText
    this.exprs = new Map();       // pid -> Equation (solo da mostrare: decide il server)
    this.chests = new Map();      // cid -> { sprite, text, x, y, opening, t }
    this.powerups = new Map();    // puid -> { obj, shadow, x, y, ox, oy, t, life }
    this.buffs = {};              // kind -> secondi rimanenti (solo i propri)
    this.buffIcons = [];
    this.buffKey = "";
    this.net.send("SEND_ME_EQ");
  }

  // --- equazioni sopra i giocatori ---

  setEquation(pid, str, { pop = false, onlyIfMissing = false } = {}) {
    if (onlyIfMissing && this.equations.has(pid)) return;
    const expr = parseSympy(str);
    if (!expr) return;
    this.exprs.set(pid, expr);
    let text = this.equations.get(pid);
    if (!text) {
      text = new MathText(this, 0, 0).setDepth(DEPTH.worldFx - 20);
      this.equations.set(pid, text);
    }
    text.setValue(expr);
    if (pop) this.tweens.add({ targets: text, scale: { from: 1.35, to: 1 }, duration: 140 });
  }

  // --- messaggi ---

  handleMessage(type, f) {
    if (this.handleCommon(type, f)) return;
    const pid = Number(f[0]);
    switch (type) {
      case "SPAWN_EQ": this.setEquation(pid, f[1], { onlyIfMissing: true }); break;
      case "NEW_EQ": this.setEquation(pid, f[1]); break;
      case "TAKE_VALUE": this.setEquation(pid, f[1], { pop: true }); break;
      case "DEATH": this.onDeath(pid); break;
      case "PLAYER_ALIVE": this.onAlive(pid); break;
      case "SPAWN_CHEST": this.spawnChest(pid, Number(f[1]), Number(f[2]), f[3]); break;
      case "CHEST_TAKE_VALUE": this.chestValue(pid, f[1]); break;
      case "CHEST_OPENED": this.openChest(pid); break;
      case "SPAWN_POWERUP": this.spawnPowerup(f); break;
      case "POWERUP_TAKEN": this.removePowerup(pid, true); break;
      case "POWERUP_EXPIRED": this.removePowerup(pid, false); break;
      case "BUFF_START": this.onBuff(pid, f[1], Number(f[2]), Number(f[3])); break;
      case "BUFF_END": this.onBuffEnd(pid, f[1]); break;
      case "PLAYER_SLOWED":
        // il server rallenta chi e' colpito da un proiettile di ghiaccio: lo applico anche
        // alla predizione locale, cosi' il proprio player non "scatta" indietro
        if (pid === this.myId) this.slowTimer = Number(f[1]) || 3;
        break;
      default: break;
    }
  }

  onDeath(pid) {
    if (pid === this.myId) {
      this.player.startDeath();
      this.charging = { add: null, sub: null };
      this.stopInput();
    } else {
      const o = this.others.get(pid);
      if (o) { o.dead = true; o.player.startDeath(); }
    }
  }

  onAlive(pid) {
    if (pid === this.myId) {
      this.player.revive();
      this.baseSpeed = Math.min(SPEED_CAP, Math.floor(this.baseSpeed * RESPAWN_BONUS));
    } else {
      const o = this.others.get(pid);
      if (o) { o.dead = false; o.player.revive(); }
    }
  }

  // --- forzieri ---

  spawnChest(cid, x, y, eq) {
    if (this.chests.has(cid) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const sprite = this.add.sprite(x, y, "chest", 0).setDepth(y);
    const text = new MathText(this, x, y - 20).setDepth(DEPTH.worldFx - 20);
    const chest = { sprite, text, x, y, opening: false, t: 0 };
    this.chests.set(cid, chest);
    this.chestValue(cid, eq);
  }

  chestValue(cid, eq) {
    const chest = this.chests.get(cid);
    const expr = parseSympy(eq);
    if (!chest || !expr) return;
    chest.text.setValue(expr);
    chest.text.setY(chest.y - 10 - chest.text.textH / 2);
    this.tweens.add({ targets: chest.text, scale: { from: 1.3, to: 1 }, duration: 140 });
  }

  openChest(cid) {
    const chest = this.chests.get(cid);
    if (!chest) return;
    chest.opening = true;
    chest.t = 0;
    chest.text.setVisible(false);
  }

  // --- power-up ---

  spawnPowerup(f) {
    const [puid, kind, x, y, ox, oy, label, life] = f;
    const id = Number(puid);
    let obj;
    if (POWERUP_ICON[kind] !== undefined) {
      obj = this.add.image(0, 0, "upgrade_icons", POWERUP_ICON[kind]);
    } else {
      // pickup "equazione": l'operazione scritta grande, da leggere da lontano
      obj = this.add.container(0, 0, [
        this.add.bitmapText(1, 1, "gold16", label || "?").setOrigin(0.5).setTint(0x3c1e0a),
        this.add.bitmapText(0, 0, "gold16", label || "?").setOrigin(0.5).setTint(0xfff0a0),
      ]);
    }
    const shadow = this.add.ellipse(0, 0, 12, 4, 0x000000, 0.3).setDepth(DEPTH.shadow);
    this.powerups.set(id, { obj, shadow, x: Number(x), y: Number(y), ox: Number(ox), oy: Number(oy), t: 0, life: Number(life) || 15 });
  }

  removePowerup(id, taken) {
    const pu = this.powerups.get(id);
    if (!pu) return;
    if (taken) this.coinSound.play();
    pu.obj.destroy();
    pu.shadow.destroy();
    this.powerups.delete(id);
  }

  /** rimbalzo scriptato dall'origine (il forziere) al punto di riposo deciso dal server */
  powerupPose(pu) {
    const first = POWERUP_BOUNCES[0][0];
    const k = Math.min(1, pu.t / first);
    const x = pu.ox + (pu.x - pu.ox) * k;
    const y = pu.oy + (pu.y - pu.oy) * k;
    let rest = pu.t;
    for (const [dur, height] of POWERUP_BOUNCES) {
      if (rest < dur) { const u = rest / dur; return [x, y, 4 * height * u * (1 - u)]; }
      rest -= dur;
    }
    return [x, y, 0];
  }

  // --- buff ---

  onBuff(pid, kind, duration, mult) {
    if (pid !== this.myId) return;
    this.buffs[kind] = duration || 10;
    if (kind === "move_speed") this.speedMult = mult || 1.35;
  }

  onBuffEnd(pid, kind) {
    if (pid !== this.myId) return;
    delete this.buffs[kind];
    if (kind === "move_speed") this.speedMult = 1;
  }

  // --- ciclo ---

  updateMode(dt) {
    // equazioni sopra la testa
    for (const [pid, text] of this.equations) {
      const p = this.playerOf(pid);
      if (!p) { text.setVisible(false); continue; }
      text.setVisible(true).setPosition(Math.round(p.sprite.x), Math.round(NetMatchScene.headY(p) - 2 - text.textH / 2));
    }

    for (const [cid, chest] of this.chests) {
      if (!chest.opening) continue;
      chest.t += dt;
      const frame = Math.floor(chest.t / CHEST_FRAME_TIME);
      if (frame <= 3) chest.sprite.setFrame(frame);
      if (chest.t >= CHEST_FRAME_TIME * 4 + 0.3) {
        chest.sprite.destroy();
        chest.text.destroy();
        this.chests.delete(cid);
      }
    }

    for (const pu of this.powerups.values()) {
      pu.t += dt;
      const [x, y, z] = this.powerupPose(pu);
      const blinking = pu.t >= pu.life - BLINK_TIME;
      pu.obj.setPosition(Math.round(x), Math.round(y - z)).setDepth(y)
        .setVisible(!blinking || Math.floor((pu.t - pu.life + BLINK_TIME) / 0.3) % 2 === 0);
      pu.shadow.setPosition(Math.round(x), Math.round(y + 7)).setScale(Math.max(0.5, 1 - z / 30));
    }

    // buff attivi in basso a sinistra: icona e secondi rimanenti
    for (const kind of Object.keys(this.buffs)) this.buffs[kind] = Math.max(0, this.buffs[kind] - dt);
    const key = Object.entries(this.buffs).map(([k, s]) => `${k}:${Math.ceil(s)}`).join(",");
    if (key !== this.buffKey) {
      this.buffKey = key;
      this.buffIcons.forEach((o) => o.destroy());
      this.buffIcons = [];
      Object.entries(this.buffs).forEach(([kind, secs], i) => {
        const x = 12 + i * 36;
        const y = H - 34;
        this.buffIcons.push(this.add.image(x, y, "upgrade_icons", POWERUP_ICON[kind] ?? 0).setOrigin(0, 0.5)
          .setScrollFactor(0).setDepth(DEPTH.hud));
        this.buffIcons.push(shadowText(this, x + 18, y, "gold10", `${Math.ceil(secs)}`).setOrigin(0, 0.5)
          .setScrollFactor(0).setDepth(DEPTH.hud));
      });
    }
  }
}
