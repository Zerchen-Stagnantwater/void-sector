// ============================================
//   VOID SECTOR — shop.js
//   Between-wave upgrade screen.
//   Manages menu state, cursor, purchases.
//   Renderer reads getState() to draw it.
//   main.js calls update() each frame while
//   in the SHOP game state.
// ============================================

const Shop = (() => {

  // ---------- State ----------
  let _cursor = 0;      // Selected item index
  let _items = [];     // Built each time shop opens, with current costs/levels
  let _message = '';     // Feedback line: "PURCHASED" / "INSUFFICIENT FUNDS" etc.
  let _messageTimer = 0;      // Frames to show message
  let _wave = 0;      // Wave we just completed (for display)
  let _inputLock = 0;      // Prevent instant double-input on open

  // ---------- Build item list ----------
  // Called fresh each time the shop opens so costs reflect
  // current upgrade levels.

  function _buildItems() {
    const upgrades = Player.getUpgrades();
    _items = C.SHOP.ITEMS.map(def => {
      const level = upgrades[def.id] || 0;
      const maxed = level >= def.maxLevel;
      const cost = maxed
        ? null
        : Math.floor(def.baseCost * Math.pow(C.SHOP.COST_SCALE, level));
      return {
        id: def.id,
        label: def.label,
        desc: def.desc,
        level,
        maxLevel: def.maxLevel,
        cost,
        maxed,
      };
    });

    // Add a "LEAVE SHOP" option at the bottom
    _items.push({
      id: 'leave',
      label: 'LAUNCH >',
      desc: 'Begin next wave.',
      level: null,
      maxLevel: null,
      cost: null,
      maxed: false,
    });
  }

  // ---------- Open ----------

  function open(waveJustCompleted) {
    _wave = waveJustCompleted;
    _cursor = 0;
    _message = '';
    _messageTimer = 0;
    _inputLock = 12;   // Lock input for 12 frames on open
    _buildItems();
  }

  // ---------- Update ----------
  // Returns true when the player chooses to leave.

  function update(gameState) {
    if (_inputLock > 0) {
      _inputLock -= 1;
      return false;
    }

    if (_messageTimer > 0) _messageTimer -= 1;

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
        Audio.play('menuConfirm');
        return true;   // Signal to main.js: leave shop
      }

      _tryPurchase(item, gameState);
    }

    return false;
  }

  // ---------- Purchase ----------

  function _tryPurchase(item, gameState) {
    if (item.maxed) {
      _setMessage('ALREADY MAXED');
      Audio.play('shopDeny');
      return;
    }

    const score = Player.getScore();

    if (score < item.cost) {
      _setMessage('INSUFFICIENT FUNDS');
      Audio.play('shopDeny');
      return;
    }

    // Deduct cost — we reach into player score via a dedicated method
    // NOTE: Player doesn't expose setScore directly. We use spendScore.
    // We'll wire this via gameState so shop doesn't depend on player internals.
    gameState.spendScore = item.cost;

    const ok = Player.applyUpgrade(item.id);
    if (ok) {
      _setMessage('UPGRADE INSTALLED');
      Audio.play('shopBuy');
      _buildItems();   // Rebuild to show new level + updated cost
    } else {
      gameState.spendScore = 0;
      _setMessage('CANNOT UPGRADE');
      Audio.play('shopDeny');
    }
  }

  function _setMessage(msg, duration = 90) {
    _message = msg;
    _messageTimer = duration;
  }

  // ---------- Read (for renderer / ui) ----------

  function getState() {
    return {
      wave: _wave,
      cursor: _cursor,
      items: _items,
      message: _messageTimer > 0 ? _message : '',
      messageTimer: _messageTimer,
    };
  }

  // ---------- Reset ----------

  function reset() {
    _cursor = 0;
    _items = [];
    _message = '';
    _messageTimer = 0;
    _wave = 0;
    _inputLock = 0;
  }

  return {
    open,
    update,
    getState,
    reset,
  };

})();
