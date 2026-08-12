// ============================================
//   VOID SECTOR — lobby.js
//   Pre-game lobby: connect, create or join
//   a room, wait for players, start game.
//
//   Screens managed here:
//     CONNECTING → LOBBY_MENU → CREATE_WAIT
//                             → JOIN_INPUT
//                             → ROOM_WAIT
//   Once server sends 'game_start' → main.js
//   takes over and screen becomes PLAYING.
// ============================================

const Lobby = (() => {
  // ---------- State ----------
  const STATE = {
    CONNECTING: "CONNECTING", // Waiting for WS to open
    LOBBY_MENU: "LOBBY_MENU", // "Create" or "Join"
    CREATE_WAIT: "CREATE_WAIT", // Room created, waiting for others
    JOIN_INPUT: "JOIN_INPUT", // Player typing a join code
    ROOM_WAIT: "ROOM_WAIT", // In a room, waiting for host to start
    ERROR: "ERROR", // Something went wrong
  };

  let _state = STATE.CONNECTING;
  let _cursor = 0; // 0 = CREATE, 1 = JOIN
  let _roomCode = ""; // Code of the room we're in
  let _myId = null; // Our player id (0–3)
  let _isHost = false;
  let _playerCount = 0;
  let _joinInput = ""; // Code the player is typing
  let _errorMsg = "";
  let _inputLock = 0;
  let _active = true; // False once game_start received

  // ---------- Init ----------

  function init() {
    // Register all server message handlers
    Net.on("connected", _onConnected);
    Net.on("disconnected", _onDisconnected);
    Net.on("room_created", _onRoomCreated);
    Net.on("room_joined", _onRoomJoined);
    Net.on("player_joined", _onPlayerJoined);
    Net.on("player_left", _onPlayerLeft);
    Net.on("game_start", _onGameStart);
    Net.on("error", _onError);
    Net.on("pong", () => {}); // Swallow pongs silently

    Net.connect();
  }

  // ---------- Server message handlers ----------

  function _onConnected() {
    _state = STATE.LOBBY_MENU;
    _cursor = 0;
    _inputLock = 8;
  }

  function _onDisconnected() {
    if (!_active) return; // Game already started — main.js handles this
    _state = STATE.CONNECTING;
    _errorMsg = "CONNECTION LOST — RECONNECTING...";
  }

  function _onRoomCreated(msg) {
    _roomCode = msg.code;
    _myId = msg.playerId;
    _isHost = true;
    _playerCount = 1;
    _state = STATE.CREATE_WAIT;
    Audio.play("menuConfirm");
  }

  function _onRoomJoined(msg) {
    _roomCode = msg.code;
    _myId = msg.playerId;
    _isHost = msg.isHost || false;
    _playerCount = msg.playerCount;
    _state = STATE.ROOM_WAIT;
    Audio.play("menuConfirm");
  }

  function _onPlayerJoined(msg) {
    _playerCount = msg.playerCount;
    Audio.play("menuMove");
  }

  function _onPlayerLeft(msg) {
    _playerCount = msg.playerCount;
    if (msg.newHostId === _myId) {
      _isHost = true;
    }
  }

  function _onGameStart(msg) {
    _active = false;
    // Hand off to main.js via a flag on window
    // main.js watches for this
    window._gameStartMsg = msg;
  }

  function _onError(msg) {
    const messages = {
      ROOM_NOT_FOUND: "ROOM NOT FOUND — CHECK THE CODE",
      ROOM_FULL: "ROOM IS FULL — MAX 4 PLAYERS",
      GAME_IN_PROGRESS: "GAME ALREADY STARTED",
    };
    _errorMsg = messages[msg.message] || "SOMETHING WENT WRONG";
    _state = STATE.ERROR;
    Audio.play("shopDeny");

    // Return to lobby menu after 2.5 seconds
    setTimeout(() => {
      _state = STATE.LOBBY_MENU;
      _errorMsg = "";
      _cursor = 0;
    }, 2500);
  }

  // ---------- Update ----------

  function update() {
    if (!_active) return;
    if (_inputLock > 0) {
      _inputLock -= 1;
      return;
    }

    switch (_state) {
      case STATE.LOBBY_MENU:
        _updateLobbyMenu();
        break;
      case STATE.JOIN_INPUT:
        _updateJoinInput();
        break;
      case STATE.CREATE_WAIT:
        _updateCreateWait();
        break;
      case STATE.ROOM_WAIT:
        _updateRoomWait();
        break;
    }
  }

  function _updateLobbyMenu() {
    if (Input.pressed.left || Input.pressed.right) {
      _cursor = _cursor === 0 ? 1 : 0;
      Audio.play("menuMove");
    }
    if (Input.pressed.up || Input.pressed.down) {
      _cursor = _cursor === 0 ? 1 : 0;
      Audio.play("menuMove");
    }

    if (Input.pressed.confirm) {
      if (_cursor === 0) {
        // CREATE
        Net.createRoom();
        Audio.play("menuMove");
      } else {
        // JOIN
        _state = STATE.JOIN_INPUT;
        _joinInput = "";
        _inputLock = 5;
        Audio.play("menuMove");
      }
    }
  }

  function _updateJoinInput() {
    // Code entry is handled via keydown listener below
    // Here we just handle confirm/cancel
    if (Input.pressed.confirm && _joinInput.length === 4) {
      Net.joinRoom(_joinInput);
      Audio.play("menuMove");
    }
    if (Input.pressed.pause) {
      _state = STATE.LOBBY_MENU;
      _joinInput = "";
      Audio.play("menuMove");
    }
  }

  function _updateCreateWait() {
    // Host can press confirm to start when 2+ players
    if (Input.pressed.confirm && _playerCount >= 2) {
      Net.send({ type: "start" });
      Audio.play("menuConfirm");
    }
    // Host can also start solo for testing (remove before ship)
    if (Input.pressed.confirm && _playerCount === 1) {
      Net.send({ type: "start" });
      Audio.play("menuConfirm");
    }
  }

  function _updateRoomWait() {
    // Non-host just waits
    // Nothing to do — server will send game_start
  }

  // ---------- Key listener for code entry ----------
  // We need raw keydown for typing a join code —
  // Input.pressed only tracks game actions, not character input.

  window.addEventListener("keydown", (e) => {
    if (_state !== STATE.JOIN_INPUT) return;

    const key = e.key.toUpperCase();

    // Accept alphanumeric characters up to 4
    if (/^[A-Z0-9]$/.test(key) && _joinInput.length < 4) {
      _joinInput += key;
      Audio.play("menuMove");
    }

    // Backspace
    if (e.key === "Backspace" && _joinInput.length > 0) {
      _joinInput = _joinInput.slice(0, -1);
      Audio.play("menuMove");
    }
  });

  // ---------- Draw ----------
  // Called by main.js each frame while screen === 'LOBBY'

  function draw(ctx) {
    if (!_active) return;

    const CW = C.CHAR_W;
    const CH = C.CHAR_H;

    // Background already cleared by renderer
    _drawBorder(ctx);

    switch (_state) {
      case STATE.CONNECTING:
        _drawConnecting(ctx, CW, CH);
        break;
      case STATE.LOBBY_MENU:
        _drawLobbyMenu(ctx, CW, CH);
        break;
      case STATE.JOIN_INPUT:
        _drawJoinInput(ctx, CW, CH);
        break;
      case STATE.CREATE_WAIT:
        _drawRoomWait(ctx, CW, CH, true);
        break;
      case STATE.ROOM_WAIT:
        _drawRoomWait(ctx, CW, CH, false);
        break;
      case STATE.ERROR:
        _drawError(ctx, CW, CH);
        break;
    }
  }

  function _drawBorder(ctx) {
    ctx.strokeStyle = C.COLOR.DIM;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.strokeRect(1, 1, C.CANVAS_W - 2, C.CANVAS_H - 2);
    ctx.globalAlpha = 1;
  }

  function _tc(
    ctx,
    text,
    y,
    color,
    alpha = 1,
    size = C.FONT_SIZE,
    bold = false,
  ) {
    ctx.font = `${bold ? "bold " : ""}${size}px ${C.FONT_FAMILY}`;
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    const w = ctx.measureText(text).width;
    ctx.fillText(text, (C.CANVAS_W - w) / 2, y);
    ctx.globalAlpha = 1;
  }

  function _drawConnecting(ctx, CW, CH) {
    _tc(
      ctx,
      "[ VOID SECTOR ]",
      C.CANVAS_H * 0.35,
      C.COLOR.PRIMARY,
      1,
      C.FONT_SIZE * 1.4,
      true,
    );

    const dots = ".".repeat(Math.floor(Date.now() / 400) % 4);
    _tc(
      ctx,
      `CONNECTING${dots}`,
      C.CANVAS_H * 0.52,
      C.COLOR.DIM,
      0.8,
      C.FONT_SIZE * 0.85,
    );

    if (_errorMsg) {
      _tc(
        ctx,
        _errorMsg,
        C.CANVAS_H * 0.62,
        C.COLOR.WARN,
        0.9,
        C.FONT_SIZE * 0.8,
      );
    }
  }

  function _drawLobbyMenu(ctx, CW, CH) {
    _tc(
      ctx,
      "[ VOID SECTOR ]",
      C.CANVAS_H * 0.2,
      C.COLOR.PRIMARY,
      1,
      C.FONT_SIZE * 1.4,
      true,
    );
    _tc(
      ctx,
      "MULTIPLAYER",
      C.CANVAS_H * 0.32,
      C.COLOR.DIM,
      0.7,
      C.FONT_SIZE * 0.8,
      false,
    );

    const btnY = C.CANVAS_H * 0.5;
    const btnGap = C.CANVAS_W * 0.28;
    const btnCX = C.CANVAS_W / 2;

    const opts = ["CREATE ROOM", "JOIN ROOM"];
    for (let i = 0; i < 2; i++) {
      const x = btnCX + (i === 0 ? -btnGap : btnGap);
      const sel = _cursor === i;
      const color = sel ? C.COLOR.ACCENT : C.COLOR.DIM;
      const alpha = sel ? 1 : 0.55;
      const prefix = sel ? "[ " : "  ";
      const suffix = sel ? " ]" : "  ";
      const label = prefix + opts[i] + suffix;

      ctx.font = `${sel ? "bold " : ""}${C.FONT_SIZE * 0.9}px ${C.FONT_FAMILY}`;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      const w = ctx.measureText(label).width;
      ctx.fillText(label, x - w / 2, btnY);
      ctx.globalAlpha = 1;
    }

    _tc(
      ctx,
      "ARROW KEYS TO SELECT   ENTER TO CONFIRM",
      C.CANVAS_H * 0.72,
      C.COLOR.DIM,
      0.45,
      C.FONT_SIZE * 0.72,
    );
  }

  function _drawJoinInput(ctx, CW, CH) {
    _tc(
      ctx,
      "ENTER ROOM CODE",
      C.CANVAS_H * 0.35,
      C.COLOR.PRIMARY,
      1,
      C.FONT_SIZE * 1.0,
      true,
    );

    // 4 character boxes
    const boxW = C.FONT_SIZE * 1.6;
    const boxGap = 12;
    const totalW = 4 * boxW + 3 * boxGap;
    const startX = (C.CANVAS_W - totalW) / 2;
    const boxY = C.CANVAS_H * 0.46;
    const boxH = C.FONT_SIZE * 1.4;

    for (let i = 0; i < 4; i++) {
      const bx = startX + i * (boxW + boxGap);
      const ch = _joinInput[i] || "";
      const active = i === _joinInput.length;

      // Box background
      ctx.fillStyle = "#050f07";
      ctx.globalAlpha = 0.8;
      ctx.fillRect(bx, boxY - boxH * 0.8, boxW, boxH);

      // Box border
      ctx.strokeStyle = active ? C.COLOR.PRIMARY : C.COLOR.DIM;
      ctx.globalAlpha = active ? 1 : 0.4;
      ctx.lineWidth = active ? 1.5 : 0.5;
      ctx.strokeRect(bx, boxY - boxH * 0.8, boxW, boxH);

      // Character
      if (ch) {
        ctx.font = `bold ${C.FONT_SIZE * 1.1}px ${C.FONT_FAMILY}`;
        ctx.fillStyle = C.COLOR.PRIMARY;
        ctx.globalAlpha = 1;
        const cw = ctx.measureText(ch).width;
        ctx.fillText(ch, bx + (boxW - cw) / 2, boxY + C.FONT_SIZE * 0.15);
      }

      // Blinking cursor in active box
      if (active && Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillStyle = C.COLOR.PRIMARY;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(bx + boxW / 2 - 1, boxY - boxH * 0.6, 2, boxH * 0.7);
      }

      ctx.globalAlpha = 1;
    }

    const canConfirm = _joinInput.length === 4;
    _tc(
      ctx,
      canConfirm ? "[ PRESS ENTER TO JOIN ]" : "TYPE 4-CHARACTER CODE",
      C.CANVAS_H * 0.68,
      canConfirm ? C.COLOR.ACCENT : C.COLOR.DIM,
      canConfirm ? 1 : 0.5,
      C.FONT_SIZE * 0.82,
    );

    _tc(
      ctx,
      "ESC TO GO BACK",
      C.CANVAS_H * 0.76,
      C.COLOR.DIM,
      0.4,
      C.FONT_SIZE * 0.72,
    );
  }

  function _drawRoomWait(ctx, CW, CH, isHost) {
    _tc(
      ctx,
      "[ ROOM " + _roomCode + " ]",
      C.CANVAS_H * 0.2,
      C.COLOR.PRIMARY,
      1,
      C.FONT_SIZE * 1.2,
      true,
    );

    // Player slots
    const COLORS = ["#00ff41", "#00ccff", "#ffaa00", "#ff00aa"];
    const NAMES = ["P1", "P2", "P3", "P4"];
    const slotY = C.CANVAS_H * 0.38;
    const slotGap = C.CANVAS_W / 5;

    for (let i = 0; i < 4; i++) {
      const x = slotGap + i * slotGap;
      const filled = i < _playerCount;
      const isMe = i === _myId;
      const color = filled ? COLORS[i] : C.COLOR.DIM;
      const alpha = filled ? 1 : 0.25;

      ctx.font = `bold ${C.FONT_SIZE * 1.4}px ${C.FONT_FAMILY}`;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      const cw = ctx.measureText("^").width;
      ctx.fillText("^", x - cw / 2, slotY);

      ctx.font = `${C.FONT_SIZE * 0.75}px ${C.FONT_FAMILY}`;
      const label = filled ? (isMe ? NAMES[i] + " (YOU)" : NAMES[i]) : "------";
      const lw = ctx.measureText(label).width;
      ctx.fillText(label, x - lw / 2, slotY + CH * 1.3);
      ctx.globalAlpha = 1;
    }

    // Player count
    _tc(
      ctx,
      `${_playerCount} / 4 PLAYERS`,
      C.CANVAS_H * 0.6,
      C.COLOR.DIM,
      0.7,
      C.FONT_SIZE * 0.85,
    );

    if (isHost) {
      const blink = Math.floor(Date.now() / 500) % 2 === 0;
      const canStart = _playerCount >= 1; // 1+ for testing, change to 2 for ship
      if (canStart && blink) {
        _tc(
          ctx,
          "[ PRESS ENTER TO START ]",
          C.CANVAS_H * 0.72,
          C.COLOR.ACCENT,
          1,
          C.FONT_SIZE * 0.95,
          true,
        );
      } else if (!canStart) {
        _tc(
          ctx,
          "WAITING FOR PLAYERS...",
          C.CANVAS_H * 0.72,
          C.COLOR.DIM,
          0.6,
          C.FONT_SIZE * 0.85,
        );
      }
    } else {
      const dots = ".".repeat(Math.floor(Date.now() / 400) % 4);
      _tc(
        ctx,
        `WAITING FOR HOST TO START${dots}`,
        C.CANVAS_H * 0.72,
        C.COLOR.DIM,
        0.6,
        C.FONT_SIZE * 0.82,
      );
    }

    // Share code hint
    _tc(
      ctx,
      `SHARE CODE: ${_roomCode}`,
      C.CANVAS_H * 0.85,
      C.COLOR.DIM,
      0.45,
      C.FONT_SIZE * 0.75,
    );
  }

  function _drawError(ctx, CW, CH) {
    _tc(
      ctx,
      "[ ERROR ]",
      C.CANVAS_H * 0.4,
      C.COLOR.DANGER,
      1,
      C.FONT_SIZE * 1.1,
      true,
    );
    _tc(
      ctx,
      _errorMsg,
      C.CANVAS_H * 0.54,
      C.COLOR.WARN,
      0.9,
      C.FONT_SIZE * 0.85,
    );
  }

  // ---------- Getters ----------

  function isActive() {
    return _active;
  }
  function getMyId() {
    return _myId;
  }
  function getRoomCode() {
    return _roomCode;
  }
  function getPlayerCount() {
    return _playerCount;
  }
  function isHost() {
    return _isHost;
  }
  function getScreen() {
    return _state;
  }

  return {
    init,
    update,
    draw,
    isActive,
    getMyId,
    getRoomCode,
    getPlayerCount,
    isHost,
    getScreen,
  };
})();
