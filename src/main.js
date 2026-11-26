import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from "./config/settings.js";
import BootScene from "./scenes/BootScene.js";
import IntroScene from "./scenes/IntroScene.js";
import MenuScene from "./scenes/MenuScene.js";
import LevelScene from "./scenes/LevelScene.js";
import StatsScene from "./scenes/StatsScene.js";

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
  scene: [BootScene, IntroScene, MenuScene, LevelScene, StatsScene],
});
