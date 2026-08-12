// ============================================
//   VOID SECTOR — main.js (MULTIPLAYER)
//   Game loop and state machine.
//   No simulation runs here anymore.
//   Loop does three things per frame:
//     1. Send input to server
//     2. Apply latest server state
//     3. Render
// ============================================

const SCREEN = {
  LOBBY: "LOBBY",
  PLAYING: "PLAYING",
  SHOP: "SHOP",
  GAMEOVER: "GAMEOVER",
  DYING: "DYING",
};

// ---------- Shared game state ----------
// Populated entirely by server broadcasts.
// Client never writes game logic into this.

let gameState = {
  screen: SCREEN.LOBBY,
  frame: 0,
  wave: 0,
  myId: null,
  roomCode: null,

  players: [],
  enemies: [],
  bullets: [],
  drops: [],
  shopState: null,

  newHighScore: false,
  finalStats: null,
  _reconnecting: false,
};

// ---------- Player identity ----------

const PLAYER_IDENTITY = [
  { id: 0, char: "^", color: "#00ff41" },
  { id: 1, char: "^", color: "#00ccff" },
  { id: 2, char: "^", color: "#ffaa00" },
  { id: 3, char: "^", color: "#ff00aa" },
];

// ---------- Server message handlers ----------

function _registerNetHandlers() {
  Net.on("state", (msg) => {
    if (gameState.screen !== SCREEN.PLAYING && gameState.screen !== SCREEN.SHOP)
      return;

    gameState.wave = msg.wave;
    gameState.players = msg.players || [];
    gameState.enemies = msg.enemies || [];
    gameState.bullets = msg.bullets || [];
    gameState.drops = msg.drops || [];
    gameState.shopState = msg.shopState || null;

    if (msg.roomState === "SHOP" && gameState.screen !== SCREEN.SHOP) {
      _enterShop();
    }
    if (msg.roomState === "PLAYING" && gameState.screen !== SCREEN.PLAYING) {
      gameState.screen = SCREEN.PLAYING;
      gameState.shopState = null;
      Audio.play("waveStart");
    }
  });

  Net.on("event", (msg) => {
    _handleServerEvent(msg);
  });

  Net.on("wave_start", (msg) => {
    gameState.wave = msg.wave;
    gameState.screen = SCREEN.PLAYING;
    Audio.play("waveStart");
    if (msg.wave > 1) UI.showWaveClear(msg.wave - 1);
  });

  Net.on("shop_result", (msg) => {
    Shop.applyResult(msg);
  });

  Net.on("game_over", (msg) => {
    _enterGameOver(msg);
  });

  Net.on("player_left", (msg) => {
    Audio.play("menuMove");
    Particles.spawnFloatText(
      C.COLS / 2,
      C.ROWS / 2,
      "P" + (msg.playerId + 1) + " LEFT",
      { color: PLAYER_IDENTITY[msg.playerId]?.color || C.COLOR.DIM },
    );
  });

  Net.on("disconnected", () => {
    if (gameState.screen === SCREEN.LOBBY) return;
    gameState._reconnecting = true;
  });

  Net.on("connected", () => {
    gameState._reconnecting = false;
  });
}

// ---------- Server event -> local juice ----------

function _handleServerEvent(msg) {
  const event = msg.event;
  const x = msg.x;
  const y = msg.y;
  const data = msg.data || {};

  switch (event) {
    case "enemy_die":
      Particles.spawnExplosion(x, y, {
        color: _enemyColor(data.enemyType),
        count: data.enemyType === "C" ? 18 : C.PARTICLE.EXPLOSION_COUNT,
      });
      Particles.shake(C.SHAKE.HIT_INTENSITY);
      Audio.play("enemyDie");
      if (data.playerId === gameState.myId) {
        const label =
          data.multiplier > 1
            ? "+" + data.score + " x" + data.multiplier
            : "+" + data.score;
        Particles.spawnFloatText(x, y, label, {
          color: data.multiplier > 1 ? C.COLOR.ACCENT : C.COLOR.PRIMARY,
        });
      }
      break;

    case "enemy_hit":
      Particles.spawnHitSpark(x, y, { color: _enemyColor(data.enemyType) });
      Audio.play("enemyHit");
      break;

    case "player_hit":
      if (data.playerId === gameState.myId) {
        Particles.flash(C.COLOR.DANGER, 0.35);
        Particles.shake(C.SHAKE.HIT_INTENSITY);
      }
      Particles.spawnExplosion(x, y, { color: C.COLOR.DANGER, count: 8 });
      Audio.play("playerHit");
      break;

    case "player_die":
      Particles.spawnExplosion(x, y, {
        color: PLAYER_IDENTITY[data.playerId]?.color || C.COLOR.DANGER,
        count: C.PARTICLE.EXPLOSION_COUNT * 2,
        spread: 2.0,
      });
      Particles.shake(C.SHAKE.DEATH_INTENSITY);
      if (data.playerId === gameState.myId) {
        Particles.flash(C.COLOR.DANGER, 0.8);
      }
      Audio.play("playerDie");
      break;

    case "shield_hit":
      Particles.spawnExplosion(x, y, { color: C.COLOR.SHIELD, count: 6 });
      Particles.flash(C.COLOR.SHIELD, 0.25);
      Audio.play("shieldHit");
      break;

    case "pickup":
      Audio.play("pickup");
      if (data.playerId === gameState.myId) {
        const labels = {
          RAPID: "RAPID FIRE!",
          SPREAD: "SPREAD SHOT!",
          SHIELD: "SHIELD UP!",
          BOMB: "BOMB +1",
          LIFE: "EXTRA LIFE!",
        };
        Particles.spawnFloatText(
          x,
          y - 2,
          labels[data.pickupType] || data.pickupType,
          {
            color: C.POWERUP.COLORS[data.pickupType],
          },
        );
        if (data.pickupType === "LIFE") Particles.flash(C.COLOR.PRIMARY, 0.3);
        if (data.pickupType === "SHIELD") Particles.flash(C.COLOR.SHIELD, 0.25);
      }
      break;

    case "bomb":
      Particles.flash(C.COLOR.WARN, 0.6);
      Particles.shake(C.SHAKE.DEATH_INTENSITY * 0.7);
      Audio.play("bomb");
      break;

    case "wave_clear":
      Audio.play("waveClear");
      break;
  }
}

