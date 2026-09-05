// ============================================
//   LobbyRenderer.ts
//   All canvas drawing for the lobby screens.
// ============================================

import { C, PLAYER_IDENTITY } from '@void-sector/shared';

export function drawLobbyConnecting(ctx: CanvasRenderingContext2D, errorMsg: string): void {
  tc(ctx, '[ VOID SECTOR ]', C.CANVAS_H * 0.35, C.COLOR.PRIMARY, 1, C.FONT_SIZE * 1.4, true);
  const dots = '.'.repeat(Math.floor(Date.now() / 400) % 4);
  tc(ctx, `CONNECTING${dots}`, C.CANVAS_H * 0.52, C.COLOR.DIM, 0.8, C.FONT_SIZE * 0.85);
  if (errorMsg) tc(ctx, errorMsg, C.CANVAS_H * 0.62, C.COLOR.WARN, 0.9, C.FONT_SIZE * 0.8);
}

export function drawLobbyMenu(ctx: CanvasRenderingContext2D, cursor: number): void {
  tc(ctx, '[ VOID SECTOR ]', C.CANVAS_H * 0.2,  C.COLOR.PRIMARY, 1,   C.FONT_SIZE * 1.4, true);
  tc(ctx, 'MULTIPLAYER',     C.CANVAS_H * 0.32, C.COLOR.DIM,     0.7, C.FONT_SIZE * 0.8);
  const opts = ['CREATE ROOM', 'JOIN ROOM'];
  const btnCX = C.CANVAS_W / 2, btnGap = C.CANVAS_W * 0.28, btnY = C.CANVAS_H * 0.5;
  for (let i = 0; i < 2; i++) {
    const x = btnCX + (i === 0 ? -btnGap : btnGap), sel = cursor === i;
    const label = (sel ? '[ ' : '  ') + opts[i] + (sel ? ' ]' : '  ');
    ctx.font = `${sel ? 'bold ' : ''}${C.FONT_SIZE * 0.9}px ${C.FONT_FAMILY}`;
    ctx.fillStyle = sel ? C.COLOR.ACCENT : C.COLOR.DIM;
    ctx.globalAlpha = sel ? 1 : 0.55;
    ctx.fillText(label, x - ctx.measureText(label).width / 2, btnY);
    ctx.globalAlpha = 1;
  }
  tc(ctx, 'ARROW KEYS TO SELECT   ENTER TO CONFIRM', C.CANVAS_H * 0.72, C.COLOR.DIM, 0.45, C.FONT_SIZE * 0.72);
}

export function drawLobbyJoinInput(ctx: CanvasRenderingContext2D, joinInput: string): void {
  tc(ctx, 'ENTER ROOM CODE', C.CANVAS_H * 0.35, C.COLOR.PRIMARY, 1, C.FONT_SIZE * 1.0, true);
  const boxW = C.FONT_SIZE * 1.6, boxGap = 12;
  const totalW = 4 * boxW + 3 * boxGap;
  const startX = (C.CANVAS_W - totalW) / 2;
  const boxY = C.CANVAS_H * 0.46, boxH = C.FONT_SIZE * 1.4;
  for (let i = 0; i < 4; i++) {
    const bx = startX + i * (boxW + boxGap);
    const ch = joinInput[i] ?? '', active = i === joinInput.length;
    ctx.fillStyle = '#050f07'; ctx.globalAlpha = 0.8;
    ctx.fillRect(bx, boxY - boxH * 0.8, boxW, boxH);
    ctx.strokeStyle = active ? C.COLOR.PRIMARY : C.COLOR.DIM;
    ctx.globalAlpha = active ? 1 : 0.4; ctx.lineWidth = active ? 1.5 : 0.5;
    ctx.strokeRect(bx, boxY - boxH * 0.8, boxW, boxH);
    if (ch) {
      ctx.font = `bold ${C.FONT_SIZE * 1.1}px ${C.FONT_FAMILY}`;
      ctx.fillStyle = C.COLOR.PRIMARY; ctx.globalAlpha = 1;
      ctx.fillText(ch, bx + (boxW - ctx.measureText(ch).width) / 2, boxY + C.FONT_SIZE * 0.15);
    }
    if (active && Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.fillStyle = C.COLOR.PRIMARY; ctx.globalAlpha = 0.6;
      ctx.fillRect(bx + boxW / 2 - 1, boxY - boxH * 0.6, 2, boxH * 0.7);
    }
    ctx.globalAlpha = 1;
  }
  const canConfirm = joinInput.length === 4;
  tc(ctx, canConfirm ? '[ PRESS ENTER TO JOIN ]' : 'TYPE 4-CHARACTER CODE',
    C.CANVAS_H * 0.68, canConfirm ? C.COLOR.ACCENT : C.COLOR.DIM, canConfirm ? 1 : 0.5, C.FONT_SIZE * 0.82);
  tc(ctx, 'ESC TO GO BACK', C.CANVAS_H * 0.76, C.COLOR.DIM, 0.4, C.FONT_SIZE * 0.72);
}

