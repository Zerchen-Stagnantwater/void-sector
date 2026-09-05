// ============================================
//   Net.ts
//   WebSocket client wrapper.
//   Typed send/receive using shared message types.
// ============================================

import type { ClientMessage, ServerMessage } from '@void-sector/shared';
import { held, pressed } from '../core/input.js';

const SERVER_URL = window.location.hostname === 'localhost'
  ? 'ws://localhost:8080'
  : `wss://${window.location.hostname}:8080`;

// ---------- State ----------

let _ws:             WebSocket | null = null;
let _connected                        = false;
let _reconnectDelay                   = 1000;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _reconnecting                     = false;
let _lastInputHash                    = '';

// Message handlers
const _handlers = new Map<string, Array<(msg: ServerMessage) => void>>();

// ---------- Connect ----------

export function connect(): void {
  if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return;

  console.log('[Net] Connecting to', SERVER_URL);
  _ws = new WebSocket(SERVER_URL);

  _ws.onopen    = onOpen;
  _ws.onclose   = onClose;
  _ws.onerror   = onError;
  _ws.onmessage = onMessage;
}

function onOpen(): void {
  console.log('[Net] Connected');
  _connected      = true;
  _reconnecting   = false;
  _reconnectDelay = 1000;
  if (_reconnectTimer) clearTimeout(_reconnectTimer);
  emit('connected', { type: 'pong' }); // sentinel — handlers check type
}

function onClose(e: CloseEvent): void {
  console.log('[Net] Disconnected', e.code);
  _connected = false;
  _ws        = null;
  emit('disconnected', { type: 'pong' });
  scheduleReconnect();
}

function onError(_e: Event): void {
  // onClose fires after onerror — reconnect handled there
}

function onMessage(e: MessageEvent): void {
  let msg: ServerMessage;
  try {
    msg = JSON.parse(e.data as string) as ServerMessage;
  } catch {
    return;
  }
  if (!msg?.type) return;
  emit(msg.type, msg);
}

function scheduleReconnect(): void {
  if (_reconnecting) return;
  _reconnecting   = true;
  _reconnectTimer = setTimeout(() => {
    _reconnecting   = false;
    _reconnectDelay = Math.min(_reconnectDelay * 2, 16000);
    connect();
  }, _reconnectDelay);
}

// ---------- Send ----------

export function send(msg: ClientMessage): void {
  if (!_connected || !_ws) return;
  try { _ws.send(JSON.stringify(msg)); } catch { /* dead socket */ }
}

export function sendInput(): void {
  if (!_connected) return;

  const input = {
    held: {
      left:  held('left'),
      right: held('right'),
      shoot: held('shoot'),
      roll:  held('roll'),
      bomb:  held('bomb'),
    },
    pressed: {
      roll:    pressed('roll'),
      bomb:    pressed('bomb'),
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

export const createRoom  = (): void => send({ type: 'create' });
export const joinRoom    = (code: string): void => send({ type: 'join', code });
export const startGame   = (): void => send({ type: 'start' });
export const buyUpgrade  = (itemId: import('@void-sector/shared').UpgradeId): void =>
  send({ type: 'shop_buy', itemId });
export const shopReady   = (): void => send({ type: 'shop_ready' });
export const ping        = (): void => send({ type: 'ping' });

// ---------- Keepalive ----------

setInterval(() => { if (_connected) ping(); }, 20_000);

// ---------- State ----------

export const isConnected = (): boolean => _connected;
