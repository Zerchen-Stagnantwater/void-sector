// ============================================
//   Net.ts
//   socket.io client wrapper.
//   Typed send/receive using shared message types.
//   Public API (connect/on/off/send/...) is
//   unchanged from the raw-WebSocket version —
//   Lobby.ts and main.ts don't need to change.
// ============================================

import { io, type Socket } from 'socket.io-client';
import type { ClientMessage, ServerMessage } from '@void-sector/shared';
import { held, pressed } from '../core/input.js';

const SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8080'
  : window.location.origin;

// ---------- State ----------

let _socket: Socket | null = null;
let _connected = false;
let _lastInputHash = '';

// Message handlers
const _handlers = new Map<string, Array<(msg: ServerMessage) => void>>();

// 'connected'/'disconnected' are internal-only events (not real server
// messages) — handlers registered for them never read the payload, this
// just satisfies the shared handler signature.
const SENTINEL = { type: '__internal__' } as unknown as ServerMessage;

// ---------- Connect ----------

export function connect(): void {
  if (_socket?.connected) return;

  console.log('[Net] Connecting to', SERVER_URL);

  _socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 16000,
  });

  _socket.on('connect', onConnect);
  _socket.on('disconnect', onDisconnect);
  _socket.on('msg', onMessage);
}

function onConnect(): void {
  console.log('[Net] Connected');
  _connected = true;
  emit('connected', SENTINEL);
}

function onDisconnect(reason: string): void {
  console.log('[Net] Disconnected', reason);
  _connected = false;
  emit('disconnected', SENTINEL);
  // socket.io reconnects automatically unless the server
  // explicitly disconnected us — no manual scheduling needed.
}

function onMessage(msg: ServerMessage): void {
  if (!msg?.type) return;
  emit(msg.type, msg);
}

// ---------- Send ----------

export function send(msg: ClientMessage): void {
  if (!_connected || !_socket) return;
  _socket.emit('msg', msg);
}

export function sendInput(): void {
  if (!_connected) return;

  const input = {
    held: {
      left: held('left'),
      right: held('right'),
      shoot: held('shoot'),
      roll: held('roll'),
      bomb: held('bomb'),
    },
    pressed: {
      roll: pressed('roll'),
      bomb: pressed('bomb'),
      confirm: pressed('confirm'),
    },
  };

  const hash = JSON.stringify(input);
  if (hash === _lastInputHash) return;
  _lastInputHash = hash;

  send({ type: 'input', ...input });
}

// ---------- Handlers ----------

export function on(type: string, fn: (msg: ServerMessage) => void): void {
  const existing = _handlers.get(type) ?? [];
  existing.push(fn);
  _handlers.set(type, existing);
}

export function off(type: string, fn: (msg: ServerMessage) => void): void {
  const existing = _handlers.get(type) ?? [];
  _handlers.set(type, existing.filter(h => h !== fn));
}

function emit(type: string, msg: ServerMessage): void {
  for (const fn of _handlers.get(type) ?? []) {
    try { fn(msg); } catch (e) { console.error(`[Net] Handler error "${type}":`, e); }
  }
}

// ---------- Convenience senders ----------

export const createRoom = (): void => send({ type: 'create' });
export const joinRoom = (code: string): void => send({ type: 'join', code });
export const startGame = (): void => send({ type: 'start' });
export const buyUpgrade = (itemId: import('@void-sector/shared').UpgradeId): void =>
  send({ type: 'shop_buy', itemId });
export const shopReady = (): void => send({ type: 'shop_ready' });

// ---------- State ----------

export const isConnected = (): boolean => _connected;
