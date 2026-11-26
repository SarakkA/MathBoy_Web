# MathBoy – versione browser

Porting graduale di MathBoy (gioco desktop in Python + pygame) nel browser, con [Phaser 3](https://phaser.io).
Non c'è nessun build step e nessuna dipendenza da installare: sono moduli JavaScript serviti così come sono.

**Stato attuale:**
- intro con nome e scelta tra i tre personaggi, poi il menu principale;
- tutti e cinque i mondi della storia, 3 stanze ciascuno:
  - Z e Q: numeri interi e frazioni, carica per × e ÷;
  - Z[x] e Q[x]: polinomi di primo grado da portare a "x";
  - Eqz: equazioni di primo grado da portare a "x = numero";
- baule e dialoghi, armi che si sbloccano, monete, vite, statistiche e sblocco del mondo successivo;
- modalità **Survivor**: ondate infinite, boss-equazione con minion, carte potenziamento a ogni livello, pozioni ghiaccio / elettrico / fuoco;
- modalità **Parametrico**: equazioni con i parametri a e b che cadono dall'alto, munizioni a, b, −1, 2; si perde una vita se toccano la striscia rossa;
- **multiplayer online**, Sfida (versus) e Coop, sullo stesso server del gioco desktop: chi gioca dal browser e chi dal .exe finiscono nelle stesse partite;
- pagina dei **crediti**.

Per ora è tutto già sbloccato, per poter provare subito ogni modalità: `UNLOCK_EVERYTHING` in `src/core/profile.js` (rimettere a `false` per tornare alla progressione normale).

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
| ESC (crediti, coda online) | torna al menu |
| E tenuto premuto (coop) | rianima il compagno a terra |

**Da telefono (in orizzontale):**
- **pollice sinistro:** joystick che compare dove appoggi il dito nella metà sinistra;
- **pollice destro:** bottoni + e −, che sparano nella direzione in cui guarda il player (i puntini davanti al player indicano dove). Tenendoli premuti si carica × o ÷;
- **bottone E:** compare vicino al baule;
- **valore:** si cambia toccando la pallina del numero;
- **carte del Survivor:** si toccano la carta e poi "Conferma".

I controlli touch compaiono al primo tocco e spariscono appena usi tastiera o mouse (`src/core/input.js`).

**Lingua:** si cambia toccando la bandierina nel menu, oppure con `?lang=en` nell'indirizzo (anche `es`, `fr`, `de`).

**Salvataggi:** nome, personaggio, mondi sbloccati, monete totali e livello record del Survivor restano salvati nel browser (`src/core/profile.js`). Con `?unlock=all` nell'indirizzo si sbloccano tutti i mondi, comodo per i test.

## Multiplayer online

Il server è quello del gioco desktop (`server_online.py`, nel progetto Python), che gira sulla VPS e decide tutto: posizioni, colpi, soluzioni, morti. Il browser non può aprire connessioni TCP, quindi sulla VPS c'è un piccolo ponte WebSocket (`ws_bridge.py`) con Caddy davanti per l'https:

```
browser --wss://mathboy.duckdns.org/ws--> Caddy --> ws_bridge.py --tcp--> server_online.py <--tcp-- .exe
```

- L'indirizzo è in `src/net/connection.js` (`ONLINE_SERVER_URL`); per provare in locale si aggiunge `?server=ws://localhost:8770` all'indirizzo del gioco.
- Le istruzioni per la VPS (ponte, Caddy, DuckDNS, protezioni) stanno nel progetto Python: `tools/DEPLOY_ONLINE.md`.
- Le formule arrivano dal server come testo sympy (`Eq(x + 10, 0)`) e le legge `src/math/sympyParse.js`, un parser scritto a mano: niente `eval` su testo che arriva dalla rete. `tests/sympyParse.mjs` lo verifica su 400 formule generate dal server.

Per provarlo tutto in locale (nella cartella `src/network` del progetto Python):

```
python server_online.py --duration 60
python ws_bridge.py
```

poi due finestre del browser su `http://localhost:8765/?server=ws://localhost:8770`, menu → MultiPlayer.

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
    survivor.js          Survivor: ondate, carte potenziamento, pozioni
    skins.js             i tre personaggi: fogli, righe e frame delle animazioni
    webStrings.js        stringhe che esistono solo nella versione web
  core/
    input.js             input unico: tastiera+mouse o touch, la scena riceve solo le azioni
    run.js               dati della partita (HP, vite, armi, monete; nel Survivor anche i potenziamenti)
    profile.js           profilo salvato nel browser: nome, personaggio, mondi sbloccati, record
  net/
    connection.js        connessione WebSocket al server online, coda dei messaggi, ping
    i18n.js              traduzioni: t("chiave")
    utils.js             collisioni, palline sfumate, testo con ombra
  math/                  motore algebrico, senza dipendenze da Phaser
    fraction.js          frazioni esatte (al posto di sympy.Rational)
    linear.js            espressioni a·x + b ed equazioni di primo grado
    tokens.js            da espressione a pezzi da impaginare (convenzioni del LaTeX di sympy)
    generators.js        formule dei nemici per tipo e livello
    symbolic.js          Parametrico: equazioni con a e b (forma iniziale come sympy, poi cancel)
    sympyParse.js        legge le formule che manda il server online
  scenes/
    BootScene.js         caricamento degli asset
    IntroScene.js        titolo, nome, scelta del personaggio
    MenuScene.js         menu principale
    BaseLevelScene.js    parte comune di ogni modalità su mappa: player, sparo, carica, proiettili, monete, danno
    LevelScene.js        una stanza qualsiasi di un mondo (porta, baule, tutorial)
    SurvivorScene.js     modalità Survivor
    ParametricScene.js   modalità Parametrico
    OnlineLobbyScene.js  coda online: connessione, nomi, attesa degli altri giocatori
    NetMatchScene.js     parte comune delle partite online (predizione, snapshot, proiettili, timer)
    VersusScene.js       Sfida online: equazione sopra ogni giocatore, forzieri, power-up
    CoopScene.js         Coop online: ondate condivise, ruoli + × / − ÷, rianimazione
    StatsScene.js        riepilogo di fine mondo o di fine Survivor
    CreditsScene.js      crediti
  entities/              Player, Bullet, Coin, Chest, Door, Potion, enemies/MathEnemy (numero, polinomio o equazione)
  ui/                    Hud, DialogBox, TouchControls, UpgradeOverlay, mathText, menuBackground, weaponIcon, floatingReward
tests/algebra.mjs        test del motore algebrico: node tests/algebra.mjs
tests/parametric.mjs     test del Parametrico contro 120 casi calcolati con sympy: node tests/parametric.mjs
tests/sympyParse.mjs     test del parser delle formule del server online: node tests/sympyParse.mjs
```

**Corrispondenza con il Python:**

| Python | Web |
|---|---|
| `game_manager.py`: `data`, `treasure_config_*`, `levels_*` | `core/run.js`, `config/worlds.js` |
| `level_base.py` | `scenes/BaseLevelScene.js` |
| `level_Z.py` (e gli altri mondi) | `scenes/LevelScene.js` |
| `survivor_state.py`, `upgrade_overlay.py`, `upgrade_speed.py`, `potion.py` | `scenes/SurvivorScene.js`, `config/survivor.js`, `ui/UpgradeOverlay.js`, `entities/Potion.js` |
| `credits_state.py`, `utils/floaters.py` | `scenes/CreditsScene.js` |
| `letterale_state.py`, `enemy_parametric.py` | `scenes/ParametricScene.js`, `math/symbolic.js` |
| `online_state.py`, `lobby_state.py` | `scenes/OnlineLobbyScene.js`, `net/connection.js` |
| `multiplayer_state3.py`, `enemy_1v1.py`, `versus_chest.py` | `scenes/NetMatchScene.js`, `scenes/VersusScene.js` |
| `multiplayer_coop_state.py` | `scenes/CoopScene.js` |
| `entities/*.py`, `ui/*.py` | `entities/`, `ui/` |
| `utils/locales/*.py` | `assets/locales/*.json`, esportati in automatico |
| `intro_state.py`, `menu_state.py`, `stats_state.py` | `scenes/IntroScene.js`, `MenuScene.js`, `StatsScene.js` |
| `draw_utils.render_latex` (matplotlib) | `ui/mathText.js` |
| `enemy.py`, `enemy_number.py`, `enemy_poly.py`, `enemy_equation2.py`, `enemy_equation_super.py` | `entities/enemies/MathEnemy.js` + `math/` |

I nomi dei file sono case-sensitive su GitHub Pages: un import scritto con maiuscole o minuscole sbagliate funziona in locale su Windows ma non online.

## Aggiungere una stanza

1. Nel progetto Python, aggiungi la mappa a `MAPS` in `tools/export_level_web.py` e lancia `python tools/export_level_web.py`.
2. Aggiungi la stanza in `src/config/worlds.js`.
3. Se i nemici sono di un tipo nuovo, aggiungi il livello in `src/math/generators.js`.

## Motore algebrico e formule

Il gioco desktop usa sympy per la matematica e LaTeX (matplotlib) per disegnare i nemici: troppo pesanti per il browser. Qui il lavoro è diviso in tre strati:

1. **Calcolo** (`src/math/`): `Frac` per le frazioni esatte, `Linear` per a·x + b, `Equation` per due lati lineari. Hanno tutte la stessa interfaccia:
   - `apply(op, valore)` è il colpo: su un'equazione agisce su entrambi i lati, su un polinomio su tutta l'espressione;
   - `isSolved()` dice se il nemico è risolto (0, oppure "x", oppure "x = numero");
   - `toTokens()` restituisce i pezzi da impaginare.
2. **Pezzi** (`tokens.js`): testo, frazione, segno, operatore. Seguono le convenzioni del LaTeX di sympy: `\frac{3x}{2}` con la x nel numeratore, il meno davanti alla frazione, il termine noto dopo la x.
3. **Disegno** (`ui/mathText.js`): mette i pezzi su una riga, tutti sullo stesso asse orizzontale. Le frazioni hanno cifre più piccole, impilate attorno a una barra di 1 px. Per allineare l'inchiostro delle cifre senza spazi vuoti usa `assets/fonts/metrics.json`, misurato dallo script di export.

**Parametrico** (`symbolic.js`): ogni lato dell'equazione ha due forme. Prima del primo colpo è un albero costruito con le stesse semplificazioni automatiche di sympy (i numeri si distribuiscono sulle somme, le lettere no), così si vede la struttura, es. `b(x/2 + 1) = 3`. Dopo un colpo diventa la forma di `sympy.cancel`: polinomio espanso diviso un monomio. Anche l'ordine dei termini è quello di sympy (lessicografico a > b > x, con l'eccezione `1 - x`). `tests/parametric.mjs` lo verifica contro sympy.

Il nemico (`MathEnemy`) non sa che formula ha: chiama solo queste tre funzioni. Per un tipo nuovo di formula (es. secondo grado, x su entrambi i lati) basta una classe con la stessa interfaccia.

## Roadmap (indicativa)

1. ~~Mondo Z~~, ~~intro e menu~~, ~~Mondo Q~~, ~~Z[x], Q[x] ed Eqz con il motore algebrico~~, ~~Survivor~~, ~~crediti~~, ~~Parametrico~~, ~~multiplayer online~~.
2. Musica (pesa: va scelto se e come caricarla senza rallentare l'avvio).
3. Modalità 1 Minuto, che usa gli stessi nemici-formula.
4. Statistiche complete (precisione, voto) e classifica online.
5. Classifica online: solo dopo aver ristretto le regole di Firestore (`tools/firestore.rules` nel progetto Python).

## Pubblicazione

Il workflow `.github/workflows/pages.yml` pubblica il repo su GitHub Pages a ogni push su `main`
(Settings → Pages → Source: "GitHub Actions"). In circa un minuto la versione nuova è online.
Ogni deploy si vede nella tab Actions; in Deployments (colonna di destra del repo) c'è il commit attualmente online.
