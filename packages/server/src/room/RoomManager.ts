// ============================================
//   RoomManager.ts
//   Create, join, leave, destroy rooms.
//   Broadcast helpers.
//   No game logic — pure room bookkeeping.
// ============================================

import type { WebSocket } from 'ws';
import type { ServerMessage } from '@void-sector/shared';
import { makeRoom, makePlayer, type Room } from './Room.js';

// ---------- Constants ----------

const MAX_PLAYERS    = 4;
const LOBBY_TTL_MS   = 10 * 60 * 1000;
const CODE_CHARS     = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ---------- Stores ----------

const rooms      = new Map<string, Room>();
const connToRoom = new Map<WebSocket, { roomCode: string; playerId: number }>();

// ---------- Code generation ----------

function generateCode(): string {
  let code: string;
  do {
    code = Array.from(
      { length: 4 },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)] ?? 'A',
    ).join('');
  } while (rooms.has(code));
  return code;
}

// ---------- Create ----------

export function createRoom(ws: WebSocket): { room: Room; playerId: number } {
  const code   = generateCode();
  const room   = makeRoom(code, 0);

  room.sockets.set(0, ws);
  room.lobbyTimer = setTimeout(() => {
    if (room.phase === 'LOBBY') destroyRoom(code, 'LOBBY_TIMEOUT');
  }, LOBBY_TTL_MS);

  rooms.set(code, room);
  connToRoom.set(ws, { roomCode: code, playerId: 0 });

  return { room, playerId: 0 };
}

// ---------- Join ----------

export type JoinResult =
  | { ok: true;  room: Room; playerId: number }
  | { ok: false; error: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'GAME_IN_PROGRESS' };

export function joinRoom(ws: WebSocket, code: string): JoinResult {
  const room = rooms.get(code);

  if (!room)                        return { ok: false, error: 'ROOM_NOT_FOUND' };
  if (room.phase !== 'LOBBY')       return { ok: false, error: 'GAME_IN_PROGRESS' };
  if (room.players.length >= MAX_PLAYERS) return { ok: false, error: 'ROOM_FULL' };

  const playerId = room.players.length;
  room.players.push(makePlayer(playerId));
  room.sockets.set(playerId, ws);
  connToRoom.set(ws, { roomCode: code, playerId });

  return { ok: true, room, playerId };
}

// ---------- Leave ----------

export interface LeaveResult {
  room:        Room | null;
  playerId:    number;
  roomCode:    string;
  newHostId:   number;
  playerCount: number;
}

export function playerLeft(ws: WebSocket): LeaveResult | null {
  const conn = connToRoom.get(ws);
  if (!conn) return null;

  const { roomCode, playerId } = conn;
  const room = rooms.get(roomCode);
  connToRoom.delete(ws);

  if (!room) return null;

  const player = room.players[playerId];
  if (player) {
    player.connected = false;
    if (room.phase === 'PLAYING' || room.phase === 'SHOP') {
      player.alive = false;
    }
  }

  // Auto-ready disconnected player so shop never soft-locks
  if (room.shopReady.length > playerId) {
    room.shopReady[playerId] = true;
  }

  // Host migration across all phases
  if (playerId === room.hostId) {
    const next = room.players.find(p => p.connected);
    if (next) room.hostId = next.id;
  }

  room.sockets.delete(playerId);

  const anyConnected = room.players.some(p => p.connected);
  if (!anyConnected) {
    destroyRoom(roomCode, 'ALL_DISCONNECTED');
    return { room: null, playerId, roomCode, newHostId: -1, playerCount: 0 };
  }

  return {
    room,
    playerId,
    roomCode,
    newHostId:   room.hostId,
    playerCount: room.players.filter(p => p.connected).length,
  };
}

// ---------- Destroy ----------

export function destroyRoom(code: string, reason: string): void {
  const room = rooms.get(code);
  if (!room) return;

  if (room.tickInterval) clearInterval(room.tickInterval);
  if (room.lobbyTimer)   clearTimeout(room.lobbyTimer);

  rooms.delete(code);
  console.log(`[Room] ${code} destroyed — ${reason}`);
}

// ---------- Getters ----------

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function getConn(ws: WebSocket) {
  return connToRoom.get(ws);
}

export function getRoomCount():       number { return rooms.size;       }
export function getConnectionCount(): number { return connToRoom.size;  }

// ---------- Broadcast ----------

export function broadcast(room: Room, msg: ServerMessage): void {
  const str = JSON.stringify(msg);
  for (const [, socket] of room.sockets) {
    if (socket.readyState === 1) {
      try { socket.send(str); } catch { /* dead socket */ }
    }
  }
}

export function broadcastExcept(
  room: Room,
  excludeId: number,
  msg: ServerMessage,
): void {
  const str = JSON.stringify(msg);
  for (const [id, socket] of room.sockets) {
    if (id !== excludeId && socket.readyState === 1) {
      try { socket.send(str); } catch { /* dead socket */ }
    }
  }
}

export function sendTo(ws: WebSocket, msg: ServerMessage): void {
  try {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  } catch { /* dead socket */ }
}
