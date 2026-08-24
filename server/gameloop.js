// ============================================
//   VOID SECTOR SERVER — gameLoop.js
//   Full authoritative game simulation.
//   Runs at 60fps per room via setInterval.
//   Broadcasts state to all clients at 20fps.
//   Emits events for juice (audio/particles).
// ============================================

const C  = require('./constants');
const RM = require('./roomManager');

// ---------- Start game ----------

function startGame(room) {
  if (room.state !== 'LOBBY') return;

  clearTimeout(room._lobbyTimer);
  room.state = 'PLAYING';

  room.gameState = {
    frame:      0,
    wave:       0,
    enemies:    [],
    bullets:    [],
    drops:      [],
    spawnQueue: [],
    spawnTimer: 0,
    allSpawned: false,
    interlude:  0,
    _nextEnemyId:  0,
    _nextBulletId: 0,
    _nextDropId:   0,
  };

  // Reset all players to start positions
  for (const p of room.players) {
    if (!p.connected) continue;
    p.x             = C.PLAYER_START_COLS[p.id];
    p.y             = C.PLAYER.START_ROW;
    p.lives         = C.PLAYER.LIVES;
    p.score         = 0;
    p.kills         = 0;
    p.combo         = 0;
    p.comboTimer    = 0;
    p.rolling       = false;
    p.rollTimer     = 0;
    p.rollCooldown  = 0;
    p.invincible    = false;
    p.invTimer      = 0;
    p.shootCooldown = 0;
    p.bombs         = 0;
    p.shieldActive  = false;
    p.shieldHits    = 0;
    p.alive         = true;
    p.effects.rapid.active  = false;
    p.effects.rapid.framesLeft  = 0;
    p.effects.spread.active = false;
    p.effects.spread.framesLeft = 0;
  }

  _startNextWave(room);

  // Broadcast game_start
  RM.broadcast(room, {
    type:    'game_start',
    wave:    room.gameState.wave,
    players: room.players.map(_serializePlayer),
  });

  // Kick off the loop
  room.tickInterval = setInterval(() => _tick(room), C.TICK_MS);
  console.log(`[Game] Room ${room.code} started`);
}

// ---------- Tick ----------

function _tick(room) {
  const gs = room.gameState;
  gs.frame++;

  _tickPlayers(room);
  _tickBullets(gs);
  _tickEnemies(room);
  _tickDrops(room);
  _tickSpawner(room);
  _checkWaveComplete(room);

  // Broadcast state every 3 ticks (20fps)
  if (gs.frame % 3 === 0) {
    _broadcastState(room);
  }
}

// ============================================
//   PLAYERS
// ============================================

function _tickPlayers(room) {
  for (const p of room.players) {
    if (!p.connected || !p.alive) continue;

    _applyMovement(p);
    _applyRoll(p);
    _applyShoot(p, room);
    _tickEffects(p);
    _tickCombo(p);
    _tickInvincibility(p);

    // Clear pressed inputs after processing
    p.input.pressed.roll    = false;
    p.input.pressed.bomb    = false;
    p.input.pressed.confirm = false;

    // Update cooldown fraction for client HUD
    p.rollCooldownFrac = p.rollCooldown / C.PLAYER.ROLL_COOLDOWN;
  }
}

function _applyMovement(p) {
  const speed = _getSpeed(p);

  if (p.rolling) {
    p.x += p.rollDir * speed;
  } else {
    if (p.input.held.left)  p.x -= speed;
    if (p.input.held.right) p.x += speed;
  }

  p.x = Math.max(0, Math.min(C.COLS - 1, p.x));
}

function _getSpeed(p) {
  const base    = C.PLAYER.SPEED + p.upgrades.move_speed * 0.022;
  const rollMul = p.rolling ? C.PLAYER.ROLL_SPEED : 1;
  return base * rollMul;
}

