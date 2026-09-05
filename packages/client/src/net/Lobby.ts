// ============================================
//   Lobby.ts
//   Pre-game lobby UI and state machine.
//   Draws on the canvas directly.
//   Hands off to main.ts via window signal.
// ============================================

import { C, PLAYER_IDENTITY } from '@void-sector/shared';
import type { MsgRoomCreated, MsgRoomJoined, MsgPlayerJoined, MsgPlayerLeft, MsgGameStart, MsgError, ServerMessage } from '@void-sector/shared';
import * as Net from './Net.js';
import { drawLobbyConnecting, drawLobbyMenu, drawLobbyJoinInput, drawLobbyRoomWait, drawLobbyError } from '../ui/LobbyRenderer.js';
import * as Audio from '../fx/Audio.js';
import { pressed } from '../core/input.js';

// ---------- State machine ----------

type LobbyState =
  | 'CONNECTING'
  | 'LOBBY_MENU'
  | 'JOIN_INPUT'
  | 'CREATE_WAIT'
  | 'ROOM_WAIT'
  | 'ERROR';

let _state:       LobbyState = 'CONNECTING';
let _cursor       = 0;
let _roomCode     = '';
let _myId: number | null = null;
let _isHost       = false;
let _playerCount  = 0;
let _joinInput    = '';
let _errorMsg     = '';
let _inputLock    = 0;
let _active       = false;

// Expose game start signal to main.ts
declare global {
  interface Window { _gameStartMsg: MsgGameStart | null; }
}

// ---------- Server handlers ----------

const _onConnected = (_msg: ServerMessage): void => {
  _state     = 'LOBBY_MENU';
  _inputLock = 8;
};

const _onDisconnected = (_msg: ServerMessage): void => {
  if (!_active) return;
  _state    = 'CONNECTING';
  _errorMsg = 'CONNECTION LOST — RECONNECTING...';
};

const _onRoomCreated = (msg: ServerMessage): void => {
  const m = msg as MsgRoomCreated;
  _roomCode    = m.code;
  _myId        = m.playerId;
  _isHost      = true;
  _playerCount = 1;
  _state       = 'CREATE_WAIT';
  Audio.play('menuConfirm');
};

const _onRoomJoined = (msg: ServerMessage): void => {
  const m = msg as MsgRoomJoined;
  _roomCode    = m.code;
  _myId        = m.playerId;
  _isHost      = m.isHost;
  _playerCount = m.playerCount;
  _state       = 'ROOM_WAIT';
  Audio.play('menuConfirm');
};

const _onPlayerJoined = (msg: ServerMessage): void => {
  _playerCount = (msg as MsgPlayerJoined).playerCount;
  Audio.play('menuMove');
};

const _onPlayerLeft = (msg: ServerMessage): void => {
  const m = msg as MsgPlayerLeft;
  _playerCount = m.playerCount;
  if (m.newHostId === _myId) _isHost = true;
};

const _onGameStart = (msg: ServerMessage): void => {
  _active = false;
  window._gameStartMsg = msg as MsgGameStart;
};

const _onError = (msg: ServerMessage): void => {
  const codes: Record<string, string> = {
    ROOM_NOT_FOUND:   'ROOM NOT FOUND — CHECK THE CODE',
    ROOM_FULL:        'ROOM IS FULL — MAX 4 PLAYERS',
    GAME_IN_PROGRESS: 'GAME ALREADY STARTED',
  };
  _errorMsg = codes[(msg as MsgError).message] ?? 'SOMETHING WENT WRONG';
  _state    = 'ERROR';
  Audio.play('shopDeny');
  setTimeout(() => { _state = 'LOBBY_MENU'; _errorMsg = ''; _cursor = 0; }, 2500);
};

// ---------- Init ----------

