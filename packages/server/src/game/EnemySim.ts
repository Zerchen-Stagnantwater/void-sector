// ============================================
//   EnemySim.ts
//   Enemy AI, bullet collision, player damage.
//   Each enemy type has its own AI function.
// ============================================

import type {
  ServerEnemy, ServerPlayer, GameState,
  EnemyType, Bullet,
} from '@void-sector/shared';
import { damagePlayer } from './DamageSim.js';
import { C } from '@void-sector/shared';
import type { Room } from '../room/Room.js';
import { broadcast } from '../room/RoomManager.js';
import { spawnBullet } from './PlayerSim.js';

// ---------- Spawn enemy ----------

export function spawnEnemy(
  gs:          GameState,
  type:        EnemyType,
  col:         number,
  row:         number,
  playerCount: number,
): void {
  const def     = C.ENEMY[type];
  const hpScale = 1 + (playerCount - 1) * C.MP_SCALE.HP_PER_PLAYER;
  const hp      = Math.ceil(def.HP * hpScale);

  const enemy: ServerEnemy = {
    id:         gs._nextEnemyId++,
    type,
    x:          col,
    y:          row,
    hp,
    maxHp:      hp,
    char:       def.CHAR,
    color:      def.COLOR,
    flashTimer: 0,
    shootTimer: Math.floor(Math.random() * def.SHOOT_RATE),
    moveTimer:  Math.floor(Math.random() * 60),
    moveDir:    Math.random() < 0.5 ? 1 : -1,
    phaseTimer: 0,
  };

  gs.enemies.push(enemy);
}

// ---------- Tick all enemies ----------

export function tickEnemies(room: Room, players: ServerPlayer[]): void {
  const gs = room.gameState;
  if (!gs) return;

  for (let i = gs.enemies.length - 1; i >= 0; i--) {
    const e = gs.enemies[i];
    if (!e) continue;

    if (e.flashTimer > 0) e.flashTimer--;

    // AI
    switch (e.type) {
      case 'A': aiGrunt(e, gs);           break;
      case 'B': aiDasher(e, gs, players); break;
      case 'C': aiTank(e, gs);            break;
      case 'D': aiBomber(e, gs);          break;
    }

    // Bullet collision — returns true if enemy was killed
    const killed = checkBulletHits(e, i, room, players);
    if (killed) continue;

    // Body collision with players
    checkBodyCollision(e, room, players);

    // Reached bottom — breach damage
    if (e.y >= C.ROWS - 1) {
      gs.enemies.splice(i, 1);
      const target = nearestPlayer(e, players);
      if (target) damagePlayer(target, room, true);
    }
  }
}

// ---------- AI: Grunt ----------

function aiGrunt(e: ServerEnemy, gs: GameState): void {
  e.y += C.ENEMY.A.SPEED;

  e.moveTimer++;
  if (e.moveTimer % 90 === 0) e.moveDir = Math.random() < 0.5 ? 1 : -1;
  e.x = clampX(e.x + e.moveDir * 0.008);

  tickShoot(e, C.ENEMY.A.SHOOT_RATE, gs, () => {
    spawnBullet(gs, {
      owner: 'enemy', ownerId: null,
      x: e.x, y: e.y + 1,
      vx: 0, vy: C.BULLET.ENEMY_SPEED,
      char: '!', color: '#ff2200', damage: 1,
    });
  });
}

// ---------- AI: Dasher ----------

function aiDasher(
  e:       ServerEnemy,
  gs:      GameState,
  players: ServerPlayer[],
): void {
  e.y += C.ENEMY.B.SPEED;

  e.moveTimer++;
  if (e.moveTimer % 40 === 0) e.moveDir *= -1;
  e.x = clampX(e.x + e.moveDir * 0.22);
  if (e.x <= 1 || e.x >= C.COLS - 2) e.moveDir *= -1;

  tickShoot(e, C.ENEMY.B.SHOOT_RATE, gs, () => {
    const target = nearestPlayer(e, players);
    if (!target) return;

    const dx  = target.x - e.x;
    const dy  = target.y - e.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd = C.BULLET.ENEMY_SPEED * 1.2;

    spawnBullet(gs, {
      owner: 'enemy', ownerId: null,
      x: e.x, y: e.y + 1,
      vx: (dx / len) * spd * 0.5,
      vy: (dy / len) * spd,
      char: '!', color: '#ff6600', damage: 1,
    });
  });
}

// ---------- AI: Tank ----------

function aiTank(e: ServerEnemy, gs: GameState): void {
  e.y += C.ENEMY.C.SPEED;

  e.moveTimer++;
  e.x = clampX(e.x + Math.sin(e.moveTimer * 0.04) * 0.03);

  tickShoot(e, C.ENEMY.C.SHOOT_RATE, gs, () => {
    const opts = { owner: 'enemy' as const, ownerId: null, vy: C.BULLET.ENEMY_SPEED, char: '!', color: '#ff00aa', damage: 1, vx: 0 };
    spawnBullet(gs, { ...opts, x: e.x,       y: e.y + 1 });
    spawnBullet(gs, { ...opts, x: e.x + 0.8, y: e.y + 1 });
  });
}

