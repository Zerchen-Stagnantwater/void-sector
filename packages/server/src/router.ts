// ============================================
//   router.ts
//   Routes every inbound WebSocket message
//   to the correct handler.
//   Keeps index.ts clean.
// ============================================

import type { WebSocket } from 'ws';
import type { ClientMessage, UpgradeId } from '@void-sector/shared';
import {
  createRoom, joinRoom, playerLeft,
  getRoom, getConn,
  broadcast, broadcastExcept, sendTo,
  getRoomCount, getConnectionCount,
} from './room/RoomManager.js';
import { startGame, startNextWave, checkAllDead } from './game/GameLoop.js';
import { handleShopBuy, handleShopReady } from './game/Shop.js';

// ---------- Rate limiter ----------

const rateLimiters = new WeakMap<WebSocket, { count: number; window: number }>();
const MSG_PER_SEC  = 70;

function isRateLimited(ws: WebSocket): boolean {
  const now    = Date.now();
  const state  = rateLimiters.get(ws) ?? { count: 0, window: now };

  if (now - state.window > 1000) {
    state.count  = 0;
    state.window = now;
  }

  state.count++;
  rateLimiters.set(ws, state);
  return state.count > MSG_PER_SEC;
}

// ---------- Route ----------

export function route(ws: WebSocket, raw: string): void {
  if (isRateLimited(ws)) return;

  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    return;
  }

  if (!msg?.type) return;

  switch (msg.type) {

    // ---- Lobby ----

    case 'create': {
      const { room, playerId } = createRoom(ws);
      sendTo(ws, {
        type:     'room_created',
        code:     room.code,
        playerId,
        isHost:   true,
      });
      console.log(`[Room] Created ${room.code}`);
      break;
    }

    case 'join': {
      const code   = msg.code.toUpperCase().trim();
      const result = joinRoom(ws, code);

      if (!result.ok) {
        sendTo(ws, { type: 'error', message: result.error });
        return;
      }

      const { room, playerId } = result;

      sendTo(ws, {
        type:        'room_joined',
        code:        room.code,
        playerId,
        playerCount: room.players.length,
        isHost:      playerId === room.hostId,
      });

      broadcastExcept(room, playerId, {
        type:        'player_joined',
        playerId,
        playerCount: room.players.length,
      });

      console.log(`[Room] ${code} — P${playerId} joined (${room.players.length}/4)`);
      break;
    }

    case 'start': {
      const conn = getConn(ws);
      if (!conn) return;

      const room = getRoom(conn.roomCode);
      if (!room) return;

      if (conn.playerId !== room.hostId) {
        sendTo(ws, { type: 'error', message: 'NOT_HOST' });
        return;
      }

      startGame(room);
      break;
    }

    // ---- Gameplay ----

    case 'input': {
      const conn = getConn(ws);
      if (!conn) return;

      const room   = getRoom(conn.roomCode);
      if (!room || room.phase !== 'PLAYING') return;

      const player = room.players[conn.playerId];
      if (!player?.alive) return;

      if (msg.held) {
        player.input.held.left  = !!msg.held.left;
        player.input.held.right = !!msg.held.right;
        player.input.held.shoot = !!msg.held.shoot;
        player.input.held.roll  = !!msg.held.roll;
        player.input.held.bomb  = !!msg.held.bomb;
      }

      if (msg.pressed) {
        // Only set true — gameLoop clears after consuming
        if (msg.pressed.roll)    player.input.pressed.roll    = true;
        if (msg.pressed.bomb)    player.input.pressed.bomb    = true;
        if (msg.pressed.confirm) player.input.pressed.confirm = true;
      }
      break;
    }

    // ---- Shop ----

    case 'shop_buy': {
      const conn = getConn(ws);
      if (!conn) return;

      const room = getRoom(conn.roomCode);
      if (!room) return;

      // Validate itemId is a known upgrade string
      const validIds: UpgradeId[] = [
        'fire_rate', 'move_speed', 'multi_shot', 'shield', 'bullet_spd',
      ];
      if (!validIds.includes(msg.itemId)) return;

      handleShopBuy(room, conn.playerId, msg.itemId);
      break;
    }

    case 'shop_ready': {
      const conn = getConn(ws);
      if (!conn) return;

      const room = getRoom(conn.roomCode);
      if (!room) return;

      const allReady = handleShopReady(room, conn.playerId);
      if (allReady) startNextWave(room);
      break;
    }

    // ---- Keepalive ----

    case 'ping':
      sendTo(ws, { type: 'pong' });
      break;
  }
}

// ---------- Disconnect ----------

export function handleDisconnect(ws: WebSocket): void {
  const result = playerLeft(ws);
  if (!result?.room) return;

  const { room, playerId, newHostId, playerCount } = result;

  broadcastExcept(room, playerId, {
    type:        'player_left',
    playerId,
    playerCount,
    newHostId:   newHostId >= 0 ? newHostId : null,
  });

  // Check if remaining players are all dead
  checkAllDead(room);
}

// ---------- Health stats (for logging) ----------

export function logHealth(): void {
  const rooms = getRoomCount();
  const conns  = getConnectionCount();
  if (rooms > 0 || conns > 0) {
    console.log(
      `[Health] rooms=${rooms} connections=${conns} uptime=${Math.floor(process.uptime())}s`,
    );
  }
}
