// ============================================
//   VOID SECTOR — main.js
//   The game loop and state machine.
//   Wires every system together.
//   Nothing renders or updates without
//   passing through here first.
// ============================================

// ---------- Game state machine ----------
// MENU → PLAYING → SHOP → PLAYING → ... → GAMEOVER → MENU

const SCREEN = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  SHOP: 'SHOP',
  GAMEOVER: 'GAMEOVER',
};

// ---------- Shared game state ----------
// Passed into every system's update() each frame.
// Systems write flags here; main.js reads and acts on them.

let gameState = {
  screen: SCREEN.MENU,
  frame: 0,
  wave: 0,

  // Flags written by systems, read by main each frame
  playerDead: false,
  justHit: false,
  waveComplete: false,
  enemyBreached: false,
  enemiesKilledThisWave: 0,
  pendingLifeUp: false,

  // Written by shop, read by main
  spendScore: 0,

  // Written by player, read by renderer
  playerX: C.PLAYER.START_COL,
  playerY: C.PLAYER.START_ROW,

  // Game over data
  finalStats: null,
  newHighScore: false,
};

// ---------- Score shadow ----------
// Player holds the authoritative score internally.
// main.js applies shop deductions here so shop stays decoupled.
let _pendingSpend = 0;

// ---------- Transition helpers ----------

function _gotoMenu() {
  gameState.screen = SCREEN.MENU;
  _resetAll();
}

function _startGame() {
  _resetAll();
  Player.init();
  gameState.screen = SCREEN.PLAYING;
  gameState.wave = 0;
  Audio.unlock();
  _startNextWave();
}

function _startNextWave() {
  gameState.wave += 1;
  gameState.waveComplete = false;
  gameState.enemiesKilledThisWave = 0;
  gameState.enemyBreached = false;

  Enemies.reset();
  Bullets.reset();
  Powerups.reset();
  Player.resetPosition();
  Particles.reset();

  Waves.startWave(gameState.wave);
  Audio.play('waveStart');
}

function _gotoShop() {
  gameState.screen = SCREEN.SHOP;
  UI.showWaveClear(gameState.wave);

  // Wave clear score bonus (scales with wave)
  const bonus = C.SCORE.WAVE_CLEAR_BONUS + (gameState.wave - 1) * 100;
  _addScore(bonus);

  Shop.open(gameState.wave);
  Audio.play('waveClear');
}

function _addScore(amount) {
  // Score lives inside Player — we proxy additions through registerKill
  // for normal play, but for bonuses we use a direct internal add.
  // Since Player doesn't expose addScore we track it here via a side table.
  // Simpler: expose addScore on Player.
  Player._addBonus(amount);
}

function _gotoGameOver() {
  gameState.screen = SCREEN.GAMEOVER;
  gameState.frame = 0;

  gameState.finalStats = {
    score: Player.getScore(),
    wave: gameState.wave,
    kills: Player.getKills(),
  };

  const wasNewHigh = Save.submitRun(gameState.finalStats);
  gameState.newHighScore = wasNewHigh;

  if (wasNewHigh) {
    setTimeout(() => Audio.play('highScore'), 400);
  }
}

function _resetAll() {
  Player.init();
  Enemies.reset();
  Bullets.reset();
  Powerups.reset();
  Particles.reset();
  Waves.reset();
  Shop.reset();
  UI.reset();

  gameState.playerDead = false;
  gameState.justHit = false;
  gameState.waveComplete = false;
  gameState.enemyBreached = false;
  gameState.enemiesKilledThisWave = 0;
  gameState.pendingLifeUp = false;
  gameState.spendScore = 0;
  gameState.finalStats = null;
  gameState.newHighScore = false;
  gameState.wave = 0;
}

// ---------- Per-screen update ----------

function _updateMenu() {
  if (Input.pressed.confirm) {
    Audio.unlock();
    Audio.play('menuConfirm');
    _startGame();
  }
}

function _updatePlaying() {
  // Pause toggle
  if (Input.pressed.pause) {
    UI.togglePause();
  }

  // If paused, let UI handle input and nothing else
  if (UI.isPaused()) {
    const uiResult = UI.update(gameState);
    if (uiResult === 'quit') {
      _gotoMenu();
    }
    return;
  }

  // --- Sync player position into gameState for enemies ---
  gameState.playerX = Player.getX();
  gameState.playerY = Player.getY();

  // --- Update all systems ---
  Waves.update(gameState);
  Enemies.update(gameState);
  Bullets.update();
  Player.update(gameState);

  // Powerup update — returns array of picked-up types
  const picked = Powerups.update(
    Player.getX(), Player.getY(), gameState
  );
  _handlePickups(picked);

  Particles.update();

  // --- Apply shop spend (deferred from last shop visit) ---
  if (gameState.spendScore > 0) {
    Player._spendScore(gameState.spendScore);
    gameState.spendScore = 0;
  }

  // --- Read flags written by systems ---

  if (gameState.justHit) {
    gameState.justHit = false;
    // (shake and flash already applied inside player._takeDamage)
  }

  if (gameState.enemyBreached) {
    gameState.enemyBreached = false;
    // Breached enemy damages player
    Particles.shake(C.SHAKE.HIT_INTENSITY);
    Particles.flash(C.COLOR.DANGER, 0.2);
    Audio.play('playerHit');
    Player._forceHit(gameState);
  }

  if (gameState.playerDead) {
    gameState.playerDead = false;
    // Wait for death animation before transitioning
    setTimeout(() => _gotoGameOver(), 1200);
    gameState.screen = 'DYING'; // Prevent further updates
    return;
  }

  if (gameState.waveComplete) {
    gameState.waveComplete = false;
    _gotoShop();
    return;
  }
}

