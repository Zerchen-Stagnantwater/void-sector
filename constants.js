// ============================================
//   VOID SECTOR — constants.js
//   Single source of truth for every number.
//
//   BALANCE PASS v1.1
//   - Zoom: bigger font, tighter grid (feels full)
//   - Economy: shop costs 3-4x more, wave bonuses cut
//   - Gameplay: faster enemies, faster bullets, more pressure
// ============================================

const C = {

  // ---------- Canvas ----------
  // Smaller grid + bigger font = zoomed-in, dense feel.
  // Was 60x36 @ 18px. Now 44x28 @ 22px.
  COLS: 44,
  ROWS: 28,
  FONT_SIZE: 22,
  FONT_FAMILY: "'Share Tech Mono', 'Courier New', monospace",

  // ---------- Colors ----------
  COLOR: {
    BG: '#000000',
    PRIMARY: '#00ff41',
    DIM: '#007a1f',
    ACCENT: '#39ff14',
    DANGER: '#ff2200',
    WARN: '#ffaa00',
    WHITE: '#ccffcc',
    ENEMY_A: '#ff2200',
    ENEMY_B: '#ff6600',
    ENEMY_C: '#ff00aa',
    ENEMY_D: '#aa00ff',
    PARTICLE: '#00ff41',
    SHIELD: '#00ccff',
    HUD: '#00ff41',
  },

  // ---------- Timing ----------
  TARGET_FPS: 60,
  TICK_MS: 1000 / 60,

  // ---------- Player ----------
  PLAYER: {
    START_COL: 22,
    START_ROW: 24,
    SPEED: 0.20,
    CHAR: '^',
    LIVES: 3,
    INVINCIBLE_FRAMES: 80,
    ROLL_DURATION: 16,
    ROLL_COOLDOWN: 50,
    ROLL_SPEED: 0.6,
    SHOOT_COOLDOWN: 12,
  },

  // ---------- Bullets ----------
  BULLET: {
    PLAYER_SPEED: 0.7,
    ENEMY_SPEED: 0.28,
    PLAYER_CHAR: '|',
    ENEMY_CHAR: '!',
    SPREAD_CHARS: ['\\', '|', '/'],
    POOL_SIZE: 200,
  },

  // ---------- Enemies ----------
  ENEMY: {
    A: {
      CHAR: 'V', COLOR: '#ff2200',
      HP: 1, SCORE: 100,
      SPEED: 0.04, SHOOT_RATE: 140, DROP_CHANCE: 0.10,
    },
    B: {
      CHAR: 'W', COLOR: '#ff6600',
      HP: 1, SCORE: 200,
      SPEED: 0.08, SHOOT_RATE: 200, DROP_CHANCE: 0.12,
    },
    C: {
      CHAR: '#', COLOR: '#ff00aa',
      HP: 6, SCORE: 600,
      SPEED: 0.016, SHOOT_RATE: 75, DROP_CHANCE: 0.30,
    },
    D: {
      CHAR: '@', COLOR: '#aa00ff',
      HP: 3, SCORE: 400,
      SPEED: 0.025, SHOOT_RATE: 95, DROP_CHANCE: 0.20,
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
    FALL_SPEED: 0.035,
    RAPID_DURATION: 280,
    SPREAD_DURATION: 360,
    SHIELD_HITS: 3,
  },

  // ---------- Particles ----------
  PARTICLE: {
    EXPLOSION_COUNT: 10,
    LIFETIME: 28,
    CHARS: ['*', '.', '+', "'", '`', ','],
  },

  // ---------- Shop ----------
  // Economy: wave 1 earns ~600-900. Full max-out takes 8-10 waves.
  // COST_SCALE 2.1 means: L1=base, L2=2.1x, L3=4.4x, L4=9.3x, L5=19.5x
  SHOP: {
    ITEMS: [
      { id: 'fire_rate', label: 'FIRE RATE  +', baseCost: 300, maxLevel: 5, desc: 'Shoot faster. Stacks well.' },
      { id: 'move_speed', label: 'MOVE SPEED +', baseCost: 250, maxLevel: 5, desc: 'Move faster across the grid.' },
      { id: 'multi_shot', label: 'MULTI-SHOT +', baseCost: 700, maxLevel: 3, desc: 'Fire extra parallel bullets.' },
      { id: 'shield', label: 'SHIELD     +', baseCost: 500, maxLevel: 1, desc: 'Absorbs 3 hits. One time.' },
      { id: 'bullet_spd', label: 'BULLET SPD +', baseCost: 220, maxLevel: 5, desc: 'Bullets travel faster.' },
    ],
    COST_SCALE: 2.1,
  },

  // ---------- Screen shake ----------
  SHAKE: {
    HIT_INTENSITY: 2.5,
    DEATH_INTENSITY: 6,
    DECAY: 0.82,
  },

  // ---------- Scoring ----------
  SCORE: {
    WAVE_CLEAR_BONUS: 250,
    COMBO_WINDOW: 100,
  },

};

// Canvas pixel dimensions
C.CANVAS_W = C.COLS * C.FONT_SIZE * 0.6;
C.CANVAS_H = C.ROWS * C.FONT_SIZE;
C.CHAR_W = C.CANVAS_W / C.COLS;
C.CHAR_H = C.CANVAS_H / C.ROWS;

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
