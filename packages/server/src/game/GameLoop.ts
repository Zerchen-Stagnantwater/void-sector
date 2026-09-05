// ============================================
//   GameLoop.ts
//   Tick orchestration and wave lifecycle.
//   Calls PlayerSim, EnemySim, DropSim.
//   Broadcasts state at 20fps.
//   Manages wave transitions and game over.
// ============================================

import type { GameState, ServerPlayer } from '@void-sector/shared';
import { C } from '@void-sector/shared';
import type { Room } from '../room/Room.js';
import { serializePlayer } from '../room/Room.js';
import { broadcast } from '../room/RoomManager.js';
import { tickPlayer, tickBullets } from './PlayerSim.js';
import { tickEnemies, spawnEnemy } from './EnemySim.js';
import { damagePlayer } from './DamageSim.js';
import { tickDrops, flushPendingDrops } from './DropSim.js';
import { openShop } from './Shop.js';
import { buildWave } from './WaveBuilder.js';

const BROADCAST_EVERY = 3; // ticks — 60fps tick, 20fps broadcast

// ---------- Start game ----------

export function startGame(room: Room): void {
  if (room.phase !== 'LOBBY') return;

  if (room.lobbyTimer) clearTimeout(room.lobbyTimer);

  room.phase     = 'PLAYING';
  room.gameState = makeGameState();

  // Reset all players
  const startCols = C.PLAYER_START_COLS;
  for (const p of room.players) {
    if (!p.connected) continue;
    resetPlayer(p, startCols[p.id] ?? C.COLS / 2);
  }

  _startNextWave(room);

  broadcast(room, {
    type:    'game_start',
    wave:    room.gameState.wave,
    players: room.players.map(serializePlayer),
  });

  room.tickInterval = setInterval(() => _tick(room), C.TICK_MS);
  console.log(`[Game] Room ${room.code} started`);
}

// ---------- Core tick ----------

function _tick(room: Room): void {
  const gs = room.gameState;
  if (!gs) return;

  gs.frame++;

  const livePlayers = room.players.filter(p => p.alive && p.connected);

  // 1. Simulate players
  for (const p of livePlayers) tickPlayer(p, gs);

  // 2. Move bullets
  tickBullets(gs);

  // 3. Enemy AI + collision
  tickEnemies(room, livePlayers);

  // 4. Flush drops queued by EnemySim
  flushPendingDrops(gs);

  // 5. Drop fall + pickup
  tickDrops(room, livePlayers);

  // 6. Enemy bullet hits on players
  for (const p of livePlayers) {
    if (!p.invincible) damagePlayer(p, room, false);
  }

  // 7. Spawner
  _tickSpawner(room, gs);

  // 8. Check wave / game over
  _checkWaveComplete(room, gs);

  // 9. Broadcast at 20fps
  if (gs.frame % BROADCAST_EVERY === 0) _broadcastState(room, gs);
}

// ---------- Spawner ----------

function _tickSpawner(room: Room, gs: GameState): void {
  if (gs.interlude > 0) { gs.interlude--; return; }

  gs.spawnTimer++;

  if (!gs.allSpawned) {
    const playerCount = room.players.filter(p => p.connected).length;

    while (
      gs.spawnQueue.length > 0 &&
      (gs.spawnQueue[0]?.delay ?? Infinity) <= gs.spawnTimer
    ) {
      const entry = gs.spawnQueue.shift();
      if (entry) spawnEnemy(gs, entry.type, entry.col, entry.row, playerCount);
    }

    if (gs.spawnQueue.length === 0) gs.allSpawned = true;
  }
}

// ---------- Wave complete ----------

function _checkWaveComplete(room: Room, gs: GameState): void {
  if (!gs.allSpawned)          return;
  if (gs.enemies.length > 0)   return;
  if (room.phase !== 'PLAYING') return;

  // Transition immediately to prevent re-entry
  room.phase = 'SHOP';

  const bonus = C.SCORE.WAVE_CLEAR_BONUS + (gs.wave - 1) * 100;
  for (const p of room.players) {
    if (!p.alive || !p.connected) continue;
    p.score += bonus;
  }

  broadcast(room, {
    type:  'event',
    event: 'wave_clear',
    x:     0,
    y:     0,
    data:  { bonus, wave: gs.wave },
  });

  openShop(room);
}

