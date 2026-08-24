// ============================================
//   VOID SECTOR — bullets.js
//   Bullet pool for ALL projectiles.
//   Player bullets and enemy bullets live here.
//   Collision detection is also handled here —
//   bullets know what they can hit.
// ============================================

const Bullets = (() => {

  // ---------- Pool ----------
  // One flat pool for all bullets — both player and enemy.
  // 'owner' field tells us whose side a bullet is on.

  const _pool = [];

  for (let i = 0; i < C.BULLET.POOL_SIZE; i++) {
    _pool.push({
      active: false,
      owner: 'player',   // 'player' | 'enemy'
      x: 0,          // Grid col (float)
      y: 0,          // Grid row (float)
      vx: 0,          // Horizontal velocity (cols/frame)
      vy: 0,          // Vertical velocity (rows/frame)
      char: '|',
      color: C.COLOR.PRIMARY,
      damage: 1,
    });
  }

  function _get() {
    for (const b of _pool) {
      if (!b.active) return b;
    }
    return null; // Pool full — bullet is dropped (rare)
  }

  // ---------- Spawn ----------

  // Fire a single player bullet upward
  function spawnPlayer(col, row, { vx = 0, char = C.BULLET.PLAYER_CHAR, damage = 1 } = {}) {
    const b = _get();
    if (!b) return;

    b.active = true;
    b.owner = 'player';
    b.x = col;
    b.y = row - 1;   // Spawn just above player
    b.vx = vx;
    b.vy = -C.BULLET.PLAYER_SPEED;
    b.char = char;
    b.color = C.COLOR.PRIMARY;
    b.damage = damage;
  }

  // Fire a spread shot — 3 bullets in a cone
  function spawnPlayerSpread(col, row) {
    const chars = C.BULLET.SPREAD_CHARS;
    const angles = [-0.18, 0, 0.18]; // Slight left, center, slight right

    for (let i = 0; i < 3; i++) {
      const b = _get();
      if (!b) continue;

      b.active = true;
      b.owner = 'player';
      b.x = col;
      b.y = row - 1;
      b.vx = angles[i];
      b.vy = -C.BULLET.PLAYER_SPEED;
      b.char = chars[i];
      b.color = C.COLOR.ACCENT;
      b.damage = 1;
    }
  }

  // Fire a multi-shot (parallel columns) — upgrade level controls count
  function spawnPlayerMulti(col, row, count, spreadActive) {
    if (spreadActive) {
      spawnPlayerSpread(col, row);
      return;
    }

    // count: 1 = single, 2 = double, 3 = triple, etc.
    // Bullets fan out symmetrically around the player
    const offsets = _multiOffsets(count);
    for (const ox of offsets) {
      spawnPlayer(col + ox, row, { vx: 0 });
    }
  }

  function _multiOffsets(count) {
    if (count === 1) return [0];
    if (count === 2) return [-1, 1];
    if (count === 3) return [-2, 0, 2];
    if (count === 4) return [-3, -1, 1, 3];
    return [-4, -2, 0, 2, 4]; // max 5
  }

  // Fire an enemy bullet downward toward player
  // dir: optional horizontal bias (-1 = left, 0 = straight, 1 = right)
  function spawnEnemy(col, row, { vx = 0, vy = null, damage = 1 } = {}) {
    const b = _get();
    if (!b) return;

    b.active = true;
    b.owner = 'enemy';
    b.x = col;
    b.y = row + 1;  // Spawn just below enemy
    b.vx = vx;
    b.vy = vy !== null ? vy : C.BULLET.ENEMY_SPEED;
    b.char = C.BULLET.ENEMY_CHAR;
    b.color = C.COLOR.DANGER;
    b.damage = damage;
  }

  // Bomber spread — fires 3 bullets in a downward cone
  function spawnEnemySpread(col, row) {
    const angles = [-0.12, 0, 0.12];
    for (const vx of angles) {
      spawnEnemy(col, row, { vx, vy: C.BULLET.ENEMY_SPEED * 0.85 });
    }
  }

  // ---------- Update ----------

  function update() {
    for (let i = _pool.length - 1; i >= 0; i--) {
      const b = _pool[i];
      if (!b.active) continue;

      b.x += b.vx;
      b.y += b.vy;

      // Deactivate if off screen (with margin)
      if (b.y < -2 || b.y > C.ROWS + 2 || b.x < -2 || b.x > C.COLS + 2) {
        b.active = false;
      }
    }
  }

  // ---------- Collision ----------

  // Returns all active player bullets within hit radius of (col, row)
  // Caller (enemies.js) uses this to check if a bullet hit an enemy
  function getPlayerHits(col, row, radius = 0.8) {
    const hits = [];
    for (const b of _pool) {
      if (!b.active || b.owner !== 'player') continue;
      const dx = b.x - col;
      const dy = b.y - row;
      if (Math.abs(dx) < radius && Math.abs(dy) < radius) {
        hits.push(b);
      }
    }
    return hits;
  }

  // Returns all active enemy bullets within hit radius of (col, row)
  // Caller (player.js) uses this to check if a bullet hit the player
  function getEnemyHits(col, row, radius = 0.8) {
    const hits = [];
    for (const b of _pool) {
      if (!b.active || b.owner !== 'enemy') continue;
      const dx = b.x - col;
      const dy = b.y - row;
      if (Math.abs(dx) < radius && Math.abs(dy) < radius) {
        hits.push(b);
      }
    }
    return hits;
  }

  // Deactivate a bullet (call after a hit is registered)
  function destroy(bullet) {
    bullet.active = false;
  }

  // Destroy all enemy bullets — used by bomb power-up
  function clearEnemyBullets() {
    for (const b of _pool) {
      if (b.active && b.owner === 'enemy') b.active = false;
    }
  }

  // ---------- Read (for renderer) ----------

  function getActive() {
    return _pool.filter(b => b.active);
  }

  // ---------- Reset ----------

  function reset() {
    for (const b of _pool) b.active = false;
  }

  return {
    // Spawn
    spawnPlayer,
    spawnPlayerSpread,
    spawnPlayerMulti,
    spawnEnemy,
    spawnEnemySpread,
    // Update
    update,
    // Collision
    getPlayerHits,
    getEnemyHits,
    destroy,
    clearEnemyBullets,
    // Read
    getActive,
    // Lifecycle
    reset,
  };

})();
