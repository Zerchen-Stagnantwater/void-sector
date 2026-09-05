// ============================================
//   input.ts
//   Central keyboard input handler.
//   held  = true every frame key is down
//   pressed = true for exactly one frame
// ============================================

export type Action =
  | 'left' | 'right' | 'shoot' | 'roll'
  | 'pause' | 'confirm' | 'up' | 'down' | 'bomb';

const BINDINGS: Record<Action, string[]> = {
  left:    ['ArrowLeft',  'a', 'A'],
  right:   ['ArrowRight', 'd', 'D'],
  shoot:   ['Space', ' ', 'z', 'Z'],
  roll:    ['ShiftLeft', 'Shift', 'x', 'X'],
  pause:   ['Escape'],
  confirm: ['Enter', 'Space', ' ', 'z', 'Z'],
  up:      ['ArrowUp',   'w', 'W'],
  down:    ['ArrowDown', 's', 'S'],
  bomb:    ['b', 'B'],
};

// Reverse lookup: raw key → actions
const keyToActions = new Map<string, Action[]>();
for (const [action, keys] of Object.entries(BINDINGS) as [Action, string[]][]) {
  for (const k of keys) {
    const existing = keyToActions.get(k) ?? [];
    existing.push(action);
    keyToActions.set(k, existing);
  }
}

const SCROLL_BLOCK = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space',' ']);

// State
const _held        = new Map<Action, boolean>();
const _pressed     = new Map<Action, boolean>();
const _justPressed = new Map<Action, boolean>();

function onKeyDown(e: KeyboardEvent): void {
  if (SCROLL_BLOCK.has(e.key)) e.preventDefault();
  const actions = keyToActions.get(e.key) ?? [];
  for (const a of actions) {
    _held.set(a, true);
    if (!_justPressed.get(a)) _justPressed.set(a, true);
  }
}

function onKeyUp(e: KeyboardEvent): void {
  const actions = keyToActions.get(e.key) ?? [];
  for (const a of actions) _held.set(a, false);
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup',   onKeyUp);

// ---------- Public ----------

/** Call once at the start of every tick to flush pressed buffer. */
export function updateInput(): void {
  for (const action of Object.keys(BINDINGS) as Action[]) {
    _pressed.set(action, _justPressed.get(action) ?? false);
    _justPressed.set(action, false);
  }
}

export function held(action: Action):    boolean { return _held.get(action)    ?? false; }
export function pressed(action: Action): boolean { return _pressed.get(action) ?? false; }
