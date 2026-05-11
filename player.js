// ============================================
//   VOID SECTOR — player.js
//   Everything the player does:
//   movement, dodge roll, shooting, damage,
//   invincibility frames, death sequence.
//   Reads from Input, writes to Bullets,
//   Particles, Audio. Never touches canvas.
// ============================================

const Player = (() => {

  // ---------- State ----------
  let x, y;           // Grid position (float)
  let lives;
  let score;
  let combo;          // Current kill combo count
  let comboTimer;     // Frames until combo resets
  let kills;          // Total kills this run

  // Shooting
  let shootCooldown;  // Frames until next shot allowed
  let shootRate;      // Current frames-between-shots (affected by upgrades + rapid)

  // Dodge roll
  let rolling;        // True while rolling
  let rollTimer;      // Frames remaining in roll
  let rollCooldown;   // Frames until roll can be used again
  let rollDir;        // -1 = left, 1 = right

  // Damage
  let invincible;     // True while invincibility frames active
  let invTimer;       // Frames remaining of invincibility
  let dead;           // True after final death — game over
  let deathTimer;     // Frames into death sequence

  // Upgrades (set by shop, persist between waves)
  let upgrades;

  // ---------- Init / Reset ----------

  function init() {
    x = C.PLAYER.START_COL;
    y = C.PLAYER.START_ROW;
    lives = C.PLAYER.LIVES;
    score = 0;
    combo = 0;
    comboTimer = 0;
    kills = 0;
    shootCooldown = 0;
    shootRate = C.PLAYER.SHOOT_COOLDOWN;
    rolling = false;
    rollTimer = 0;
    rollCooldown = 0;
    rollDir = 1;
    invincible = false;
    invTimer = 0;
    dead = false;
    deathTimer = 0;

    upgrades = {
      fire_rate: 0,   // 0–5 levels
      move_speed: 0,   // 0–5 levels
      multi_shot: 0,   // 0–3 levels (shot count = level + 1)
      shield: 0,   // 0–1
      bullet_spd: 0,   // 0–5
    };
  }

  // Called between waves — position resets, effects don't
  function resetPosition() {
    x = C.PLAYER.START_COL;
    y = C.PLAYER.START_ROW;
    rolling = false;
    rollTimer = 0;
    invincible = false;
    invTimer = 0;
    dead = false;
    deathTimer = 0;
    shootCooldown = 0;
  }

  // ---------- Computed stats from upgrades ----------

  function _getSpeed() {
    const base = C.PLAYER.SPEED;
    const bonus = upgrades.move_speed * 0.022;
    const rollMul = rolling ? C.PLAYER.ROLL_SPEED : 1;
    return (base + bonus) * rollMul;
  }

  function _getShootRate() {
    // fire_rate upgrade reduces cooldown by 1.5 frames per level
    const base = C.PLAYER.SHOOT_COOLDOWN;
    const bonus = upgrades.fire_rate * 1.5;
    const rapid = Powerups.isRapid() ? 0.4 : 1.0; // Rapid halves cooldown
    return Math.max(3, (base - bonus) * rapid);    // Floor at 3 frames
  }

  function _getShotCount() {
    // multi_shot level 0 = 1 bullet, level 3 = 4 bullets
    return upgrades.multi_shot + 1;
  }

  function _getBulletSpeed() {
    return C.BULLET.PLAYER_SPEED + upgrades.bullet_spd * 0.04;
  }

  // ---------- Update ----------

  function update(gameState) {
    if (dead) {
      deathTimer += 1;
      return;
    }

    _handleMovement();
    _handleRoll();
    _handleShooting(gameState);
    _handleInvincibility();
    _handleEnemyCollision(gameState);
    _handleBulletCollision(gameState);
    _handleCombo();
    _handlePendingLifeUp(gameState);
    _handleBomb();
  }

  // ---------- Movement ----------

  function _handleMovement() {
    const speed = _getSpeed();
    let dx = 0;

    if (Input.held.left) dx = -speed;
    if (Input.held.right) dx = speed;

    // During a roll, override direction with roll direction
    if (rolling) {
      dx = rollDir * _getSpeed();
    }

    x = Math.max(0, Math.min(C.COLS - 1, x + dx));
  }

  // ---------- Dodge roll ----------

  function _handleRoll() {
    // Tick cooldown
    if (rollCooldown > 0) rollCooldown -= 1;

    if (rolling) {
      rollTimer -= 1;

      // Spawn trail behind player during roll
      Particles.spawnTrail(x, y + 0.5, { color: C.COLOR.DIM });

      if (rollTimer <= 0) {
        rolling = false;
        // Brief invincibility grace after roll ends
        invincible = true;
        invTimer = 6;
      }
      return; // Don't start a new roll while rolling
    }

    // Initiate roll
    if (Input.pressed.roll && rollCooldown <= 0) {
      // Roll direction = current movement direction, or last facing
      if (Input.held.left) rollDir = -1;
      else if (Input.held.right) rollDir = 1;
      // else keep last rollDir

      rolling = true;
      rollTimer = C.PLAYER.ROLL_DURATION;
      rollCooldown = C.PLAYER.ROLL_COOLDOWN;

      // Invincible during the roll
      invincible = true;
      invTimer = C.PLAYER.ROLL_DURATION + 6;

      Audio.play('roll');
    }
  }

  // ---------- Shooting ----------

  function _handleShooting(gameState) {
    if (shootCooldown > 0) shootCooldown -= 1;

    if (Input.held.shoot && shootCooldown <= 0) {
      shootCooldown = _getShootRate();

      const shotCount = _getShotCount();
      const spreadActive = Powerups.isSpread();

      Bullets.spawnPlayerMulti(x, y, shotCount, spreadActive);

      const soundName = spreadActive ? 'shootSpread' : 'shoot';
      Audio.play(soundName);

      // Tiny upward recoil particle
      Particles.spawnTrail(x, y, { color: C.COLOR.DIM });
    }
  }

  // ---------- Invincibility frames ----------

  function _handleInvincibility() {
    if (invincible && !rolling) {
      invTimer -= 1;
      if (invTimer <= 0) invincible = false;
    }
  }

  // ---------- Enemy body collision ----------

  function _handleEnemyCollision(gameState) {
    if (invincible) return;

    const enemies = gameState.enemies || [];
    for (const e of enemies) {
      if (!e.active) continue;
      const dx = Math.abs(e.x - x);
      const dy = Math.abs(e.y - y);
      if (dx < 0.9 && dy < 0.9) {
        _takeDamage(gameState);
        return;
      }
    }
  }

  // ---------- Enemy bullet collision ----------

  function _handleBulletCollision(gameState) {
    if (invincible) return;

    const hits = Bullets.getEnemyHits(x, y);
    if (hits.length > 0) {
      for (const h of hits) Bullets.destroy(h);
      _takeDamage(gameState);
    }
  }

  // ---------- Take damage ----------

  function _takeDamage(gameState) {
    // Check shield first
    if (Powerups.absorbHit()) {
      Audio.play('shieldHit');
      Particles.flash(C.COLOR.SHIELD, 0.25);
      Particles.shake(C.SHAKE.HIT_INTENSITY * 0.5);
      Particles.spawnExplosion(x, y, { color: C.COLOR.SHIELD, count: 6 });
      // Brief invincibility after shield absorb
      invincible = true;
      invTimer = 30;
      return;
    }

    lives -= 1;

    if (lives <= 0) {
      _die(gameState);
      return;
    }

    // Survived the hit — flash and invincibility frames
    Audio.play('playerHit');
    Particles.flash(C.COLOR.DANGER, 0.35);
    Particles.shake(C.SHAKE.HIT_INTENSITY);
    Particles.spawnExplosion(x, y, { color: C.COLOR.DANGER, count: 8 });

    invincible = true;
    invTimer = C.PLAYER.INVINCIBLE_FRAMES;

    gameState.justHit = true;
  }

  // ---------- Death ----------

  function _die(gameState) {
    dead = true;
    deathTimer = 0;

    Audio.play('playerDie');
    Particles.flash(C.COLOR.DANGER, 0.8);
    Particles.shake(C.SHAKE.DEATH_INTENSITY);
    Particles.spawnExplosion(x, y, {
      color: C.COLOR.DANGER,
      count: C.PARTICLE.EXPLOSION_COUNT * 2,
      spread: 2.0,
    });

    gameState.playerDead = true;
  }

  // ---------- Combo ----------

  function _handleCombo() {
    if (comboTimer > 0) {
      comboTimer -= 1;
      if (comboTimer <= 0) combo = 0;
    }
  }

  // Called by main.js when an enemy dies
  function registerKill(baseScore) {
    kills += 1;
    combo += 1;
    comboTimer = C.SCORE.COMBO_WINDOW;

    // Combo multiplier: x1 up to x8
    const multiplier = Math.min(combo, 8);
    const earned = baseScore * multiplier;
    score += earned;

    return { earned, multiplier, combo };
  }

  // ---------- Pending life up from powerup ----------

  function _handlePendingLifeUp(gameState) {
    if (gameState.pendingLifeUp) {
      lives = Math.min(lives + 1, 6);   // Cap at 6 lives
      gameState.pendingLifeUp = false;
    }
  }

  // ---------- Bomb ----------

  function _handleBomb() {
    if (Input.pressed.bomb) {
      if (Powerups.useBomb()) {
        Audio.play('bomb');
        Particles.flash(C.COLOR.WARN, 0.6);
        Particles.shake(C.SHAKE.DEATH_INTENSITY * 0.7);
      }
    }
  }

  // ---------- Upgrade from shop ----------

  function applyUpgrade(id) {
    if (!(id in upgrades)) return false;
    const item = C.SHOP.ITEMS.find(i => i.id === id);
    if (!item) return false;
    if (upgrades[id] >= item.maxLevel) return false;

    upgrades[id] += 1;

    // Shield upgrade gives an immediate shield
    if (id === 'shield') {
      Powerups._applyEffect && Powerups._applyEffect('SHIELD');
    }

    return true;
  }

  // Cost of next level of an upgrade
  function getUpgradeCost(id) {
    const item = C.SHOP.ITEMS.find(i => i.id === id);
    if (!item) return Infinity;
    const level = upgrades[id] || 0;
    return Math.floor(item.baseCost * Math.pow(C.SHOP.COST_SCALE, level));
  }

  // ---------- Getters ----------

  function getX() { return x; }
  function getY() { return y; }
  function getLives() { return lives; }
  function getScore() { return score; }
  function getCombo() { return combo; }
  function getKills() { return kills; }
  function isRolling() { return rolling; }
  function isInvincible() { return invincible; }
  function isDead() { return dead; }
  function getDeathTimer() { return deathTimer; }
  function getUpgrades() { return upgrades; }
  function getRollCooldownFrac() {
    // 0 = ready, 1 = fully on cooldown (for HUD display)
    return rollCooldown / C.PLAYER.ROLL_COOLDOWN;
  }

  return {
    init,
    resetPosition,
    update,
    registerKill,
    applyUpgrade,
    getUpgradeCost,
    getX, getY,
    getLives, getScore, getCombo, getKills,
    isRolling, isInvincible, isDead, getDeathTimer,
    getUpgrades, getRollCooldownFrac,
  };

})();
