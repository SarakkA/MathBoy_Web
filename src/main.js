import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from "./settings.js";
import Level1Scene from "./scenes/Level1Scene.js";

// Superficie logica 640x360 come il desktop, scalata per riempire la finestra.
// AUTO = WebGL, con ripiego automatico su Canvas 2D se WebGL e' disattivato.
// esposto su window per il debug dalla console del browser
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
  },
  scene: [Level1Scene],
});
