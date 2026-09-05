// ============================================
//   Renderer.ts
//   Master renderer. Sets up canvas, routes
//   to sub-renderers per screen state.
// ============================================

import { C } from '@void-sector/shared';
import type { ClientGameState } from '../types.js';
import type { ShopViewState } from '../types.js';
import { getShakeOffset, getFlash } from '../fx/Particles.js';
import { initPlayingRenderer, drawPlaying } from './RenderPlaying.js';
import { initShopRenderer, drawShop }       from './RenderShop.js';
import { initGameOverRenderer, drawGameOver } from './RenderGameOver.js';

// ---------- Canvas setup ----------

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx    = canvas.getContext('2d')!;

canvas.width  = C.CANVAS_W;
canvas.height = C.CANVAS_H;

const CW = C.CHAR_W;
const CH = C.CHAR_H;

// Initialise sub-renderers with shared ctx
initPlayingRenderer(ctx, CW, CH);
initShopRenderer(ctx, CW, CH);
initGameOverRenderer(ctx, CW, CH);

// ---------- Starfield ----------

interface Star {
  x:      number;
  y:      number;
  speed:  number;
  char:   string;
  bright: boolean;
}

const _stars: Star[] = Array.from({ length: 55 }, () => ({
  x:      Math.random() * C.COLS,
  y:      Math.random() * C.ROWS,
  speed:  0.003 + Math.random() * 0.012,
  char:   Math.random() < 0.15 ? '+' : '.',
  bright: Math.random() < 0.2,
}));

function drawStarfield(moving: boolean): void {
  ctx.font = `${C.FONT_SIZE * 0.75}px ${C.FONT_FAMILY}`;
  for (const s of _stars) {
    if (moving) { s.y += s.speed; if (s.y > C.ROWS) s.y = 0; }
    const alpha = s.bright ? 0.55 : 0.22;
    const color = s.bright ? C.COLOR.DIM : '#003810';
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    ctx.fillText(s.char, s.x * CW, s.y * CH + CH * 0.8);
    ctx.globalAlpha = 1;
  }
}

// ---------- Reconnecting overlay ----------

function drawReconnecting(): void {
  ctx.fillStyle   = '#000';
  ctx.globalAlpha = 0.72;
  ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
  ctx.globalAlpha = 1;

  const dots = '.'.repeat(Math.floor(Date.now() / 400) % 4);
  tc('CONNECTION LOST', C.CANVAS_H * 0.42, C.COLOR.DANGER, 1, C.FONT_SIZE * 1.05, true);
  tc(`RECONNECTING${dots}`,  C.CANVAS_H * 0.55, C.COLOR.WARN,   0.85, C.FONT_SIZE * 0.85);
}

// ---------- Flash overlay ----------

function drawFlash(): void {
  const f = getFlash();
  if (f.alpha <= 0) return;
  ctx.globalAlpha = f.alpha;
  ctx.fillStyle   = f.color;
  ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
  ctx.globalAlpha = 1;
}

// ---------- Master draw ----------

export function draw(gs: ClientGameState, shopView: ShopViewState): void {
  const shake = getShakeOffset();
  ctx.save();
  ctx.translate(shake.x * CW * 0.5, shake.y * CH * 0.5);

  // Clear
  ctx.fillStyle = C.COLOR.BG;
  ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

  // Starfield — moves during PLAYING only
  drawStarfield(gs.screen === 'PLAYING' || gs.screen === 'DYING');

  switch (gs.screen) {
    case 'LOBBY':                           break; // Lobby draws itself
    case 'PLAYING': case 'DYING':
      drawPlaying(gs);
      break;
    case 'SHOP':
      drawShop(gs, shopView);
      break;
    case 'GAMEOVER':
      drawGameOver(gs);
      break;
  }

  ctx.restore();

  // Flash outside shake transform
  drawFlash();

  // Reconnecting overlay on top of everything
  if (gs.reconnecting) drawReconnecting();
}

// ---------- Expose canvas for lobby ----------

export function getCanvas(): HTMLCanvasElement { return canvas; }
export function getCtx():    CanvasRenderingContext2D { return ctx; }

// ---------- Helpers ----------

function tc(text: string, y: number, color: string, alpha = 1, size = C.FONT_SIZE, bold = false): void {
  ctx.font        = `${bold ? 'bold ' : ''}${size}px ${C.FONT_FAMILY}`;
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = color;
  const w = ctx.measureText(text).width;
  ctx.fillText(text, (C.CANVAS_W - w) / 2, y);
  ctx.globalAlpha = 1;
}
