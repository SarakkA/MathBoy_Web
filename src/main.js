import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from "./config/settings.js";
import BootScene from "./scenes/BootScene.js";
import IntroScene from "./scenes/IntroScene.js";
import MenuScene from "./scenes/MenuScene.js";
import LevelScene from "./scenes/LevelScene.js";
import StatsScene from "./scenes/StatsScene.js";
import SurvivorScene from "./scenes/SurvivorScene.js";
import CreditsScene from "./scenes/CreditsScene.js";
import RankScene from "./scenes/RankScene.js";
import ParametricScene from "./scenes/ParametricScene.js";
import OnlineLobbyScene from "./scenes/OnlineLobbyScene.js";
import VersusScene from "./scenes/VersusScene.js";
import CoopScene from "./scenes/CoopScene.js";
import PauseScene from "./scenes/PauseScene.js";

// Superficie logica 640x360 come il desktop, scalata per riempire la finestra.
// AUTO = WebGL, con ripiego automatico su Canvas 2D se WebGL e' disattivato.
// Esposto su window per il debug dalla console del browser.
window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
  backgroundColor: "#53a03b",
  pixelArt: true,
  roundPixels: true,
  fps: { target: 60 },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    mouse: { preventDefaultWheel: true },
    activePointers: 3, // multitocco: joystick + bottone insieme
  },
  scene: [BootScene, IntroScene, MenuScene, LevelScene, SurvivorScene, ParametricScene, OnlineLobbyScene, VersusScene, CoopScene, StatsScene, CreditsScene, RankScene,
    PauseScene], // ultima: disegnata sopra la partita
});

// telefono: quando compaiono o spariscono le barre del browser l'area visibile cambia.
// Phaser se ne accorge da solo entro mezzo secondo; cosi' si riadatta subito.
window.visualViewport?.addEventListener("resize", () => window.game.scale.refresh());
