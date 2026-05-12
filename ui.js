// ============================================
//   VOID SECTOR — ui.js
//   Overlay UI elements that sit on top of
//   the renderer: pause screen, wave clear
//   announcement, settings panel.
//   draw() is called by main.js after
//   Renderer.draw() each frame.
// ============================================

const UI = (() => {

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const CW = C.CHAR_W;
  const CH = C.CHAR_H;

  // ---------- State ----------
  let _paused = false;
  let _pauseCursor = 0;       // 0 = RESUME, 1 = SETTINGS, 2 = QUIT
  let _inSettings = false;
  let _settingsCursor = 0;
  let _inputLock = 0;

  // Wave clear announcement
  let _waveAnnounce = 0;       // Frames remaining to show announcement
  let _waveAnnounceNum = 0;

  // ---------- Pause ----------

  function togglePause() {
    if (_inSettings) { _inSettings = false; return; }
    _paused = !_paused;
    _pauseCursor = 0;
    _inputLock = 10;
    if (_paused) Audio.play('menuMove');
  }

  function isPaused() { return _paused; }

  // ---------- Wave clear ----------

  function showWaveClear(waveNum) {
    _waveAnnounceNum = waveNum;
    _waveAnnounce = 150;   // Show for 2.5 seconds
  }

  // ---------- Update ----------
  // Returns 'quit' if player chose to quit to menu.

  function update(gameState) {
    if (_inputLock > 0) { _inputLock -= 1; return null; }
    if (!_paused) return null;

    if (_inSettings) {
      return _updateSettings(gameState);
    }

    return _updatePauseMenu(gameState);
  }

  function _updatePauseMenu(gameState) {
    const items = 3; // RESUME, SETTINGS, QUIT

    if (Input.pressed.down) {
      _pauseCursor = (_pauseCursor + 1) % items;
      Audio.play('menuMove');
    }
    if (Input.pressed.up) {
      _pauseCursor = (_pauseCursor - 1 + items) % items;
      Audio.play('menuMove');
    }
    if (Input.pressed.confirm || Input.pressed.pause) {
      switch (_pauseCursor) {
        case 0:  // RESUME
          togglePause();
          Audio.play('menuConfirm');
          break;
        case 1:  // SETTINGS
          _inSettings = true;
          _settingsCursor = 0;
          Audio.play('menuConfirm');
          break;
        case 2:  // QUIT
          _paused = false;
          _inSettings = false;
          Audio.play('menuConfirm');
          return 'quit';
      }
    }
    return null;
  }

  function _updateSettings(gameState) {
    const save = Save.load();

    if (Input.pressed.up || Input.pressed.down) {
      _settingsCursor = (_settingsCursor + 1) % 2;
      Audio.play('menuMove');
    }
    if (Input.pressed.left) {
      if (_settingsCursor === 0) {
        Audio.setMasterVolume(Math.max(0, save.masterVolume - 0.1));
        Audio.play('menuMove');
      } else {
        Audio.setSfxVolume(Math.max(0, save.sfxVolume - 0.1));
        Audio.play('menuMove');
      }
    }
    if (Input.pressed.right) {
      if (_settingsCursor === 0) {
        Audio.setMasterVolume(Math.min(1, save.masterVolume + 0.1));
        Audio.play('menuMove');
      } else {
        Audio.setSfxVolume(Math.min(1, save.sfxVolume + 0.1));
        Audio.play('menuMove');
      }
    }
    if (Input.pressed.pause || Input.pressed.confirm) {
      _inSettings = false;
      Audio.play('menuConfirm');
    }
    return null;
  }

  // ---------- Draw ----------

  function draw(gameState) {
    if (_waveAnnounce > 0) {
      _drawWaveAnnounce();
      _waveAnnounce -= 1;
    }

    if (!_paused) return;

    _drawPauseOverlay(gameState);
  }

  function _drawWaveAnnounce() {
    const alpha = Math.min(1, _waveAnnounce / 30) * Math.min(1, (_waveAnnounce - 20) / 30 + 1);
    const y = C.CANVAS_H * 0.42;

    // Dark backing strip
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.55 * alpha;
    ctx.fillRect(0, y - CH * 1.2, C.CANVAS_W, CH * 2.2);
    ctx.globalAlpha = 1;

    _drawTextCentered(`WAVE ${_waveAnnounceNum} CLEARED`, y, C.COLOR.PRIMARY, alpha, C.FONT_SIZE * 1.05, true);

    const bonus = C.SCORE.WAVE_CLEAR_BONUS + (_waveAnnounceNum - 1) * 100;
    _drawTextCentered(`+${bonus} BONUS`, y + CH * 1.3, C.COLOR.ACCENT, alpha * 0.85, C.FONT_SIZE * 0.82);
  }

  function _drawPauseOverlay(gameState) {
    // Dim the whole screen
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.65;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    ctx.globalAlpha = 1;

    if (_inSettings) {
      _drawSettings();
    } else {
      _drawPauseMenu();
    }
  }

  function _drawPauseMenu() {
    const cx = C.CANVAS_W / 2;
    const cy = C.CANVAS_H * 0.38;

    _drawTextCentered('[ PAUSED ]', cy, C.COLOR.PRIMARY, 1, C.FONT_SIZE * 1.2, true);

    const items = ['RESUME', 'SETTINGS', 'QUIT TO MENU'];
    const lineH = CH * 1.8;

    for (let i = 0; i < items.length; i++) {
      const y = cy + CH * 2.2 + i * lineH;
      const selected = i === _pauseCursor;
      const color = selected ? C.COLOR.ACCENT : C.COLOR.DIM;
      const alpha = selected ? 1 : 0.6;
      const prefix = selected ? '> ' : '  ';

      _drawTextCentered(prefix + items[i], y, color, alpha, C.FONT_SIZE * 0.95, selected);
    }
  }

  function _drawSettings() {
    const cy = C.CANVAS_H * 0.35;
    _drawTextCentered('[ SETTINGS ]', cy, C.COLOR.PRIMARY, 1, C.FONT_SIZE * 1.1, true);

    const save = Save.load();
    const lineH = CH * 2.0;
    const labels = ['MASTER VOL', 'SFX VOL'];
    const vals = [save.masterVolume, save.sfxVolume];

    for (let i = 0; i < labels.length; i++) {
      const y = cy + CH * 2.5 + i * lineH;
      const selected = i === _settingsCursor;
      const color = selected ? C.COLOR.PRIMARY : C.COLOR.DIM;

      _drawTextCentered(labels[i], y, color, selected ? 1 : 0.65, C.FONT_SIZE * 0.88, selected);

      // Volume bar
      const barW = CW * 12;
      const barX = (C.CANVAS_W - barW) / 2;
      const barY = y + 5;
      const filled = Math.round(vals[i] * 10);

      ctx.fillStyle = C.COLOR.DIM;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(barX, barY, barW, 4);
      ctx.fillStyle = selected ? C.COLOR.ACCENT : C.COLOR.DIM;
      ctx.globalAlpha = selected ? 0.9 : 0.4;
      ctx.fillRect(barX, barY, barW * vals[i], 4);
      ctx.globalAlpha = 1;

      // Tick marks
      ctx.fillStyle = selected ? C.COLOR.PRIMARY : C.COLOR.DIM;
      ctx.globalAlpha = selected ? 0.7 : 0.3;
      _setFont(C.FONT_SIZE * 0.7);
      ctx.fillText('< ' + '|'.repeat(filled) + ' '.repeat(10 - filled) + ' >', barX - CW * 2, barY + 10);
      ctx.globalAlpha = 1;
    }

    _drawTextCentered('< > TO ADJUST  |  ENTER TO BACK', cy + CH * 8, C.COLOR.DIM, 0.5, C.FONT_SIZE * 0.72);
  }

  // ---------- Helpers ----------

  function _drawTextCentered(text, y, color, alpha = 1, size = C.FONT_SIZE, bold = false) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${C.FONT_FAMILY}`;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    const w = ctx.measureText(text).width;
    ctx.fillText(text, (C.CANVAS_W - w) / 2, y);
    ctx.globalAlpha = 1;
  }

  function _setFont(size, bold = false) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${C.FONT_FAMILY}`;
  }

  // ---------- Reset ----------

  function reset() {
    _paused = false;
    _pauseCursor = 0;
    _inSettings = false;
    _settingsCursor = 0;
    _inputLock = 0;
    _waveAnnounce = 0;
  }

  return {
    togglePause,
    isPaused,
    showWaveClear,
    update,
    draw,
    reset,
  };

})();
