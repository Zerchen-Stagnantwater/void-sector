// ============================================
//   RenderHUD.ts
//   HUD: lives, score, wave, combo, bombs,
//   roll cooldown, powerup timers, other scores.
// ============================================

import { C, PLAYER_IDENTITY } from '@void-sector/shared';
import type { ClientGameState } from '../types.js';

let _ctx: CanvasRenderingContext2D;
let _CW:  number;
let _CH:  number;

export function initHUDRenderer(ctx: CanvasRenderingContext2D, CW: number, CH: number): void {
  _ctx = ctx; _CW = CW; _CH = CH;
}

// ---------- HUD ----------

export function drawHUD(gs: ClientGameState): void {
  const myPlayer = gs.players.find(p => p.id === gs.myId);
  if (!myPlayer) return;

  const myColor = PLAYER_IDENTITY[gs.myId ?? 0]?.color ?? C.COLOR.PRIMARY;

  sf(C.FONT_SIZE * 0.82, true);
  const y = _CH * 0.95;

  // Lives
  _ctx.fillStyle   = myColor;
  _ctx.globalAlpha = 0.9;
  _ctx.fillText('SHIP: ' + '^'.repeat(Math.max(0, myPlayer.lives)), _CW * 0.5, y);

  // Score — centered
  tc(_pad(myPlayer.score, 8), y, myColor, 0.95, C.FONT_SIZE * 0.82, true);

  // Wave — right
  sf(C.FONT_SIZE * 0.82, true);
  const waveStr = 'WAVE ' + _pad(gs.wave, 2);
  const ww      = _ctx.measureText(waveStr).width;
  _ctx.fillStyle   = C.COLOR.HUD;
  _ctx.fillText(waveStr, C.CANVAS_W - ww - _CW * 0.5, y);
  _ctx.globalAlpha = 1;

  // Combo
  if (myPlayer.combo > 1) {
    tc(`x${myPlayer.combo} COMBO`, _CH * 1.9, C.COLOR.ACCENT, 0.9, C.FONT_SIZE * 0.8, true);
  }

  // Bombs
  if ((myPlayer.bombs ?? 0) > 0) {
    sf(C.FONT_SIZE * 0.78);
    _ctx.fillStyle   = C.COLOR.WARN;
    _ctx.globalAlpha = 0.85;
    _ctx.fillText('BOMB: ' + 'B'.repeat(myPlayer.bombs), _CW * 0.5, _CH * 1.9);
    _ctx.globalAlpha = 1;
  }

  // Roll cooldown bar
  const rollFrac = myPlayer.rollCooldownFrac ?? 0;
  if (rollFrac > 0) {
    const barW = _CW * 6;
    const barX = _CW * 0.5;
    const barY = C.CANVAS_H - _CH * 0.6;
    _ctx.fillStyle   = C.COLOR.DIM;
    _ctx.globalAlpha = 0.5;
    _ctx.fillRect(barX, barY, barW, 3);
    _ctx.fillStyle   = myColor;
    _ctx.globalAlpha = 0.85;
    _ctx.fillRect(barX, barY, barW * (1 - rollFrac), 3);
    _ctx.globalAlpha = 1;
    sf(C.FONT_SIZE * 0.65);
    _ctx.fillStyle   = C.COLOR.DIM;
    _ctx.globalAlpha = 0.7;
    _ctx.fillText('ROLL', barX, barY - 2);
    _ctx.globalAlpha = 1;
  }

  // Powerup timers
  drawPowerupTimers(myPlayer);

  // Other players' scores
  drawOtherScores(gs);
}

function drawPowerupTimers(player: ClientGameState['players'][number]): void {
  if (!player.effects) return;
  sf(C.FONT_SIZE * 0.75);
  let col      = C.CANVAS_W - _CW * 8;
  const row    = C.CANVAS_H - _CH * 0.6;

  if (player.effects.rapid?.active) {
    const frac = player.effects.rapid.framesLeft / C.POWERUP.RAPID_DURATION;
    drawTimerBar('RAPID', col, row, frac, C.COLOR.WARN);
    col -= _CW * 8.5;
  }
  if (player.effects.spread?.active) {
    const frac = player.effects.spread.framesLeft / C.POWERUP.SPREAD_DURATION;
    drawTimerBar('SPRD', col, row, frac, C.COLOR.ACCENT);
    col -= _CW * 8.5;
  }
  if (player.shieldActive) {
    _ctx.fillStyle   = C.COLOR.SHIELD;
    _ctx.globalAlpha = 0.85;
    _ctx.fillText(`SHLD:${player.shieldHits ?? ''}`, col, row);
    _ctx.globalAlpha = 1;
  }
}

function drawTimerBar(label: string, x: number, y: number, frac: number, color: string): void {
  const barW = _CW * 5;
  _ctx.fillStyle   = C.COLOR.DIM;
  _ctx.globalAlpha = 0.4;
  _ctx.fillRect(x, y, barW, 3);
  _ctx.fillStyle   = color;
  _ctx.globalAlpha = 0.85;
  _ctx.fillRect(x, y, barW * frac, 3);
  _ctx.globalAlpha = 0.7;
  _ctx.fillText(label, x, y - 2);
  _ctx.globalAlpha = 1;
}

function drawOtherScores(gs: ClientGameState): void {
  const others = gs.players.filter(p => p.id !== gs.myId);
  if (!others.length) return;

  sf(C.FONT_SIZE * 0.7);
  let y = _CH * 2.2;
  const x = C.CANVAS_W - _CW * 0.5;

  for (const p of others) {
    const color = PLAYER_IDENTITY[p.id]?.color ?? C.COLOR.DIM;
    const label = `P${p.id + 1} ${_pad(p.score, 6)}`;
    _ctx.fillStyle   = color;
    _ctx.globalAlpha = p.alive ? 0.7 : 0.25;
    const w = _ctx.measureText(label).width;
    _ctx.fillText(label, x - w, y);
    _ctx.globalAlpha = 1;
    y += _CH * 1.1;
  }
}

// ---------- Helpers ----------

function sf(size: number, bold = false): void {
  _ctx.font = `${bold ? 'bold ' : ''}${size}px ${C.FONT_FAMILY}`;
}

function tc(text: string, y: number, color: string, alpha = 1, size = C.FONT_SIZE, bold = false): void {
  sf(size, bold);
  _ctx.globalAlpha = alpha;
  _ctx.fillStyle   = color;
  const w = _ctx.measureText(text).width;
  _ctx.fillText(text, (C.CANVAS_W - w) / 2, y);
  _ctx.globalAlpha = 1;
}

function _pad(n: number, len: number): string {
  return String(Math.floor(n)).padStart(len, '0');
}
