// Valori presi dalla versione Python (src/settings.py, player.py, level_base.py)
export const LOGICAL_WIDTH = 640;
export const LOGICAL_HEIGHT = 360;

export const BLU = 0x003cff;
export const ROSSO = 0xdc3232;
export const VIOLA = 0xff00ff;

export const PLAYER_SPEED = 80;      // px/s, player.py
export const BULLET_SPEED = 150;     // px/s, player.py
export const BULLET_RADIUS = 7;      // bullet.py
export const HP_MAX = 500;           // game_manager.py default_data
export const LIVES = 3;
export const CONTACT_DPS = 40;       // HP/s persi a contatto con un nemico, level_base.py
export const DEATH_DURATION = 5;     // s di animazione morte prima di rinascere, player.py
export const ENEMY_SOLVE_DELAY = 1;  // s tra lo 0 e la sparizione del nemico, enemy_number.py

export const Op = { ADD: "+", SUB: "-" };