export function initLobby(): void {
  _active      = true;
  _roomCode    = '';
  _myId        = null;
  _isHost      = false;
  _playerCount = 0;
  _joinInput   = '';
  _errorMsg    = '';
  _inputLock   = 12;
  _state       = Net.isConnected() ? 'LOBBY_MENU' : 'CONNECTING';

  // Deregister before re-registering to prevent duplicates
  Net.off('connected',     _onConnected);
  Net.off('disconnected',  _onDisconnected);
  Net.off('room_created',  _onRoomCreated);
  Net.off('room_joined',   _onRoomJoined);
  Net.off('player_joined', _onPlayerJoined);
  Net.off('player_left',   _onPlayerLeft);
  Net.off('game_start',    _onGameStart);
  Net.off('error',         _onError);

  Net.on('connected',     _onConnected);
  Net.on('disconnected',  _onDisconnected);
  Net.on('room_created',  _onRoomCreated);
  Net.on('room_joined',   _onRoomJoined);
  Net.on('player_joined', _onPlayerJoined);
  Net.on('player_left',   _onPlayerLeft);
  Net.on('game_start',    _onGameStart);
  Net.on('error',         _onError);

  Net.connect();

  // Raw keydown for join code entry
  window.addEventListener('keydown', _onKeyDown);
}

function _onKeyDown(e: KeyboardEvent): void {
  if (_state !== 'JOIN_INPUT') return;
  const key = e.key.toUpperCase();
  if (/^[A-Z0-9]$/.test(key) && _joinInput.length < 4) {
    _joinInput += key;
    Audio.play('menuMove');
  }
  if (e.key === 'Backspace' && _joinInput.length > 0) {
    _joinInput = _joinInput.slice(0, -1);
    Audio.play('menuMove');
  }
}

// ---------- Update ----------

export function updateLobby(): void {
  if (!_active) return;
  if (_inputLock > 0) { _inputLock--; return; }

  switch (_state) {
    case 'LOBBY_MENU':  _updateMenu();       break;
    case 'JOIN_INPUT':  _updateJoinInput();  break;
    case 'CREATE_WAIT': _updateCreateWait(); break;
    default: break;
  }
}

function _updateMenu(): void {
  if (pressed('left') || pressed('right') || pressed('up') || pressed('down')) {
    _cursor = _cursor === 0 ? 1 : 0;
    Audio.play('menuMove');
  }
  if (pressed('confirm')) {
    if (_cursor === 0) { Net.createRoom(); Audio.play('menuMove'); }
    else               { _state = 'JOIN_INPUT'; _joinInput = ''; _inputLock = 5; Audio.play('menuMove'); }
  }
}

function _updateJoinInput(): void {
  if (pressed('confirm') && _joinInput.length === 4) {
    Net.joinRoom(_joinInput);
    Audio.play('menuMove');
  }
  if (pressed('pause')) { _state = 'LOBBY_MENU'; _joinInput = ''; Audio.play('menuMove'); }
}

function _updateCreateWait(): void {
  if (pressed('confirm')) { Net.startGame(); Audio.play('menuConfirm'); }
}

// ---------- Draw ----------

export function drawLobby(ctx: CanvasRenderingContext2D): void {
  if (!_active) return;
  // Clear + border
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
  ctx.strokeStyle = C.COLOR.DIM; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
  ctx.strokeRect(1, 1, C.CANVAS_W - 2, C.CANVAS_H - 2);
  ctx.globalAlpha = 1;

  switch (_state) {
    case 'CONNECTING':  drawLobbyConnecting(ctx, _errorMsg);                                   break;
    case 'LOBBY_MENU':  drawLobbyMenu(ctx, _cursor);                                            break;
    case 'JOIN_INPUT':  drawLobbyJoinInput(ctx, _joinInput);                                    break;
    case 'CREATE_WAIT':
    case 'ROOM_WAIT':   drawLobbyRoomWait(ctx, _roomCode, _playerCount, _myId, _isHost);        break;
    case 'ERROR':       drawLobbyError(ctx, _errorMsg);                                         break;
  }
}

// ---------- Getters ----------

export const getLobbyMyId      = (): number | null => _myId;
export const getLobbyRoomCode  = (): string        => _roomCode;
export const isLobbyActive     = (): boolean        => _active;
