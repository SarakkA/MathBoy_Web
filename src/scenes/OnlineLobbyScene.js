import { LOGICAL_WIDTH as W, LOGICAL_HEIGHT as H } from "../config/settings.js";
import { SKINS } from "../config/skins.js";
import { t } from "../core/i18n.js";
import { getProfile } from "../core/profile.js";
import { shadowText } from "../core/utils.js";
import Connection from "../net/connection.js";
import MenuBackground, { MenuButton } from "../ui/menuBackground.js";

const SLOT_W = 70;
const SLOT_GAP = 16;

// arene della versus: map = nome della mappa (assets/maps) e dell'arena sul server
// (MathBoy2/src/network/maps.py). Ogni arena ha la sua coda: si gioca solo con chi
// ha scelto la stessa. La coop resta sulla prima.
export const PVP_ARENAS = [
  { map: "multiplayer_map", label: "web.map_arena" },
  { map: "survivor_map", label: "web.map_lake" },
];
const CARD_W = 150;
const CARD_PREVIEW = 130;
const CARD_Y = 96;

/** Coda online (online_state.py + lobby_state.py): connessione al server, nome e
 *  modalita', attesa degli altri giocatori. Allo START passa alla partita con la
 *  stessa connessione. data.mode: "pvp" (versus) | "coop".
 *  In versus prima si sceglie l'arena, poi parte la connessione. */
export default class OnlineLobbyScene extends Phaser.Scene {
  constructor() {
    super("OnlineLobby");
  }

  init(data) {
    this.mode = data.mode === "coop" ? "coop" : "pvp";
  }

  create() {
    this.bg = new MenuBackground(this);
    this.bg.setTitleAlpha(0);
    this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0);
    this.cameras.main.fadeIn(300);
    this.input.setDefaultCursor("default");
    this.isTouch = this.registry.get("inputMode") === "touch";

    shadowText(this, W / 2, 40, "gold24", t(this.mode === "coop" ? "lobby.mode_coop" : "lobby.mode_versus")).setOrigin(0.5);
    this.status = shadowText(this, W / 2, 80, "gold12", "").setOrigin(0.5);
    this.count = shadowText(this, W / 2, 98, "gold12", "").setOrigin(0.5);
    this.slots = this.add.container(0, 0);
    this.back = new MenuButton(this, W / 2 - 50, H - 50, 100, 30, t("web.back"), { onClick: () => this.leave() });
    this.input.on("pointerdown", (p) => {
      this.isTouch = p.wasTouch;
      if (this.back.contains(p.x, p.y)) this.back.onClick();
      else if (this.cards) {
        const card = this.cards.find((c) => c.rect.contains(p.x, p.y));
        if (card) this.chooseArena(card.arena.map);
      }
    });
    this.input.keyboard.on("keydown-ESC", () => this.leave());
    this.input.keyboard.on("keydown", (e) => {
      this.isTouch = false;
      const i = ["1", "2", "3", "4"].indexOf(e.key);
      if (this.cards && this.cards[i]) this.chooseArena(this.cards[i].arena.map);
    });

    this.myId = null;
    this.role = "all";
    this.players = [];       // [{ pid, name, skin }]
    this.capacity = this.mode === "coop" ? 2 : 2;
    this.leaving = false;
    this.started = false;
    this.animT = 0;
    this.net = null;
    this.chosenMap = PVP_ARENAS[0].map;
    // la mappa su cui si gioca davvero la dice il server (MAP): un server vecchio
    // non la manda e usa sempre la prima, quindi si parte da quella
    this.serverMap = PVP_ARENAS[0].map;
    this.cards = null;

