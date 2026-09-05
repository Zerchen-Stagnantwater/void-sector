// ============================================
//   DropSim.ts
//   Drop spawning, falling, pickup collision,
//   and powerup effect application.
// ============================================

import type {
  ServerPlayer, GameState, Drop, DropType,
} from '@void-sector/shared';
import { C } from '@void-sector/shared';
import type { Room } from '../room/Room.js';
import { broadcast } from '../room/RoomManager.js';

// ---------- Spawn ----------

export function spawnDrop(gs: GameState, x: number, y: number): void {
  const type   = randomDropType();
  const spawnY = Math.max(y, Math.floor(C.ROWS * 0.38));

  const drop: Drop = {
    id:    gs._nextDropId++,
    type,
    x,
    y:     spawnY,
    char:  C.POWERUP.CHARS[type],
    color: C.POWERUP.COLORS[type],
    life:  480,
  };

  gs.drops.push(drop);
}

function randomDropType(): DropType {
  const roll = Math.random();
  if (roll < 0.30) return 'RAPID';
  if (roll < 0.55) return 'SPREAD';
  if (roll < 0.72) return 'SHIELD';
  if (roll < 0.88) return 'BOMB';
  return 'LIFE';
}

// ---------- Tick ----------

export function tickDrops(room: Room, players: ServerPlayer[]): void {
  const gs = room.gameState;
  if (!gs) return;

  for (let i = gs.drops.length - 1; i >= 0; i--) {
    const d = gs.drops[i];
    if (!d) continue;

    d.y    += C.POWERUP.FALL_SPEED;
    d.life -= 1;

    // Expire
    if (d.y > C.ROWS + 1 || d.life <= 0) {
      gs.drops.splice(i, 1);
      continue;
    }

    // Pickup collision
    const picker = players.find(
      p => Math.abs(d.x - p.x) < 0.9 && Math.abs(d.y - p.y) < 0.9,
    );

    if (picker) {
      applyDrop(d.type, picker);
      broadcast(room, {
        type:  'event',
        event: 'pickup',
        x:     d.x,
        y:     d.y,
        data:  { pickupType: d.type, playerId: picker.id },
      });
      gs.drops.splice(i, 1);
    }
  }
}

// ---------- Apply effect ----------

function applyDrop(type: DropType, player: ServerPlayer): void {
  switch (type) {
    case 'RAPID':
      player.effects.rapid.active     = true;
      player.effects.rapid.framesLeft = C.POWERUP.RAPID_DURATION;
      break;

    case 'SPREAD':
      player.effects.spread.active     = true;
      player.effects.spread.framesLeft = C.POWERUP.SPREAD_DURATION;
      break;

    case 'SHIELD':
      player.shieldActive = true;
      player.shieldHits   = C.POWERUP.SHIELD_HITS;
      break;

    case 'BOMB':
      player.bombs = Math.min(player.bombs + 1, 3);
      break;

    case 'LIFE':
      player.lives = Math.min(player.lives + 1, 6);
      break;
  }
}

// ---------- Flush pending drops ----------
// EnemySim queues drops via gs._pendingDrops.
// GameLoop calls this after tickEnemies.

export function flushPendingDrops(gs: GameState): void {
  if (!gs._pendingDrops?.length) return;

  for (const { x, y } of gs._pendingDrops) {
    spawnDrop(gs, x, y);
  }

  gs._pendingDrops = [];
}
