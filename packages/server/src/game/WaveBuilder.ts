// ============================================
//   WaveBuilder.ts
//   Wave definitions (1–10) and procedural
//   generation for waves beyond that.
//   Returns spawn lists consumed by GameLoop.
// ============================================

import type { SpawnEntry, EnemyType } from '@void-sector/shared';
import { C } from '@void-sector/shared';

// ---------- Public ----------

export function buildWave(waveNum: number, playerCount: number): SpawnEntry[] {
  const base = waveNum <= WAVE_DEFS.length
    ? (WAVE_DEFS[waveNum - 1]?.() ?? procedural(waveNum))
    : procedural(waveNum);

  return scaleForPlayers(base, playerCount);
}

// ---------- Formation helpers ----------

function line(
  type: EnemyType,
  count: number,
  rowOffset: number,
  spacing: number,
  stagger: number,
  baseDelay = 0,
): SpawnEntry[] {
  const totalW   = (count - 1) * spacing;
  const startCol = Math.floor((C.COLS - totalW) / 2);

  return Array.from({ length: count }, (_, i) => ({
    type,
    col:   startCol + i * spacing,
    row:   rowOffset,
    delay: baseDelay + i * stagger,
  }));
}

function scatter(
  type: EnemyType,
  count: number,
  baseDelay = 0,
): SpawnEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    type,
    col:   2 + Math.floor(Math.random() * (C.COLS - 4)),
    row:   Math.floor(Math.random() * 3),
    delay: baseDelay + i * 70,
  }));
}

function single(
  type: EnemyType,
  col: number,
  delay: number,
): SpawnEntry {
  return { type, col, row: 0, delay };
}

// ---------- Wave definitions ----------

type WaveFn = () => SpawnEntry[];

const WAVE_DEFS: WaveFn[] = [
  // 1 — Tutorial: 3 grunts
  () => line('A', 3, 1, 12, 60),

  // 2 — More grunts
  () => line('A', 4, 1, 10, 50),

  // 3 — First dasher
  () => [
    ...line('A', 3, 1, 12, 50),
    ...scatter('B', 1, 240),
  ],

  // 4 — Two dashers
  () => [
    ...scatter('A', 3, 0),
    ...scatter('B', 2, 160),
  ],

  // 5 — Introduce Tank
  () => [
    ...line('A', 4, 1, 9, 40),
    single('C', Math.floor(C.COLS / 2), 100),
  ],

  // 6 — Mixed
  () => [
    ...line('A', 4, 1, 9, 35),
    ...scatter('B', 3, 90),
    single('C', 10, 180),
    single('C', 34, 180),
  ],

  // 7 — Introduce Bomber
  () => [
    ...scatter('A', 5, 0),
    ...scatter('B', 2, 130),
    single('D', Math.floor(C.COLS / 2), 70),
  ],

  // 8 — Twin bombers
  () => [
    ...line('A', 3, 1, 10, 35),
    single('D', 12, 50),
    single('D', 32, 50),
    ...scatter('B', 3, 180),
  ],

  // 9 — Tank swarm
  () => [
    single('C', 8,  0),
    single('C', 20, 60),
    single('C', 32, 60),
    single('C', 42, 120),
    ...scatter('A', 5, 220),
  ],

  // 10 — Boss wave
  () => [
    ...line('A', 5, 1, 8, 35),
    ...scatter('B', 4, 110),
    single('C', 8,  160),
    single('C', 36, 160),
    single('D', 14, 220),
    single('D', 30, 220),
    ...scatter('B', 3, 340),
    single('C', Math.floor(C.COLS / 2), 400),
  ],
];

// ---------- Procedural generation ----------

type Weights = Record<EnemyType, number>;

function procedural(waveNum: number): SpawnEntry[] {
  const list:   SpawnEntry[] = [];
  const budget = 4 + waveNum * 1.5;
  const weights: Weights = {
    A: Math.max(0.1,  0.5  - waveNum * 0.02),
    B: Math.min(0.4,  0.2  + waveNum * 0.015),
    C: Math.min(0.3,  0.05 + waveNum * 0.015),
    D: Math.min(0.25, 0.05 + waveNum * 0.01),
  };

  let spent = 0;
  let delay = 0;

  while (spent < budget) {
    const type = weightedRandom(weights);
    const cost = type === 'C' ? 2 : type === 'D' ? 1.5 : 1;
    if (spent + cost > budget + 1) break;

    list.push({
      type,
      col:   2 + Math.floor(Math.random() * (C.COLS - 4)),
      row:   Math.floor(Math.random() * 3),
      delay,
    });

    delay += 40 + Math.floor(Math.random() * 40);
    spent += cost;
  }

  return list;
}

function weightedRandom(weights: Weights): EnemyType {
  const keys  = Object.keys(weights) as EnemyType[];
  const total = keys.reduce((s, k) => s + (weights[k] ?? 0), 0);
  let   r     = Math.random() * total;

  for (const k of keys) {
    r -= weights[k] ?? 0;
    if (r <= 0) return k;
  }

  return keys[keys.length - 1] ?? 'A';
}

// ---------- Multiplayer scaling ----------

function scaleForPlayers(base: SpawnEntry[], playerCount: number): SpawnEntry[] {
  if (playerCount <= 1) return base;

  const scale = 1 + (playerCount - 1) * C.MP_SCALE.COUNT_PER_PLAYER;
  const extra = Math.floor(base.length * (scale - 1));
  const added: SpawnEntry[] = [];

  for (let i = 0; i < extra; i++) {
    const ref = base[Math.floor(Math.random() * base.length)];
    if (!ref) continue;
    added.push({
      type:  ref.type,
      col:   2 + Math.floor(Math.random() * (C.COLS - 4)),
      row:   Math.floor(Math.random() * 3),
      delay: ref.delay + 20 + Math.floor(Math.random() * 60),
    });
  }

  return [...base, ...added];
}
