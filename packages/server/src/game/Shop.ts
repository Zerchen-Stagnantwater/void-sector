// ============================================
//   Shop.ts
//   Server-side shop logic.
//   Validates purchases, applies upgrades,
//   tracks ready flags, starts next wave.
// ============================================

import type { UpgradeId } from '@void-sector/shared';
import { C, upgradeCost } from '@void-sector/shared';
import type { Room } from '../room/Room.js';
import { sendTo } from '../room/RoomManager.js';

// ---------- Open ----------

export function openShop(room: Room): void {
  room.phase     = 'SHOP';
  room.shopReady = room.players.map(() => false);
}

// ---------- Buy ----------

export function handleShopBuy(
  room:     Room,
  playerId: number,
  itemId:   UpgradeId,
): void {
  if (room.phase !== 'SHOP') return;

  const player = room.players[playerId];
  const socket = room.sockets.get(playerId);
  if (!player || !socket) return;

  const item = C.SHOP.ITEMS.find(i => i.id === itemId);
  if (!item) {
    sendTo(socket, {
      type: 'shop_result', success: false, message: 'UNKNOWN ITEM',
    });
    return;
  }

  const level = player.upgrades[itemId];

  if (level >= item.maxLevel) {
    sendTo(socket, {
      type: 'shop_result', success: false, message: 'ALREADY MAXED',
    });
    return;
  }

  const cost = upgradeCost(itemId, level);
  if (player.score < cost) {
    sendTo(socket, {
      type: 'shop_result', success: false, message: 'INSUFFICIENT FUNDS',
    });
    return;
  }

  // Apply
  player.score             -= cost;
  player.upgrades[itemId]   = level + 1;

  // Shield upgrade gives immediate shield
  if (itemId === 'shield') {
    player.shieldActive = true;
    player.shieldHits   = C.POWERUP.SHIELD_HITS;
  }

  sendTo(socket, {
    type:     'shop_result',
    success:  true,
    itemId,
    newLevel: player.upgrades[itemId],
    newScore: player.score,
    message:  'UPGRADE INSTALLED',
  });
}

// ---------- Ready ----------
// Returns true if all active players are ready and the game should start.

export function handleShopReady(room: Room, playerId: number): boolean {
  if (room.phase !== 'SHOP') return false;

  room.shopReady[playerId] = true;

  const activePlayers = room.players.filter(p => p.connected && p.alive);
  return activePlayers.every(p => room.shopReady[p.id] === true);
}
