// ============================================
//   UI.ts
//   Pause screen, settings panel,
//   wave clear announcement overlay.
// ============================================

import { C } from '@void-sector/shared';
import * as Audio from '../fx/Audio.js';
import { pressed } from '../core/input.js';
import { load } from '../core/save.js';
import { getCtx } from './Renderer.js';

// ---------- State ----------

let _paused         = false;
let _pauseCursor    = 0;
let _inSettings     = false;
let _settingsCursor = 0;
let _inputLock      = 0;
let _waveAnnounce   = 0;
let _waveNum        = 0;

// ---------- Wave clear ----------

export function showWaveClear(waveNum: number): void {
  if (!waveNum || waveNum < 1) return;
  _waveNum      = waveNum;
  _waveAnnounce = 150;
}

// ---------- Pause ----------

export function togglePause(): void {
  if (_inSettings) { _inSettings = false; return; }
  _paused      = !_paused;
  _pauseCursor = 0;
  _inputLock   = 10;
  if (_paused) Audio.play('menuMove');
}

export function isPaused(): boolean { return _paused; }

// ---------- Update ----------

/** Returns 'quit' if player chose to quit to lobby. */
export function updateUI(): 'quit' | null {
  if (_inputLock > 0) { _inputLock--; return null; }
  if (!_paused) return null;
  return _inSettings ? _updateSettings() : _updatePause();
}

function _updatePause(): 'quit' | null {
  if (pressed('down')) { _pauseCursor = (_pauseCursor + 1) % 3; Audio.play('menuMove'); }
  if (pressed('up'))   { _pauseCursor = (_pauseCursor - 1 + 3) % 3; Audio.play('menuMove'); }

  if (pressed('confirm') || pressed('pause')) {
    switch (_pauseCursor) {
      case 0: togglePause(); Audio.play('menuConfirm'); break;
      case 1: _inSettings = true; _settingsCursor = 0; Audio.play('menuConfirm'); break;
      case 2:
        _paused = false; _inSettings = false;
        Audio.play('menuConfirm');
        return 'quit';
    }
  }
  return null;
}

function _updateSettings(): 'quit' | null {
  const save = load();
  if (pressed('up') || pressed('down')) { _settingsCursor = (_settingsCursor + 1) % 2; Audio.play('menuMove'); }
  if (pressed('left')) {
    if (_settingsCursor === 0) Audio.setMasterVolume(Math.max(0, save.masterVolume - 0.1));
    else                       Audio.setSfxVolume(Math.max(0, save.sfxVolume - 0.1));
    Audio.play('menuMove');
  }
  if (pressed('right')) {
    if (_settingsCursor === 0) Audio.setMasterVolume(Math.min(1, save.masterVolume + 0.1));
    else                       Audio.setSfxVolume(Math.min(1, save.sfxVolume + 0.1));
    Audio.play('menuMove');
  }
  if (pressed('pause') || pressed('confirm')) { _inSettings = false; Audio.play('menuConfirm'); }
  return null;
}

// ---------- Draw ----------

export function drawUI(frame: number): void {
  if (_waveAnnounce > 0) { _drawWaveClear(); _waveAnnounce--; }
  if (_paused) _drawPause();
}

function _drawWaveClear(): void {
  const ctx   = getCtx();
  const CH    = C.CHAR_H;
  const alpha = Math.min(1, _waveAnnounce / 30) * Math.min(1, (_waveAnnounce - 20) / 30 + 1);
  const y     = C.CANVAS_H * 0.42;

  ctx.fillStyle   = '#000';
  ctx.globalAlpha = 0.55 * alpha;
  ctx.fillRect(0, y - CH * 1.2, C.CANVAS_W, CH * 2.2);
  ctx.globalAlpha = 1;

  tc(`WAVE ${_waveNum} CLEARED`, y,             C.COLOR.PRIMARY, alpha, C.FONT_SIZE * 1.05, true);
  tc(`+${C.SCORE.WAVE_CLEAR_BONUS + (_waveNum - 1) * 100} BONUS`,
     y + CH * 1.3, C.COLOR.ACCENT,  alpha * 0.85, C.FONT_SIZE * 0.82);
}