export function drawLobbyRoomWait(
  ctx: CanvasRenderingContext2D,
  roomCode: string, playerCount: number, myId: number | null, isHost: boolean,
): void {
  tc(ctx, `[ ROOM ${roomCode} ]`, C.CANVAS_H * 0.2, C.COLOR.PRIMARY, 1, C.FONT_SIZE * 1.2, true);
  const slotGap = C.CANVAS_W / 5, slotY = C.CANVAS_H * 0.38;
  for (let i = 0; i < 4; i++) {
    const x = slotGap + i * slotGap, filled = i < playerCount, isMe = i === myId;
    const id = PLAYER_IDENTITY[i], color = filled && id ? id.color : C.COLOR.DIM;
    ctx.font = `bold ${C.FONT_SIZE * 1.4}px ${C.FONT_FAMILY}`;
    ctx.fillStyle = color; ctx.globalAlpha = filled ? 1 : 0.25;
    ctx.fillText('^', x - ctx.measureText('^').width / 2, slotY);
    ctx.font = `${C.FONT_SIZE * 0.75}px ${C.FONT_FAMILY}`;
    const label = filled ? `P${i+1}${isMe ? ' (YOU)' : ''}` : '------';
    ctx.fillText(label, x - ctx.measureText(label).width / 2, slotY + C.CHAR_H * 1.3);
    ctx.globalAlpha = 1;
  }
  tc(ctx, `${playerCount} / 4 PLAYERS`, C.CANVAS_H * 0.6, C.COLOR.DIM, 0.7, C.FONT_SIZE * 0.85);
  if (isHost) {
    if (Math.floor(Date.now() / 500) % 2 === 0)
      tc(ctx, '[ PRESS ENTER TO START ]', C.CANVAS_H * 0.72, C.COLOR.ACCENT, 1, C.FONT_SIZE * 0.95, true);
  } else {
    tc(ctx, `WAITING FOR HOST TO START${'.'.repeat(Math.floor(Date.now()/400)%4)}`,
      C.CANVAS_H * 0.72, C.COLOR.DIM, 0.6, C.FONT_SIZE * 0.82);
  }
  tc(ctx, `SHARE CODE: ${roomCode}`, C.CANVAS_H * 0.85, C.COLOR.DIM, 0.45, C.FONT_SIZE * 0.75);
}

export function drawLobbyError(ctx: CanvasRenderingContext2D, errorMsg: string): void {
  tc(ctx, '[ ERROR ]', C.CANVAS_H * 0.4,  C.COLOR.DANGER, 1,   C.FONT_SIZE * 1.1, true);
  tc(ctx, errorMsg,    C.CANVAS_H * 0.54, C.COLOR.WARN,   0.9, C.FONT_SIZE * 0.85);
}

function tc(ctx: CanvasRenderingContext2D, text: string, y: number, color: string, alpha = 1, size = C.FONT_SIZE, bold = false): void {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${C.FONT_FAMILY}`;
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.fillText(text, (C.CANVAS_W - ctx.measureText(text).width) / 2, y);
  ctx.globalAlpha = 1;
}
