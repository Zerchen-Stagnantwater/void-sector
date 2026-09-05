// ============================================
//   main.ts
//   Game loop, state machine, server events.
//   Imports everything — the only file that
//   knows about all other modules.
// ============================================

import { C, PLAYER_IDENTITY } from '@void-sector/shared';
import type {
  MsgState, MsgEvent, MsgGameOver,
  MsgWaveStart, MsgShopResult,
  ServerMessage,
} from '@void-sector/shared';
import { handleEvent } from './EventHandler.js';

import { updateInput, pressed } from './core/input.js';
import * as Save from './core/save.js';
import * as Audio from './fx/Audio.js';
import * as Particles from './fx/Particles.js';
import * as Net from './net/Net.js';
import {
  initLobby, updateLobby, drawLobby,
  getLobbyMyId, getLobbyRoomCode,
} from './net/Lobby.js';
import { draw as rendererDraw, getCanvas, getCtx } from './ui/Renderer.js';
import { updateUI, drawUI, isPaused, togglePause, resetUI, showWaveClear } from './ui/UI.js';
import { updateShop, openShop, getShopView, applyShopResult, resetShop } from './ui/Shop.js';

import type { ClientGameState } from './types.js';

// ============================================
//   Game state
// ============================================

const gs: ClientGameState = {
  screen: 'LOBBY',
  frame: 0,
  wave: 0,
  myId: null,
  roomCode: null,
  players: [],
  enemies: [],
  bullets: [],
  drops: [],
  shopState: null,
  finalStats: null,
  newHighScore: false,
  showWaveBanner: false,
  waveBannerAlpha: 0,
  waveBannerTimer: 0,
  reconnecting: false,
};

// ============================================
//   Server message handlers
// ============================================

function registerHandlers(): void {

  Net.on('state', (msg: ServerMessage) => {
    const m = msg as MsgState;
    if (gs.screen !== 'PLAYING' && gs.screen !== 'SHOP') return;

    gs.wave = m.wave;
    gs.players = m.players;
    gs.enemies = m.enemies;
    gs.bullets = m.bullets;
    gs.drops = m.drops;
    gs.shopState = m.shopState ?? null;

    if (m.roomState === 'SHOP' && gs.screen !== 'SHOP') enterShop();
    if (m.roomState === 'PLAYING' && gs.screen !== 'PLAYING') {
      gs.screen = 'PLAYING';
      gs.shopState = null;
      Audio.play('waveStart');
    }
  });

  Net.on('event', (msg: ServerMessage) => handleEvent(msg as MsgEvent, gs.myId));

  Net.on('wave_start', (msg: ServerMessage) => {
    const m = msg as MsgWaveStart;
    if (gs.screen === 'GAMEOVER' || gs.screen === 'LOBBY') return;
    gs.wave = m.wave;
    gs.screen = 'PLAYING';
    gs.showWaveBanner = true;
    gs.waveBannerTimer = 120;
    gs.waveBannerAlpha = 1;
    Audio.play('waveStart');
    if (m.wave > 1) showWaveClear(m.wave - 1);
  });

  Net.on('shop_result', (msg: ServerMessage) => applyShopResult(msg));

  Net.on('game_over', (msg: ServerMessage) => {
    console.log('[Main] game_over received');
    enterGameOver(msg as MsgGameOver);
  });

  Net.on('player_left', (msg: ServerMessage) => {
    const m = msg as { playerId: number };
    Audio.play('menuMove');
    const id = PLAYER_IDENTITY[m.playerId];
    Particles.spawnFloatText(
      C.COLS / 2, C.ROWS / 2,
      `P${m.playerId + 1} LEFT`,
      { color: id?.color ?? C.COLOR.DIM },
    );
  });

  Net.on('disconnected', () => {
    if (gs.screen === 'LOBBY') return;
    gs.reconnecting = true;
  });

  Net.on('connected', () => {
    gs.reconnecting = false;
  });
}


// ============================================
//   State transitions
// ============================================

function enterShop(): void {
  gs.screen = 'SHOP';
  const myPlayer = gs.players.find(p => p.id === gs.myId);
  openShop(gs.wave, myPlayer?.upgrades ?? {
    fire_rate: 0, move_speed: 0, multi_shot: 0, shield: 0, bullet_spd: 0,
  });
  Audio.play('waveClear');
  showWaveClear(gs.wave);
}

