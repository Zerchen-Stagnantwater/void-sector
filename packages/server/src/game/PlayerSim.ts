// ============================================
//   PlayerSim.ts
//   Server-side player simulation.
//   Movement, roll, shooting, effects, combo.
//   Called once per tick per living player.
// ============================================

import type { ServerPlayer, GameState, Bullet } from '@void-sector/shared';
import { C } from '@void-sector/shared';

// ---------- Public entry point ----------

export function tickPlayer(p: ServerPlayer, gs: GameState): void {
  applyMovement(p);
  applyRoll(p);
  applyShoot(p, gs);
  tickEffects(p);
  tickCombo(p);
  tickInvincibility(p);

  // Update cooldown fraction for client HUD
  p.rollCooldownFrac = p.rollCooldown / C.PLAYER.ROLL_COOLDOWN;

  // Clear pressed flags — consumed for this tick
  p.input.pressed.roll    = false;
  p.input.pressed.bomb    = false;
  p.input.pressed.confirm = false;
}

// ---------- Movement ----------

function applyMovement(p: ServerPlayer): void {
  const speed = getSpeed(p);

  if (p.rolling) {
    p.x += p.rollDir * speed;
  } else {
    if (p.input.held.left)  p.x -= speed;
    if (p.input.held.right) p.x += speed;
  }

  p.x = Math.max(0, Math.min(C.COLS - 1, p.x));
}

function getSpeed(p: ServerPlayer): number {
  const base    = C.PLAYER.SPEED + p.upgrades.move_speed * 0.022;
  const rollMul = p.rolling ? C.PLAYER.ROLL_SPEED : 1;
  return base * rollMul;
}

// ---------- Roll ----------

function applyRoll(p: ServerPlayer): void {
  if (p.rollCooldown > 0) p.rollCooldown--;

  if (p.rolling) {
    p.rollTimer--;
    if (p.rollTimer <= 0) {
      p.rolling    = false;
      p.invincible = true;
      p.invTimer   = 6;
    }
    return;
  }

  if (p.input.pressed.roll && p.rollCooldown <= 0) {
    p.rollDir      = p.input.held.left ? -1 : p.input.held.right ? 1 : p.rollDir;
    p.rolling      = true;
    p.rollTimer    = C.PLAYER.ROLL_DURATION;
    p.rollCooldown = C.PLAYER.ROLL_COOLDOWN;
    p.invincible   = true;
    p.invTimer     = C.PLAYER.ROLL_DURATION + 6;
  }
}

// ---------- Shoot ----------

function applyShoot(p: ServerPlayer, gs: GameState): void {
  if (p.shootCooldown > 0) { p.shootCooldown--; return; }
  if (!p.input.held.shoot) return;

  p.shootCooldown = getShootRate(p);

  const speed  = C.BULLET.PLAYER_SPEED + p.upgrades.bullet_spd * 0.04;
  const spread = p.effects.spread.active;
  const count  = p.upgrades.multi_shot + 1;

  if (spread) {
    spawnSpreadShot(p, gs, speed);
  } else {
    spawnMultiShot(p, gs, speed, count);
  }
}

function spawnSpreadShot(p: ServerPlayer, gs: GameState, speed: number): void {
  const configs = [
    { vx: -0.18, char: '\\', color: '#39ff14' },
    { vx:  0,    char: '|',  color: '#39ff14' },
    { vx:  0.18, char: '/',  color: '#39ff14' },
  ];
  for (const cfg of configs) {
    spawnBullet(gs, {
      owner: 'player', ownerId: p.id,
      x: p.x, y: p.y - 1,
      vx: cfg.vx, vy: -speed,
      char: cfg.char, color: cfg.color, damage: 1,
    });
  }
}

function spawnMultiShot(
  p: ServerPlayer,
  gs: GameState,
  speed: number,
  count: number,
): void {
  for (const ox of multiOffsets(count)) {
    spawnBullet(gs, {
      owner: 'player', ownerId: p.id,
      x: p.x + ox, y: p.y - 1,
      vx: 0, vy: -speed,
      char: '|', color: '#00ff41', damage: 1,
    });
  }
}

function multiOffsets(count: number): number[] {
  if (count === 1) return [0];
  if (count === 2) return [-1, 1];
  if (count === 3) return [-2, 0, 2];
  if (count === 4) return [-3, -1, 1, 3];
  return [-4, -2, 0, 2, 4];
}

function getShootRate(p: ServerPlayer): number {
  const base  = C.PLAYER.SHOOT_COOLDOWN - p.upgrades.fire_rate * 1.5;
  const rapid = p.effects.rapid.active ? 0.4 : 1.0;
  return Math.max(3, base * rapid);
}

// ---------- Effects ----------

function tickEffects(p: ServerPlayer): void {
  if (p.effects.rapid.active) {
    p.effects.rapid.framesLeft--;
    if (p.effects.rapid.framesLeft <= 0) p.effects.rapid.active = false;
  }
  if (p.effects.spread.active) {
    p.effects.spread.framesLeft--;
    if (p.effects.spread.framesLeft <= 0) p.effects.spread.active = false;
  }
}

// ---------- Combo ----------

function tickCombo(p: ServerPlayer): void {
  if (p.comboTimer > 0) {
    p.comboTimer--;
    if (p.comboTimer <= 0) p.combo = 0;
  }
}

// ---------- Invincibility ----------

function tickInvincibility(p: ServerPlayer): void {
  if (p.invincible && !p.rolling) {
    p.invTimer--;
    if (p.invTimer <= 0) p.invincible = false;
  }
}

// ---------- Bullet spawn helper ----------

interface BulletOpts {
  owner:   'player' | 'enemy';
  ownerId: number | null;
  x:       number;
  y:       number;
  vx:      number;
  vy:      number;
  char:    string;
  color:   string;
  damage:  number;
}

export function spawnBullet(gs: GameState, opts: BulletOpts): void {
  const bullet: Bullet = {
    id:      gs._nextBulletId++,
    owner:   opts.owner,
    ownerId: opts.ownerId,
    x:       opts.x,
    y:       opts.y,
    vx:      opts.vx,
    vy:      opts.vy,
    char:    opts.char,
    color:   opts.color,
    damage:  opts.damage,
  };
  gs.bullets.push(bullet);
}

// ---------- Bullet tick ----------

export function tickBullets(gs: GameState): void {
  for (let i = gs.bullets.length - 1; i >= 0; i--) {
    const b = gs.bullets[i];
    if (!b) continue;

    b.x += b.vx;
    b.y += b.vy;

    if (
      b.y < -2 || b.y > C.ROWS + 2 ||
      b.x < -2 || b.x > C.COLS + 2
    ) {
      gs.bullets.splice(i, 1);
    }
  }
}
