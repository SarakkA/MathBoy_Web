# MathBoy – versione browser

Porting graduale di MathBoy (gioco desktop in Python + pygame) nel browser, con [Phaser 3](https://phaser.io).
Non c'è nessun build step e nessuna dipendenza da installare: sono moduli JavaScript serviti così come sono.

**Stato attuale:**
- intro con nome e scelta tra i tre personaggi, poi il menu principale;
- Mondo Z completo (3 stanze) e Mondo Q completo (3 stanze, con frazioni e carica per × e ÷);
- baule e dialoghi, armi che si sbloccano, monete, vite, statistiche e sblocco del mondo successivo.

Si gioca su https://sarakka.github.io/MathBoy_Web/.

## Comandi

| Tasto | Azione |
|---|---|
| W A S D | muoversi |
| click sinistro | spara + (dopo averlo sbloccato) |
| click destro | spara − (dopo averlo sbloccato) |
| tenere premuto sinistro / destro | carica: al rilascio spara × o ÷ (dopo averli sbloccati nel Mondo Q) |
| rotella | cambia numero |
| E | apre il baule e chiude i dialoghi |
| F3 | mostra/nasconde FPS e renderer (WebGL/Canvas) |
| R | continua (game over / fine mondo: si torna al menu) |
| T tenuto premuto 2 s (menu) | sblocca tutti i mondi, come nel gioco desktop |

**Da telefono (in orizzontale):**
- **pollice sinistro:** joystick che compare dove appoggi il dito nella metà sinistra;
- **pollice destro:** bottoni + e −, che sparano nella direzione in cui guarda il player (i puntini davanti al player indicano dove). Tenendoli premuti si carica × o ÷;
- **bottone E:** compare vicino al baule;
- **valore:** si cambia toccando la pallina del numero.

I controlli touch compaiono al primo tocco e spariscono appena usi tastiera o mouse (`src/core/input.js`).

**Lingua:** si cambia toccando la bandierina nel menu, oppure con `?lang=en` nell'indirizzo (anche `es`, `fr`, `de`).

**Salvataggi:** nome, personaggio, mondi sbloccati e monete totali restano salvati nel browser (`src/core/profile.js`). Con `?unlock=all` nell'indirizzo si sbloccano tutti i mondi, comodo per i test.

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
    skins.js             i tre personaggi: fogli, righe e frame delle animazioni
    webStrings.js        stringhe che esistono solo nella versione web
  core/
    input.js             input unico: tastiera+mouse o touch, la scena riceve solo le azioni
    run.js               dati della partita che passano tra le stanze (HP, vite, armi, monete)
    profile.js           profilo salvato nel browser: nome, personaggio, mondi sbloccati
    i18n.js              traduzioni: t("chiave")
    utils.js             collisioni, palline sfumate, testo con ombra
  math/
    fraction.js          frazioni esatte (al posto di sympy.Rational)
    equations.js         generazione dei nemici per livello
  scenes/
    BootScene.js         caricamento degli asset
    IntroScene.js        titolo, nome, scelta del personaggio
    MenuScene.js         menu principale
    LevelScene.js        una stanza qualsiasi di un mondo
    StatsScene.js        riepilogo di fine mondo
  entities/              Player, Bullet, Coin, Chest, Door, enemies/
  ui/                    Hud, DialogBox, TouchControls, mathText, menuBackground, weaponIcon, floatingReward
```

**Corrispondenza con il Python:**

| Python | Web |
|---|---|
| `game_manager.py`: `data`, `treasure_config_*`, `levels_*` | `core/run.js`, `config/worlds.js` |
| `level_base.py` + `level_Z.py` | `scenes/LevelScene.js` |
| `entities/*.py`, `ui/*.py` | `entities/`, `ui/` |
| `utils/locales/*.py` | `assets/locales/*.json`, esportati in automatico |
| `intro_state.py`, `menu_state.py`, `stats_state.py` | `scenes/IntroScene.js`, `MenuScene.js`, `StatsScene.js` |
| `draw_utils.render_latex` (matplotlib) | `ui/mathText.js` |

I nomi dei file sono case-sensitive su GitHub Pages: un import scritto con maiuscole o minuscole sbagliate funziona in locale su Windows ma non online.

## Aggiungere una stanza

1. Nel progetto Python, aggiungi la mappa a `MAPS` in `tools/export_level_web.py` e lancia `python tools/export_level_web.py`.
2. Aggiungi la stanza in `src/config/worlds.js`.
3. Se i nemici sono di un tipo nuovo, aggiungi il livello in `src/math/equations.js` o una classe in `src/entities/enemies/`.

## Come sono disegnate le frazioni

Il gioco desktop disegna i nemici con LaTeX tramite matplotlib, troppo pesante per il browser. Qui c'è `ui/mathText.js`, che compone la formula con i font bitmap:
- **intero:** una riga, centrata sull'inchiostro delle cifre;
- **frazione:** numeratore e denominatore con il font più piccolo, impilati attorno a una barra di 1 px, con il segno meno davanti, come il `rac` di LaTeX.

Per impilare senza spazi vuoti serve sapere dove sta davvero l'inchiostro delle cifre dentro ogni font. Lo script di export lo misura e lo salva in `assets/fonts/metrics.json`.

Per le equazioni dei mondi successivi (es. `2x + 3/4 = 1`) basterà mettere in fila gli stessi pezzi: numeri, frazioni, simboli ed eventuali esponenti.

## Roadmap (indicativa)

1. ~~Mondo Z~~, ~~intro e menu~~, ~~Mondo Q con frazioni e carica~~.
2. Musica (pesa: va scelto se e come caricarla senza rallentare l'avvio).
3. Mondi con equazioni e polinomi (Z[x], Q[x], EQ): `mathText` diventa un piccolo impaginatore di formule.
4. Modalità extra (1 Minuto, Survivor, Parametrico).
5. Statistiche complete: precisione, voto, classifica online.
6. Multiplayer: richiede un server WebSocket, perché il browser non può usare i socket TCP del server attuale.

## Pubblicazione

Il workflow `.github/workflows/pages.yml` pubblica il repo su GitHub Pages a ogni push su `main`
(Settings → Pages → Source: "GitHub Actions"). In circa un minuto la versione nuova è online.
Ogni deploy si vede nella tab Actions; in Deployments (colonna di destra del repo) c'è il commit attualmente online.