function _applyRoll(p) {
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
    if (p.input.held.left)       p.rollDir = -1;
    else if (p.input.held.right) p.rollDir =  1;

    p.rolling      = true;
    p.rollTimer    = C.PLAYER.ROLL_DURATION;
    p.rollCooldown = C.PLAYER.ROLL_COOLDOWN;
    p.invincible   = true;
    p.invTimer     = C.PLAYER.ROLL_DURATION + 6;
  }
}

function _applyShoot(p, room) {
  if (p.shootCooldown > 0) { p.shootCooldown--; return; }
  if (!p.input.held.shoot) return;

  p.shootCooldown = _getShootRate(p);

  const count  = p.upgrades.multi_shot + 1;
  const spread = p.effects.spread.active;
  const spd    = C.BULLET.PLAYER_SPEED + p.upgrades.bullet_spd * 0.04;

  if (spread) {
    const angles = [-0.18, 0, 0.18];
    for (const vx of angles) {
      _spawnBullet(room.gameState, {
        owner: 'player', ownerId: p.id,
        x: p.x, y: p.y - 1,
        vx, vy: -spd,
        char: ['\\', '|', '/'][angles.indexOf(vx)],
        color: '#39ff14',
      });
    }
  } else {
    const offsets = _multiOffsets(count);
    for (const ox of offsets) {
      _spawnBullet(room.gameState, {
        owner: 'player', ownerId: p.id,
        x: p.x + ox, y: p.y - 1,
        vx: 0, vy: -spd,
        char: '|',
        color: '#00ff41',
      });
    }
  }
}

function _multiOffsets(count) {
  if (count === 1) return [0];
  if (count === 2) return [-1, 1];
  if (count === 3) return [-2, 0, 2];
  if (count === 4) return [-3, -1, 1, 3];
  return [-4, -2, 0, 2, 4];
}

function _getShootRate(p) {
  const base  = C.PLAYER.SHOOT_COOLDOWN - p.upgrades.fire_rate * 1.5;
  const rapid = p.effects.rapid.active ? 0.4 : 1.0;
  return Math.max(3, base * rapid);
}

function _tickEffects(p) {
  if (p.effects.rapid.active) {
    p.effects.rapid.framesLeft--;
    if (p.effects.rapid.framesLeft <= 0) p.effects.rapid.active = false;
  }
  if (p.effects.spread.active) {
    p.effects.spread.framesLeft--;
    if (p.effects.spread.framesLeft <= 0) p.effects.spread.active = false;
  }
}

function _tickCombo(p) {
  if (p.comboTimer > 0) {
    p.comboTimer--;
    if (p.comboTimer <= 0) p.combo = 0;
  }
}

function _tickInvincibility(p) {
  if (p.invincible && !p.rolling) {
    p.invTimer--;
    if (p.invTimer <= 0) p.invincible = false;
  }
}

// ============================================
//   BULLETS
// ============================================

function _spawnBullet(gs, opts) {
  gs.bullets.push({
    id:      gs._nextBulletId++,
    active:  true,
    owner:   opts.owner,
    ownerId: opts.ownerId ?? null,
    x:       opts.x,
    y:       opts.y,
    vx:      opts.vx || 0,
    vy:      opts.vy,
    char:    opts.char,
    color:   opts.color,
    damage:  opts.damage || 1,
  });
}

function _tickBullets(gs) {
  for (let i = gs.bullets.length - 1; i >= 0; i--) {
    const b = gs.bullets[i];
    b.x += b.vx;
    b.y += b.vy;

    if (b.y < -2 || b.y > C.ROWS + 2 ||
        b.x < -2 || b.x > C.COLS + 2) {
      gs.bullets.splice(i, 1);
    }
  }
}

// ============================================
//   ENEMIES
// ============================================

