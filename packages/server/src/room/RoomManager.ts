// ============================================
//   RoomManager.ts
//   Create, join, leave, destroy rooms.
//   Broadcast helpers.
//   No game logic — pure room bookkeeping.
//
//   Per-connection state (roomCode, playerId) lives
//   on socket.data — no separate connection map to
//   keep in sync or leak.
// ============================================

import type { ServerMessage } from '@void-sector/shared';
import type { AppSocket } from '../socketTypes.js';
import { makeRoom, makePlayer, type Room } from './Room.js';

// ---------- Constants ----------

const MAX_PLAYERS = 4;
const LOBBY_TTL_MS = 10 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ---------- Store ----------

const rooms = new Map<string, Room>();

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

export function createRoom(socket: AppSocket): { room: Room; playerId: number } {
  const code = generateCode();
  const room = makeRoom(code, 0);

  room.sockets.set(0, socket);
  room.lobbyTimer = setTimeout(() => {
    if (room.phase === 'LOBBY') destroyRoom(code, 'LOBBY_TIMEOUT');
  }, LOBBY_TTL_MS);

  rooms.set(code, room);
  socket.data.roomCode = code;
  socket.data.playerId = 0;

  return { room, playerId: 0 };
}

// ---------- Join ----------

export type JoinResult =
  | { ok: true; room: Room; playerId: number }
  | { ok: false; error: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'GAME_IN_PROGRESS' };

export function joinRoom(socket: AppSocket, code: string): JoinResult {
  const room = rooms.get(code);

  if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
  if (room.phase !== 'LOBBY') return { ok: false, error: 'GAME_IN_PROGRESS' };
  if (room.players.length >= MAX_PLAYERS) return { ok: false, error: 'ROOM_FULL' };

  const playerId = room.players.length;
  room.players.push(makePlayer(playerId));
  room.sockets.set(playerId, socket);
  socket.data.roomCode = code;
  socket.data.playerId = playerId;

  return { ok: true, room, playerId };
}

// ---------- Leave ----------

export interface LeaveResult {
  room: Room | null;
  playerId: number;
  roomCode: string;
  newHostId: number;
  playerCount: number;
}

export function playerLeft(socket: AppSocket): LeaveResult | null {
  const { roomCode, playerId } = socket.data;
  if (roomCode === undefined || playerId === undefined) return null;

  const room = rooms.get(roomCode);
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
    newHostId: room.hostId,
    playerCount: room.players.filter(p => p.connected).length,
  };
}

// ---------- Destroy ----------

export function destroyRoom(code: string, reason: string): void {
  const room = rooms.get(code);
  if (!room) return;

  if (room.tickInterval) clearInterval(room.tickInterval);
  if (room.lobbyTimer) clearTimeout(room.lobbyTimer);

  rooms.delete(code);
  console.log(`[Room] ${code} destroyed — ${reason}`);
}

// ---------- Getters ----------

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function getConn(socket: AppSocket): { roomCode: string; playerId: number } | undefined {
  const { roomCode, playerId } = socket.data;
  if (roomCode === undefined || playerId === undefined) return undefined;
  return { roomCode, playerId };
}

export function getRoomCount(): number {
  return rooms.size;
}

export function getConnectionCount(): number {
  let n = 0;
  for (const room of rooms.values()) n += room.sockets.size;
  return n;
}

// ---------- Broadcast ----------
// socket.io no-ops silently on a disconnected socket — no readyState
// checks or try/catch needed here, unlike the raw-ws version.

export function broadcast(room: Room, msg: ServerMessage): void {
  for (const [, socket] of room.sockets) socket.emit('msg', msg);
}

export function broadcastExcept(room: Room, excludeId: number, msg: ServerMessage): void {
  for (const [id, socket] of room.sockets) {
    if (id !== excludeId) socket.emit('msg', msg);
  }
}

export function sendTo(socket: AppSocket, msg: ServerMessage): void {
  socket.emit('msg', msg);
}
