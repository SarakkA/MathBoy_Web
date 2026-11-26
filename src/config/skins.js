// I tre personaggi (player.py: load_animation_sprite, _woman, _male).
//
// anims: stato -> [texture, riga, specchiata, numero di frame]
// Tutti hanno la stessa hitbox 12x16; lo sprite e' disegnato con il bordo alto
// 33 px sopra il centro della hitbox (vale sia per i frame 48x48 sia per i 48x64).

const SKIN0_ROWS = {
  idle_down: [0, false], idle_right: [1, false], idle_right_up: [1, false], idle_up: [2, false],
  down: [3, false], right: [4, false], right_up: [4, false], up: [5, false],
  left: [4, true], left_up: [4, true], idle_left: [1, true], idle_left_up: [1, true],
};

function skin0() {
  const anims = {};
  for (const [state, [row, flip]] of Object.entries(SKIN0_ROWS)) anims[state] = ["player", row, flip, 6];
  anims.death = ["player", 9, false, 3];
  return { cols: 6, frameTime: 7 / 60, shadow: false, anims };
}

// personaggi 1 e 2: un foglio per idle, uno per camminata, uno per la morte; nessuno specchiato
const ROWS_8DIR = { down: 0, left: 1, left_up: 2, up: 3, right_up: 4, right: 5 };

function skin8(prefix) {
  const anims = {};
  for (const [dir, row] of Object.entries(ROWS_8DIR)) {
    anims[`idle_${dir}`] = [`${prefix}_idle`, row, false, 8];
    anims[dir] = [`${prefix}_walk`, row, false, 8];
  }
  anims.death = [`${prefix}_death`, 5, false, 8];
  return { cols: 8, frameTime: 5 / 60, shadow: true, anims };
}

export const SKINS = [skin0(), skin8("woman"), skin8("male")];
export const DEATH_FRAME_TIME = 30 / 60;
export const SPRITE_TOP = 33; // px tra il bordo alto dello sprite e il centro della hitbox
