// ============================================
//   @void-sector/shared — types/game.ts
//   Runtime entity shapes used by both
//   server (simulation) and client (rendering).
// ============================================

// ---------- Enums ----------

export type EnemyType  = 'A' | 'B' | 'C' | 'D';
export type DropType   = 'RAPID' | 'SPREAD' | 'SHIELD' | 'BOMB' | 'LIFE';
export type BulletOwner = 'player' | 'enemy';
export type RoomState  = 'LOBBY' | 'PLAYING' | 'SHOP' | 'GAME_OVER';
export type UpgradeId  =
  | 'fire_rate'
  | 'move_speed'
  | 'multi_shot'
  | 'shield'
  | 'bullet_spd';

// ---------- Sub-shapes ----------

export interface Effect {
  active:     boolean;
  framesLeft: number;
}

export interface Effects {
  rapid:  Effect;
  spread: Effect;
}

export interface Upgrades {
  fire_rate:  number;
  move_speed: number;
  multi_shot: number;
  shield:     number;
  bullet_spd: number;
}

export interface Input {
  held: {
    left:  boolean;
    right: boolean;
    shoot: boolean;
    roll:  boolean;
    bomb:  boolean;
  };
  pressed: {
    roll:    boolean;
    bomb:    boolean;
    confirm: boolean;
  };
}

// ---------- Player ----------

/** Full server-side player state. Never sent to clients directly. */
export interface ServerPlayer {
  id:            number;        // 0–3
  connected:     boolean;
  alive:         boolean;
  x:             number;
  y:             number;
  lives:         number;
  score:         number;
  kills:         number;
  combo:         number;
  comboTimer:    number;
  rolling:       boolean;
  rollTimer:     number;
  rollDir:       number;        // -1 | 1
  rollCooldown:  number;
  rollCooldownFrac: number;     // 0–1, for HUD
  invincible:    boolean;
  invTimer:      number;
  shootCooldown: number;
  bombs:         number;
  shieldActive:  boolean;
  shieldHits:    number;
  effects:       Effects;
  upgrades:      Upgrades;
  input:         Input;
}

/** Serialised player state sent to clients each broadcast. */
export interface ClientPlayer {
  id:               number;
  x:                number;
  y:                number;
  lives:            number;
  score:            number;
  kills:            number;
  combo:            number;
  alive:            boolean;
  connected:        boolean;
  rolling:          boolean;
  rollDir:          number;
  invincible:       boolean;
  shieldActive:     boolean;
  shieldHits:       number;
  bombs:            number;
  rollCooldownFrac: number;
  effects:          Effects;
  upgrades:         Upgrades;
}

// ---------- Enemy ----------

export interface ServerEnemy {
  id:          number;
  type:        EnemyType;
  x:           number;
  y:           number;
  hp:          number;
  maxHp:       number;
  char:        string;
  color:       string;
  flashTimer:  number;
  shootTimer:  number;
  moveTimer:   number;
  moveDir:     number;
  phaseTimer:  number;
}

export interface ClientEnemy {
  id:         number;
  type:       EnemyType;
  x:          number;
  y:          number;
  hp:         number;
  maxHp:      number;
  char:       string;
  flashTimer: number;
}

// ---------- Bullet ----------

export interface Bullet {
  id:      number;
  owner:   BulletOwner;
  ownerId: number | null;
  x:       number;
  y:       number;
  vx:      number;
  vy:      number;
  char:    string;
  color:   string;
  damage:  number;
}

export interface ClientBullet {
  id:    number;
  owner: BulletOwner;
  x:     number;
  y:     number;
  char:  string;
  color: string;
}

// ---------- Drop ----------

export interface Drop {
  id:    number;
  type:  DropType;
  x:     number;
  y:     number;
  char:  string;
  color: string;
  life:  number;
}

// ---------- Spawn ----------

export interface SpawnEntry {
  type:  EnemyType;
  col:   number;
  row:   number;
  delay: number;
}

// ---------- Game state (server-internal) ----------

export interface GameState {
  frame:      number;
  wave:       number;
  enemies:    ServerEnemy[];
  bullets:    Bullet[];
  drops:      Drop[];
  spawnQueue: SpawnEntry[];
  spawnTimer: number;
  allSpawned: boolean;
  interlude:  number;
  _nextEnemyId:  number;
  _nextBulletId: number;
  _nextDropId:   number;
}

// ---------- Shop ----------

export interface ShopPlayerState {
  id:       number;
  score:    number;
  upgrades: Upgrades;
}

export interface ShopState {
  readyFlags: boolean[];
  players:    ShopPlayerState[];
}

// ---------- End of game ----------

export interface PlayerResult {
  id:    number;
  score: number;
  kills: number;
}
