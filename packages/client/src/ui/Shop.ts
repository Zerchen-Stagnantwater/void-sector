// ============================================
//   Shop.ts (client)
//   Shop input, item list, server comms.
//   Renderer reads getShopView().
// ============================================

import { C, upgradeCost } from '@void-sector/shared';
import type { UpgradeId, MsgShopResult, ServerMessage, Upgrades } from '@void-sector/shared';
import type { ShopItem, ShopViewState } from '../types.js';
import * as Audio from '../fx/Audio.js';
import * as Net from '../net/Net.js';
import { pressed } from '../core/input.js';
import type { ClientGameState } from '../types.js';

// ---------- State ----------

let _cursor            = 0;
let _items:  ShopItem[] = [];
let _message           = '';
let _messageTimer      = 0;
let _wave              = 0;
let _inputLock         = 0;
let _waitingForServer  = false;
let _serverTimeout:    ReturnType<typeof setTimeout> | null = null;

// ---------- Build items ----------

function buildItems(upgrades: Upgrades): void {
  _items = C.SHOP.ITEMS.map(def => {
    const level = upgrades[def.id as UpgradeId] ?? 0;
    const maxed = level >= def.maxLevel;
    return {
      id:       def.id as UpgradeId,
      label:    def.label,
      desc:     def.desc,
      level,
      maxLevel: def.maxLevel,
      cost:     maxed ? null : upgradeCost(def.id as UpgradeId, level),
      maxed,
    };
  });

  // Leave/launch option
  _items.push({
    id:       'fire_rate', // placeholder id — check by index
    label:    'LAUNCH >',
    desc:     'Ready up. Wave starts when all players are ready.',
    level:    0,
    maxLevel: 0,
    cost:     null,
    maxed:    false,
  });
}

// ---------- Open ----------

export function openShop(wave: number, upgrades: Upgrades): void {
  _wave           = wave;
  _cursor         = 0;
  _message        = '';
  _messageTimer   = 0;
  _inputLock      = 14;
  _waitingForServer = false;
  if (_serverTimeout) clearTimeout(_serverTimeout);
  buildItems(upgrades);
}

// ---------- Update ----------

export function updateShop(gs: ClientGameState): void {
  if (_inputLock > 0) { _inputLock--; return; }
  if (_messageTimer > 0) _messageTimer--;

  // Rebuild from latest server state
  const myPlayer = gs.players.find(p => p.id === gs.myId);
  if (myPlayer?.upgrades) buildItems(myPlayer.upgrades);

  if (_waitingForServer) return;

  if (pressed('down') || pressed('right')) { _cursor = (_cursor + 1) % _items.length; Audio.play('menuMove'); }
  if (pressed('up')   || pressed('left'))  { _cursor = (_cursor - 1 + _items.length) % _items.length; Audio.play('menuMove'); }

  if (pressed('confirm')) {
    const isLeave = _cursor === _items.length - 1;

    if (isLeave) {
      Net.shopReady();
      setMessage('READY — WAITING FOR OTHERS');
      Audio.play('menuConfirm');
      return;
    }

    const item     = _items[_cursor];
    if (!item) return;

    if (item.maxed) { setMessage('ALREADY MAXED'); Audio.play('shopDeny'); return; }

    const myScore = gs.players.find(p => p.id === gs.myId)?.score ?? 0;
    if (item.cost !== null && myScore < item.cost) { setMessage('INSUFFICIENT FUNDS'); Audio.play('shopDeny'); return; }

    _waitingForServer = true;
    setMessage('...');
    Net.buyUpgrade(item.id);

    // Safety valve — unlock if server never responds
    _serverTimeout = setTimeout(() => {
      if (_waitingForServer) { _waitingForServer = false; setMessage('NO RESPONSE — TRY AGAIN'); }
    }, 3000);
  }
}

// ---------- Apply server result ----------

export function applyShopResult(msg: ServerMessage): void {
  const m = msg as MsgShopResult;
  _waitingForServer = false;
  if (_serverTimeout) { clearTimeout(_serverTimeout); _serverTimeout = null; }
  setMessage(m.success ? 'UPGRADE INSTALLED' : (m.message ?? 'ERROR'));
  Audio.play(m.success ? 'shopBuy' : 'shopDeny');
}

// ---------- Getters ----------

export function getShopView(): ShopViewState {
  return {
    wave:         _wave,
    cursor:       _cursor,
    items:        _items,
    message:      _messageTimer > 0 ? _message : '',
    messageTimer: _messageTimer,
  };
}

// ---------- Reset ----------

export function resetShop(): void {
  _cursor           = 0;
  _items            = [];
  _message          = '';
  _messageTimer     = 0;
  _wave             = 0;
  _inputLock        = 0;
  _waitingForServer = false;
  if (_serverTimeout) { clearTimeout(_serverTimeout); _serverTimeout = null; }
}

// ---------- Helper ----------

function setMessage(msg: string, duration = 90): void {
  _message      = msg;
  _messageTimer = duration;
}
