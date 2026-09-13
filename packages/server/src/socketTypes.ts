// ============================================
//   socketTypes.ts
//   Typed socket.io generics.
//   One event, 'msg', carries the existing
//   ClientMessage / ServerMessage envelope —
//   this is what lets every other file (GameLoop,
//   Shop, RoomManager's public API) stay untouched
//   by the transport swap.
// ============================================

import type { Server, Socket } from 'socket.io';
import type { ClientMessage, ServerMessage } from '@void-sector/shared';

export interface ClientToServerEvents {
  msg: (msg: ClientMessage) => void;
}

export interface ServerToClientEvents {
  msg: (msg: ServerMessage) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents { }

export interface SocketData {
  roomCode?: string;
  playerId?: number;
}

export type AppServer = Server<ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