function _spawnEnemy(gs, type, col, row, playerCount) {
  const def    = C.ENEMY[type];
  const hpScale = 1 + (playerCount - 1) * C.MP_SCALE.HP_PER_PLAYER;
  const hp      = Math.ceil(def.HP * hpScale);

  gs.enemies.push({
    id:          gs._nextEnemyId++,
    type,
    x:           col,
    y:           row,
    hp,
    maxHp:       hp,
    char:        def.CHAR,
    color:       def.COLOR,
    flashTimer:  0,
    shootTimer:  Math.floor(Math.random() * def.SHOOT_RATE),
    moveTimer:   Math.floor(Math.random() * 60),
    moveDir:     Math.random() < 0.5 ? 1 : -1,
    phaseTimer:  0,
  });
}

function _tickEnemies(room) {
  const gs = room.gameState;
  const players = room.players.filter(p => p.alive && p.connected);

  for (let i = gs.enemies.length - 1; i >= 0; i--) {
    const e = gs.enemies[i];

    if (e.flashTimer > 0) e.flashTimer--;

    // AI movement
    switch (e.type) {
      case 'A': _aiGrunt(e, gs);   break;
      case 'B': _aiDasher(e, gs, players);  break;
      case 'C': _aiTank(e, gs);    break;
      case 'D': _aiBomber(e, gs);  break;
    }

    // Check player bullets hitting this enemy
    _checkEnemyHit(e, i, room, players);

    // Enemy reached bottom — damage nearest player
    if (e.y >= C.ROWS - 1) {
      gs.enemies.splice(i, 1);
      if (players.length > 0) {
        const target = players[Math.floor(Math.random() * players.length)];
        _damagePlayer(target, room, true);
      }
    }
  }
}

function _aiGrunt(e, gs) {
  e.y += C.ENEMY.A.SPEED;
  e.moveTimer++;
  if (e.moveTimer % 90 === 0) e.moveDir = Math.random() < 0.5 ? 1 : -1;
  e.x += e.moveDir * 0.008;
  e.x  = Math.max(1, Math.min(C.COLS - 2, e.x));
  _enemyShoot(e, C.ENEMY.A.SHOOT_RATE, gs, () => {
    _spawnBullet(gs, {
      owner: 'enemy', x: e.x, y: e.y + 1,
      vx: 0, vy: C.BULLET.ENEMY_SPEED,
      char: '!', color: '#ff2200',
    });
  });
}

function _aiDasher(e, gs, players) {
  e.y += C.ENEMY.B.SPEED;
  e.moveTimer++;
  if (e.moveTimer % 40 === 0) e.moveDir *= -1;
  e.x += e.moveDir * 0.22;
  e.x  = Math.max(1, Math.min(C.COLS - 2, e.x));
  if (e.x <= 1 || e.x >= C.COLS - 2) e.moveDir *= -1;

  _enemyShoot(e, C.ENEMY.B.SHOOT_RATE, gs, () => {
    // Aim at nearest living player
    const target = _nearestPlayer(e, players);
    if (!target) return;
    const dx  = target.x - e.x;
    const dy  = target.y - e.y;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    const spd = C.BULLET.ENEMY_SPEED * 1.2;
    _spawnBullet(gs, {
      owner: 'enemy', x: e.x, y: e.y + 1,
      vx: (dx/len) * spd * 0.5,
      vy: (dy/len) * spd,
      char: '!', color: '#ff6600',
    });
  });
}

function _aiTank(e, gs) {
  e.y += C.ENEMY.C.SPEED;
  e.moveTimer++;
  e.x += Math.sin(e.moveTimer * 0.04) * 0.03;
  e.x  = Math.max(1, Math.min(C.COLS - 2, e.x));
  _enemyShoot(e, C.ENEMY.C.SHOOT_RATE, gs, () => {
    _spawnBullet(gs, {
      owner: 'enemy', x: e.x,       y: e.y + 1,
      vx: 0, vy: C.BULLET.ENEMY_SPEED,
      char: '!', color: '#ff00aa',
    });
    _spawnBullet(gs, {
      owner: 'enemy', x: e.x + 0.8, y: e.y + 1,
      vx: 0, vy: C.BULLET.ENEMY_SPEED,
      char: '!', color: '#ff00aa',
    });
  });
}