// ---------- AI: Bomber ----------

function aiBomber(e: ServerEnemy, gs: GameState): void {
  const hoverRow = Math.floor(C.ROWS * 0.35);

  if (e.y < hoverRow) {
    e.y += C.ENEMY.D.SPEED * 1.5;
  } else {
    e.phaseTimer++;
    e.x = clampX(e.x + Math.sin(e.phaseTimer * 0.03) * 0.08);
    if (e.phaseTimer > 300) e.y += C.ENEMY.D.SPEED * 0.5;
  }

  tickShoot(e, C.ENEMY.D.SHOOT_RATE, gs, () => {
    for (const vx of [-0.12, 0, 0.12]) {
      spawnBullet(gs, {
        owner: 'enemy', ownerId: null,
        x: e.x, y: e.y + 1,
        vx, vy: C.BULLET.ENEMY_SPEED * 0.85,
        char: '!', color: '#aa00ff', damage: 1,
      });
    }
  });
}

// ---------- Shoot tick ----------

function tickShoot(
  e:      ServerEnemy,
  rate:   number,
  gs:     GameState,
  fireFn: () => void,
): void {
  e.shootTimer++;
  const scaled = Math.max(rate * 0.45, rate - gs.wave * 4);
  if (e.shootTimer >= scaled) {
    e.shootTimer = 0;
    fireFn();
  }
}

// ---------- Bullet collision ----------

function checkBulletHits(
  e:       ServerEnemy,
  idx:     number,
  room:    Room,
  players: ServerPlayer[],
): boolean {
  const gs = room.gameState;
  if (!gs) return false;

  const hits = gs.bullets.filter(
    (b): b is Bullet =>
      b.owner === 'player' &&
      Math.abs(b.x - e.x) < 0.8 &&
      Math.abs(b.y - e.y) < 0.8,
  );

  for (const b of hits) {
    e.hp        -= b.damage;
    e.flashTimer = 6;

    const bi = gs.bullets.indexOf(b);
    if (bi !== -1) gs.bullets.splice(bi, 1);

    broadcast(room, {
      type: 'event', event: 'enemy_hit',
      x: e.x, y: e.y,
      data: { enemyType: e.type, playerId: b.ownerId },
    });

    if (e.hp <= 0) {
      killEnemy(e, idx, room, players, b.ownerId);
      return true;
    }
  }

  return false;
}

// ---------- Kill ----------

function killEnemy(
  e:              ServerEnemy,
  idx:            number,
  room:           Room,
  players:        ServerPlayer[],
  killerPlayerId: number | null,
): void {
  const gs  = room.gameState;
  if (!gs) return;

  const def    = C.ENEMY[e.type];
  const killer = killerPlayerId !== null
    ? room.players.find(p => p.id === killerPlayerId)
    : undefined;

  let earned     = def.SCORE;
  let multiplier = 1;

  if (killer) {
    killer.combo++;
    killer.comboTimer = C.SCORE.COMBO_WINDOW;
    killer.kills++;
    multiplier  = Math.min(killer.combo, 8);
    earned      = def.SCORE * multiplier;
    killer.score += earned;
  } else {
    console.warn('[EnemySim] Kill with no owner — killerPlayerId:', killerPlayerId);
  }

  broadcast(room, {
    type: 'event', event: 'enemy_die',
    x: e.x, y: e.y,
    data: { enemyType: e.type, score: earned, multiplier, playerId: killerPlayerId },
  });

  // Drop chance handled by caller (GameLoop imports DropSim)
  gs.enemies.splice(idx, 1);

  // Return drop info so GameLoop can spawn
  // (We use a side-channel via the room's gameState)
  if (Math.random() < def.DROP_CHANCE) {
    gs._pendingDrops ??= [];
    gs._pendingDrops.push({ x: e.x, y: e.y });
  }
}

// ---------- Body collision ----------

function checkBodyCollision(
  e:       ServerEnemy,
  room:    Room,
  players: ServerPlayer[],
): void {
  for (const p of players) {
    if (p.invincible) continue;
    if (Math.abs(e.x - p.x) < 0.9 && Math.abs(e.y - p.y) < 0.9) {
      damagePlayer(p, room, false);
    }
  }
}


// ---------- Helpers ----------

function clampX(x: number): number {
  return Math.max(1, Math.min(C.COLS - 2, x));
}

function nearestPlayer(
  e:       ServerEnemy,
  players: ServerPlayer[],
): ServerPlayer | undefined {
  let nearest: ServerPlayer | undefined;
  let minDist = Infinity;
  for (const p of players) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d  = dx * dx + dy * dy;
    if (d < minDist) { minDist = d; nearest = p; }
  }
  return nearest;
}
