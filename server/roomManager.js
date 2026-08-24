// ============================================
//   VOID SECTOR SERVER — roomManager.js
//   Handles room lifecycle:
//   create, join, leave, destroy.
//   Rooms live in memory — no database.
//   Destroyed when all players disconnect.
// ============================================

const C = require('./constants');

// ---------- Room store ----------
// code → room object
const rooms = new Map();

// ws → { roomCode, playerId }
const connections = new Map();

// ---------- Constants ----------
const MAX_PLAYERS     = 4;
const LOBBY_TIMEOUT   = 10 * 60 * 1000;  // 10 min idle lobby expiry
const CODE_CHARS      = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ---------- Code generation ----------

function _generateCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

// ---------- Player factory ----------

function _makePlayer(id, ws) {
  return {
    id,
    ws,
    connected:     true,
    alive:         true,
    x:             C.PLAYER_START_COLS[id],
    y:             C.PLAYER.START_ROW,
    lives:         C.PLAYER.LIVES,
    score:         0,
    kills:         0,
    combo:         0,
    comboTimer:    0,
    rolling:       false,
    rollTimer:     0,
    rollDir:       1,
    rollCooldown:  0,
    invincible:    false,
    invTimer:      0,
    shootCooldown: 0,
    bombs:         0,
    shieldActive:  false,
    shieldHits:    0,
    rollCooldownFrac: 0,
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
    // Raw input — updated every frame from client messages
    input: {
      held:    { left: false, right: false, shoot: false, roll: false, bomb: false },
      pressed: { roll: false, bomb: false, confirm: false },
    },
  };
}

// ---------- Create room ----------

function createRoom(ws) {
  const code   = _generateCode();
  const player = _makePlayer(0, ws);

  const room = {
    code,
    state:       'LOBBY',    // LOBBY | PLAYING | SHOP | GAME_OVER
    players:     [player],
    hostId:      0,
    gameState:   null,       // Populated on game start
    tickInterval: null,
    shopReady:   [false, false, false, false],
    created:     Date.now(),
    _lobbyTimer: null,
  };

  // Auto-expire idle lobbies
  room._lobbyTimer = setTimeout(() => {
    if (room.state === 'LOBBY') destroyRoom(code, 'LOBBY_TIMEOUT');
  }, LOBBY_TIMEOUT);

  rooms.set(code, room);
  connections.set(ws, { roomCode: code, playerId: 0 });

  return { room, player };
}

// ---------- Join room ----------

function joinRoom(ws, code) {
  const room = rooms.get(code);

  if (!room) {
    return { error: 'ROOM_NOT_FOUND' };
  }
  if (room.state !== 'LOBBY') {
    return { error: 'GAME_IN_PROGRESS' };
  }
  if (room.players.length >= MAX_PLAYERS) {
    return { error: 'ROOM_FULL' };
  }

  const id     = room.players.length;
  const player = _makePlayer(id, ws);
  room.players.push(player);
  connections.set(ws, { roomCode: code, playerId: id });

  return { room, player };
}

// ---------- Leave / disconnect ----------

function playerLeft(ws) {
  const conn = connections.get(ws);
  if (!conn) return null;

  const { roomCode, playerId } = conn;
  const room = rooms.get(roomCode);
  connections.delete(ws);

  if (!room) return null;

  const player = room.players[playerId];
  if (player) {
    player.connected = false;
    player.ws        = null;
    if (room.state === 'PLAYING' || room.state === 'SHOP') {
      player.alive = false;
    }
  }

  // Promote new host if host left during lobby
  if (room.state === 'LOBBY' && playerId === room.hostId) {
    const next = room.players.find(p => p.id !== playerId && p.connected);
    if (next) room.hostId = next.id;
  }

  // Destroy room if everyone gone
  const anyConnected = room.players.some(p => p.connected);
  if (!anyConnected) {
    destroyRoom(roomCode, 'ALL_DISCONNECTED');
    return { room: null, playerId, roomCode };
  }

  return {
    room,
    playerId,
    newHostId: room.hostId,
    playerCount: room.players.filter(p => p.connected).length,
  };
}

// ---------- Destroy room ----------

function destroyRoom(code, reason = '') {
  const room = rooms.get(code);
  if (!room) return;

  if (room.tickInterval) {
    clearInterval(room.tickInterval);
    room.tickInterval = null;
  }
  if (room._lobbyTimer) {
    clearTimeout(room._lobbyTimer);
  }

  rooms.delete(code);
  console.log(`[Room] ${code} destroyed — ${reason}`);
}

// ---------- Getters ----------

function getRoom(code)           { return rooms.get(code);         }
function getConnection(ws)       { return connections.get(ws);     }
function getRoomCount()          { return rooms.size;              }
function getConnectionCount()    { return connections.size;        }

// ---------- Broadcast helpers ----------

function broadcast(room, msg) {
  const str = JSON.stringify(msg);
  for (const p of room.players) {
    if (p.connected && p.ws && p.ws.readyState === 1) {
      try { p.ws.send(str); } catch (e) { /* socket died */ }
    }
  }
}

function sendTo(ws, msg) {
  try {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  } catch (e) { /* socket died */ }
}

module.exports = {
  createRoom,
  joinRoom,
  playerLeft,
  destroyRoom,
  getRoom,
  getConnection,
  getRoomCount,
  getConnectionCount,
  broadcast,
  sendTo,
};
