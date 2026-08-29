// ============================================
//   VOID SECTOR — input.js
//   Central keyboard input handler.
//   No game logic here — only tracks key state.
//   Any system can read Input.held or Input.pressed.
// ============================================

const Input = (() => {

  // held[key]    = true while key is held down
  // pressed[key] = true for exactly ONE frame after keydown
  const held    = {};
  const pressed = {};
  const _justPressed = {};  // raw buffer, cleared each frame

  // Key aliases — map multiple keys to one action name
  const BINDINGS = {
    left:  ['ArrowLeft',  'a', 'A'],
    right: ['ArrowRight', 'd', 'D'],
    shoot: ['Space', ' ', 'ArrowUp', 'w', 'W', 'z', 'Z'],
    roll:  ['ShiftLeft', 'Shift', 'x', 'X'],
    pause: ['Escape'],
    confirm: ['Enter', 'Space', ' ', 'z', 'Z'],
    up:    ['ArrowUp',   'w', 'W'],
    down:  ['ArrowDown', 's', 'S'],
    bomb:  ['b', 'B'],
  };

  // Reverse lookup: rawKey → [actionName, ...]
  const _keyToAction = {};
  for (const [action, keys] of Object.entries(BINDINGS)) {
    for (const k of keys) {
      if (!_keyToAction[k]) _keyToAction[k] = [];
      _keyToAction[k].push(action);
    }
  }

  function onKeyDown(e) {
    // Prevent page scroll on arrows/space
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space',' '].includes(e.key)) {
      e.preventDefault();
    }

    const actions = _keyToAction[e.key] || [];
    for (const action of actions) {
      held[action] = true;
      if (!_justPressed[action]) {
        _justPressed[action] = true;
      }
    }
  }

  function onKeyUp(e) {
    const actions = _keyToAction[e.key] || [];
    for (const action of actions) {
      held[action] = false;
    }
  }

  // Call once per game frame — flushes the pressed buffer
  function update() {
    for (const action of Object.keys(BINDINGS)) {
      pressed[action] = !!_justPressed[action];
      _justPressed[action] = false;
    }
  }

  // Attach listeners
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup',   onKeyUp);

  return { held, pressed, update };

})();