function _aiBomber(e, gs) {
  const hoverRow = Math.floor(C.ROWS * 0.35);
  if (e.y < hoverRow) {
    e.y += C.ENEMY.D.SPEED * 1.5;
  } else {
    e.phaseTimer++;
    e.x += Math.sin(e.phaseTimer * 0.03) * 0.08;
    e.x  = Math.max(1, Math.min(C.COLS - 2, e.x));
    if (e.phaseTimer > 300) e.y += C.ENEMY.D.SPEED * 0.5;
  }
  _enemyShoot(e, C.ENEMY.D.SHOOT_RATE, gs, () => {
    for (const vx of [-0.12, 0, 0.12]) {
      _spawnBullet(gs, {
        owner: 'enemy', x: e.x, y: e.y + 1,
        vx, vy: C.BULLET.ENEMY_SPEED * 0.85,
        char: '!', color: '#aa00ff',
      });
    }
  });
}

function _enemyShoot(e, rate, gs, fireFn) {
  e.shootTimer++;
  const scaled = Math.max(rate * 0.45, rate - (gs.wave || 0) * 4);
  if (e.shootTimer >= scaled) {
    e.shootTimer = 0;
    fireFn();
  }
}

function _nearestPlayer(e, players) {
  let nearest = null, minDist = Infinity;
  for (const p of players) {
    const dx = p.x - e.x, dy = p.y - e.y;
    const d  = dx*dx + dy*dy;
    if (d < minDist) { minDist = d; nearest = p; }
  }
  return nearest;
}

function _checkEnemyHit(e, idx, room, players) {
  const gs   = room.gameState;
  const hits = gs.bullets.filter(b =>
    b.owner === 'player' &&
    Math.abs(b.x - e.x) < 0.8 &&
    Math.abs(b.y - e.y) < 0.8
  );

  for (const b of hits) {
    e.hp     -= b.damage;
    e.flashTimer = 6;
    gs.bullets.splice(gs.bullets.indexOf(b), 1);

    RM.broadcast(room, {
      type: 'event', event: 'enemy_hit',
      x: e.x, y: e.y,
      data: { enemyType: e.type, playerId: b.ownerId },
    });

    if (e.hp <= 0) {
      _killEnemy(e, idx, room, players, b.ownerId);
      return;
    }
  }

  // Check player body collision
  for (const p of players) {
    if (p.invincible) continue;
    if (Math.abs(e.x - p.x) < 0.9 && Math.abs(e.y - p.y) < 0.9) {
      _damagePlayer(p, room, false);
    }
  }
}

function _killEnemy(e, idx, room, players, killerPlayerId) {
  const gs  = room.gameState;
  const def = C.ENEMY[e.type];

  // Award score + combo to killer
  const killer = room.players.find(p => p.id === killerPlayerId);
  let earned = def.SCORE, multiplier = 1;
  if (killer) {
    killer.combo++;
    killer.comboTimer = C.SCORE.COMBO_WINDOW;
    killer.kills++;
    multiplier = Math.min(killer.combo, 8);
    earned     = def.SCORE * multiplier;
    killer.score += earned;
  }

  RM.broadcast(room, {
    type: 'event', event: 'enemy_die',
    x: e.x, y: e.y,
    data: {
      enemyType:  e.type,
      score:      earned,
      multiplier,
      playerId:   killerPlayerId,
    },
  });

  // Drop
  if (Math.random() < def.DROP_CHANCE) {
    _spawnDrop(gs, e.x, e.y);
  }

  gs.enemies.splice(idx, 1);
}

// ============================================
//   DROPS
// ============================================

const DROP_TYPES = ['RAPID','SPREAD','SHIELD','BOMB','LIFE'];

