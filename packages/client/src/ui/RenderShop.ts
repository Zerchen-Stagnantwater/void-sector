// ============================================
//   RenderShop.ts
//   Draws the between-wave upgrade shop.
// ============================================

import { C, PLAYER_IDENTITY } from '@void-sector/shared';
import type { ClientGameState } from '../types.js';
import type { ShopViewState } from '../types.js';
import { drawBorder } from './RenderPlaying.js';

let _ctx: CanvasRenderingContext2D;
let _CW: number;
let _CH: number;

export function initShopRenderer(ctx: CanvasRenderingContext2D, CW: number, CH: number): void {
  _ctx = ctx; _CW = CW; _CH = CH;
}

export function drawShop(gs: ClientGameState, shopView: ShopViewState): void {
  drawBorder();

  const myPlayer = gs.players.find(p => p.id === gs.myId);
  const credits = myPlayer?.score ?? 0;

  // Header
  tc(`[ WAVE ${shopView.wave} COMPLETE ]`, _CH * 1.5, C.COLOR.PRIMARY, 1, C.FONT_SIZE * 1.1, true);

  // Credits
  const selItem = shopView.items[shopView.cursor];
  const canAfford = selItem?.cost !== null && credits >= (selItem?.cost ?? 0);
  tc('CREDITS', _CH * 2.7, C.COLOR.DIM, 0.7, C.FONT_SIZE * 0.72);
  tc(`${credits} cr`, _CH * 3.7, canAfford ? C.COLOR.ACCENT : C.COLOR.WARN, 1, C.FONT_SIZE * 1.3, true);

  // Divider
  sf(C.FONT_SIZE * 0.7);
  _ctx.fillStyle = C.COLOR.DIM;
  _ctx.globalAlpha = 0.5;
  _ctx.fillText('─'.repeat(Math.floor(C.COLS * 0.9)), _CW * 0.5, _CH * 4.7);
  _ctx.globalAlpha = 1;

  tc('UPGRADES', _CH * 5.5, C.COLOR.DIM, 0.7, C.FONT_SIZE * 0.8);

  // Items
  const startY = _CH * 6.6;
  const lineH = _CH * 1.55;

  for (let i = 0; i < shopView.items.length; i++) {
    const item = shopView.items[i]!;
    const sel = i === shopView.cursor;
    const y = startY + i * lineH;

    // Selection highlight
    if (sel) {
      _ctx.fillStyle = C.COLOR.PRIMARY;
      _ctx.globalAlpha = 0.08;
      _ctx.fillRect(_CW * 0.5, y - _CH * 0.85, C.CANVAS_W - _CW, _CH * 1.1);
      _ctx.globalAlpha = 1;
      sf(C.FONT_SIZE * 0.7);
      _ctx.fillStyle = C.COLOR.PRIMARY;
      _ctx.fillText('>', _CW * 0.8, y);
    }

    // Label
    sf(C.FONT_SIZE * 0.9, sel);
    _ctx.fillStyle = item.maxed ? C.COLOR.DIM : sel ? C.COLOR.PRIMARY : C.COLOR.WHITE;
    _ctx.globalAlpha = item.maxed ? 0.5 : sel ? 1 : 0.75;
    _ctx.fillText(item.label, _CW * 2, y);

    // Level pips
    if (item.maxLevel !== null) {
      sf(C.FONT_SIZE * 0.75);
      _ctx.fillStyle = C.COLOR.ACCENT;
      _ctx.globalAlpha = 0.8;
      _ctx.fillText('■'.repeat(item.level) + '□'.repeat(item.maxLevel - item.level), _CW * 20, y);
    }

    // Cost / status
    sf(C.FONT_SIZE * 0.82);
    if (item.id === 'leave') {
      _ctx.fillStyle = sel ? C.COLOR.ACCENT : C.COLOR.DIM;
      _ctx.globalAlpha = sel ? 1 : 0.6;
      const lw = _ctx.measureText('[ ENTER ]').width;
      _ctx.fillText('[ ENTER ]', C.CANVAS_W - lw - _CW, y);
    } else if (item.maxed) {
      _ctx.fillStyle = C.COLOR.DIM;
      _ctx.globalAlpha = 0.5;
      const mw = _ctx.measureText('MAXED').width;
      _ctx.fillText('MAXED', C.CANVAS_W - mw - _CW, y);
    } else if (item.cost !== null) {
      _ctx.fillStyle = credits >= item.cost ? C.COLOR.ACCENT : C.COLOR.DANGER;
      _ctx.globalAlpha = 0.9;
      const costStr = `${item.cost}cr`;
      const cw2 = _ctx.measureText(costStr).width;
      _ctx.fillText(costStr, C.CANVAS_W - cw2 - _CW, y);
    }

    _ctx.globalAlpha = 1;
  }

  // Description
  if (selItem?.desc) {
    tc(selItem.desc, C.CANVAS_H - _CH * 3.8, C.COLOR.DIM, 0.7, C.FONT_SIZE * 0.78);
  }

  // Feedback message
  if (shopView.message) {
    const fade = Math.min(1, shopView.messageTimer / 20);
    tc(shopView.message, C.CANVAS_H - _CH * 2.8, C.COLOR.WARN, fade, C.FONT_SIZE * 0.85, true);
  }

  // Ready flags
  if (gs.shopState) {
    const flags = gs.shopState.readyFlags;
    const slotW = C.CANVAS_W / 5;
    const flagY = C.CANVAS_H - _CH * 1.4;
    sf(C.FONT_SIZE * 0.72);

    for (let i = 0; i < 4; i++) {
      if (!gs.players.find(p => p.id === i)) continue;
      const ready = flags[i] ?? false;
      const id = PLAYER_IDENTITY[i];
      if (!id) continue;
      const label = ready ? `P${i + 1} READY` : `P${i + 1} ...`;
      const x = slotW + i * slotW;
      _ctx.fillStyle = id.color;
      _ctx.globalAlpha = ready ? 1 : 0.35;
      const w = _ctx.measureText(label).width;
      _ctx.fillText(label, x - w / 2, flagY);
      _ctx.globalAlpha = 1;
    }
  }
}

// ---------- Helpers ----------

function sf(size: number, bold = false): void {
  _ctx.font = `${bold ? 'bold ' : ''}${size}px ${C.FONT_FAMILY}`;
}

function tc(text: string, y: number, color: string, alpha = 1, size = C.FONT_SIZE, bold = false): void {
  sf(size, bold);
  _ctx.globalAlpha = alpha;
  _ctx.fillStyle = color;
  const w = _ctx.measureText(text).width;
  _ctx.fillText(text, (C.CANVAS_W - w) / 2, y);
  _ctx.globalAlpha = 1;
}
