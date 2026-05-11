// ============================================
//   VOID SECTOR — constants.js
//   Single source of truth for every number.
//   Tweak here, game changes everywhere.
// ============================================

const C = {

  // ---------- Canvas ----------
  COLS: 60,          // Character columns
  ROWS: 36,          // Character rows
  FONT_SIZE: 18,     // px — drives canvas size
  FONT_FAMILY: "'Share Tech Mono', 'Courier New', monospace",

  // ---------- Colors (phosphor green palette) ----------
  COLOR: {
    BG: '#000000',
    PRIMARY: '#00ff41',   // Bright green — player, UI
    DIM: '#007a1f',   // Dim green — inactive elements
    ACCENT: '#39ff14',   // Neon green — pickups, highlights
    DANGER: '#ff2200',   // Red — enemy bullets, damage
    WARN: '#ffaa00',   // Amber — warnings, shields
    WHITE: '#ccffcc',   // Near-white — text
    ENEMY_A: '#ff2200',   // Basic enemy
    ENEMY_B: '#ff6600',   // Fast enemy
    ENEMY_C: '#ff00aa',   // Tank enemy
    ENEMY_D: '#aa00ff',   // Bomber enemy
    PARTICLE: '#00ff41',
    SHIELD: '#00ccff',
    HUD: '#00ff41',
  },

  // ---------- Timing ----------
  TARGET_FPS: 60,
  TICK_MS: 1000 / 60,   // ~16.67ms per frame

  // ---------- Player ----------
  PLAYER: {
    START_COL: 30,         // Starting column (center)
    START_ROW: 31,         // Starting row (near bottom)
    SPEED: 0.18,       // Cols per frame
    CHAR: '^',
    LIVES: 3,
    INVINCIBLE_FRAMES: 90,    // Frames of invincibility after hit
    ROLL_DURATION: 18,    // Frames the dodge roll lasts
    ROLL_COOLDOWN: 45,    // Frames before roll can be used again
    ROLL_SPEED: 0.55,  // Speed multiplier during roll
    SHOOT_COOLDOWN: 10,    // Frames between shots (base)
  },

  // ---------- Bullets ----------
  BULLET: {
    PLAYER_SPEED: 0.55,    // Rows per frame (upward)
    ENEMY_SPEED: 0.22,    // Rows per frame (downward)
    PLAYER_CHAR: '|',
    ENEMY_CHAR: '!',
    SPREAD_CHARS: ['\\', '|', '/'],  // Spread shot chars
    POOL_SIZE: 200,     // Max bullets alive at once
  },

  // ---------- Enemies ----------
  ENEMY: {
    // Type A — Grunt
    A: {
      CHAR: 'V', COLOR: '#ff2200',
      HP: 1, SCORE: 100,
      SPEED: 0.025, SHOOT_RATE: 180,  // frames between shots
      DROP_CHANCE: 0.12,
    },
    // Type B — Dasher (fast, zigzag)
    B: {
      CHAR: 'W', COLOR: '#ff6600',
      HP: 1, SCORE: 200,
      SPEED: 0.06, SHOOT_RATE: 240,
      DROP_CHANCE: 0.15,
    },
    // Type C — Tank (slow, tanky)
    C: {
      CHAR: '#', COLOR: '#ff00aa',
      HP: 5, SCORE: 500,
      SPEED: 0.012, SHOOT_RATE: 90,
      DROP_CHANCE: 0.35,
    },
    // Type D — Bomber (slow, fires spread)
    D: {
      CHAR: '@', COLOR: '#aa00ff',
      HP: 3, SCORE: 350,
      SPEED: 0.018, SHOOT_RATE: 120,
      DROP_CHANCE: 0.25,
    },
  },

  // ---------- Power-ups ----------
  POWERUP: {
    CHARS: { SHIELD: 'S', RAPID: 'R', SPREAD: 'X', LIFE: '+', BOMB: 'B' },
    COLORS: {
      SHIELD: '#00ccff',
      RAPID: '#ffff00',
      SPREAD: '#ff6600',
      LIFE: '#00ff41',
      BOMB: '#ff00aa',
    },
    FALL_SPEED: 0.04,
    RAPID_DURATION: 300,   // frames
    SPREAD_DURATION: 400,
    SHIELD_HITS: 3,
  },

  // ---------- Particles ----------
  PARTICLE: {
    EXPLOSION_COUNT: 12,
    LIFETIME: 30,    // frames
    CHARS: ['*', '.', '+', '\'', '`', ','],
  },

  // ---------- Shop ----------
  SHOP: {
    ITEMS: [
      { id: 'fire_rate', label: 'FIRE RATE   +', baseCost: 150, maxLevel: 5, desc: 'Shoot faster.' },
      { id: 'move_speed', label: 'MOVE SPEED  +', baseCost: 120, maxLevel: 5, desc: 'Move faster.' },
      { id: 'multi_shot', label: 'MULTI-SHOT  +', baseCost: 300, maxLevel: 3, desc: 'Extra bullets per shot.' },
      { id: 'shield', label: 'SHIELD      +', baseCost: 200, maxLevel: 1, desc: 'One-hit shield.' },
      { id: 'bullet_spd', label: 'BULLET SPD  +', baseCost: 100, maxLevel: 5, desc: 'Bullets travel faster.' },
    ],
    COST_SCALE: 1.6,   // Cost multiplier per level
  },

  // ---------- Screen shake ----------
  SHAKE: {
    HIT_INTENSITY: 3,
    DEATH_INTENSITY: 7,
    DECAY: 0.85,
  },

  // ---------- Scoring ----------
  SCORE: {
    WAVE_CLEAR_BONUS: 500,
    COMBO_WINDOW: 120,   // frames to keep combo alive
  },

};

// Canvas pixel dimensions derived from grid
C.CANVAS_W = C.COLS * C.FONT_SIZE * 0.6;   // mono chars are ~60% as wide as tall
C.CANVAS_H = C.ROWS * C.FONT_SIZE;
C.CHAR_W = C.CANVAS_W / C.COLS;
C.CHAR_H = C.CANVAS_H / C.ROWS;

// Freeze the object so no file accidentally mutates it
Object.freeze(C);
Object.freeze(C.COLOR);
Object.freeze(C.PLAYER);
Object.freeze(C.BULLET);
Object.freeze(C.ENEMY.A);
Object.freeze(C.ENEMY.B);
Object.freeze(C.ENEMY.C);
Object.freeze(C.ENEMY.D);
Object.freeze(C.POWERUP);
Object.freeze(C.PARTICLE);
Object.freeze(C.SHAKE);
Object.freeze(C.SCORE);
