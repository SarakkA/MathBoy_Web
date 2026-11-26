# MathBoy – versione browser

Porting graduale di MathBoy (gioco desktop in Python + pygame) nel browser, con [Phaser 3](https://phaser.io).
Non c'è nessun build step e nessuna dipendenza da installare: sono moduli JavaScript serviti così come sono.

**Stato attuale:** Mondo Z, stanze 1 e 2. Ci sono baule e dialoghi, armi che si sbloccano, nemici-numero, monete, vite e statistiche finali.

Si gioca su https://sarakka.github.io/MathBoy_Web/.

## Comandi

| Tasto | Azione |
|---|---|
| W A S D | muoversi |
| click sinistro | spara + (dopo averlo sbloccato) |
| click destro | spara − (dopo averlo sbloccato) |
| rotella | cambia numero |
| E | apre il baule e chiude i dialoghi |
| F3 | mostra/nasconde FPS e renderer (WebGL/Canvas) |
| R | rigioca (game over / fine) |

**Da telefono (in orizzontale):**
- **pollice sinistro:** joystick che compare dove appoggi il dito nella metà sinistra;
- **pollice destro:** bottoni + e −, che sparano nella direzione in cui guarda il player (i puntini davanti al player indicano dove);
- **bottone E:** compare vicino al baule;
- **valore:** si cambia toccando la pallina del numero.

I controlli touch compaiono al primo tocco e spariscono appena usi tastiera o mouse (`src/core/input.js`).

Per cambiare lingua si aggiunge `?lang=en` all'indirizzo (anche `es`, `fr`, `de`). La scelta resta salvata nel browser.

## Provarlo in locale

I moduli JS non funzionano aprendo il file con doppio click: serve un server locale. Dalla cartella del progetto:

```
python -m http.server 8000
```

Poi apri http://localhost:8000.

## Struttura

```
index.html
lib/phaser.min.js        Phaser 3.90, copiato nel repo: le reti scolastiche spesso bloccano le CDN
assets/                  generati dal progetto Python (tools/export_level_web.py), non modificare a mano
  maps/                  <mappa>.png (terreno) + <mappa>.json (oggetti Tiled)
  sprites/  sfx/  fonts/ font bitmap ricavati da Gold.ttf
  locales/               traduzioni esportate dai locale Python
src/
  main.js                configurazione di Phaser
  config/
    settings.js          costanti prese dal gioco Python (velocità, HP, danni, profondità)
    worlds.js            mondi e stanze: mappa, livello dei nemici, contenuto del baule
    webStrings.js        stringhe che esistono solo nella versione web
  core/
    input.js             input unico: tastiera+mouse o touch, la scena riceve solo le azioni
    run.js               dati della partita che passano tra le stanze (HP, vite, armi, monete)
    i18n.js              traduzioni: t("chiave")
    utils.js             collisioni, palline sfumate, testo con ombra
  math/equations.js      generazione dei nemici per livello
  scenes/
    BootScene.js         caricamento degli asset
    LevelScene.js        una stanza qualsiasi di un mondo
    StatsScene.js        riepilogo di fine mondo
  entities/              Player, Bullet, Coin, Chest, Door, enemies/
  ui/                    Hud, DialogBox, TouchControls, weaponIcon, floatingReward
```

**Corrispondenza con il Python:**

| Python | Web |
|---|---|
| `game_manager.py`: `data`, `treasure_config_*`, `levels_*` | `core/run.js`, `config/worlds.js` |
| `level_base.py` + `level_Z.py` | `scenes/LevelScene.js` |
| `entities/*.py`, `ui/*.py` | `entities/`, `ui/` |
| `utils/locales/*.py` | `assets/locales/*.json`, esportati in automatico |

I nomi dei file sono case-sensitive su GitHub Pages: un import scritto con maiuscole o minuscole sbagliate funziona in locale su Windows ma non online.

## Aggiungere una stanza

1. Nel progetto Python, aggiungi la mappa a `MAPS` in `tools/export_level_web.py` e lancia `python tools/export_level_web.py`.
2. Aggiungi la stanza in `src/config/worlds.js`.
3. Se i nemici sono di un tipo nuovo, aggiungi il livello in `src/math/equations.js` o una classe in `src/entities/enemies/`.

## Roadmap (indicativa)

1. ~~Mondo Z stanza 1~~, ~~baule e stanza 2~~, poi la stanza 3: valore 2 e rotella.
2. Intro (nome e personaggio) e menu, come nuove scene.
3. Mondo Q: carica per × e ÷, frazioni. Serve una piccola libreria di frazioni al posto di sympy.
4. Mondi con equazioni e polinomi (Z[x], Q[x], EQ).
5. Statistiche complete: precisione, voto, classifica online.
6. Multiplayer: richiede un server WebSocket, perché il browser non può usare i socket TCP del server attuale.

## Pubblicazione

Il workflow `.github/workflows/pages.yml` pubblica il repo su GitHub Pages a ogni push su `main`
(Settings → Pages → Source: "GitHub Actions"). In circa un minuto la versione nuova è online.
Ogni deploy si vede nella tab Actions; in Deployments (colonna di destra del repo) c'è il commit attualmente online.
