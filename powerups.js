// ============================================
//   VOID SECTOR — powerups.js
//   Handles drops from dead enemies, pickup
//   collision with player, and timed effects.
//   Active effects are stored here and read
//   by player.js each frame.
// ============================================

const Powerups = (() => {

  // ---------- Active drops (falling on screen) ----------
  let _drops = [];

  // ---------- Active timed effects on the player ----------
  const _effects = {
    rapid: { active: false, framesLeft: 0 },
    spread: { active: false, framesLeft: 0 },
    shield: { active: false, hitsLeft: 0 },
  };

  // ---------- Bomb count (inventory, not timed) ----------
  let _bombs = 0;

  // ---------- Spawn a drop at a grid position ----------
  // Called by enemies.js when an enemy dies

  function spawnDrop(col, row, type = null) {
    // If no type specified, pick randomly weighted
    const t = type || _randomType();
    const def = C.POWERUP;

    _drops.push({
      x: col,
      y: row,
      type: t,
      char: def.CHARS[t],
      color: def.COLORS[t],
      life: 420,   // Auto-despawn after 7 seconds (420 frames)
    });
  }

  function _randomType() {
    // Weighted random — lives and bombs are rarer
    const roll = Math.random();
    if (roll < 0.30) return 'RAPID';
    if (roll < 0.55) return 'SPREAD';
    if (roll < 0.72) return 'SHIELD';
    if (roll < 0.88) return 'BOMB';
    return 'LIFE';
  }

  // ---------- Update ----------

  function update(playerCol, playerRow, gameState) {
    const pickRadius = 0.9;
    const picked = [];   // Types picked up this frame — returned to caller

    for (let i = _drops.length - 1; i >= 0; i--) {
      const d = _drops[i];

      // Fall downward
      d.y += C.POWERUP.FALL_SPEED;
      d.life -= 1;

      // Despawn if off screen or expired
      if (d.y > C.ROWS + 1 || d.life <= 0) {
        _drops.splice(i, 1);
        continue;
      }

      // Collision with player
      const dx = Math.abs(d.x - playerCol);
      const dy = Math.abs(d.y - playerRow);
      if (dx < pickRadius && dy < pickRadius) {
        _applyEffect(d.type, gameState);
        picked.push(d.type);
        _drops.splice(i, 1);
        continue;
      }
    }

    // Tick timed effects
    if (_effects.rapid.active) {
      _effects.rapid.framesLeft -= 1;
      if (_effects.rapid.framesLeft <= 0) _effects.rapid.active = false;
    }
    if (_effects.spread.active) {
      _effects.spread.framesLeft -= 1;
      if (_effects.spread.framesLeft <= 0) _effects.spread.active = false;
    }

    return picked;  // Caller uses this to play sounds, show float text, etc.
  }

  // ---------- Apply an effect when picked up ----------

  function _applyEffect(type, gameState) {
    switch (type) {
      case 'RAPID':
        _effects.rapid.active = true;
        _effects.rapid.framesLeft = C.POWERUP.RAPID_DURATION;
        break;

      case 'SPREAD':
        _effects.spread.active = true;
        _effects.spread.framesLeft = C.POWERUP.SPREAD_DURATION;
        break;

      case 'SHIELD':
        _effects.shield.active = true;
        _effects.shield.hitsLeft = C.POWERUP.SHIELD_HITS;
        break;

      case 'BOMB':
        _bombs = Math.min(_bombs + 1, 3);   // Max 3 bombs held
        break;

      case 'LIFE':
        // gameState passed in so powerups can request a life add
        // without directly touching player state
        if (gameState) gameState.pendingLifeUp = true;
        break;
    }
  }

  // ---------- Shield interaction ----------

  // Call when player would take damage. Returns true if shield absorbed it.
  function absorbHit() {
    if (_effects.shield.active && _effects.shield.hitsLeft > 0) {
      _effects.shield.hitsLeft -= 1;
      if (_effects.shield.hitsLeft <= 0) {
        _effects.shield.active = false;
      }
      return true;  // Hit absorbed
    }
    return false;   // No shield — take the hit
  }

  // ---------- Bomb ----------

  function useBomb() {
    if (_bombs <= 0) return false;
    _bombs -= 1;
    Bullets.clearEnemyBullets();
    return true;
  }

  function getBombCount() { return _bombs; }

  // ---------- Getters (read by player.js and renderer) ----------

  function isRapid() { return _effects.rapid.active; }
  function isSpread() { return _effects.spread.active; }
  function isShield() { return _effects.shield.active; }

  function getRapidFramesLeft() { return _effects.rapid.framesLeft; }
  function getSpreadFramesLeft() { return _effects.spread.framesLeft; }
  function getShieldHitsLeft() { return _effects.shield.hitsLeft; }

  function getDrops() { return _drops; }

  // ---------- Reset ----------

  function reset() {
    _drops.length = 0;
    _effects.rapid.active = false;
    _effects.rapid.framesLeft = 0;
    _effects.spread.active = false;
    _effects.spread.framesLeft = 0;
    _effects.shield.active = false;
    _effects.shield.hitsLeft = 0;
    _bombs = 0;
  }

  return {
    // Spawn
    spawnDrop,
    // Update
    update,
    // Shield
    absorbHit,
    // Bomb
    useBomb,
    getBombCount,
    // Effect queries
    isRapid,
    isSpread,
    isShield,
    getRapidFramesLeft,
    getSpreadFramesLeft,
    getShieldHitsLeft,
    // Read
    getDrops,
    // Lifecycle
    reset,
  };

})();