function _updateShop() {
  const leave = Shop.update(gameState);

  // Apply any score spend from this frame
  if (gameState.spendScore > 0) {
    Player._spendScore(gameState.spendScore);
    gameState.spendScore = 0;
  }

  if (leave) {
    gameState.screen = SCREEN.PLAYING;
    _startNextWave();
  }
}

function _updateGameOver() {
  if (Input.pressed.confirm) {
    Audio.play('menuConfirm');
    _gotoMenu();
  }
}

// ---------- Pickup handling ----------

function _handlePickups(picked) {
  for (const type of picked) {
    Audio.play('pickup');

    const labels = {
      RAPID: 'RAPID FIRE!',
      SPREAD: 'SPREAD SHOT!',
      SHIELD: 'SHIELD UP!',
      BOMB: 'BOMB +1',
      LIFE: 'EXTRA LIFE!',
    };
    Particles.spawnFloatText(
      Player.getX(), Player.getY() - 2,
      labels[type] || type,
      { color: C.POWERUP.COLORS[type] }
    );

    if (type === 'LIFE') {
      Particles.flash(C.COLOR.PRIMARY, 0.3);
    }
    if (type === 'SHIELD') {
      Particles.flash(C.COLOR.SHIELD, 0.25);
    }
  }
}

// ---------- Main loop ----------

let _lastTime = 0;
let _accumulator = 0;
const FIXED_STEP = C.TICK_MS;

function _loop(timestamp) {
  requestAnimationFrame(_loop);

  const delta = Math.min(timestamp - _lastTime, 50); // Cap at 50ms to avoid spiral of death
  _lastTime = timestamp;

  _accumulator += delta;

  // Fixed timestep update — decouple logic from frame rate
  while (_accumulator >= FIXED_STEP) {
    _tick();
    _accumulator -= FIXED_STEP;
  }

  // Render once per animation frame (not per tick)
  gameState.frame += 1;
  Renderer.draw(gameState);
  UI.draw(gameState);
}

function _tick() {
  Input.update();   // Flush pressed buffer — must be first

  switch (gameState.screen) {
    case SCREEN.MENU: _updateMenu(); break;
    case SCREEN.PLAYING: _updatePlaying(); break;
    case SCREEN.SHOP: _updateShop(); break;
    case SCREEN.GAMEOVER: _updateGameOver(); break;
    case 'DYING': Particles.update(); break; // Keep particles alive during death
  }
}

// ---------- Patch Player with bonus/spend methods ----------
// These are thin wrappers we add here so player.js
// stays clean and main.js controls score transactions.

Player._addBonus = function(amount) {
  // Access the score via the closure — we monkey-patch a direct adder.
  // Cleaner alternative: expose addScore in player.js.
  // This works but note it for refactor in Game #2.
  if (typeof _playerScoreRef !== 'undefined') {
    _playerScoreRef += amount;
  }
  // Since score is private in player.js IIFE we use registerKill with 0 combo:
  // Actually simplest: just add to score via a proper method.
  // We'll wire this properly below.
};

// The cleanest solution: add these two small methods to the Player module.
// Since JS IIFEs are already executed, we extend the returned object:
(function _patchPlayer() {
  // We need internal access to score. The cleanest way at this stage:
  // re-open the interface by storing score in a shared ref.
  // For this game we use a simple module-level variable approach:
  let _bonusScore = 0;

  Player.getBonusScore = function() { return _bonusScore; };

  Player._addBonus = function(amount) {
    _bonusScore += amount;
  };

  Player._spendScore = function(amount) {
    _bonusScore -= amount;
    if (_bonusScore < 0) _bonusScore = 0;
  };

  // Override getScore to include bonus
  const _origGetScore = Player.getScore;
  Player.getScore = function() {
    return _origGetScore() + _bonusScore;
  };

  // Reset bonus on init
  const _origInit = Player.init;
  Player.init = function() {
    _bonusScore = 0;
    _origInit();
  };

  // Force hit from breached enemy (bypasses invincibility check)
  Player._forceHit = function(gs) {
    // We call the internal damage path by briefly clearing invincibility.
    // Since _takeDamage is private we trigger via a flag:
    gs._breachDamage = true;
  };

})();

// ---------- Boot ----------

window.addEventListener('load', () => {
  // First keydown unlocks audio context (browser policy)
  window.addEventListener('keydown', () => Audio.unlock(), { once: true });

  _lastTime = performance.now();
  requestAnimationFrame(_loop);
});
