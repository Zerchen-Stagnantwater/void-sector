// ============================================
//   VOID SECTOR SERVER — server.js
//   Entry point. Boots WebSocket server.
//   Routes all client messages to the right
//   handler in roomManager or gameLoop.
//   Run with: node server.js
// ============================================

const { WebSocketServer } = require('ws');
const RM = require('./roomManager');
const GL = require('./gameLoop');

const PORT = process.env.PORT || 8080;

// ---------- Boot ----------

const wss = new WebSocketServer({ port: PORT });

console.log(`[Server] VOID SECTOR running on port ${PORT}`);
console.log(`[Server] ${new Date().toISOString()}`);

// ---------- Connection ----------

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[Connect] ${ip} — total: ${wss.clients.size}`);

  // Rate limiting — max 70 messages/sec per client
  let _msgCount   = 0;
  let _msgWindow  = Date.now();
  const MSG_LIMIT = 70;

  ws.on('message', (raw) => {

    // Rate limit check
    const now = Date.now();
    if (now - _msgWindow > 1000) {
      _msgCount  = 0;
      _msgWindow = now;
    }
    _msgCount++;
    if (_msgCount > MSG_LIMIT) return; // Silently drop

    // Parse
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (!msg || !msg.type) return;

    // Route
    _route(ws, msg);
  });

  ws.on('close', () => {
    console.log(`[Disconnect] ${ip} — total: ${wss.clients.size}`);
    _handleDisconnect(ws);
  });

  ws.on('error', (e) => {
    console.warn(`[WS Error] ${ip}:`, e.message);
  });
});

// ---------- Message router ----------

function _route(ws, msg) {
  switch (msg.type) {

    // ---------- Lobby ----------

    case 'create': {
      const { room, player } = RM.createRoom(ws);
      RM.sendTo(ws, {
        type:     'room_created',
        code:     room.code,
        playerId: player.id,
        isHost:   true,
      });
      console.log(`[Room] Created ${room.code} by player ${player.id}`);
      break;
    }

    case 'join': {
      if (!msg.code || typeof msg.code !== 'string') return;
      const code   = msg.code.toUpperCase().trim();
      const result = RM.joinRoom(ws, code);

      if (result.error) {
        RM.sendTo(ws, { type: 'error', message: result.error });
        return;
      }

      const { room, player } = result;

      // Tell the joining player they're in
      RM.sendTo(ws, {
        type:        'room_joined',
        code:        room.code,
        playerId:    player.id,
        playerCount: room.players.length,
        isHost:      player.id === room.hostId,
      });

      // Tell everyone else a new player joined
      _broadcastExcept(room, ws, {
        type:        'player_joined',
        playerId:    player.id,
        playerCount: room.players.length,
      });

      console.log(`[Room] ${code} — player ${player.id} joined (${room.players.length}/4)`);
      break;
    }

    case 'start': {
      const conn = RM.getConnection(ws);
      if (!conn) return;
      const room = RM.getRoom(conn.roomCode);
      if (!room) return;

      // Only host can start
      if (conn.playerId !== room.hostId) {
        RM.sendTo(ws, { type: 'error', message: 'NOT_HOST' });
        return;
      }
      if (room.state !== 'LOBBY') return;

      GL.startGame(room);
      break;
    }

    // ---------- Gameplay ----------

    case 'input': {
      const conn = RM.getConnection(ws);
      if (!conn) return;
      const room = RM.getRoom(conn.roomCode);
      if (!room || room.state !== 'PLAYING') return;

      const player = room.players[conn.playerId];
      if (!player || !player.alive) return;

      // Validate and apply input — never trust raw client data
      if (msg.held && typeof msg.held === 'object') {
        player.input.held.left  = !!msg.held.left;
        player.input.held.right = !!msg.held.right;
        player.input.held.shoot = !!msg.held.shoot;
        player.input.held.roll  = !!msg.held.roll;
        player.input.held.bomb  = !!msg.held.bomb;
      }
      if (msg.pressed && typeof msg.pressed === 'object') {
        // OR with existing — don't overwrite a press that hasn't been consumed yet
        player.input.pressed.roll    = player.input.pressed.roll    || !!msg.pressed.roll;
        player.input.pressed.bomb    = player.input.pressed.bomb    || !!msg.pressed.bomb;
        player.input.pressed.confirm = player.input.pressed.confirm || !!msg.pressed.confirm;
      }
      break;
    }

    // ---------- Shop ----------

    case 'shop_buy': {
      const conn = RM.getConnection(ws);
      if (!conn) return;
      const room = RM.getRoom(conn.roomCode);
      if (!room) return;

      GL.handleShopBuy(room, conn.playerId, msg.itemId);
      break;
    }

    case 'shop_ready': {
      const conn = RM.getConnection(ws);
      if (!conn) return;
      const room = RM.getRoom(conn.roomCode);
      if (!room) return;

      GL.handleShopReady(room, conn.playerId);
      break;
    }

    // ---------- Keepalive ----------

    case 'ping': {
      RM.sendTo(ws, { type: 'pong' });
      break;
    }

    default:
      // Unknown message type — silently ignore
      break;
  }
}

// ---------- Disconnect ----------

function _handleDisconnect(ws) {
  const result = RM.playerLeft(ws);
  if (!result || !result.room) return;

  const { room, playerId, newHostId, playerCount } = result;

  _broadcastExcept(room, ws, {
    type:        'player_left',
    playerId,
    playerCount,
    newHostId:   newHostId ?? null,
  });
}

// ---------- Broadcast helpers ----------

function _broadcastExcept(room, excludeWs, msg) {
  const str = JSON.stringify(msg);
  for (const p of room.players) {
    if (p.connected && p.ws && p.ws !== excludeWs && p.ws.readyState === 1) {
      try { p.ws.send(str); } catch (e) { /* dead socket */ }
    }
  }
}

// ---------- Health check ----------
// Log room count every 60 seconds so you can
// monitor load from the VPS terminal.

setInterval(() => {
  const rooms  = RM.getRoomCount();
  const conns  = RM.getConnectionCount();
  if (rooms > 0 || conns > 0) {
    console.log(`[Health] rooms=${rooms} connections=${conns} uptime=${Math.floor(process.uptime())}s`);
  }
}, 60_000);

// ---------- Graceful shutdown ----------

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM — shutting down');
  wss.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT — shutting down');
  wss.close(() => process.exit(0));
});
