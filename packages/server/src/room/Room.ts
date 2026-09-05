// ============================================
//   Room.ts
//   Room shape and player factory.
//   Pure data — no logic, no side effects.
// ============================================

import type { WebSocket } from 'ws';
import type { ServerPlayer, GameState } from '@void-sector/shared';
import { C } from '@void-sector/shared';

// ---------- Room ----------

export type RoomPhase = 'LOBBY' | 'PLAYING' | 'SHOP' | 'GAME_OVER';

export interface Room {
  code:         string;
  phase:        RoomPhase;
  players:      ServerPlayer[];
  hostId:       number;
  sockets:      Map<number, WebSocket>;   // playerId → socket
  gameState:    GameState | null;
  tickInterval: ReturnType<typeof setInterval> | null;
  shopReady:    boolean[];
  lobbyTimer:   ReturnType<typeof setTimeout> | null;
  createdAt:    number;
}

// ---------- Player factory ----------

export function makePlayer(id: number): ServerPlayer {
  const startCol = C.PLAYER_START_COLS[id] ?? C.COLS / 2;

  return {
    id,
    connected:        true,
    alive:            true,
    x:                startCol,
    y:                C.PLAYER.START_ROW,
    lives:            C.PLAYER.LIVES,
    score:            0,
    kills:            0,
    combo:            0,
    comboTimer:       0,
    rolling:          false,
    rollTimer:        0,
    rollDir:          1,
    rollCooldown:     0,
    rollCooldownFrac: 0,
    invincible:       false,
    invTimer:         0,
    shootCooldown:    0,
    bombs:            0,
    shieldActive:     false,
    shieldHits:       0,
    effects: {
      rapid:  { active: false, framesLeft: 0 },
      spread: { active: false, framesLeft: 0 },
    },
    upgrades: {
      fire_rate:  0,
      move_speed: 0,
      multi_shot: 0,
      shield:     0,
      bullet_spd: 0,
    },
    input: {
      held:    { left: false, right: false, shoot: false, roll: false, bomb: false },
      pressed: { roll: false, bomb: false, confirm: false },
    },
  };
}

// ---------- Room factory ----------

export function makeRoom(code: string, firstPlayerId: number): Room {
  return {
    code,
    phase:        'LOBBY',
    players:      [makePlayer(firstPlayerId)],
    hostId:       firstPlayerId,
    sockets:      new Map(),
    gameState:    null,
    tickInterval: null,
    shopReady:    [],
    lobbyTimer:   null,
    createdAt:    Date.now(),
  };
}

// ---------- Serialise player for broadcast ----------

export function serializePlayer(p: ServerPlayer) {
  return {
    id:               p.id,
    x:                p.x,
    y:                p.y,
    lives:            p.lives,
    score:            p.score,
    kills:            p.kills,
    combo:            p.combo,
    alive:            p.alive,
    connected:        p.connected,
    rolling:          p.rolling,
    rollDir:          p.rollDir,
    invincible:       p.invincible,
    shieldActive:     p.shieldActive,
    shieldHits:       p.shieldHits,
    bombs:            p.bombs,
    rollCooldownFrac: p.rollCooldownFrac,
    effects:          p.effects,
    upgrades:         p.upgrades,
  };
}
