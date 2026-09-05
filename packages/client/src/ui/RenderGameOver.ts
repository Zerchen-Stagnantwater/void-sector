// ============================================
//   RenderGameOver.ts
//   Game over screen with per-player results.
// ============================================

import { C, PLAYER_IDENTITY } from '@void-sector/shared';
import type { ClientGameState } from '../types.js';
import { drawBorder } from './RenderPlaying.js';

let _ctx: CanvasRenderingContext2D;
let _CW:  number;
let _CH:  number;

export function initGameOverRenderer(ctx: CanvasRenderingContext2D, CW: number, CH: number): void {
  _ctx = ctx; _CW = CW; _CH = CH;
}

export function drawGameOver(gs: ClientGameState): void {
  drawBorder();

  tc('[ GAME OVER ]', C.CANVAS_H * 0.18, C.COLOR.DANGER, 1, C.FONT_SIZE * 1.4, true);
  tc(`WAVE ${gs.finalStats?.wave ?? gs.wave}`, C.CANVAS_H * 0.3, C.COLOR.DIM, 0.8, C.FONT_SIZE * 0.9);

  const stats  = gs.finalStats?.stats ?? [];
  const startY = C.CANVAS_H * 0.39;
  const lineH  = _CH * 2.0;

  // Table headers
  sf(C.FONT_SIZE * 0.78, true);
  _ctx.fillStyle   = C.COLOR.DIM;
  _ctx.globalAlpha = 0.5;
  _ctx.fillText('PLAYER', _CW * 3,  startY);
  _ctx.fillText('SCORE',  _CW * 16, startY);
  _ctx.fillText('KILLS',  _CW * 28, startY);
  _ctx.globalAlpha = 1;

  // Sort by score descending
  const sorted = [...stats].sort((a, b) => b.score - a.score);

  for (let i = 0; i < sorted.length; i++) {
    const s     = sorted[i]!;
    const y     = startY + (i + 1) * lineH;
    const id    = PLAYER_IDENTITY[s.id];
    const color = id?.color ?? C.COLOR.PRIMARY;
    const isMe  = s.id === gs.myId;

    sf(C.FONT_SIZE * 0.88, isMe);
    _ctx.fillStyle   = color;
    _ctx.globalAlpha = isMe ? 1 : 0.7;

    const prefix = i === 0 ? '# ' : '  ';
    _ctx.fillText(`${prefix}P${s.id + 1}${isMe ? ' (YOU)' : ''}`, _CW * 3,  y);
    _ctx.fillText(pad(s.score, 7),                                  _CW * 16, y);
    _ctx.fillText(pad(s.kills, 5),                                  _CW * 28, y);
    _ctx.globalAlpha = 1;
  }

  // New high score
  if (gs.newHighScore) {
    if (Math.floor(gs.frame / 20) % 2 === 0) {
      tc('*** NEW HIGH SCORE ***', C.CANVAS_H * 0.76, C.COLOR.ACCENT, 1, C.FONT_SIZE * 0.9, true);
    }
  }

  // Return prompt — blinking after input unlocks (frame > 60)
  if (gs.frame > 60 && Math.floor(gs.frame / 35) % 2 === 0) {
    tc('[ PRESS SPACE TO RETURN TO LOBBY ]', C.CANVAS_H * 0.86, C.COLOR.PRIMARY, 0.85);
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

function pad(n: number, len: number): string {
  return String(Math.floor(n)).padStart(len, '0');
}
