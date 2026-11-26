// Connessione al server online di MathBoy (lo stesso del gioco desktop).
//
// Il server parla a righe di testo "TIPO|campo|campo" su TCP; il browser non puo' usare
// TCP, quindi passa dal ponte WebSocket sulla VPS (MathBoy2/src/network/ws_bridge.py):
// un frame WebSocket = una riga del protocollo.
//
// I messaggi ricevuti finiscono in una coda che la scena svuota nel suo update(), cosi'
// tutta la logica di gioco resta nel ciclo di Phaser (come il desktop, che li legge da
// un thread e li applica nel ciclo principale).

// indirizzo del ponte in produzione; ?server=ws://localhost:8770 lo sostituisce per i test
export const ONLINE_SERVER_URL = "wss://mathboy-game.duckdns.org/ws";

export function serverUrl() {
  const fromQuery = new URLSearchParams(window.location.search).get("server");
  return fromQuery || ONLINE_SERVER_URL;
}

export default class Connection {
  constructor(url = serverUrl()) {
    this.url = url;
    this.queue = [];
    this.status = "connecting"; // connecting | open | closed
    this.closeReason = "";
    this.ping = null;           // ms, dall'ultimo PONG
    this.ws = null;
    this.open();
  }

  open() {
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      this.status = "closed";
      this.closeReason = String(e.message || e);
      return;
    }
    this.ws = ws;
    ws.onopen = () => { this.status = "open"; };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      const parts = ev.data.split("|");
      if (parts[0] === "PONG") {
        const sent = Number(parts[1]);
        if (Number.isFinite(sent)) this.ping = Math.max(0, Math.round(performance.now() - sent));
        return;
      }
      this.queue.push(parts);
    };
    ws.onclose = (ev) => {
      this.status = "closed";
      this.closeReason = ev.reason || "";
    };
    ws.onerror = () => { /* segue sempre onclose */ };
  }

  /** messaggi arrivati dall'ultima chiamata: array di [tipo, campo, campo...] */
  drain() {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  send(type, ...args) {
    if (this.status !== "open") return;
    this.ws.send([type, ...args].join("|"));
  }

  sendPing() {
    this.send("PING", Math.round(performance.now()));
  }

  close() {
    this.status = "closed";
    try { this.ws?.close(); } catch { /* gia' chiusa */ }
  }
}
