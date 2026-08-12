// ============================================
//   VOID SECTOR — net.js
//   WebSocket client wrapper.
//   Single connection to the game server.
//   All multiplayer traffic flows through here.
//
//   API:
//     Net.connect()
//     Net.send(obj)
//     Net.sendInput()
//     Net.on(type, fn)
//     Net.isConnected()
// ============================================

const Net = (() => {
  // ---------- Config ----------
  // In production this points to your VPS.
  // In local dev it points to localhost.
  const SERVER_URL =
    window.location.hostname === "localhost"
      ? "ws://localhost:8080"
      : "wss://YOUR_VPS_DOMAIN:8080"; // <-- replace before deploy

  // ---------- State ----------
  let _ws = null;
  let _connected = false;
  let _reconnecting = false;
  let _reconnectTimer = null;
  let _reconnectDelay = 1000; // ms, doubles on each failed attempt

  // Message handlers — registered by other modules
  // Map of type → [handler, handler, ...]
  const _handlers = {};

  // Last input sent — used to skip redundant sends
  let _lastInputHash = "";

  // ---------- Connect ----------

  function connect() {
    if (
      _ws &&
      (_ws.readyState === WebSocket.OPEN ||
        _ws.readyState === WebSocket.CONNECTING)
    )
      return;

    console.log("[Net] Connecting to", SERVER_URL);
    _ws = new WebSocket(SERVER_URL);

    _ws.onopen = _onOpen;
    _ws.onclose = _onClose;
    _ws.onerror = _onError;
    _ws.onmessage = _onMessage;
  }

  function _onOpen() {
    console.log("[Net] Connected");
    _connected = true;
    _reconnecting = false;
    _reconnectDelay = 1000;
    clearTimeout(_reconnectTimer);
    _emit("connected", {});
  }

  function _onClose(e) {
    console.log("[Net] Disconnected", e.code, e.reason);
    _connected = false;
    _ws = null;
    _emit("disconnected", { code: e.code });
    _scheduleReconnect();
  }

  function _onError(e) {
    console.warn("[Net] Error", e);
    // onclose will fire after onerror — reconnect handled there
  }

  function _onMessage(e) {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch (err) {
      console.warn("[Net] Bad message:", e.data);
      return;
    }

    if (!msg.type) {
      console.warn("[Net] Message missing type:", msg);
      return;
    }

    _emit(msg.type, msg);
  }

  // ---------- Reconnect ----------

  function _scheduleReconnect() {
    if (_reconnecting) return;
    _reconnecting = true;

    console.log(`[Net] Reconnecting in ${_reconnectDelay}ms...`);
    _reconnectTimer = setTimeout(() => {
      _reconnecting = false;
      connect();
      _reconnectDelay = Math.min(_reconnectDelay * 2, 16000); // cap at 16s
    }, _reconnectDelay);
  }

  // ---------- Send ----------

  function send(obj) {
    if (!_connected || !_ws) {
      console.warn("[Net] Send failed — not connected:", obj);
      return;
    }
    try {
      _ws.send(JSON.stringify(obj));
    } catch (e) {
      console.warn("[Net] Send error:", e);
    }
  }

  // ---------- Send input ----------
  // Called every frame from main.js tick.
  // Only sends if input changed since last frame — avoids
  // flooding the server with identical messages at 60fps.

  function sendInput() {
    if (!_connected) return;

    const held = Input.held;
    const pressed = Input.pressed;

    // Build minimal input snapshot
    const input = {
      held: {
        left: !!held.left,
        right: !!held.right,
        shoot: !!held.shoot,
        roll: !!held.roll,
        bomb: !!held.bomb,
      },
      pressed: {
        roll: !!pressed.roll,
        bomb: !!pressed.bomb,
        confirm: !!pressed.confirm,
      },
    };

    // Hash to detect changes — skip send if nothing changed
    const hash = JSON.stringify(input);
    if (hash === _lastInputHash) return;
    _lastInputHash = hash;

    send({ type: "input", ...input });
  }

  // ---------- Message handler registration ----------

  // Register a handler for a specific message type.
  // Multiple handlers can be registered for the same type.
  // Usage: Net.on('state', (msg) => { ... })

  function on(type, fn) {
    if (!_handlers[type]) _handlers[type] = [];
    _handlers[type].push(fn);
  }

  // Remove a handler
  function off(type, fn) {
    if (!_handlers[type]) return;
    _handlers[type] = _handlers[type].filter((h) => h !== fn);
  }

  function _emit(type, msg) {
    const handlers = _handlers[type];
    if (!handlers || handlers.length === 0) return;
    for (const fn of handlers) {
      try {
        fn(msg);
      } catch (e) {
        console.error(`[Net] Handler error for "${type}":`, e);
      }
    }
  }

  // ---------- Convenience senders ----------
  // Named methods so callers don't hardcode type strings

  function createRoom() {
    send({ type: "create" });
  }

  function joinRoom(code) {
    send({ type: "join", code: code.toUpperCase().trim() });
  }

  function buyUpgrade(itemId) {
    send({ type: "shop_buy", itemId });
  }

  function shopReady() {
    send({ type: "shop_ready" });
  }

  function ping() {
    send({ type: "ping" });
  }

  // ---------- Keepalive ----------
  // Send a ping every 20 seconds to prevent connection timeout.

  setInterval(() => {
    if (_connected) ping();
  }, 20000);

  // ---------- Public ----------

  function isConnected() {
    return _connected;
  }
  function getReadyState() {
    return _ws ? _ws.readyState : WebSocket.CLOSED;
  }

  return {
    connect,
    send,
    sendInput,
    on,
    off,
    isConnected,
    getReadyState,
    // Convenience
    createRoom,
    joinRoom,
    buyUpgrade,
    shopReady,
    ping,
  };
})();
