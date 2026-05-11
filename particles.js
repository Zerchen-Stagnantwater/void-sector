// ============================================
//   VOID SECTOR — particles.js
//   Visual juice: explosions, screen shake,
//   floating text, trails, flash effects.
//   Pure visual — no game logic lives here.
// ============================================

const Particles = (() => {

  // ---------- State ----------
  let _particles = [];   // Active particle objects
  let _floatTexts = [];   // Floating score/text popups
  let _shake = { x: 0, y: 0, intensity: 0 };
  let _flashAlpha = 0;    // Full-screen flash (0 = none, 1 = white)
  let _flashColor = C.COLOR.PRIMARY;

  // ---------- Particle pool ----------
  // We recycle objects instead of allocating new ones each explosion.
  // This is a core performance habit — avoid GC pressure in the game loop.

  const POOL_SIZE = 300;
  const _pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    _pool.push({
      active: false,
      x: 0, y: 0,       // Grid coords (float)
      vx: 0, vy: 0,     // Velocity in grid units per frame
      char: '*',
      color: C.COLOR.PRIMARY,
      life: 0,           // Frames remaining
      maxLife: 0,
      alpha: 1,
    });
  }

  function _getFromPool() {
    for (const p of _pool) {
      if (!p.active) return p;
    }
    return null; // Pool exhausted — skip this particle
  }

  // ---------- Spawn helpers ----------

  function spawnExplosion(col, row, { color = C.COLOR.PRIMARY, count = C.PARTICLE.EXPLOSION_COUNT, spread = 1.2 } = {}) {
    for (let i = 0; i < count; i++) {
      const p = _getFromPool();
      if (!p) continue;

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
      const speed = (0.04 + Math.random() * 0.08) * spread;

      p.active = true;
      p.x = col;
      p.y = row;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.char = C.PARTICLE.CHARS[Math.floor(Math.random() * C.PARTICLE.CHARS.length)];
      p.color = color;
      p.maxLife = C.PARTICLE.LIFETIME + Math.floor(Math.random() * 10);
      p.life = p.maxLife;
      p.alpha = 1;

      _particles.push(p);
    }
  }

  function spawnHitSpark(col, row, { color = C.COLOR.PRIMARY } = {}) {
    // Small, fast spark — used when a bullet hits an enemy
    for (let i = 0; i < 4; i++) {
      const p = _getFromPool();
      if (!p) continue;

      p.active = true;
      p.x = col + (Math.random() - 0.5) * 0.5;
      p.y = row + (Math.random() - 0.5) * 0.5;
      p.vx = (Math.random() - 0.5) * 0.12;
      p.vy = (Math.random() - 0.5) * 0.12;
      p.char = Math.random() < 0.5 ? '+' : '.';
      p.color = color;
      p.maxLife = 10 + Math.floor(Math.random() * 8);
      p.life = p.maxLife;
      p.alpha = 1;

      _particles.push(p);
    }
  }

  function spawnTrail(col, row, { color = C.COLOR.DIM } = {}) {
    // Single trail particle — call each frame behind fast-moving objects
    const p = _getFromPool();
    if (!p) return;

    p.active = true;
    p.x = col + (Math.random() - 0.5) * 0.3;
    p.y = row;
    p.vx = (Math.random() - 0.5) * 0.02;
    p.vy = 0.01 + Math.random() * 0.02;
    p.char = Math.random() < 0.5 ? '.' : '`';
    p.color = color;
    p.maxLife = 8 + Math.floor(Math.random() * 6);
    p.life = p.maxLife;
    p.alpha = 0.7;

    _particles.push(p);
  }

  // Floating score text — e.g. "+100" rising from a kill
  function spawnFloatText(col, row, text, { color = C.COLOR.PRIMARY } = {}) {
    _floatTexts.push({
      x: col, y: row,
      text,
      color,
      life: 45,
      maxLife: 45,
      vy: -0.04,   // Drifts upward
    });
  }

  // ---------- Screen shake ----------

  function shake(intensity) {
    // Always take the larger value — don't reset a big shake with a small one
    if (intensity > _shake.intensity) {
      _shake.intensity = intensity;
    }
  }

  function getShakeOffset() {
    return { x: _shake.x, y: _shake.y };
  }

  // ---------- Screen flash ----------

  function flash(color = C.COLOR.PRIMARY, alpha = 0.4) {
    _flashColor = color;
    _flashAlpha = Math.min(1, _flashAlpha + alpha);
  }

  function getFlash() {
    return { color: _flashColor, alpha: _flashAlpha };
  }

  // ---------- Update (called every frame) ----------

  function update() {
    // Update shake
    if (_shake.intensity > 0.1) {
      _shake.x = (Math.random() - 0.5) * _shake.intensity;
      _shake.y = (Math.random() - 0.5) * _shake.intensity;
      _shake.intensity *= C.SHAKE.DECAY;
    } else {
      _shake.x = 0;
      _shake.y = 0;
      _shake.intensity = 0;
    }

    // Decay flash
    if (_flashAlpha > 0) {
      _flashAlpha = Math.max(0, _flashAlpha - 0.06);
    }

    // Update particles
    for (let i = _particles.length - 1; i >= 0; i--) {
      const p = _particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      p.alpha = p.life / p.maxLife;

      if (p.life <= 0) {
        p.active = false;
        _particles.splice(i, 1);
      }
    }

    // Update float texts
    for (let i = _floatTexts.length - 1; i >= 0; i--) {
      const t = _floatTexts[i];
      t.y += t.vy;
      t.life -= 1;
      if (t.life <= 0) {
        _floatTexts.splice(i, 1);
      }
    }
  }

  // ---------- Read (for renderer) ----------

  function getParticles() { return _particles; }
  function getFloatTexts() { return _floatTexts; }

  // ---------- Reset (on new game) ----------

  function reset() {
    for (const p of _pool) p.active = false;
    _particles.length = 0;
    _floatTexts.length = 0;
    _shake.x = 0;
    _shake.y = 0;
    _shake.intensity = 0;
    _flashAlpha = 0;
  }

  return {
    // Spawn
    spawnExplosion,
    spawnHitSpark,
    spawnTrail,
    spawnFloatText,
    // Effects
    shake,
    flash,
    // Read
    getShakeOffset,
    getFlash,
    getParticles,
    getFloatTexts,
    // Lifecycle
    update,
    reset,
  };

})();