function _drawPause(): void {
  const ctx = getCtx();
  ctx.fillStyle   = '#000';
  ctx.globalAlpha = 0.65;
  ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
  ctx.globalAlpha = 1;

  if (_inSettings) _drawSettings(ctx);
  else             _drawPauseMenu(ctx);
}

function _drawPauseMenu(ctx: CanvasRenderingContext2D): void {
  const cy    = C.CANVAS_H * 0.38;
  const lineH = C.CHAR_H * 1.8;
  tc('[ PAUSED ]', cy, C.COLOR.PRIMARY, 1, C.FONT_SIZE * 1.2, true);

  ['RESUME', 'SETTINGS', 'QUIT TO LOBBY'].forEach((label, i) => {
    const y   = cy + C.CHAR_H * 2.2 + i * lineH;
    const sel = i === _pauseCursor;
    tc((sel ? '> ' : '  ') + label, y, sel ? C.COLOR.ACCENT : C.COLOR.DIM, sel ? 1 : 0.6, C.FONT_SIZE * 0.95, sel);
  });
}

function _drawSettings(ctx: CanvasRenderingContext2D): void {
  const cy    = C.CANVAS_H * 0.35;
  const lineH = C.CHAR_H * 2.0;
  const CW    = C.CHAR_W;
  const save  = load();
  tc('[ SETTINGS ]', cy, C.COLOR.PRIMARY, 1, C.FONT_SIZE * 1.1, true);

  const labels = ['MASTER VOL', 'SFX VOL'];
  const vals   = [save.masterVolume, save.sfxVolume];

  for (let i = 0; i < 2; i++) {
    const y   = cy + C.CHAR_H * 2.5 + i * lineH;
    const sel = i === _settingsCursor;
    tc(labels[i]!, y, sel ? C.COLOR.PRIMARY : C.COLOR.DIM, sel ? 1 : 0.65, C.FONT_SIZE * 0.88, sel);

    const barW = CW * 12;
    const barX = (C.CANVAS_W - barW) / 2;
    const barY = y + 5;
    const val  = vals[i]!;

    ctx.fillStyle   = C.COLOR.DIM;   ctx.globalAlpha = 0.3; ctx.fillRect(barX, barY, barW, 4);
    ctx.fillStyle   = sel ? C.COLOR.ACCENT : C.COLOR.DIM;
    ctx.globalAlpha = sel ? 0.9 : 0.4;
    ctx.fillRect(barX, barY, barW * val, 4);
    ctx.globalAlpha = 1;

    ctx.font        = `${C.FONT_SIZE * 0.7}px ${C.FONT_FAMILY}`;
    ctx.fillStyle   = sel ? C.COLOR.PRIMARY : C.COLOR.DIM;
    ctx.globalAlpha = sel ? 0.7 : 0.3;
    const filled    = Math.round(val * 10);
    ctx.fillText(`< ${'|'.repeat(filled)}${' '.repeat(10 - filled)} >`, barX - CW * 2, barY + 10);
    ctx.globalAlpha = 1;
  }

  tc('< > TO ADJUST  |  ENTER TO BACK', cy + C.CHAR_H * 8, C.COLOR.DIM, 0.5, C.FONT_SIZE * 0.72);
}

// ---------- Reset ----------

export function resetUI(): void {
  _paused         = false;
  _pauseCursor    = 0;
  _inSettings     = false;
  _settingsCursor = 0;
  _inputLock      = 0;
  _waveAnnounce   = 0;
}

// ---------- Helper ----------

function tc(text: string, y: number, color: string, alpha = 1, size = C.FONT_SIZE, bold = false): void {
  const ctx = getCtx();
  ctx.font        = `${bold ? 'bold ' : ''}${size}px ${C.FONT_FAMILY}`;
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = color;
  const w = ctx.measureText(text).width;
  ctx.fillText(text, (C.CANVAS_W - w) / 2, y);
  ctx.globalAlpha = 1;
}
