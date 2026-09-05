// ============================================
//   @void-sector/shared — constants.ts
//   Single source of truth for all numbers.
//   Imported by both server and client.
// ============================================

import type { EnemyType, DropType, UpgradeId } from './types/index.js';

interface EnemyConfig {
  readonly CHAR: string;
  readonly COLOR: string;
  readonly HP: number;
  readonly SCORE: number;
  readonly SPEED: number;
  readonly SHOOT_RATE: number;
  readonly DROP_CHANCE: number;
}

interface ShopItem {
  readonly id: UpgradeId;
  readonly label: string;
  readonly baseCost: number;
  readonly maxLevel: number;
  readonly desc: string;
}

// ---------- Grid base values ----------
// Defined before C so derived values can reference them.

const COLS = 44;
const ROWS = 28;
const FONT_SIZE = 22;

export const CANVAS_W = COLS * FONT_SIZE * 0.6;
export const CANVAS_H = ROWS * FONT_SIZE;
export const CHAR_W = CANVAS_W / COLS;
export const CHAR_H = CANVAS_H / ROWS;

// ---------- Main constants ----------

export const C = {

  COLS,
  ROWS,
  FONT_SIZE,
  FONT_FAMILY: "'Share Tech Mono', 'Courier New', monospace",

  // Canvas dimensions — same values, on C for convenience
  CANVAS_W,
  CANVAS_H,
  CHAR_W,
  CHAR_H,

  // ---------- Colors ----------
  COLOR: {
    BG: '#000000',
    PRIMARY: '#00ff41',
    DIM: '#007a1f',
    ACCENT: '#39ff14',
    DANGER: '#ff2200',
    WARN: '#ffaa00',
    WHITE: '#ccffcc',
    SHIELD: '#00ccff',
    HUD: '#00ff41',
  },

  // ---------- Timing ----------
  TICK_MS: 1000 / 60,

  // ---------- Player ----------
  PLAYER: {
    SPEED: 0.20,
    LIVES: 3,
    INVINCIBLE_FRAMES: 80,
    ROLL_DURATION: 16,
    ROLL_COOLDOWN: 50,
    ROLL_SPEED: 0.6,
    SHOOT_COOLDOWN: 12,
    START_ROW: 24,
  },

  // ---------- Bullets ----------
  BULLET: {
    PLAYER_SPEED: 0.7,
    ENEMY_SPEED: 0.28,
    POOL_SIZE: 200,
  },

  // ---------- Enemies ----------
  ENEMY: {
    A: {
      CHAR: 'V', COLOR: '#ff2200',
      HP: 1, SCORE: 50,
      SPEED: 0.04, SHOOT_RATE: 140, DROP_CHANCE: 0.06,
    } as EnemyConfig,
    B: {
      CHAR: 'W', COLOR: '#ff6600',
      HP: 1, SCORE: 120,
      SPEED: 0.08, SHOOT_RATE: 200, DROP_CHANCE: 0.08,
    } as EnemyConfig,
    C: {
      CHAR: '#', COLOR: '#ff00aa',
      HP: 6, SCORE: 350,
      SPEED: 0.016, SHOOT_RATE: 75, DROP_CHANCE: 0.22,
    } as EnemyConfig,
    D: {
      CHAR: '@', COLOR: '#aa00ff',
      HP: 3, SCORE: 220,
      SPEED: 0.025, SHOOT_RATE: 95, DROP_CHANCE: 0.15,
    } as EnemyConfig,
  } satisfies Record<EnemyType, EnemyConfig>,

  // ---------- Power-ups ----------
  POWERUP: {
    CHARS: {
      SHIELD: 'S', RAPID: 'R', SPREAD: 'X', LIFE: '+', BOMB: 'B',
    } as Record<DropType, string>,
    COLORS: {
      SHIELD: '#00ccff', RAPID: '#ffff00',
      SPREAD: '#ff6600', LIFE: '#00ff41', BOMB: '#ff00aa',
    } as Record<DropType, string>,
    FALL_SPEED: 0.12,
    RAPID_DURATION: 280,
    SPREAD_DURATION: 360,
    SHIELD_HITS: 3,
  },

  // ---------- Particles ----------
  PARTICLE: {
    EXPLOSION_COUNT: 10,
    LIFETIME: 28,
    CHARS: ['*', '.', '+', "'", '`', ','] as readonly string[],
  },

  // ---------- Screen shake ----------
  SHAKE: {
    HIT_INTENSITY: 2.5,
    DEATH_INTENSITY: 6,
    DECAY: 0.82,
  },

  // ---------- Shop ----------
  SHOP: {
    ITEMS: [
      { id: 'fire_rate', label: 'FIRE RATE  +', baseCost: 400, maxLevel: 5, desc: 'Shoot faster.' },
      { id: 'move_speed', label: 'MOVE SPEED +', baseCost: 350, maxLevel: 5, desc: 'Move faster.' },
      { id: 'multi_shot', label: 'MULTI-SHOT +', baseCost: 900, maxLevel: 3, desc: 'Extra parallel bullets.' },
      { id: 'shield', label: 'SHIELD     +', baseCost: 650, maxLevel: 1, desc: 'Absorbs 3 hits.' },
      { id: 'bullet_spd', label: 'BULLET SPD +', baseCost: 300, maxLevel: 5, desc: 'Bullets travel faster.' },
    ] as ReadonlyArray<ShopItem>,
    COST_SCALE: 2.4,
  },

  // ---------- Scoring ----------
  SCORE: {
    WAVE_CLEAR_BONUS: 100,
    COMBO_WINDOW: 100,
  },

  // ---------- Multiplayer ----------
  MP_SCALE: {
    HP_PER_PLAYER: 0.4,
    COUNT_PER_PLAYER: 0.3,
  },

  // ---------- Player start cols ----------
  PLAYER_START_COLS: [10, 18, 26, 34] as readonly number[],

} as const;

// ---------- Player identity ----------

export interface PlayerIdentity {
  readonly id: number;
  readonly char: string;
  readonly color: string;
}

export const PLAYER_IDENTITY: readonly PlayerIdentity[] = [
  { id: 0, char: '^', color: '#00ff41' },
  { id: 1, char: '^', color: '#00ccff' },
  { id: 2, char: '^', color: '#ffaa00' },
  { id: 3, char: '^', color: '#ff00aa' },
] as const;

// ---------- Upgrade cost helper ----------

export function upgradeCost(itemId: UpgradeId, currentLevel: number): number {
  const item = C.SHOP.ITEMS.find(i => i.id === itemId);
  if (!item) return Infinity;
  return Math.floor(item.baseCost * Math.pow(C.SHOP.COST_SCALE, currentLevel));
}
