// ============================================
//   router.ts
//   Registers the 'msg' listener + disconnect
//   handler for one socket. Dispatches to the
//   correct game/room handler by msg.type.
// ============================================

import type { ClientMessage, UpgradeId } from '@void-sector/shared';
import type { AppSocket } from './socketTypes.js';
import {
  createRoom, joinRoom, playerLeft,
  getRoom, getConn,
  broadcast, broadcastExcept, sendTo,
  getRoomCount, getConnectionCount,
} from './room/RoomManager.js';
import { startGame, startNextWave, checkAllDead } from './game/GameLoop.js';
import { handleShopBuy, handleShopReady } from './game/Shop.js';

// ---------- Rate limiter ----------

const MSG_PER_SEC = 70;
const rateState = new WeakMap<AppSocket, { count: number; window: number }>();

function isRateLimited(socket: AppSocket): boolean {
  const now = Date.now();
  const state = rateState.get(socket) ?? { count: 0, window: now };

  if (now - state.window > 1000) {
    state.count = 0;
    state.window = now;
  }

  state.count++;
  rateState.set(socket, state);
  return state.count > MSG_PER_SEC;
}

// ---------- Registration ----------

export function registerHandlers(socket: AppSocket): void {
  socket.on('msg', (msg: ClientMessage) => {
    if (isRateLimited(socket)) return;
    if (!msg?.type) return;
    dispatch(socket, msg);
  });

  socket.on('disconnect', () => handleDisconnect(socket));
}

// ---------- Dispatch ----------

function dispatch(socket: AppSocket, msg: ClientMessage): void {
  switch (msg.type) {

    // ---- Lobby ----

    case 'create': {
      const { room, playerId } = createRoom(socket);
      sendTo(socket, {
        type: 'room_created',
        code: room.code,
        playerId,
        isHost: true,
      });
      console.log(`[Room] Created ${room.code}`);
      break;
    }

    case 'join': {
      const code = msg.code.toUpperCase().trim();
      const result = joinRoom(socket, code);

      if (!result.ok) {
        sendTo(socket, { type: 'error', message: result.error });
        return;
      }

      const { room, playerId } = result;

      sendTo(socket, {
        type: 'room_joined',
        code: room.code,
        playerId,
        playerCount: room.players.length,
        isHost: playerId === room.hostId,
      });

      broadcastExcept(room, playerId, {
        type: 'player_joined',
        playerId,
        playerCount: room.players.length,
      });

      console.log(`[Room] ${code} — P${playerId} joined (${room.players.length}/4)`);
      break;
    }

    case 'start': {
      const conn = getConn(socket);
      if (!conn) return;

      const room = getRoom(conn.roomCode);
      if (!room) return;

      if (conn.playerId !== room.hostId) {
        sendTo(socket, { type: 'error', message: 'NOT_HOST' });
        return;
      }

      startGame(room);
      break;
    }

    // ---- Gameplay ----

    case 'input': {
      const conn = getConn(socket);
      if (!conn) return;

      const room = getRoom(conn.roomCode);
      if (!room || room.phase !== 'PLAYING') return;

      const player = room.players[conn.playerId];
      if (!player?.alive) return;

      if (msg.held) {
        player.input.held.left = !!msg.held.left;
        player.input.held.right = !!msg.held.right;
        player.input.held.shoot = !!msg.held.shoot;
        player.input.held.roll = !!msg.held.roll;
        player.input.held.bomb = !!msg.held.bomb;
      }

      if (msg.pressed) {
        // Only set true — gameLoop clears after consuming
        if (msg.pressed.roll) player.input.pressed.roll = true;
        if (msg.pressed.bomb) player.input.pressed.bomb = true;
        if (msg.pressed.confirm) player.input.pressed.confirm = true;
      }
      break;
    }

    // ---- Shop ----

    case 'shop_buy': {
      const conn = getConn(socket);
      if (!conn) return;

      const room = getRoom(conn.roomCode);
      if (!room) return;

      const validIds: UpgradeId[] = [
        'fire_rate', 'move_speed', 'multi_shot', 'shield', 'bullet_spd',
      ];
      if (!validIds.includes(msg.itemId)) return;

      handleShopBuy(room, conn.playerId, msg.itemId);
      break;
    }

    case 'shop_ready': {
      const conn = getConn(socket);
      if (!conn) return;

      const room = getRoom(conn.roomCode);
      if (!room) return;

      const allReady = handleShopReady(room, conn.playerId);
      if (allReady) startNextWave(room);
      break;
    }

    // ---- Leave ----
    // Explicit "quit to lobby" — same cleanup as a real disconnect, but
    // the socket itself stays connected so the client can create/join
    // another room afterward.

    case 'leave': {
      leaveCurrentRoom(socket);
      break;
    }
  }
}

// ---------- Leave / disconnect (shared) ----------

function leaveCurrentRoom(socket: AppSocket): void {
  const result = playerLeft(socket);
  if (!result?.room) return;

  const { room, playerId, newHostId, playerCount } = result;

  broadcastExcept(room, playerId, {
    type: 'player_left',
    playerId,
    playerCount,
    newHostId: newHostId >= 0 ? newHostId : null,
  });

  checkAllDead(room);
}

function handleDisconnect(socket: AppSocket): void {
  leaveCurrentRoom(socket);
}

// ---------- Health stats (for logging) ----------

export function logHealth(): void {
  const rooms = getRoomCount();
  const conns = getConnectionCount();
  if (rooms > 0 || conns > 0) {
    console.log(
      `[Health] rooms=${rooms} connections=${conns} uptime=${Math.floor(process.uptime())}s`,
    );
  }
}