    if (this.mode === "pvp" && PVP_ARENAS.length > 1) this.showArenaChoice();
    else this.connect();
  }

  /** due riquadri con l'anteprima delle mappe: un click (o il tasto 1 / 2) sceglie */
  showArenaChoice() {
    this.status.setText(t("web.choose_map"));
    const n = PVP_ARENAS.length;
    const gap = 30;
    const x0 = W / 2 - (n * CARD_W + (n - 1) * gap) / 2;
    const last = this.registry.get("pvpMap");
    this.cards = PVP_ARENAS.map((arena, i) => {
      const x = x0 + i * (CARD_W + gap);
      const frame = this.add.rectangle(x, CARD_Y, CARD_W, CARD_PREVIEW + 36, 0x1e1e37, 0.9).setOrigin(0).setStrokeStyle(2, 0xd2d2e6);
      const img = this.add.image(x + CARD_W / 2, CARD_Y + 10 + CARD_PREVIEW / 2, `map_${arena.map}`).setDisplaySize(CARD_PREVIEW, CARD_PREVIEW);
      const label = this.add.bitmapText(x + CARD_W / 2, CARD_Y + CARD_PREVIEW + 22, "gold12", `${i + 1}. ${t(arena.label)}`).setOrigin(0.5);
      return {
        arena, frame, img, label, last: arena.map === last,
        rect: new Phaser.Geom.Rectangle(x, CARD_Y, CARD_W, CARD_PREVIEW + 36),
      };
    });
  }

  chooseArena(map) {
    if (this.leaving || this.net) return;
    this.chosenMap = map;
    this.registry.set("pvpMap", map); // ricordata per la prossima volta (evidenziata)
    this.sound.play("blip_sfx", { volume: 0.25 });
    for (const c of this.cards) [c.frame, c.img, c.label].forEach((o) => o.destroy());
    this.cards = null;
    this.connect();
  }

  connect() {
    this.status.setText(t("online.connecting"));
    this.net = new Connection();
  }

  leave() {
    if (this.leaving || this.started) return;
    this.leaving = true;
    this.net?.close();
    this.cameras.main.fadeOut(300);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("Menu"));
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.bg.update(dt);
    this.back.update(dt, this.input.activePointer, this.isTouch);
    this.animT += dt;
    if (this.cards) {
      const ptr = this.input.activePointer;
      for (const c of this.cards) {
        const hover = !this.isTouch && c.rect.contains(ptr.x, ptr.y);
        c.frame.setStrokeStyle(2, hover ? 0xc8c832 : c.last ? 0xffc800 : 0xd2d2e6);
      }
    }
    if (this.leaving || this.started || !this.net) return;

    if (this.net.status === "closed") {
      this.status.setText(this.myId === null ? t("online.conn_failed") : t("web.net_lost"));
      this.status.main.setTint(0xff6060);
      this.count.setText(this.myId === null ? t("web.server_off") : "");
      return;
    }

    const msgs = this.net.drain();
    for (let i = 0; i < msgs.length; i++) {
      const [type, ...f] = msgs[i];
      if (type === "ID") {
        this.myId = Number(f[0]);
        const profile = getProfile();
        // quinto campo: l'arena (solo versus; il server la ignora in coop)
        this.net.send("NAME", profile.name || "Player", profile.skin || 0, this.mode, this.chosenMap);
        this.status.setText(t(this.mode === "coop" ? "lobby.waiting_players" : "lobby.waiting_opponent"));
      } else if (type === "LOBBY") {
        // LOBBY|presenti|capienza|pid:nome:skin;...
        this.capacity = Number(f[1]) || this.capacity;
        this.players = (f[2] || "").split(";").filter(Boolean).map((entry) => {
          const a = entry.indexOf(":");
          const b = entry.lastIndexOf(":");
          return { pid: Number(entry.slice(0, a)), name: entry.slice(a + 1, b), skin: Number(entry.slice(b + 1)) || 0 };
        });
        this.drawSlots();
      } else if (type === "ROOM_NAMES") {
        this.players = f.map((entry) => {
          const a = entry.indexOf(":");
          const pid = Number(entry.slice(0, a));
          const old = this.players.find((p) => p.pid === pid);
          return { pid, name: entry.slice(a + 1), skin: old ? old.skin : 0 };
        });
        this.drawSlots();
      } else if (type === "SKINS") {
        this.applySkins(f[0] || "");
        this.drawSlots();
      } else if (type === "WAITING") {
        this.status.setText(t("lobby.opponent_found"));
      } else if (type === "ROLE") {
        this.role = f[0];
      } else if (type === "MODE") {
        this.mode = f[0];
      } else if (type === "MAP") {
        this.serverMap = f[0];
      } else if (type === "START") {
        this.status.setText(t("lobby.starting"));
        this.started = true;
        // i messaggi arrivati dopo lo START sono gia' della partita: li rimetto in coda
        this.net.queue = msgs.slice(i + 1).concat(this.net.queue);
        const data = {
          net: this.net, myId: this.myId, duration: Number(f[0]) || 300, role: this.role, mode: this.mode,
          map: this.serverMap,
          names: Object.fromEntries(this.players.map((p) => [p.pid, p.name])),
          skins: Object.fromEntries(this.players.map((p) => [p.pid, p.skin])),
        };
        this.cameras.main.fadeOut(300);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(this.mode === "coop" ? "Coop" : "Versus", data));
        return;
      } else if (type === "RESET") {
        this.status.setText(t("lobby.back_to_menu"));
        this.time.delayedCall(1200, () => this.leave());
      }
    }
    if (this.myId !== null) this.count.setText(`${this.players.length} / ${this.capacity}`);
    this.animateSlots(dt);
  }

  applySkins(text) {
    for (const entry of text.split(";").filter(Boolean)) {
      const [pid, skin] = entry.split(":").map(Number);
      const p = this.players.find((q) => q.pid === pid);
      if (p) p.skin = skin || 0;
    }
  }

  /** un riquadro per posto: personaggio e nome, oppure "?" se il posto e' libero */
  drawSlots() {
    this.slots.removeAll(true);
    const n = Math.max(this.capacity, this.players.length);
    const x0 = W / 2 - (n * SLOT_W + (n - 1) * SLOT_GAP) / 2;
    this.sprites = [];
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (SLOT_W + SLOT_GAP);
      const p = this.players[i];
      const me = p && p.pid === this.myId;
      this.slots.add(this.add.rectangle(x, 130, SLOT_W, 110, 0x1e1e37, 0.85).setOrigin(0).setStrokeStyle(2, me ? 0xffc800 : 0xd2d2e6));
      if (!p) {
        this.slots.add(this.add.bitmapText(x + SLOT_W / 2, 185, "gold24", "?").setOrigin(0.5).setTint(0x6464a0));
        continue;
      }
      const skin = SKINS[p.skin] || SKINS[0];
      const [tex, row] = skin.anims.idle_down;
      if (skin.shadow) this.slots.add(this.add.image(x + SLOT_W / 2, 140, "shadow").setOrigin(0.5, 0));
      const spr = this.add.sprite(x + SLOT_W / 2, 140, tex, row * skin.cols).setOrigin(0.5, 0);
      this.slots.add(spr);
      this.sprites.push({ spr, skin, row });
      this.slots.add(this.add.bitmapText(x + SLOT_W / 2, 222, "gold12", p.name).setOrigin(0.5).setTint(me ? 0xffc800 : 0xffffff));
    }
  }

  animateSlots() {
    if (!this.sprites) return;
    for (const s of this.sprites) {
      const count = s.skin.anims.idle_down[3];
      s.spr.setFrame(s.row * s.skin.cols + (Math.floor(this.animT / s.skin.frameTime) % count));
    }
  }
}
