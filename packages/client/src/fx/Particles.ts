// ============================================
//   Particles.ts
//   Visual juice — explosions, sparks, trails,
//   screen shake, flash overlays.
//   Pure visual — no game logic.
// ============================================

import { C } from '@void-sector/shared';

// ---------- Types ----------

interface Particle {
  active:  boolean;
  x:       number;
  y:       number;
  vx:      number;
  vy:      number;
  char:    string;
  color:   string;
  life:    number;
  maxLife: number;
  alpha:   number;
}

interface FloatText {
  x:       number;
  y:       number;
  text:    string;
  color:   string;
  life:    number;
  maxLife: number;
  vy:      number;
}

interface ShakeState {
  x:         number;
  y:         number;
  intensity: number;
}

// ---------- State ----------

const POOL_SIZE = 300;
const _pool: Particle[] = Array.from({ length: POOL_SIZE }, () => ({
  active: false, x:0, y:0, vx:0, vy:0,
  char: '*', color: C.COLOR.PRIMARY,
  life: 0, maxLife: 0, alpha: 1,
}));

const _particles:  Particle[]  = [];
const _floatTexts: FloatText[]  = [];

const _shake: ShakeState = { x:0, y:0, intensity:0 };
let   _flashAlpha = 0;
let   _flashColor = C.COLOR.PRIMARY;

const PARTICLE_CHARS = ['*', '.', '+', "'", '`', ','];

// ---------- Pool ----------

function getFromPool(): Particle | null {
  return _pool.find(p => !p.active) ?? null;
}

// ---------- Spawn ----------

export interface ExplosionOpts {
  color?:  string;
  count?:  number;
  spread?: number;
}

export function spawnExplosion(col: number, row: number, opts: ExplosionOpts = {}): void {
  const { color = C.COLOR.PRIMARY, count = C.PARTICLE.EXPLOSION_COUNT, spread = 1.2 } = opts;

  for (let i = 0; i < count; i++) {
    const p = getFromPool();
    if (!p) continue;

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
    const speed = (0.04 + Math.random() * 0.08) * spread;

    p.active  = true;
    p.x       = col;
    p.y       = row;
    p.vx      = Math.cos(angle) * speed;
    p.vy      = Math.sin(angle) * speed;
    p.char    = PARTICLE_CHARS[Math.floor(Math.random() * PARTICLE_CHARS.length)] ?? '*';
    p.color   = color;
    p.maxLife = C.PARTICLE.LIFETIME + Math.floor(Math.random() * 10);
    p.life    = p.maxLife;
    p.alpha   = 1;

    _particles.push(p);
  }
}

export function spawnHitSpark(col: number, row: number, opts: { color?: string } = {}): void {
  const { color = C.COLOR.PRIMARY } = opts;

  for (let i = 0; i < 4; i++) {
    const p = getFromPool();
    if (!p) continue;

    p.active  = true;
    p.x       = col + (Math.random() - 0.5) * 0.5;
    p.y       = row + (Math.random() - 0.5) * 0.5;
    p.vx      = (Math.random() - 0.5) * 0.12;
    p.vy      = (Math.random() - 0.5) * 0.12;
    p.char    = Math.random() < 0.5 ? '+' : '.';
    p.color   = color;
    p.maxLife = 10 + Math.floor(Math.random() * 8);
    p.life    = p.maxLife;
    p.alpha   = 1;

    _particles.push(p);
  }
}

export function spawnFloatText(
  col:  number,
  row:  number,
  text: string,
  opts: { color?: string } = {},
): void {
  _floatTexts.push({
    x: col, y: row, text,
    color:   opts.color ?? C.COLOR.PRIMARY,
    life:    45,
    maxLife: 45,
    vy:      -0.04,
  });
}

// ---------- Screen effects ----------

export function shake(intensity: number): void {
  if (intensity > _shake.intensity) _shake.intensity = intensity;
}

export function flash(color: string = C.COLOR.PRIMARY, alpha = 0.4): void {
  _flashColor = color;
  _flashAlpha = Math.min(1, _flashAlpha + alpha);
}

// ---------- Getters ----------

export function getShakeOffset(): { x: number; y: number } {
  return { x: _shake.x, y: _shake.y };
}

export function getFlash(): { color: string; alpha: number } {
  return { color: _flashColor, alpha: _flashAlpha };
}

export function getParticles():  readonly Particle[]  { return _particles;  }
export function getFloatTexts(): readonly FloatText[]  { return _floatTexts; }

// ---------- Update ----------

export function updateParticles(): void {
  // Shake
  if (_shake.intensity > 0.1) {
    _shake.x          = (Math.random() - 0.5) * _shake.intensity;
    _shake.y          = (Math.random() - 0.5) * _shake.intensity;
    _shake.intensity *= 0.82;
  } else {
    _shake.x = _shake.y = _shake.intensity = 0;
  }

  // Flash decay
  if (_flashAlpha > 0) _flashAlpha = Math.max(0, _flashAlpha - 0.06);

  // Particles
  for (let i = _particles.length - 1; i >= 0; i--) {
    const p = _particles[i]!;
    p.x    += p.vx;
    p.y    += p.vy;
    p.life -= 1;
    p.alpha = p.life / p.maxLife;
    if (p.life <= 0) {
      p.active = false;
      _particles.splice(i, 1);
    }
  }

  // Float texts
  for (let i = _floatTexts.length - 1; i >= 0; i--) {
    const t = _floatTexts[i]!;
    t.y    += t.vy;
    t.life -= 1;
    if (t.life <= 0) _floatTexts.splice(i, 1);
  }
}

// ---------- Reset ----------

export function resetParticles(): void {
  for (const p of _pool) p.active = false;
  _particles.length  = 0;
  _floatTexts.length = 0;
  _shake.x = _shake.y = _shake.intensity = 0;
  _flashAlpha = 0;
}
