// ============================================
//   save.ts
//   localStorage persistence.
//   Never call localStorage directly elsewhere.
// ============================================

import type { SaveData } from '../types.js';

const PREFIX = 'voidsector_';

const DEFAULTS: SaveData = {
  highScore:    0,
  gamesPlayed:  0,
  totalKills:   0,
  bestWave:     0,
  masterVolume: 0.5,
  sfxVolume:    1.0,
};

function key(name: string): string {
  return PREFIX + name;
}

function read<T>(name: string): T | undefined {
  try {
    const raw = localStorage.getItem(key(name));
    return raw !== null ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(name: string, value: unknown): void {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    console.warn('[Save] Write failed for', name);
  }
}

// ---------- Public ----------

export function load(): SaveData {
  const data = {} as SaveData;
  for (const [k, def] of Object.entries(DEFAULTS) as [keyof SaveData, SaveData[keyof SaveData]][]) {
    const saved = read<SaveData[keyof SaveData]>(k);
    (data as Record<string, unknown>)[k] = saved !== undefined ? saved : def;
  }
  return data;
}

export function set<K extends keyof SaveData>(name: K, value: SaveData[K]): void {
  write(name, value);
}

export interface RunStats {
  score: number;
  wave:  number;
  kills: number;
}

/** Returns true if a new high score was set. */
export function submitRun(stats: RunStats): boolean {
  const current = load();
  let newHigh   = false;

  if (stats.score > current.highScore) {
    write('highScore', stats.score);
    newHigh = true;
  }
  if (stats.wave > current.bestWave) write('bestWave', stats.wave);

  write('gamesPlayed', current.gamesPlayed + 1);
  write('totalKills',  current.totalKills  + stats.kills);

  return newHigh;
}

export function clearAll(): void {
  for (const k of Object.keys(DEFAULTS)) {
    localStorage.removeItem(key(k));
  }
}
