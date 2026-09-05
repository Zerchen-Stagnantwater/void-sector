// ============================================
//   RenderPlaying.ts
//   Draws everything in the PLAYING state:
//   HUD, player ships, enemies, bullets,
//   drops, particles, float texts.
// ============================================

import { C, PLAYER_IDENTITY } from '@void-sector/shared';
import type { ClientGameState } from '../types.js';
import {
  getParticles, getFloatTexts,
} from '../fx/Particles.js';
import { drawHUD, initHUDRenderer } from './RenderHUD.js';

// ---------- Canvas refs (set once by Renderer.ts) ----------

let _ctx: CanvasRenderingContext2D;
let _CW:  number;
let _CH:  number;

export function initPlayingRenderer(
  ctx: CanvasRenderingContext2D,
  CW:  number,
  CH:  number,
): void {
  _ctx = ctx;
  _CW  = CW;
  _CH  = CH;
  initHUDRenderer(ctx, CW, CH);
}

// ---------- Entry ----------

export function drawPlaying(gs: ClientGameState): void {
  drawHUD(gs);
  drawBullets(gs);
  drawDrops(gs);
  drawEnemies(gs);
  drawPlayers(gs);
  drawParticles();
  drawFloatTexts();
  drawBorder();

  // Wave banner
  if (gs.showWaveBanner && gs.waveBannerAlpha > 0) {
    tc(`-- WAVE ${gs.wave} --`,
      C.CANVAS_H * 0.45,
      C.COLOR.PRIMARY, gs.waveBannerAlpha, C.FONT_SIZE * 1.2, true);
  }
}

// ---------- Players ----------

function drawPlayers(gs: ClientGameState): void {
  sf(C.FONT_SIZE, true);

  for (const p of gs.players) {
    if (!p.alive) continue;

    const identity = PLAYER_IDENTITY[p.id] ?? PLAYER_IDENTITY[0]!;
    const isMe     = p.id === gs.myId;

    // Invincibility blink
    if (p.invincible && !p.rolling) {
      if (Math.floor(gs.frame / 4) % 2 === 0) continue;
    }

    // Shield glow
    if (p.shieldActive) {
      const offsets = [[-1,0],[1,0],[0,-0.6],[0,0.6],[-0.7,-0.4],[0.7,-0.4],[-0.7,0.4],[0.7,0.4]];
      for (const [ox, oy] of offsets) {
        dc('·', p.x + (ox ?? 0), p.y + (oy ?? 0), C.COLOR.SHIELD, 0.5);
      }
    }

    // Roll afterimage
    if (p.rolling && p.rollDir) {
      dc('^', p.x - p.rollDir * 0.8, p.y, C.COLOR.DIM, 0.25);
      dc('^', p.x - p.rollDir * 1.6, p.y, C.COLOR.DIM, 0.10);
    }

    // Color shifts for powerups
    let color = identity.color;
    if (p.effects?.spread?.active) color = C.COLOR.ACCENT;
    if (p.effects?.rapid?.active)  color = C.COLOR.WARN;

    dc('^', p.x, p.y, color, isMe ? 1.0 : 0.75);

    // Label for others
    if (!isMe) {
      sf(C.FONT_SIZE * 0.65);
      dc(`P${p.id + 1}`, p.x - 0.6, p.y + 1.1, identity.color, 0.5);
      sf(C.FONT_SIZE, true);
    }
  }

  sf(C.FONT_SIZE);
}

// ---------- Enemies ----------

function drawEnemies(gs: ClientGameState): void {
  for (const e of gs.enemies) {
    const def = C.ENEMY[e.type];

    const color = (e.flashTimer > 0 && Math.floor(e.flashTimer / 2) % 2 === 0)
      ? C.COLOR.WHITE
      : def.COLOR;

    dc(e.char, e.x, e.y, color, 0.95);

    // HP bar for tanks
    if (e.type === 'C' && e.hp < e.maxHp) {
      const barW = _CW * 1.6;
      const barX = cx(e.x) - barW / 2;
      const barY = cy(e.y) - _CH + 4;
      const frac = e.hp / e.maxHp;
      _ctx.fillStyle   = '#330000';
      _ctx.globalAlpha = 0.7;
      _ctx.fillRect(barX, barY, barW, 3);
      _ctx.fillStyle   = C.COLOR.DANGER;
      _ctx.globalAlpha = 0.9;
      _ctx.fillRect(barX, barY, barW * frac, 3);
      _ctx.globalAlpha = 1;
    }
  }
}

// ---------- Bullets ----------

function drawBullets(gs: ClientGameState): void {
  for (const b of gs.bullets) dc(b.char, b.x, b.y, b.color, 0.9);
}

// ---------- Drops ----------

function drawDrops(gs: ClientGameState): void {
  for (const d of gs.drops) {
    const blink = d.life < 120 && Math.floor(d.life / 8) % 2 === 0;
    if (!blink) dc(d.char, d.x, d.y, d.color, 0.95);
  }
}

// ---------- Particles ----------

function drawParticles(): void {
  for (const p of getParticles()) dc(p.char, p.x, p.y, p.color, p.alpha * 0.9);
}

function drawFloatTexts(): void {
  sf(C.FONT_SIZE * 0.8, true);
  for (const t of getFloatTexts()) {
    const alpha = t.life / t.maxLife;
    dc(t.text, t.x - t.text.length * 0.3, t.y, t.color, alpha);
  }
  sf(C.FONT_SIZE);
}

// ---------- Border ----------

export function drawBorder(): void {
  _ctx.strokeStyle = C.COLOR.DIM;
  _ctx.lineWidth   = 1;
  _ctx.globalAlpha = 0.4;
  _ctx.strokeRect(1, 1, C.CANVAS_W - 2, C.CANVAS_H - 2);
  _ctx.globalAlpha = 1;
}

// ---------- Helpers ----------

function cx(col: number): number { return col * _CW; }
function cy(row: number): number { return row * _CH + _CH * 0.8; }

function sf(size: number, bold = false): void {
  _ctx.font = `${bold ? 'bold ' : ''}${size}px ${C.FONT_FAMILY}`;
}

function dc(char: string, col: number, row: number, color: string, alpha = 1): void {
  _ctx.globalAlpha = alpha;
  _ctx.fillStyle   = color;
  _ctx.fillText(char, cx(col), cy(row));
  _ctx.globalAlpha = 1;
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
