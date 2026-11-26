# MathBoy – versione browser (prototipo)

Il livello 1 (Mondo Z, stanza 1) riscritto in JavaScript con [Phaser 3](https://phaser.io), per verificare il lag e l'accesso dal browser.
Contiene solo le meccaniche principali: movimento, sparo +/−, nemici-numero, monete, vite e porta.

## Comandi

| Tasto | Azione |
|---|---|
| W A S D | muoversi |
| click sinistro | spara +1 |
| click destro | spara −1 |
| rotella | cambia numero (per ora c'è solo 1) |
| F3 | mostra/nasconde FPS e renderer (WebGL/Canvas) |
| R | rigioca (a fine partita) |

## Provarlo in locale

I moduli JS non funzionano aprendo il file con doppio click: serve un server locale. Dalla cartella del progetto:

```
python -m http.server 8000
```

Poi apri http://localhost:8000.

## Rigenerare gli asset

Mappa, font bitmap, sprite e suoni in `assets/` sono generati dalla versione desktop (Python, repo separato) con il suo script `tools/export_level_web.py`.
Lo script scrive direttamente in questa cartella, se si trova accanto al progetto Python con il nome `MathBoy-web`.

## Struttura

- `index.html`: la pagina con il canvas.
- `lib/phaser.min.js`: Phaser 3.90, copiato nel repo apposta perché le reti scolastiche spesso bloccano le CDN.
- `src/main.js`: configurazione: superficie 640×360 scalata, pixel art.
- `src/settings.js`: costanti prese dal gioco Python (velocità, HP, danni).
- `src/scenes/Level1Scene.js`: il livello: collisioni, nemici, monete, vittoria e sconfitta.
- `src/entities/`: `Player`, `Bullet`, `EnemyNumber`, `Coin`.
- `src/ui/Hud.js`: cuori, monete, selettore, bottoni +/−, FPS, cursore, titolo.

## Pubblicazione

Il workflow `.github/workflows/pages.yml` pubblica il repo su GitHub Pages a ogni push su `main`.
Si può anche lanciare a mano dalla tab Actions.
