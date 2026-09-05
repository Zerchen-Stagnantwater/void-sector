// ============================================
//   DamageSim.ts
//   Player damage, shield absorption,
//   and death detection.
// ============================================

import type { ServerPlayer, GameState } from '@void-sector/shared';
import { C } from '@void-sector/shared';
import type { Room } from '../room/Room.js';
import { broadcast } from '../room/RoomManager.js';

// ---------- Player damage ----------

export function damagePlayer(
  p:        ServerPlayer,
  room:     Room,
  breached: boolean,
): void {
  const gs = room.gameState;
  if (!gs) return;

  if (!breached) {
    // Check enemy bullet hits
    const hits = gs.bullets.filter(
      b => b.owner === 'enemy' &&
           Math.abs(b.x - p.x) < 0.8 &&
           Math.abs(b.y - p.y) < 0.8,
    );
    if (hits.length === 0) return;
    for (const b of hits) {
      const bi = gs.bullets.indexOf(b);
      if (bi !== -1) gs.bullets.splice(bi, 1);
    }
  }

  if (p.invincible) return;

  // Shield absorb
  if (p.shieldActive && p.shieldHits > 0) {
    p.shieldHits--;
    if (p.shieldHits <= 0) p.shieldActive = false;
    p.invincible = true;
    p.invTimer   = 30;
    broadcast(room, {
      type: 'event', event: 'shield_hit',
      x: p.x, y: p.y,
      data: { playerId: p.id },
    });
    return;
  }

  p.lives--;
  p.invincible = true;
  p.invTimer   = C.PLAYER.INVINCIBLE_FRAMES;

  if (p.lives <= 0) {
    p.alive = false;
    broadcast(room, {
      type: 'event', event: 'player_die',
      x: p.x, y: p.y,
      data: { playerId: p.id },
    });
  } else {
    broadcast(room, {
      type: 'event', event: 'player_hit',
      x: p.x, y: p.y,
      data: { playerId: p.id },
    });
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

// Extend GameState with pending drops side-channel
declare module '@void-sector/shared' {
  interface GameState {
    _pendingDrops?: Array<{ x: number; y: number }>;
  }
}