function _randomDropType() {
  const roll = Math.random();
  if (roll < 0.30) return 'RAPID';
  if (roll < 0.55) return 'SPREAD';
  if (roll < 0.72) return 'SHIELD';
  if (roll < 0.88) return 'BOMB';
  return 'LIFE';
}

function _spawnDrop(gs, col, row) {
  const type   = _randomDropType();
  const spawnY = Math.max(row, Math.floor(C.ROWS * 0.38));
  gs.drops.push({
    id:    gs._nextDropId++,
    type,
    x:     col,
    y:     spawnY,
    char:  C.POWERUP.CHARS[type],
    color: C.POWERUP.COLORS[type],
    life:  480,
  });
}

function _tickDrops(room) {
  const gs      = room.gameState;
  const players = room.players.filter(p => p.alive && p.connected);

  for (let i = gs.drops.length - 1; i >= 0; i--) {
    const d = gs.drops[i];
    d.y    += C.POWERUP.FALL_SPEED;
    d.life -= 1;

    if (d.y > C.ROWS + 1 || d.life <= 0) {
      gs.drops.splice(i, 1);
      continue;
    }

    // Check collision with any player
    for (const p of players) {
      if (Math.abs(d.x - p.x) < 0.9 && Math.abs(d.y - p.y) < 0.9) {
        _applyDrop(d.type, p, room);
        RM.broadcast(room, {
          type: 'event', event: 'pickup',
          x: d.x, y: d.y,
          data: { pickupType: d.type, playerId: p.id },
        });
        gs.drops.splice(i, 1);
        break;
      }
    }
  }
}

function _applyDrop(type, player, room) {
  switch (type) {
    case 'RAPID':
      player.effects.rapid.active     = true;
      player.effects.rapid.framesLeft = C.POWERUP.RAPID_DURATION;
      break;
    case 'SPREAD':
      player.effects.spread.active     = true;
      player.effects.spread.framesLeft = C.POWERUP.SPREAD_DURATION;
      break;
    case 'SHIELD':
      player.shieldActive = true;
      player.shieldHits   = C.POWERUP.SHIELD_HITS;
      break;
    case 'BOMB':
      player.bombs = Math.min(player.bombs + 1, 3);
      break;
    case 'LIFE':
      player.lives = Math.min(player.lives + 1, 6);
      break;
  }
}

// ============================================
//   PLAYER DAMAGE
// ============================================

function _damagePlayer(p, room, breached) {
  // Check enemy bullets hitting this player
  if (!breached) {
    const gs   = room.gameState;
    const hits = gs.bullets.filter(b =>
      b.owner === 'enemy' &&
      Math.abs(b.x - p.x) < 0.8 &&
      Math.abs(b.y - p.y) < 0.8
    );
    if (hits.length === 0 && !breached) return;
    for (const b of hits) gs.bullets.splice(gs.bullets.indexOf(b), 1);
  }

  if (p.invincible) return;

  // Shield absorb
  if (p.shieldActive && p.shieldHits > 0) {
    p.shieldHits--;
    if (p.shieldHits <= 0) p.shieldActive = false;
    p.invincible = true;
    p.invTimer   = 30;
    RM.broadcast(room, {
      type: 'event', event: 'shield_hit',
      x: p.x, y: p.y,
      data: { playerId: p.id },
    });
    return;
  }

  p.lives--;
  p.invincible = true;
  p.invTimer   = C.PLAYER.INVINCIBLE_FRAMES;

  if (p.lives <= 0) {
    p.alive = false;
    RM.broadcast(room, {
      type: 'event', event: 'player_die',
      x: p.x, y: p.y,
      data: { playerId: p.id },
    });
    _checkAllDead(room);
  } else {
    RM.broadcast(room, {
      type: 'event', event: 'player_hit',
      x: p.x, y: p.y,
      data: { playerId: p.id },
    });
  }
}

