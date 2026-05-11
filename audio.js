// ============================================
//   VOID SECTOR — audio.js
//   Procedural sound via Web Audio API.
//   Zero audio files needed — all synthesized.
//   Call Audio.play('shoot') anywhere in code.
// ============================================

const Audio = (() => {

  let ctx = null;        // AudioContext — created on first interaction
  let masterGain = null; // Master volume node
  let sfxGain = null;    // SFX volume node

  // Lazily create the AudioContext (browsers block it before user gesture)
  function _getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      sfxGain = ctx.createGain();
      sfxGain.connect(masterGain);
      masterGain.connect(ctx.destination);

      const save = Save.load();
      masterGain.gain.value = save.masterVolume;
      sfxGain.gain.value = save.sfxVolume;
    }
    // Resume if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ---------- Low-level synth helpers ----------

  // Play a simple oscillator burst
  // type: 'sine'|'square'|'sawtooth'|'triangle'
  function _osc({ type = 'square', freq = 440, endFreq = null,
    duration = 0.1, volume = 0.3, delay = 0 } = {}) {
    const c = _getCtx();
    const now = c.currentTime + delay;

    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    }

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(sfxGain);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  // White noise burst (for explosions)
  function _noise({ duration = 0.15, volume = 0.4, delay = 0 } = {}) {
    const c = _getCtx();
    const now = c.currentTime + delay;

    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const source = c.createBufferSource();
    source.buffer = buffer;

    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // High-pass filter so it sounds less muddy
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);

    source.start(now);
  }

  // ---------- Sound definitions ----------
  // Each sound is a function that calls _osc / _noise
  // in combination to produce a distinct effect.

  const SOUNDS = {

    shoot() {
      _osc({ type: 'square', freq: 880, endFreq: 440, duration: 0.06, volume: 0.18 });
    },

    shootSpread() {
      _osc({ type: 'square', freq: 660, endFreq: 330, duration: 0.07, volume: 0.14, delay: 0.00 });
      _osc({ type: 'square', freq: 880, endFreq: 440, duration: 0.07, volume: 0.14, delay: 0.02 });
      _osc({ type: 'square', freq: 550, endFreq: 275, duration: 0.07, volume: 0.14, delay: 0.04 });
    },

    enemyHit() {
      _osc({ type: 'square', freq: 200, endFreq: 100, duration: 0.08, volume: 0.22 });
    },

    enemyDie() {
      _noise({ duration: 0.12, volume: 0.30 });
      _osc({ type: 'sawtooth', freq: 150, endFreq: 50, duration: 0.15, volume: 0.20 });
    },

    playerHit() {
      _noise({ duration: 0.20, volume: 0.50 });
      _osc({ type: 'sawtooth', freq: 120, endFreq: 40, duration: 0.25, volume: 0.35 });
    },

    playerDie() {
      _noise({ duration: 0.5, volume: 0.6 });
      _osc({ type: 'sawtooth', freq: 200, endFreq: 30, duration: 0.6, volume: 0.4 });
      _osc({ type: 'square', freq: 100, endFreq: 20, duration: 0.8, volume: 0.3, delay: 0.1 });
    },

    pickup() {
      _osc({ type: 'sine', freq: 660, duration: 0.08, volume: 0.25 });
      _osc({ type: 'sine', freq: 880, duration: 0.08, volume: 0.25, delay: 0.08 });
      _osc({ type: 'sine', freq: 1100, duration: 0.12, volume: 0.25, delay: 0.16 });
    },

    shieldHit() {
      _osc({ type: 'sine', freq: 440, endFreq: 880, duration: 0.15, volume: 0.30 });
      _noise({ duration: 0.08, volume: 0.15 });
    },

    roll() {
      _osc({ type: 'sine', freq: 300, endFreq: 600, duration: 0.12, volume: 0.20 });
    },

    waveStart() {
      _osc({ type: 'square', freq: 220, duration: 0.10, volume: 0.25, delay: 0.00 });
      _osc({ type: 'square', freq: 330, duration: 0.10, volume: 0.25, delay: 0.12 });
      _osc({ type: 'square', freq: 440, duration: 0.15, volume: 0.30, delay: 0.24 });
    },

    waveClear() {
      _osc({ type: 'sine', freq: 440, duration: 0.10, volume: 0.28, delay: 0.00 });
      _osc({ type: 'sine', freq: 550, duration: 0.10, volume: 0.28, delay: 0.10 });
      _osc({ type: 'sine', freq: 660, duration: 0.10, volume: 0.28, delay: 0.20 });
      _osc({ type: 'sine', freq: 880, duration: 0.20, volume: 0.35, delay: 0.30 });
    },

    menuMove() {
      _osc({ type: 'square', freq: 440, duration: 0.05, volume: 0.15 });
    },

    menuConfirm() {
      _osc({ type: 'square', freq: 660, duration: 0.08, volume: 0.22 });
      _osc({ type: 'square', freq: 880, duration: 0.10, volume: 0.22, delay: 0.08 });
    },

    bomb() {
      _noise({ duration: 0.6, volume: 0.7 });
      _osc({ type: 'sawtooth', freq: 80, endFreq: 20, duration: 0.8, volume: 0.5 });
    },

    highScore() {
      // Ascending arpeggio
      [440, 550, 660, 770, 880, 1100].forEach((f, i) => {
        _osc({ type: 'sine', freq: f, duration: 0.12, volume: 0.28, delay: i * 0.10 });
      });
    },

    shopBuy() {
      _osc({ type: 'sine', freq: 550, duration: 0.08, volume: 0.22 });
      _osc({ type: 'sine', freq: 770, duration: 0.12, volume: 0.28, delay: 0.08 });
    },

    shopDeny() {
      _osc({ type: 'square', freq: 180, duration: 0.15, volume: 0.22 });
      _osc({ type: 'square', freq: 120, duration: 0.15, volume: 0.22, delay: 0.10 });
    },

  };

  // ---------- Public API ----------

  function play(name) {
    if (!SOUNDS[name]) {
      console.warn('[Audio] Unknown sound:', name);
      return;
    }
    try {
      SOUNDS[name]();
    } catch (e) {
      // Never let audio crash the game
      console.warn('[Audio] Playback error:', e);
    }
  }

  function setMasterVolume(v) {
    _getCtx();
    masterGain.gain.value = Math.max(0, Math.min(1, v));
    Save.set('masterVolume', masterGain.gain.value);
  }

  function setSfxVolume(v) {
    _getCtx();
    sfxGain.gain.value = Math.max(0, Math.min(1, v));
    Save.set('sfxVolume', sfxGain.gain.value);
  }

  // Call once on first user interaction to unlock audio
  function unlock() { _getCtx(); }

  return { play, setMasterVolume, setSfxVolume, unlock };

})();
