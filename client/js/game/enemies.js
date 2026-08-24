// ============================================
//   VOID SECTOR — enemies.js
//   All enemy types and their AI behaviors.
//   Each enemy is a plain object from a pool.
//   Collision with bullets handled here.
//   Death triggers drops, particles, score.
// ============================================

const Enemies = (() => {

  // ---------- Pool ----------
  const MAX_ENEMIES = 80;
  const _pool = [];

  for (let i = 0; i < MAX_ENEMIES; i++) {
    _pool.push({
      active: false,
      type: 'A',
      x: 0,
      y: 0,
      hp: 1,
      maxHp: 1,
      shootTimer: 0,
      // Type-specific movement state
      moveTimer: 0,    // General timer for pattern-based movement
      moveDir: 1,    // 1 = right, -1 = left (Dasher)
      phaseTimer: 0,    // Secondary timer (Bomber hover)
      // Visual
      char: 'V',
      color: '',
      flashTimer: 0,    // Frames of hit-flash remaining
    });
  }

  function _get() {
    for (const e of _pool) {
      if (!e.active) return e;
    }
    return null;
  }

  // ---------- Spawn ----------

  function spawn(type, col, row) {
    const e = _get();
    if (!e) return null;

    const def = C.ENEMY[type];

    e.active = true;
    e.type = type;
    e.x = col;
    e.y = row;
    e.hp = def.HP;
    e.maxHp = def.HP;
    e.char = def.CHAR;
    e.color = def.COLOR;
    e.flashTimer = 0;
    e.moveTimer = Math.floor(Math.random() * 60); // Stagger so they don't all move in sync
    e.moveDir = Math.random() < 0.5 ? 1 : -1;
    e.phaseTimer = 0;

    // Stagger shoot timers so enemies don't all fire at once
    e.shootTimer = Math.floor(Math.random() * def.SHOOT_RATE);

    return e;
  }

  // ---------- Update ----------

  function update(gameState) {
    for (const e of _pool) {
      if (!e.active) continue;

      // Tick flash
      if (e.flashTimer > 0) e.flashTimer -= 1;

      // Dispatch to type-specific AI
      switch (e.type) {
        case 'A': _updateGrunt(e, gameState); break;
        case 'B': _updateDasher(e, gameState); break;
        case 'C': _updateTank(e, gameState); break;
        case 'D': _updateBomber(e, gameState); break;
      }

      // Check bullet hits
      _checkBulletHits(e, gameState);

      // Enemy reached bottom of screen — player takes damage
      if (e.y >= C.ROWS - 1) {
        e.active = false;
        gameState.enemyBreached = true;
      }
    }
  }

  // ---------- Type A: Grunt ----------
  // Marches straight down. Fires single shots.
  // Simple, predictable — good for teaching the player.

  function _updateGrunt(e, gameState) {
    const def = C.ENEMY.A;

    e.y += def.SPEED;

    // Gentle left/right drift
    e.moveTimer += 1;
    if (e.moveTimer % 90 === 0) {
      e.moveDir = Math.random() < 0.5 ? 1 : -1;
    }
    e.x += e.moveDir * 0.008;
    e.x = Math.max(1, Math.min(C.COLS - 2, e.x));

    _tickShoot(e, def.SHOOT_RATE, gameState, () => {
      Bullets.spawnEnemy(e.x, e.y);
    });
  }

  // ---------- Type B: Dasher ----------
  // Fast, zigzags horizontally. Fires infrequently.
  // Rewards players who can track erratic movement.

  function _updateDasher(e, gameState) {
    const def = C.ENEMY.B;

    e.y += def.SPEED;

    // Zigzag: flip direction every ~40 frames
    e.moveTimer += 1;
    if (e.moveTimer % 40 === 0) {
      e.moveDir *= -1;
    }

    e.x += e.moveDir * 0.22;
    e.x = Math.max(1, Math.min(C.COLS - 2, e.x));

    // Bounce off walls
    if (e.x <= 1 || e.x >= C.COLS - 2) {
      e.moveDir *= -1;
    }

    _tickShoot(e, def.SHOOT_RATE, gameState, () => {
      // Fires aimed at player
      const px = gameState.playerX;
      const py = gameState.playerY;
      const dx = px - e.x;
      const dy = py - e.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const spd = C.BULLET.ENEMY_SPEED * 1.2;
      Bullets.spawnEnemy(e.x, e.y, {
        vx: (dx / len) * spd * 0.5,
        vy: (dy / len) * spd,
      });
    });
  }

  // ---------- Type C: Tank ----------
  // Slow, high HP, fires rapidly.
  // Forces the player to commit sustained fire.

  function _updateTank(e, gameState) {
    const def = C.ENEMY.C;

    e.y += def.SPEED;

    // Slow side-to-side sway
    e.moveTimer += 1;
    e.x += Math.sin(e.moveTimer * 0.04) * 0.03;
    e.x = Math.max(1, Math.min(C.COLS - 2, e.x));

    _tickShoot(e, def.SHOOT_RATE, gameState, () => {
      Bullets.spawnEnemy(e.x, e.y);
      // Fires two bullets slightly offset
      Bullets.spawnEnemy(e.x + 0.8, e.y);
    });
  }

  // ---------- Type D: Bomber ----------
  // Hovers at mid-screen, fires spread shots downward.
  // Forces the player to dodge wide bullet patterns.

  function _updateBomber(e, gameState) {
    const def = C.ENEMY.D;

    // Phase 1: descend to hover row
    const hoverRow = Math.floor(C.ROWS * 0.35);
    if (e.y < hoverRow) {
      e.y += def.SPEED * 1.5;
    } else {
      // Phase 2: hover and strafe
      e.phaseTimer += 1;
      e.x += Math.sin(e.phaseTimer * 0.03) * 0.08;
      e.x = Math.max(1, Math.min(C.COLS - 2, e.x));

      // Slowly drift down after a while
      if (e.phaseTimer > 300) {
        e.y += def.SPEED * 0.5;
      }
    }

    _tickShoot(e, def.SHOOT_RATE, gameState, () => {
      Bullets.spawnEnemySpread(e.x, e.y);
    });
  }

  // ---------- Shared shoot tick ----------
  // Increments shoot timer and calls fireFn when ready.

  function _tickShoot(e, rate, gameState, fireFn) {
    e.shootTimer += 1;
    // Scale shoot rate down as waves get harder
    const scaledRate = Math.max(
      rate * 0.45,
      rate - (gameState.wave || 0) * 4
    );
    if (e.shootTimer >= scaledRate) {
      e.shootTimer = 0;
      fireFn();
    }
  }

  // ---------- Bullet hit detection ----------

  function _checkBulletHits(e, gameState) {
    const hits = Bullets.getPlayerHits(e.x, e.y);
    if (hits.length === 0) return;

    for (const b of hits) {
      e.hp -= b.damage;
      Bullets.destroy(b);

      // Hit spark
      Particles.spawnHitSpark(e.x, e.y, { color: e.color });
      Audio.play('enemyHit');
      e.flashTimer = 6;
    }

    if (e.hp <= 0) {
      _kill(e, gameState);
    }
  }

  // ---------- Kill ----------

  function _kill(e, gameState) {
    const def = C.ENEMY[e.type];

    // Score + combo via player
    const result = Player.registerKill(def.SCORE);

    // Float text showing score earned
    Particles.spawnFloatText(
      e.x, e.y,
      result.multiplier > 1
        ? `+${result.earned} x${result.multiplier}`
        : `+${result.earned}`,
      { color: result.multiplier > 1 ? C.COLOR.ACCENT : C.COLOR.PRIMARY }
    );

    // Explosion
    Particles.spawnExplosion(e.x, e.y, {
      color: e.color,
      count: e.type === 'C' ? 18 : C.PARTICLE.EXPLOSION_COUNT,
    });
    Particles.shake(
      e.type === 'C' ? C.SHAKE.HIT_INTENSITY * 1.5 : C.SHAKE.HIT_INTENSITY
    );
    Audio.play('enemyDie');

    // Drop
    if (Math.random() < def.DROP_CHANCE) {
      Powerups.spawnDrop(e.x, e.y);
    }

    // Track kill in gameState for wave completion check
    gameState.enemiesKilledThisWave = (gameState.enemiesKilledThisWave || 0) + 1;

    e.active = false;
  }

  // ---------- Bomb kills all active enemies ----------

  function killAll(gameState) {
    for (const e of _pool) {
      if (!e.active) continue;
      _kill(e, gameState);
    }
  }

  // ---------- Getters ----------

  function getActive() {
    return _pool.filter(e => e.active);
  }

  function getCount() {
    return _pool.reduce((n, e) => n + (e.active ? 1 : 0), 0);
  }

  // ---------- Reset ----------

  function reset() {
    for (const e of _pool) e.active = false;
  }

  return {
    spawn,
    update,
    killAll,
    getActive,
    getCount,
    reset,
  };

})();