// ---------- Next wave ----------

export function startNextWave(room: Room): void {
  const gs = room.gameState;
  if (!gs) return;

  room.phase = 'PLAYING';

  gs.wave++;
  gs.enemies    = [];
  gs.bullets    = [];
  gs.drops      = [];
  gs.spawnTimer = 0;
  gs.allSpawned = false;
  gs.interlude  = 90;

  const playerCount = room.players.filter(p => p.connected).length;
  gs.spawnQueue = buildWave(gs.wave, playerCount);
  gs.spawnQueue.sort((a, b) => a.delay - b.delay);

  // Reset player positions
  const startCols = C.PLAYER_START_COLS;
  for (const p of room.players) {
    if (!p.alive || !p.connected) continue;
    p.x            = startCols[p.id] ?? C.COLS / 2;
    p.y            = C.PLAYER.START_ROW;
    p.invincible   = false;
    p.invTimer     = 0;
    p.rolling      = false;
    p.shootCooldown= 0;
  }

  broadcast(room, { type: 'wave_start', wave: gs.wave });
  console.log(`[Game] Room ${room.code} — wave ${gs.wave}`);
}

function _startNextWave(room: Room): void {
  startNextWave(room);
}

// ---------- All dead check ----------

export function checkAllDead(room: Room): void {
  const anyAlive = room.players.some(p => p.alive && p.connected);
  if (!anyAlive && room.phase === 'PLAYING') {
    room.phase = 'GAME_OVER';
    setTimeout(() => endGame(room), 1500);
  }
}

// ---------- Game over ----------

function endGame(room: Room): void {
  if (room.tickInterval) {
    clearInterval(room.tickInterval);
    room.tickInterval = null;
  }

  const stats = room.players
    .filter(p => p.connected)
    .map(p => ({ id: p.id, score: p.score, kills: p.kills }));

  broadcast(room, {
    type:  'game_over',
    wave:  room.gameState?.wave ?? 0,
    stats,
  });

  console.log(`[Game] Room ${room.code} — game over wave ${room.gameState?.wave}`);
}

// ---------- State broadcast ----------

function _broadcastState(room: Room, gs: GameState): void {
  const shopState = room.phase === 'SHOP'
    ? {
        readyFlags: room.shopReady,
        players:    room.players
          .filter(p => p.connected)
          .map(p => ({ id: p.id, score: p.score, upgrades: p.upgrades })),
      }
    : null;

  broadcast(room, {
    type:      'state',
    frame:     gs.frame,
    wave:      gs.wave,
    roomState: room.phase,
    players:   room.players.map(serializePlayer),
    enemies:   gs.enemies.map(e => ({
      id:         e.id,
      type:       e.type,
      x:          e.x,
      y:          e.y,
      hp:         e.hp,
      maxHp:      e.maxHp,
      char:       e.char,
      flashTimer: e.flashTimer,
    })),
    bullets: gs.bullets.map(b => ({
      id:    b.id,
      owner: b.owner,
      x:     b.x,
      y:     b.y,
      char:  b.char,
      color: b.color,
    })),
    drops:     gs.drops,
    shopState,
  });
}

// ---------- Helpers ----------

function makeGameState(): GameState {
  return {
    frame:         0,
    wave:          0,
    enemies:       [],
    bullets:       [],
    drops:         [],
    spawnQueue:    [],
    spawnTimer:    0,
    allSpawned:    false,
    interlude:     0,
    _nextEnemyId:  0,
    _nextBulletId: 0,
    _nextDropId:   0,
  };
}

function resetPlayer(p: ServerPlayer, startCol: number): void {
  p.x             = startCol;
  p.y             = C.PLAYER.START_ROW;
  p.lives         = C.PLAYER.LIVES;
  p.score         = 0;
  p.kills         = 0;
  p.combo         = 0;
  p.comboTimer    = 0;
  p.rolling       = false;
  p.rollTimer     = 0;
  p.rollCooldown  = 0;
  p.invincible    = false;
  p.invTimer      = 0;
  p.shootCooldown = 0;
  p.bombs         = 0;
  p.shieldActive  = false;
  p.shieldHits    = 0;
  p.alive         = true;
  p.effects.rapid.active      = false;
  p.effects.rapid.framesLeft  = 0;
  p.effects.spread.active     = false;
  p.effects.spread.framesLeft = 0;
}
