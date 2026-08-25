// ============================================
//   VOID SECTOR — shop.js (MULTIPLAYER)
//   Between-wave upgrade screen.
//   In multiplayer, purchases are sent to
//   the server which validates and applies them.
//   Server responds with shop_result messages.
//   Each player navigates their own shop.
//   Wave starts when all players press LAUNCH.
// ============================================

const Shop = (() => {

  // ---------- State ----------
  let _cursor       = 0;
  let _items        = [];
  let _message      = '';
  let _messageTimer = 0;
  let _wave         = 0;
  let _inputLock    = 0;
  let _myId         = null;
  let _waitingForServer = false;  // True while a purchase is in-flight
  let _serverTimeout    = null;    // Safety valve for dropped responses

  // ---------- Build item list ----------
  // In multiplayer, levels and costs come from
  // the server state for THIS player.

  function _buildItems(playerUpgrades) {
    const upgrades = playerUpgrades || {};
    _items = C.SHOP.ITEMS.map(def => {
      const level = upgrades[def.id] || 0;
      const maxed = level >= def.maxLevel;
      const cost  = maxed
        ? null
        : Math.floor(def.baseCost * Math.pow(C.SHOP.COST_SCALE, level));
      return {
        id:       def.id,
        label:    def.label,
        desc:     def.desc,
        level,
        maxLevel: def.maxLevel,
        cost,
        maxed,
      };
    });

    // LAUNCH option at the bottom
    _items.push({
      id:       'leave',
      label:    'LAUNCH >',
      desc:     'Ready up. Wave starts when all players are ready.',
      level:    null,
      maxLevel: null,
      cost:     null,
      maxed:    false,
    });
  }

  // ---------- Open (multiplayer) ----------

  function openMulti(wave, myId) {
    _wave            = wave;
    _myId            = myId;
    _cursor          = 0;
    _message         = '';
    _messageTimer    = 0;
    _inputLock       = 14;
    _waitingForServer= false;
    _buildItems({});   // Build with empty upgrades — server will send real state shortly
  }

  // ---------- Update (multiplayer) ----------
  // Returns nothing — actions are sent to server,
  // not applied locally. Server responds via shop_result.

  function updateMulti(gameState) {
    if (_inputLock > 0) { _inputLock -= 1; return; }
    if (_messageTimer > 0) _messageTimer -= 1;

    // Rebuild items from latest server state for this player
    const myPlayer = gameState.players.find(p => p.id === gameState.myId);
    if (myPlayer?.upgrades) {
      _buildItems(myPlayer.upgrades);
    }

    // Don't process input while waiting for a server response
    if (_waitingForServer) return;

    // Navigation
    if (Input.pressed.down || Input.pressed.right) {
      _cursor = (_cursor + 1) % _items.length;
      Audio.play('menuMove');
    }
    if (Input.pressed.up || Input.pressed.left) {
      _cursor = (_cursor - 1 + _items.length) % _items.length;
      Audio.play('menuMove');
    }

    // Confirm
    if (Input.pressed.confirm) {
      const item = _items[_cursor];

      if (item.id === 'leave') {
        // Tell server this player is ready
        Net.shopReady();
        _setMessage('READY — WAITING FOR OTHERS');
        Audio.play('menuConfirm');
        return;
      }

      // Send purchase to server — server validates and responds
      if (item.maxed) {
        _setMessage('ALREADY MAXED');
        Audio.play('shopDeny');
        return;
      }

      const myScore = gameState.players.find(p => p.id === gameState.myId)?.score || 0;
      if (myScore < item.cost) {
        _setMessage('INSUFFICIENT FUNDS');
        Audio.play('shopDeny');
        return;
      }

      // Optimistic: show pending state, wait for server confirmation
      _waitingForServer = true;
      _setMessage('...');
      Net.buyUpgrade(item.id);

      // Safety valve — if server never responds, unlock after 3 seconds
      clearTimeout(_serverTimeout);
      _serverTimeout = setTimeout(() => {
        if (_waitingForServer) {
          _waitingForServer = false;
          _setMessage('NO RESPONSE — TRY AGAIN');
        }
      }, 3000);
    }
  }

  // ---------- Apply server result ----------
  // Called by main.js when server sends shop_result.

  function applyResult(msg) {
    _waitingForServer = false;
    clearTimeout(_serverTimeout);

    if (msg.success) {
      _setMessage('UPGRADE INSTALLED');
      Audio.play('shopBuy');
      // Server state broadcast will update the player's upgrades and score
      // _buildItems will be called on next updateMulti with fresh data
    } else {
      _setMessage(msg.message || 'CANNOT UPGRADE');
      Audio.play('shopDeny');
    }
  }

  // ---------- Message ----------

  function _setMessage(msg, duration = 90) {
    _message      = msg;
    _messageTimer = duration;
  }

  // ---------- Read (for renderer) ----------

  function getState() {
    return {
      wave:         _wave,
      cursor:       _cursor,
      items:        _items,
      message:      _messageTimer > 0 ? _message : '',
      messageTimer: _messageTimer,
    };
  }

  // ---------- Reset ----------

  function reset() {
    _cursor            = 0;
    _items             = [];
    _message           = '';
    _messageTimer      = 0;
    _wave              = 0;
    _inputLock         = 0;
    _myId              = null;
    _waitingForServer  = false;
    clearTimeout(_serverTimeout);
    _serverTimeout     = null;
  }

  return {
    openMulti,
    updateMulti,
    applyResult,
    getState,
    reset,
  };

})();
