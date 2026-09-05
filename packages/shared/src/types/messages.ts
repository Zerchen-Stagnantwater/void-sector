// ============================================
//   @void-sector/shared — types/messages.ts
//   Every WebSocket message shape.
//   Client → Server and Server → Client.
//   Import these on both ends to stay in sync.
// ============================================

import type {
  ClientPlayer, ClientEnemy, ClientBullet,
  Drop, ShopState, PlayerResult,
  EnemyType, DropType, UpgradeId,
  RoomState,
} from './game.js';

// ============================================
//   CLIENT → SERVER
// ============================================

export interface MsgCreate {
  type: 'create';
}

export interface MsgJoin {
  type: 'join';
  code: string;
}

export interface MsgStart {
  type: 'start';
}

export interface MsgInput {
  type: 'input';
  held: {
    left:  boolean;
    right: boolean;
    shoot: boolean;
    roll:  boolean;
    bomb:  boolean;
  };
  pressed: {
    roll:    boolean;
    bomb:    boolean;
    confirm: boolean;
  };
}

export interface MsgShopBuy {
  type:   'shop_buy';
  itemId: UpgradeId;
}

export interface MsgShopReady {
  type: 'shop_ready';
}

export interface MsgPing {
  type: 'ping';
}

export type ClientMessage =
  | MsgCreate
  | MsgJoin
  | MsgStart
  | MsgInput
  | MsgShopBuy
  | MsgShopReady
  | MsgPing;

// ============================================
//   SERVER → CLIENT
// ============================================

export interface MsgRoomCreated {
  type:     'room_created';
  code:     string;
  playerId: number;
  isHost:   boolean;
}

export interface MsgRoomJoined {
  type:        'room_joined';
  code:        string;
  playerId:    number;
  playerCount: number;
  isHost:      boolean;
}

export interface MsgPlayerJoined {
  type:        'player_joined';
  playerId:    number;
  playerCount: number;
}

export interface MsgPlayerLeft {
  type:        'player_left';
  playerId:    number;
  playerCount: number;
  newHostId:   number | null;
}

export interface MsgError {
  type:    'error';
  message: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'GAME_IN_PROGRESS' | 'NOT_HOST';
}

export interface MsgGameStart {
  type:    'game_start';
  wave:    number;
  players: ClientPlayer[];
}

export interface MsgState {
  type:      'state';
  frame:     number;
  wave:      number;
  roomState: RoomState;
  players:   ClientPlayer[];
  enemies:   ClientEnemy[];
  bullets:   ClientBullet[];
  drops:     Drop[];
  shopState: ShopState | null;
}

export interface MsgWaveStart {
  type: 'wave_start';
  wave: number;
}

// ---------- Event messages ----------
// Server tells clients something happened at a position.
// Client responds with local particles + audio.

export type GameEventName =
  | 'enemy_die'
  | 'enemy_hit'
  | 'player_hit'
  | 'player_die'
  | 'shield_hit'
  | 'pickup'
  | 'bomb'
  | 'wave_clear';

export interface EnemyDieData {
  enemyType:  EnemyType;
  score:      number;
  multiplier: number;
  playerId:   number | null;
}

export interface EnemyHitData {
  enemyType: EnemyType;
  playerId:  number | null;
}

export interface PlayerEventData {
  playerId: number;
}

export interface PickupData {
  pickupType: DropType;
  playerId:   number;
}

export interface WaveClearData {
  bonus: number;
  wave:  number;
}

export type GameEventData =
  | EnemyDieData
  | EnemyHitData
  | PlayerEventData
  | PickupData
  | WaveClearData
  | Record<string, never>;

export interface MsgEvent {
  type:  'event';
  event: GameEventName;
  x:     number;
  y:     number;
  data:  GameEventData;
}

export interface MsgShopResult {
  type:     'shop_result';
  success:  boolean;
  itemId?:  UpgradeId;
  newLevel?: number;
  newScore?: number;
  message:  string;
}

export interface MsgGameOver {
  type:  'game_over';
  wave:  number;
  stats: PlayerResult[];
}

export interface MsgPong {
  type: 'pong';
}

export type ServerMessage =
  | MsgRoomCreated
  | MsgRoomJoined
  | MsgPlayerJoined
  | MsgPlayerLeft
  | MsgError
  | MsgGameStart
  | MsgState
  | MsgWaveStart
  | MsgEvent
  | MsgShopResult
  | MsgGameOver
  | MsgPong;
