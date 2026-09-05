// ============================================
//   types.ts
//   Client-only types not in shared package.
// ============================================

import type { ClientPlayer } from '@void-sector/shared';

// ---------- Screen states ----------

export type GameScreen =
  | 'LOBBY'
  | 'PLAYING'
  | 'SHOP'
  | 'GAMEOVER'
  | 'DYING';

// ---------- Client game state ----------
// Populated entirely from server broadcasts.
// Client never writes simulation data here.

export interface ClientGameState {
  screen:    GameScreen;
  frame:     number;
  wave:      number;
  myId:      number | null;
  roomCode:  string | null;

  // From server state broadcasts
  players:   ClientPlayer[];
  enemies:   import('@void-sector/shared').ClientEnemy[];
  bullets:   import('@void-sector/shared').ClientBullet[];
  drops:     import('@void-sector/shared').Drop[];
  shopState: import('@void-sector/shared').ShopState | null;

  // Game over
  finalStats:    FinalStats | null;
  newHighScore:  boolean;

  // Wave banner (client-side timer)
  showWaveBanner:  boolean;
  waveBannerAlpha: number;
  waveBannerTimer: number;

  // Connection
  reconnecting: boolean;
}

export interface FinalStats {
  stats: import('@void-sector/shared').PlayerResult[];
  wave:  number;
}

// ---------- Save data ----------

export interface SaveData {
  highScore:    number;
  gamesPlayed:  number;
  totalKills:   number;
  bestWave:     number;
  masterVolume: number;
  sfxVolume:    number;
}

// ---------- Shop item (client view) ----------

export interface ShopItem {
  id:       import('@void-sector/shared').UpgradeId;
  label:    string;
  desc:     string;
  level:    number;
  maxLevel: number;
  cost:     number | null;
  maxed:    boolean;
}

export interface ShopViewState {
  wave:         number;
  cursor:       number;
  items:        ShopItem[];
  message:      string;
  messageTimer: number;
}