function _enemyColor(type) {
  return type && C.ENEMY[type] ? C.ENEMY[type].COLOR : C.COLOR.PRIMARY;
}

// ---------- State transitions ----------

function _enterShop() {
  gameState.screen = SCREEN.SHOP;
  Shop.openMulti(gameState.wave, gameState.myId);
  Audio.play("waveClear");
  UI.showWaveClear(gameState.wave);
}

function _enterGameOver(msg) {
  gameState.screen = SCREEN.GAMEOVER;
  gameState.frame = 0;
  gameState.finalStats = {
    stats: msg.stats || [],
    wave: msg.wave || gameState.wave,
  };

  const myStats = (msg.stats || []).find((s) => s.id === gameState.myId);
  if (myStats) {
    const wasNewHigh = Save.submitRun({
      score: myStats.score,
      wave: msg.wave,
      kills: myStats.kills,
    });
    gameState.newHighScore = wasNewHigh;
    if (wasNewHigh) setTimeout(() => Audio.play("highScore"), 400);
  }
}

// ---------- Per-screen update ----------

function _updateLobby() {
  Lobby.update();

  if (window._gameStartMsg) {
    const msg = window._gameStartMsg;
    window._gameStartMsg = null;

    gameState.myId = Lobby.getMyId();
    gameState.roomCode = Lobby.getRoomCode();
    gameState.screen = SCREEN.PLAYING;
    gameState.wave = msg.wave || 1;
    gameState.players = msg.players || [];
    gameState.enemies = [];
    gameState.bullets = [];
    gameState.drops = [];

    Audio.play("waveStart");
    Audio.unlock();
  }
}

function _updatePlaying() {
  if (Input.pressed.pause) UI.togglePause();

  if (UI.isPaused()) {
    const result = UI.update(gameState);
    if (result === "quit") _quitToLobby();
    return;
  }

  Net.sendInput();
  Particles.update();
}

function _updateShop() {
  Shop.updateMulti(gameState);
  Particles.update();
}

function _updateGameOver() {
  if (Input.pressed.confirm) {
    Audio.play("menuConfirm");
    _quitToLobby();
  }
}

function _quitToLobby() {
  gameState.screen = SCREEN.LOBBY;
  gameState.players = [];
  gameState.enemies = [];
  gameState.bullets = [];
  gameState.drops = [];
  gameState.shopState = null;
  gameState.myId = null;
  gameState.roomCode = null;
  gameState.wave = 0;
  gameState.finalStats = null;
  gameState.newHighScore = false;
  Particles.reset();
  UI.reset();
  Lobby.init();
}

// ---------- Main loop ----------

let _lastTime = 0;
let _accumulator = 0;
const FIXED_STEP = C.TICK_MS;

function _loop(timestamp) {
  requestAnimationFrame(_loop);

  const delta = Math.min(timestamp - _lastTime, 50);
  _lastTime = timestamp;
  _accumulator += delta;

  while (_accumulator >= FIXED_STEP) {
    _tick();
    _accumulator -= FIXED_STEP;
  }

  gameState.frame += 1;
  Renderer.draw(gameState);
  UI.draw(gameState);

  if (gameState.screen === SCREEN.LOBBY) {
    const canvas = document.getElementById("gameCanvas");
    Lobby.draw(canvas.getContext("2d"));
  }
}

function _tick() {
  Input.update();

  switch (gameState.screen) {
    case SCREEN.LOBBY:
      _updateLobby();
      break;
    case SCREEN.PLAYING:
      _updatePlaying();
      break;
    case SCREEN.SHOP:
      _updateShop();
      break;
    case SCREEN.GAMEOVER:
      _updateGameOver();
      break;
    case SCREEN.DYING:
      Particles.update();
      break;
  }
}

// ---------- Boot ----------

window.addEventListener("load", () => {
  window.addEventListener("keydown", () => Audio.unlock(), { once: true });
  _registerNetHandlers();
  Lobby.init();
  _lastTime = performance.now();
  requestAnimationFrame(_loop);
});
