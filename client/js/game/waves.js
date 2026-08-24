// ============================================
//   VOID SECTOR — waves.js
//   Wave definitions, enemy spawning,
//   difficulty scaling, and wave lifecycle.
//   Tells main.js when a wave is done.
// ============================================

const Waves = (() => {

  // ---------- State ----------
  let _wave = 0;     // Current wave number (1-indexed when active)
  let _spawnQueue = [];    // List of pending spawns: { type, col, row, delay }
  let _spawnTimer = 0;     // Counts up each frame
  let _waveActive = false;
  let _allSpawned = false; // True once spawn queue is exhausted
  let _interlude = 0;     // Frames of pre-wave pause remaining

  // ---------- Wave definitions ----------
  // Each wave is a function that returns a spawn list.
  // Spawns: { type, col, row, delay }
  // delay = frame offset from wave start before this enemy appears.
  // This lets us create formations, staggered entry, etc.

  const WAVE_DEFS = [

    // Wave 1 — Tutorial. 3 grunts = 150 score max. Can't afford anything yet.
    () => _formation_line('A', 3, 1, 12, 60),

    // Wave 2 — 4 grunts = 200 score. Saving up.
    () => _formation_line('A', 4, 1, 10, 50),

    // Wave 3 — First dasher appears. ~300 total score by now, first upgrade close.
    () => [
      ..._formation_line('A', 3, 1, 12, 50),
      ..._formation_scatter('B', 1, 240),
    ],

    // Wave 4 — More pressure. Two dashers + grunts.
    () => [
      ..._formation_scatter('A', 3, 0),
      ..._formation_scatter('B', 2, 160),
    ],

    // Wave 5 — Introduce Tank. Mini-boss feel.
    () => [
      ..._formation_line('A', 4, 1, 9, 40),
      { type: 'C', col: Math.floor(C.COLS / 2), row: 0, delay: 100 },
    ],

    // Wave 6 — Mixed. Real chaos starts.
    () => [
      ..._formation_line('A', 4, 1, 9, 35),
      ..._formation_scatter('B', 3, 90),
      { type: 'C', col: 10, row: 0, delay: 180 },
      { type: 'C', col: 34, row: 0, delay: 180 },
    ],

    // Wave 7 — Introduce Bomber.
    () => [
      ..._formation_scatter('A', 5, 0),
      ..._formation_scatter('B', 2, 130),
      { type: 'D', col: Math.floor(C.COLS / 2), row: 0, delay: 70 },
    ],

    // Wave 8 — Twin Bombers + support.
    () => [
      ..._formation_line('A', 3, 1, 10, 35),
      { type: 'D', col: 12, row: 0, delay: 50 },
      { type: 'D', col: 32, row: 0, delay: 50 },
      ..._formation_scatter('B', 3, 180),
    ],

    // Wave 9 — Tank swarm.
    () => [
      { type: 'C', col: 8, row: 0, delay: 0 },
      { type: 'C', col: 20, row: 0, delay: 60 },
      { type: 'C', col: 32, row: 0, delay: 60 },
      { type: 'C', col: 42, row: 0, delay: 120 },
      ..._formation_scatter('A', 5, 220),
    ],

    // Wave 10 — BOSS WAVE. All types, maximum pressure.
    () => [
      ..._formation_line('A', 5, 1, 8, 35),
      ..._formation_scatter('B', 4, 110),
      { type: 'C', col: 8, row: 0, delay: 160 },
      { type: 'C', col: 36, row: 0, delay: 160 },
      { type: 'D', col: 14, row: 0, delay: 220 },
      { type: 'D', col: 30, row: 0, delay: 220 },
      ..._formation_scatter('B', 3, 340),
      { type: 'C', col: Math.floor(C.COLS / 2), row: 0, delay: 400 },
    ],

  ];

  // ---------- Formation helpers ----------
  // These build spawn lists — reusable building blocks for wave design.

  // Horizontal line of enemies across the top
  // count: number, type, startCol, colSpacing, rowOffset, baseDelay
  function _formation_line(type, count, rowOffset, spacing, stagger, baseDelay = 0) {
    const list = [];
    const totalW = (count - 1) * spacing;
    const startCol = Math.floor((C.COLS - totalW) / 2);

    for (let i = 0; i < count; i++) {
      list.push({
        type,
        col: startCol + i * spacing,
        row: rowOffset,
        delay: baseDelay + i * stagger,
      });
    }
    return list;
  }

  // Random scatter across the top portion of the screen
  function _formation_scatter(type, count, baseDelay = 0) {
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        type,
        col: 2 + Math.floor(Math.random() * (C.COLS - 4)),
        row: Math.floor(Math.random() * 3),
        delay: baseDelay + i * 70,
      });
    }
    return list;
  }

  // ---------- Procedural wave generation (wave > 10) ----------
  // Waves beyond the defined ones are generated procedurally,
  // scaling up counts and mixing types.

  function _generateWave(waveNum) {
    const list = [];
    const budget = 4 + waveNum * 1.5;   // Enemy "budget" grows each wave
    let spent = 0;
    let delay = 0;

    // Type weights shift over time — later waves have more tanks/bombers
    const weights = {
      A: Math.max(0.1, 0.5 - waveNum * 0.02),
      B: Math.min(0.4, 0.2 + waveNum * 0.015),
      C: Math.min(0.3, 0.05 + waveNum * 0.015),
      D: Math.min(0.25, 0.05 + waveNum * 0.01),
    };

    const types = Object.keys(weights);

    while (spent < budget) {
      const type = _weightedRandom(weights, types);
      const cost = type === 'C' ? 2 : type === 'D' ? 1.5 : 1;
      if (spent + cost > budget + 1) break;

      list.push({
        type,
        col: 2 + Math.floor(Math.random() * (C.COLS - 4)),
        row: Math.floor(Math.random() * 3),
        delay: delay,
      });

      delay += 40 + Math.floor(Math.random() * 40);
      spent += cost;
    }

    return list;
  }

  function _weightedRandom(weights, keys) {
    const total = keys.reduce((s, k) => s + weights[k], 0);
    let r = Math.random() * total;
    for (const k of keys) {
      r -= weights[k];
      if (r <= 0) return k;
    }
    return keys[keys.length - 1];
  }

  // ---------- Wave lifecycle ----------

  function startWave(waveNum) {
    _wave = waveNum;
    _waveActive = true;
    _allSpawned = false;
    _spawnTimer = 0;
    _interlude = 90;   // 1.5 second pause before enemies enter

    // Get spawn list for this wave
    const idx = waveNum - 1;
    if (idx < WAVE_DEFS.length) {
      _spawnQueue = WAVE_DEFS[idx]();
    } else {
      _spawnQueue = _generateWave(waveNum);
    }

    // Sort by delay so we can process in order
    _spawnQueue.sort((a, b) => a.delay - b.delay);
  }

  function update(gameState) {
    if (!_waveActive) return;

    // Pre-wave interlude
    if (_interlude > 0) {
      _interlude -= 1;
      return;
    }

    _spawnTimer += 1;

    // Spawn any enemies whose delay has been reached
    if (!_allSpawned) {
      while (_spawnQueue.length > 0 && _spawnQueue[0].delay <= _spawnTimer) {
        const s = _spawnQueue.shift();
        Enemies.spawn(s.type, s.col, s.row);
      }
      if (_spawnQueue.length === 0) {
        _allSpawned = true;
      }
    }

    // Wave is complete when all spawned and all dead
    if (_allSpawned && Enemies.getCount() === 0) {
      _waveActive = false;
      gameState.waveComplete = true;
    }
  }

  // ---------- Getters ----------

  function getWave() { return _wave; }
  function isActive() { return _waveActive; }
  function isInInterlude() { return _interlude > 0; }
  function getInterludeFrac() { return _interlude / 90; }

  // ---------- Reset ----------

  function reset() {
    _wave = 0;
    _spawnQueue = [];
    _spawnTimer = 0;
    _waveActive = false;
    _allSpawned = false;
    _interlude = 0;
  }

  return {
    startWave,
    update,
    getWave,
    isActive,
    isInInterlude,
    getInterludeFrac,
    reset,
  };

})();