function _checkEnemyBulletHits(room) {
  const gs      = room.gameState;
  const players = room.players.filter(p => p.alive && p.connected && !p.invincible);

  for (const p of players) {
    _damagePlayer(p, room, false);
  }
}

function _checkAllDead(room) {
  const anyAlive = room.players.some(p => p.alive && p.connected);
  if (!anyAlive) {
    setTimeout(() => _endGame(room), 1500);
  }
}

// ============================================
//   WAVE SYSTEM
// ============================================

function _startNextWave(room) {
  const gs = room.gameState;
  gs.wave++;
  gs.enemies    = [];
  gs.bullets    = [];
  gs.drops      = [];
  gs.spawnTimer = 0;
  gs.allSpawned = false;
  gs.interlude  = 90;

  const playerCount = room.players.filter(p => p.connected).length;
  gs.spawnQueue = _buildWave(gs.wave, playerCount);
  gs.spawnQueue.sort((a, b) => a.delay - b.delay);

  // Reset player positions
  for (const p of room.players) {
    if (!p.alive || !p.connected) continue;
    p.x             = C.PLAYER_START_COLS[p.id];
    p.y             = C.PLAYER.START_ROW;
    p.invincible    = false;
    p.invTimer      = 0;
    p.rolling       = false;
    p.shootCooldown = 0;
  }

  RM.broadcast(room, { type: 'wave_start', wave: gs.wave });
  console.log(`[Game] Room ${room.code} — wave ${gs.wave} start`);
}

function _tickSpawner(room) {
  const gs = room.gameState;

  if (gs.interlude > 0) { gs.interlude--; return; }

  gs.spawnTimer++;

  if (!gs.allSpawned) {
    const playerCount = room.players.filter(p => p.connected).length;
    while (gs.spawnQueue.length > 0 &&
           gs.spawnQueue[0].delay <= gs.spawnTimer) {
      const s = gs.spawnQueue.shift();
      _spawnEnemy(gs, s.type, s.col, s.row, playerCount);
    }
    if (gs.spawnQueue.length === 0) gs.allSpawned = true;
  }
}

function _checkWaveComplete(room) {
  const gs = room.gameState;
  if (!gs.allSpawned) return;
  if (gs.enemies.length > 0) return;
  if (room.state !== 'PLAYING') return;

  // Award wave clear bonus to all living players
  for (const p of room.players) {
    if (!p.alive || !p.connected) continue;
    p.score += C.SCORE.WAVE_CLEAR_BONUS + (gs.wave - 1) * 100;
  }

  RM.broadcast(room, { type: 'event', event: 'wave_clear', x: 0, y: 0, data: {} });

  _openShop(room);
}

// ============================================
//   WAVE DEFINITIONS
// ============================================

