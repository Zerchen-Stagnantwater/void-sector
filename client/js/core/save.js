// ============================================
//   VOID SECTOR — save.js
//   Handles all persistence via localStorage.
//   One place for all save/load logic.
//   Never call localStorage directly elsewhere.
// ============================================

const Save = (() => {

  const PREFIX = 'voidsector_';

  // Default save state — what a fresh player gets
  const DEFAULTS = {
    highScore: 0,
    gamesPlayed: 0,
    totalKills: 0,
    bestWave: 0,
    masterVolume: 0.5,
    sfxVolume: 1.0,
    // Future: unlocks, achievements, etc.
  };

  // ---------- Core read/write ----------

  function _key(name) {
    return PREFIX + name;
  }

  function _get(name) {
    try {
      const raw = localStorage.getItem(_key(name));
      return raw !== null ? JSON.parse(raw) : undefined;
    } catch (e) {
      console.warn('[Save] Read failed for', name, e);
      return undefined;
    }
  }

  function _set(name, value) {
    try {
      localStorage.setItem(_key(name), JSON.stringify(value));
    } catch (e) {
      console.warn('[Save] Write failed for', name, e);
    }
  }

  // ---------- Public API ----------

  // Load full save data, filling gaps with defaults
  function load() {
    const data = {};
    for (const [key, def] of Object.entries(DEFAULTS)) {
      const saved = _get(key);
      data[key] = saved !== undefined ? saved : def;
    }
    return data;
  }

  // Save a single field by name
  function set(name, value) {
    if (!(name in DEFAULTS)) {
      console.warn('[Save] Unknown save field:', name);
      return;
    }
    _set(name, value);
  }

  // Submit end-of-run stats — updates records if beaten
  function submitRun({ score, wave, kills }) {
    const current = load();

    let changed = false;

    if (score > current.highScore) {
      _set('highScore', score);
      changed = true;
    }
    if (wave > current.bestWave) {
      _set('bestWave', wave);
    }

    _set('gamesPlayed', current.gamesPlayed + 1);
    _set('totalKills', current.totalKills + kills);

    return changed; // true = new high score
  }

  // Wipe everything (for a "reset data" option)
  function clearAll() {
    for (const key of Object.keys(DEFAULTS)) {
      localStorage.removeItem(_key(key));
    }
  }

  return { load, set, submitRun, clearAll };

})();