function enterGameOver(msg: MsgGameOver): void {
  if (gs.screen === 'GAMEOVER') return;
  console.log('[Main] _enterGameOver, myId:', gs.myId);

  gs.screen = 'GAMEOVER';
  gs.frame = 0;
  gs.finalStats = { stats: msg.stats, wave: msg.wave };

  const myStats = gs.myId !== null
    ? msg.stats.find(s => s.id === gs.myId)
    : undefined;

  if (myStats) {
    const newHigh = Save.submitRun({
      score: myStats.score,
      wave: msg.wave,
      kills: myStats.kills,
    });
    gs.newHighScore = newHigh;
    if (newHigh) setTimeout(() => Audio.play('highScore'), 600);
  }

  Audio.play('playerDie');
}

function quitToLobby(): void {
  gs.screen = 'LOBBY';
  gs.players = [];
  gs.enemies = [];
  gs.bullets = [];
  gs.drops = [];
  gs.shopState = null;
  gs.myId = null;
  gs.roomCode = null;
  gs.wave = 0;
  gs.finalStats = null;
  gs.newHighScore = false;
  gs.showWaveBanner = false;
  gs.reconnecting = false;
  Particles.resetParticles();
  resetUI();
  resetShop();
  initLobby();
}

// ============================================
//   Per-screen update
// ============================================

function updateLobbyScreen(): void {
  updateLobby();

  if (window._gameStartMsg) {
    const msg = window._gameStartMsg;
    window._gameStartMsg = null;

    gs.myId = getLobbyMyId();
    gs.roomCode = getLobbyRoomCode();
    gs.screen = 'PLAYING';
    gs.wave = msg.wave;
    gs.players = msg.players;
    gs.enemies = [];
    gs.bullets = [];
    gs.drops = [];

    Audio.play('waveStart');
    Audio.unlock();
  }
}

function updatePlaying(): void {
  if (pressed('pause') && gs.screen === 'PLAYING') togglePause();

  if (isPaused()) {
    const result = updateUI();
    if (result === 'quit') quitToLobby();
    return;
  }

  Net.sendInput();
  Particles.updateParticles();

  // Wave banner tick
  if (gs.showWaveBanner) {
    gs.waveBannerTimer--;
    gs.waveBannerAlpha = Math.min(1, gs.waveBannerTimer / 20);
    if (gs.waveBannerTimer <= 0) {
      gs.showWaveBanner = false;
      gs.waveBannerAlpha = 0;
    }
  }
}

function updateShopScreen(): void {
  updateShop(gs);
  Particles.updateParticles();
}

function updateGameOver(): void {
  if (gs.frame < 60) return;
  if (pressed('confirm') || pressed('pause')) {
    console.log('[Main] Returning to lobby');
    Audio.play('menuConfirm');
    quitToLobby();
  }
}

// ============================================
//   Main loop
// ============================================

let _lastTime = 0;
let _accumulator = 0;
const FIXED_STEP = C.TICK_MS;

function loop(timestamp: number): void {
  requestAnimationFrame(loop);

  const delta = Math.min(timestamp - _lastTime, 50);
  _lastTime = timestamp;
  _accumulator += delta;

  while (_accumulator >= FIXED_STEP) {
    tick();
    _accumulator -= FIXED_STEP;
  }

  gs.frame++;
  rendererDraw(gs, getShopView());
  drawUI(gs.frame);

  if (gs.screen === 'LOBBY') {
    drawLobby(getCtx());
  }
}

function tick(): void {
  updateInput();

  switch (gs.screen) {
    case 'LOBBY': updateLobbyScreen(); break;
    case 'PLAYING': updatePlaying(); break;
    case 'DYING': Particles.updateParticles(); break;
    case 'SHOP': updateShopScreen(); break;
    case 'GAMEOVER': updateGameOver(); break;
  }
}

// ============================================
//   Boot
// ============================================

window.addEventListener('load', () => {
  window.addEventListener('keydown', () => Audio.unlock(), { once: true });
  registerHandlers();
  initLobby();
  _lastTime = performance.now();
  requestAnimationFrame(loop);
});