function _buildWave(waveNum, playerCount) {
  const scale = 1 + (playerCount - 1) * C.MP_SCALE.COUNT_PER_PLAYER;

  const DEFS = [
    () => _line('A', 3, 1, 12, 60),
    () => _line('A', 4, 1, 10, 50),
    () => [..._line('A', 3, 1, 12, 50), ..._scatter('B', 1, 240)],
    () => [..._scatter('A', 3, 0),       ..._scatter('B', 2, 160)],
    () => [..._line('A', 4, 1, 9, 40),
            { type:'C', col: Math.floor(C.COLS/2), row:0, delay:100 }],
    () => [..._line('A', 4, 1, 9, 35),  ..._scatter('B', 3, 90),
            { type:'C', col:10, row:0, delay:180 },
            { type:'C', col:34, row:0, delay:180 }],
    () => [..._scatter('A', 5, 0),       ..._scatter('B', 2, 130),
            { type:'D', col: Math.floor(C.COLS/2), row:0, delay:70 }],
    () => [..._line('A', 3, 1, 10, 35),
            { type:'D', col:12, row:0, delay:50 },
            { type:'D', col:32, row:0, delay:50 },
            ..._scatter('B', 3, 180)],
    () => [{ type:'C', col:8,  row:0, delay:0   },
           { type:'C', col:20, row:0, delay:60  },
           { type:'C', col:32, row:0, delay:60  },
           { type:'C', col:42, row:0, delay:120 },
           ..._scatter('A', 5, 220)],
    () => [..._line('A', 5, 1, 8, 35),  ..._scatter('B', 4, 110),
           { type:'C', col:8,  row:0, delay:160 },
           { type:'C', col:36, row:0, delay:160 },
           { type:'D', col:14, row:0, delay:220 },
           { type:'D', col:30, row:0, delay:220 },
           ..._scatter('B', 3, 340),
           { type:'C', col: Math.floor(C.COLS/2), row:0, delay:400 }],
  ];

  const idx  = Math.min(waveNum - 1, DEFS.length - 1);
  let   base = idx < DEFS.length ? DEFS[idx]() : _procedural(waveNum);

  // Scale count for multiplayer
  if (playerCount > 1 && scale > 1) {
    const extra = Math.floor(base.length * (scale - 1));
    for (let i = 0; i < extra; i++) {
      const ref = base[Math.floor(Math.random() * base.length)];
      base.push({
        type:  ref.type,
        col:   2 + Math.floor(Math.random() * (C.COLS - 4)),
        row:   Math.floor(Math.random() * 3),
        delay: ref.delay + 20 + Math.floor(Math.random() * 60),
      });
    }
  }

  return base;
}

function _line(type, count, rowOffset, spacing, stagger, baseDelay = 0) {
  const list     = [];
  const totalW   = (count - 1) * spacing;
  const startCol = Math.floor((C.COLS - totalW) / 2);
  for (let i = 0; i < count; i++) {
    list.push({ type, col: startCol + i * spacing, row: rowOffset,
                delay: baseDelay + i * stagger });
  }
  return list;
}

function _scatter(type, count, baseDelay = 0) {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push({ type,
      col:   2 + Math.floor(Math.random() * (C.COLS - 4)),
      row:   Math.floor(Math.random() * 3),
      delay: baseDelay + i * 70,
    });
  }
  return list;
}

function _procedural(waveNum) {
  const list   = [];
  const budget = 4 + waveNum * 1.5;
  let   spent  = 0, delay = 0;
  const W = {
    A: Math.max(0.1, 0.5 - waveNum*0.02),
    B: Math.min(0.4, 0.2 + waveNum*0.015),
    C: Math.min(0.3, 0.05+ waveNum*0.015),
    D: Math.min(0.25,0.05+ waveNum*0.01),
  };
  const types = Object.keys(W);
  while (spent < budget) {
    const type = _wRand(W, types);
    const cost = type==='C'?2:type==='D'?1.5:1;
    if (spent + cost > budget + 1) break;
    list.push({ type,
      col:   2 + Math.floor(Math.random() * (C.COLS - 4)),
      row:   Math.floor(Math.random() * 3),
      delay,
    });
    delay += 40 + Math.floor(Math.random() * 40);
    spent += cost;
  }
  return list;
}

function _wRand(weights, keys) {
  const total = keys.reduce((s,k) => s+weights[k], 0);
  let r = Math.random() * total;
  for (const k of keys) { r -= weights[k]; if (r <= 0) return k; }
  return keys[keys.length-1];
}

// ============================================
//   SHOP
// ============================================

function _openShop(room) {
  room.state    = 'SHOP';
  room.shopReady= room.players.map(() => false);

  // Tell clients shop is open via next state broadcast
  // (roomState field will be SHOP)
}

