# MathBoy – versione browser

Porting graduale di MathBoy (gioco desktop in Python + pygame) nel browser, con [Phaser 3](https://phaser.io).
Non c'è nessun build step e nessuna dipendenza da installare: sono moduli JavaScript serviti così come sono.

**Stato attuale:**
- intro con nome e scelta tra i tre personaggi, poi il menu principale;
- tutti e cinque i mondi della storia, 3 stanze ciascuno:
  - Z e Q: numeri interi e frazioni, carica per × e ÷;
  - Z[x] e Q[x]: polinomi di primo grado da portare a "x";
  - Eqz: equazioni di primo grado da portare a "x = numero";
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
  math/                  motore algebrico, senza dipendenze da Phaser
    fraction.js          frazioni esatte (al posto di sympy.Rational)
    linear.js            espressioni a·x + b ed equazioni di primo grado
    tokens.js            da espressione a pezzi da impaginare (convenzioni del LaTeX di sympy)
    generators.js        formule dei nemici per tipo e livello
  scenes/
    BootScene.js         caricamento degli asset
    IntroScene.js        titolo, nome, scelta del personaggio
    MenuScene.js         menu principale
    LevelScene.js        una stanza qualsiasi di un mondo
    StatsScene.js        riepilogo di fine mondo
  entities/              Player, Bullet, Coin, Chest, Door, enemies/MathEnemy (numero, polinomio o equazione)
tests/algebra.mjs        test del motore algebrico: node tests/algebra.mjs
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
| `enemy_number.py`, `enemy_poly.py`, `enemy_equation2.py` | `entities/enemies/MathEnemy.js` + `math/` |

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
2. **Pezzi** (`tokens.js`): testo, frazione, segno, operatore. Seguono le convenzioni del LaTeX di sympy: rac{3x}{2} con la x nel numeratore, il meno davanti alla frazione, il termine noto dopo la x.
3. **Disegno** (`ui/mathText.js`): mette i pezzi su una riga, tutti sullo stesso asse orizzontale. Le frazioni hanno cifre più piccole, impilate attorno a una barra di 1 px. Per allineare l'inchiostro delle cifre senza spazi vuoti usa `assets/fonts/metrics.json`, misurato dallo script di export.

Il nemico (`MathEnemy`) non sa che formula ha: chiama solo queste tre funzioni. Per un tipo nuovo di formula (es. secondo grado, x su entrambi i lati) basta una classe con la stessa interfaccia.

## Roadmap (indicativa)

1. ~~Mondo Z~~, ~~intro e menu~~, ~~Mondo Q~~, ~~Z[x], Q[x] ed Eqz con il motore algebrico~~.
2. Musica (pesa: va scelto se e come caricarla senza rallentare l'avvio).
3. Modalità extra (1 Minuto, Survivor, Parametrico), che usano gli stessi nemici-formula.
4. Statistiche complete (precisione, voto) e classifica online.
5. Statistiche complete: precisione, voto, classifica online.
6. Multiplayer: richiede un server WebSocket, perché il browser non può usare i socket TCP del server attuale.

## Pubblicazione

Il workflow `.github/workflows/pages.yml` pubblica il repo su GitHub Pages a ogni push su `main`
(Settings → Pages → Source: "GitHub Actions"). In circa un minuto la versione nuova è online.
Ogni deploy si vede nella tab Actions; in Deployments (colonna di destra del repo) c'è il commit attualmente online.
