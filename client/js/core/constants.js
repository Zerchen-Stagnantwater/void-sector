// ============================================
//   VOID SECTOR — constants.js
//   BALANCE PASS v1.2
//   - Shop costs much higher, scale steeper
//   - Drop chances lower (fewer drops)
//   - Powerup fall speed much faster
//   - Wave clear bonus cut to near zero
// ============================================

const C = {

  COLS:        44,
  ROWS:        28,
  FONT_SIZE:   22,
  FONT_FAMILY: "'Share Tech Mono', 'Courier New', monospace",

  COLOR: {
    BG:           '#000000',
    PRIMARY:      '#00ff41',
    DIM:          '#007a1f',
    ACCENT:       '#39ff14',
    DANGER:       '#ff2200',
    WARN:         '#ffaa00',
    WHITE:        '#ccffcc',
    ENEMY_A:      '#ff2200',
    ENEMY_B:      '#ff6600',
    ENEMY_C:      '#ff00aa',
    ENEMY_D:      '#aa00ff',
    PARTICLE:     '#00ff41',
    SHIELD:       '#00ccff',
    HUD:          '#00ff41',
  },

  TARGET_FPS: 60,
  TICK_MS:    1000 / 60,

  PLAYER: {
    START_COL:         22,
    START_ROW:         24,
    SPEED:             0.20,
    CHAR:              '^',
    LIVES:             3,
    INVINCIBLE_FRAMES: 80,
    ROLL_DURATION:     16,
    ROLL_COOLDOWN:     50,
    ROLL_SPEED:        0.6,
    SHOOT_COOLDOWN:    12,
  },

  BULLET: {
    PLAYER_SPEED:  0.7,
    ENEMY_SPEED:   0.28,
    PLAYER_CHAR:   '|',
    ENEMY_CHAR:    '!',
    SPREAD_CHARS:  ['\\', '|', '/'],
    POOL_SIZE:     200,
  },

  ENEMY: {
    // Score per kill is LOW intentionally — shop should feel earned
    A: {
      CHAR: 'V', COLOR: '#ff2200',
      HP: 1, SCORE: 50,          // Was 100 — halved
      SPEED: 0.04, SHOOT_RATE: 140,
      DROP_CHANCE: 0.06,          // Was 0.10 — much rarer drops
    },
    B: {
      CHAR: 'W', COLOR: '#ff6600',
      HP: 1, SCORE: 120,          // Was 200
      SPEED: 0.08, SHOOT_RATE: 200,
      DROP_CHANCE: 0.08,          // Was 0.12
    },
    C: {
      CHAR: '#', COLOR: '#ff00aa',
      HP: 6, SCORE: 350,          // Was 600
      SPEED: 0.016, SHOOT_RATE: 75,
      DROP_CHANCE: 0.22,          // Was 0.30
    },
    D: {
      CHAR: '@', COLOR: '#aa00ff',
      HP: 3, SCORE: 220,          // Was 400
      SPEED: 0.025, SHOOT_RATE: 95,
      DROP_CHANCE: 0.15,          // Was 0.20
    },
  },

  POWERUP: {
    CHARS:  { SHIELD: 'S', RAPID: 'R', SPREAD: 'X', LIFE: '+', BOMB: 'B' },
    COLORS: {
      SHIELD: '#00ccff',
      RAPID:  '#ffff00',
      SPREAD: '#ff6600',
      LIFE:   '#00ff41',
      BOMB:   '#ff00aa',
    },
    FALL_SPEED:      0.12,   // Was 0.035 — 3x faster, actually reachable
    RAPID_DURATION:  280,
    SPREAD_DURATION: 360,
    SHIELD_HITS:     3,
  },

  PARTICLE: {
    EXPLOSION_COUNT: 10,
    LIFETIME:        28,
    CHARS: ['*', '.', '+', "'", '`', ','],
  },

  // ---------- Shop economy ----------
  // Wave 1: ~4 grunts x 50 = 200 score. Can afford nothing.
  // Wave 2: ~250-300 total. First upgrade (cheapest) costs 400. Still saving.
  // Wave 3: ~500-600 total. First upgrade reachable if played clean.
  // Wave 5+: Upgrades start flowing but expensive ones stay out of reach.
  // Full max-out: realistically wave 12-15.
  SHOP: {
    ITEMS: [
      { id: 'fire_rate',  label: 'FIRE RATE  +', baseCost: 400,  maxLevel: 5, desc: 'Shoot faster.' },
      { id: 'move_speed', label: 'MOVE SPEED +', baseCost: 350,  maxLevel: 5, desc: 'Move faster.' },
      { id: 'multi_shot', label: 'MULTI-SHOT +', baseCost: 900,  maxLevel: 3, desc: 'Extra parallel bullets.' },
      { id: 'shield',     label: 'SHIELD     +', baseCost: 650,  maxLevel: 1, desc: 'Absorbs 3 hits.' },
      { id: 'bullet_spd', label: 'BULLET SPD +', baseCost: 300,  maxLevel: 5, desc: 'Bullets travel faster.' },
    ],
    COST_SCALE: 2.4,  // L1=base L2=2.4x L3=5.8x L4=13.8x L5=33x
  },

  SHAKE: {
    HIT_INTENSITY:   2.5,
    DEATH_INTENSITY: 6,
    DECAY:           0.82,
  },

  SCORE: {
    WAVE_CLEAR_BONUS: 100,  // Was 250 — nearly nothing, earn it in combat
    COMBO_WINDOW:     100,
  },

};

C.CANVAS_W = C.COLS * C.FONT_SIZE * 0.6;
C.CANVAS_H = C.ROWS * C.FONT_SIZE;
C.CHAR_W   = C.CANVAS_W / C.COLS;
C.CHAR_H   = C.CANVAS_H / C.ROWS;

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

// ---------- Player identity ----------
// Must be in constants.js so renderer.js can access it —
// renderer loads before main.js in the script order.
const PLAYER_IDENTITY = [
  { id: 0, char: '^', color: '#00ff41' },
  { id: 1, char: '^', color: '#00ccff' },
  { id: 2, char: '^', color: '#ffaa00' },
  { id: 3, char: '^', color: '#ff00aa' },
];