function handleShopBuy(room, playerId, itemId) {
  if (room.state !== 'SHOP') return;

  const player = room.players[playerId];
  if (!player || !player.alive) return;

  const item = C.SHOP.ITEMS.find(i => i.id === itemId);
  if (!item) {
    RM.sendTo(player.ws, {
      type: 'shop_result', success: false, message: 'UNKNOWN_ITEM',
    });
    return;
  }

  const level = player.upgrades[itemId] || 0;
  if (level >= item.maxLevel) {
    RM.sendTo(player.ws, {
      type: 'shop_result', success: false, message: 'ALREADY MAXED',
    });
    return;
  }

  const cost = Math.floor(item.baseCost * Math.pow(C.SHOP.COST_SCALE, level));
  if (player.score < cost) {
    RM.sendTo(player.ws, {
      type: 'shop_result', success: false, message: 'INSUFFICIENT FUNDS',
    });
    return;
  }

  player.score          -= cost;
  player.upgrades[itemId] = level + 1;

  // Shield upgrade gives immediate shield
  if (itemId === 'shield') {
    player.shieldActive = true;
    player.shieldHits   = C.POWERUP.SHIELD_HITS;
  }

  RM.sendTo(player.ws, {
    type:     'shop_result',
    success:  true,
    itemId,
    newLevel: player.upgrades[itemId],
    newScore: player.score,
    message:  'UPGRADE INSTALLED',
  });
}

function handleShopReady(room, playerId) {
  if (room.state !== 'SHOP') return;
  room.shopReady[playerId] = true;

  // Check if all connected living players are ready
  const activePlayers = room.players.filter(p => p.connected && p.alive);
  const allReady = activePlayers.every(p => room.shopReady[p.id]);

  if (allReady) {
    room.state = 'PLAYING';
    _startNextWave(room);
  }
}

// ============================================
//   GAME OVER
// ============================================

function _endGame(room) {
  clearInterval(room.tickInterval);
  room.tickInterval = null;
  room.state        = 'GAME_OVER';

  const stats = room.players
    .filter(p => p.connected)
    .map(p => ({ id: p.id, score: p.score, kills: p.kills }));

  RM.broadcast(room, {
    type:  'game_over',
    wave:  room.gameState.wave,
    stats,
  });

  console.log(`[Game] Room ${room.code} — game over wave ${room.gameState.wave}`);
}

// ============================================
//   STATE BROADCAST
// ============================================

function _broadcastState(room) {
  const gs = room.gameState;

  const shopState = room.state === 'SHOP' ? {
    readyFlags: room.shopReady,
    players: room.players
      .filter(p => p.connected)
      .map(p => ({
        id:       p.id,
        score:    p.score,
        upgrades: p.upgrades,
      })),
  } : null;

  RM.broadcast(room, {
    type:      'state',
    frame:     gs.frame,
    wave:      gs.wave,
    roomState: room.state,
    players:   room.players.map(_serializePlayer),
    enemies:   gs.enemies.map(e => ({
      id: e.id, type: e.type,
      x: e.x, y: e.y,
      hp: e.hp, maxHp: e.maxHp,
      char: e.char,
      flashTimer: e.flashTimer,
    })),
    bullets:   gs.bullets.map(b => ({
      id: b.id, owner: b.owner,
      x: b.x, y: b.y,
      char: b.char, color: b.color,
    })),
    drops:     gs.drops.map(d => ({
      id: d.id, type: d.type,
      x: d.x, y: d.y,
      char: d.char, color: d.color,
      life: d.life,
    })),
    shopState,
  });
}

function _serializePlayer(p) {
  return {
    id:               p.id,
    x:                p.x,
    y:                p.y,
    lives:            p.lives,
    score:            p.score,
    kills:            p.kills,
    combo:            p.combo,
    alive:            p.alive,
    connected:        p.connected,
    rolling:          p.rolling,
    rollDir:          p.rollDir,
    invincible:       p.invincible,
    shieldActive:     p.shieldActive,
    shieldHits:       p.shieldHits,
    bombs:            p.bombs,
    rollCooldownFrac: p.rollCooldownFrac,
    effects:          p.effects,
    upgrades:         p.upgrades,
  };
}

module.exports = {
  startGame,
  handleShopBuy,
  handleShopReady,
};
