// ============================================
//   VOID SECTOR SERVER — constants.js
//   Mirror of client constants.js.
//   Must stay in sync with client at all times.
//   If you change a number here, change it
//   on the client too, and vice versa.
// ============================================

const C = {

  // ---------- Grid ----------
  COLS:     44,
  ROWS:     28,

  // ---------- Timing ----------
  TICK_MS:  1000 / 60,

  // ---------- Player ----------
  PLAYER: {
    SPEED:             0.20,
    LIVES:             3,
    INVINCIBLE_FRAMES: 80,
    ROLL_DURATION:     16,
    ROLL_COOLDOWN:     50,
    ROLL_SPEED:        0.6,
    SHOOT_COOLDOWN:    12,
    START_ROW:         24,
  },

  // ---------- Bullets ----------
  BULLET: {
    PLAYER_SPEED:  0.7,
    ENEMY_SPEED:   0.28,
    POOL_SIZE:     200,
  },

  // ---------- Enemies ----------
  ENEMY: {
    A: {
      CHAR: 'V', COLOR: '#ff2200',
      HP: 1, SCORE: 50,
      SPEED: 0.04, SHOOT_RATE: 140, DROP_CHANCE: 0.06,
    },
    B: {
      CHAR: 'W', COLOR: '#ff6600',
      HP: 1, SCORE: 120,
      SPEED: 0.08, SHOOT_RATE: 200, DROP_CHANCE: 0.08,
    },
    C: {
      CHAR: '#', COLOR: '#ff00aa',
      HP: 6, SCORE: 350,
      SPEED: 0.016, SHOOT_RATE: 75, DROP_CHANCE: 0.22,
    },
    D: {
      CHAR: '@', COLOR: '#aa00ff',
      HP: 3, SCORE: 220,
      SPEED: 0.025, SHOOT_RATE: 95, DROP_CHANCE: 0.15,
    },
  },

  // ---------- Power-ups ----------
  POWERUP: {
    CHARS:  { SHIELD: 'S', RAPID: 'R', SPREAD: 'X', LIFE: '+', BOMB: 'B' },
    COLORS: {
      SHIELD: '#00ccff',
      RAPID:  '#ffff00',
      SPREAD: '#ff6600',
      LIFE:   '#00ff41',
      BOMB:   '#ff00aa',
    },
    FALL_SPEED:      0.12,
    RAPID_DURATION:  280,
    SPREAD_DURATION: 360,
    SHIELD_HITS:     3,
  },

  // ---------- Shop ----------
  SHOP: {
    ITEMS: [
      { id: 'fire_rate',  baseCost: 400, maxLevel: 5 },
      { id: 'move_speed', baseCost: 350, maxLevel: 5 },
      { id: 'multi_shot', baseCost: 900, maxLevel: 3 },
      { id: 'shield',     baseCost: 650, maxLevel: 1 },
      { id: 'bullet_spd', baseCost: 300, maxLevel: 5 },
    ],
    COST_SCALE: 2.4,
  },

  // ---------- Scoring ----------
  SCORE: {
    WAVE_CLEAR_BONUS: 100,
    COMBO_WINDOW:     100,
  },

  // ---------- Multiplayer scaling ----------
  // Enemy HP and count scale with player count
  // so 4-player games stay challenging.
  MP_SCALE: {
    HP_PER_PLAYER:    0.4,   // +40% HP per extra player
    COUNT_PER_PLAYER: 0.3,   // +30% enemies per extra player
  },

  // ---------- Player start cols ----------
  // Spread across grid so players don't spawn overlapping.
  PLAYER_START_COLS: [10, 18, 26, 34],

};

module.exports = C;
