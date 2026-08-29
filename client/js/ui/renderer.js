// ============================================
//   VOID SECTOR — renderer.js (MULTIPLAYER)
//   All canvas drawing lives here.
//   Reads server state from gameState.
//   Draws up to 4 ships with distinct colors.
//   Never contains game logic.
// ============================================

const Renderer = (() => {

  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');

  canvas.width  = C.CANVAS_W;
  canvas.height = C.CANVAS_H;

  const CW = C.CHAR_W;
  const CH = C.CHAR_H;

  // ---------- Grid helpers ----------

  function _cx(col) { return col * CW; }
  function _cy(row) { return row * CH + CH * 0.8; }

  function _setFont(size = C.FONT_SIZE, bold = false) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${C.FONT_FAMILY}`;
  }

  function _drawChar(char, col, row, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    ctx.fillText(char, _cx(col), _cy(row));
    ctx.globalAlpha = 1;
  }

  function _drawText(text, x, y, color, alpha = 1, size = C.FONT_SIZE, bold = false) {
    _setFont(size, bold);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }

  function _drawTextCentered(text, y, color, alpha = 1, size = C.FONT_SIZE, bold = false) {
    _setFont(size, bold);
    const w = ctx.measureText(text).width;
    _drawText(text, (C.CANVAS_W - w) / 2, y, color, alpha, size, bold);
  }

  // ---------- Master draw ----------

  function draw(gameState) {
    const shake = Particles.getShakeOffset();
    ctx.save();
    ctx.translate(shake.x * CW * 0.5, shake.y * CH * 0.5);

    _clearScreen();
    _drawStarfield(gameState);

    switch (gameState.screen) {
      case 'LOBBY':    break; // Lobby draws itself on top
      case 'PLAYING':  _drawPlaying(gameState);  break;
      case 'SHOP':     _drawShop(gameState);     break;
      case 'GAMEOVER': _drawGameOver(gameState); break;
      case 'DYING':    _drawPlaying(gameState);  break;
    }

    ctx.restore();
    _drawFlash();

    // Reconnecting overlay — drawn outside shake
    if (gameState._reconnecting) {
      _drawReconnecting(gameState);
    }
  }

  // ---------- Clear ----------

  function _clearScreen() {
    ctx.fillStyle = C.COLOR.BG;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
  }

  // ---------- Starfield ----------

  const _stars = [];
  for (let i = 0; i < 55; i++) {
    _stars.push({
      x:      Math.random() * C.COLS,
      y:      Math.random() * C.ROWS,
      speed:  0.003 + Math.random() * 0.012,
      char:   Math.random() < 0.15 ? '+' : '.',
      bright: Math.random() < 0.2,
    });
  }

  function _drawStarfield(gameState) {
    _setFont(C.FONT_SIZE * 0.75);
    for (const s of _stars) {
      if (gameState.screen === 'PLAYING') {
        s.y += s.speed;
        if (s.y > C.ROWS) s.y = 0;
      }
      const alpha = s.bright ? 0.55 : 0.22;
      const color = s.bright ? C.COLOR.DIM : '#003810';
      _drawChar(s.char, s.x, s.y, color, alpha);
    }
    _setFont(C.FONT_SIZE);
  }

  // ---------- Flash overlay ----------

  function _drawFlash() {
    const f = Particles.getFlash();
    if (f.alpha <= 0) return;
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle   = f.color;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    ctx.globalAlpha = 1;
  }

  // ---------- Border ----------

  function _drawBorder() {
    ctx.strokeStyle = C.COLOR.DIM;
    ctx.lineWidth   = 1;
    ctx.globalAlpha = 0.4;
    ctx.strokeRect(1, 1, C.CANVAS_W - 2, C.CANVAS_H - 2);
    ctx.globalAlpha = 1;
  }

  // ============================================
  //   PLAYING SCREEN
  // ============================================

  function _drawPlaying(gameState) {
    _drawHUD(gameState);
    _drawBullets(gameState);
    _drawDrops(gameState);
    _drawEnemies(gameState);
    _drawPlayers(gameState);
    _drawParticles();
    _drawFloatTexts();
    _drawBorder();

    // Wave interlude banner — driven by server state flag
    if (gameState._showWaveBanner && gameState._waveBannerAlpha > 0) {
      _drawTextCentered(
        '-- WAVE ' + gameState.wave + ' --',
        C.CANVAS_H * 0.45,
        C.COLOR.PRIMARY, gameState._waveBannerAlpha, C.FONT_SIZE * 1.2, true
      );
    }
  }

  // ---------- HUD ----------

  function _drawHUD(gameState) {
    _setFont(C.FONT_SIZE * 0.82, true);

    const myPlayer = gameState.players.find(p => p.id === gameState.myId);
    if (!myPlayer) return;

    const y = CH * 0.95;

    // Lives — uses our ship color
    const myColor  = PLAYER_IDENTITY[gameState.myId]?.color || C.COLOR.PRIMARY;
    const livesStr = 'SHIP: ' + '^'.repeat(Math.max(0, myPlayer.lives));
    ctx.fillStyle   = myColor;
    ctx.globalAlpha = 0.9;
    ctx.fillText(livesStr, CW * 0.5, y);

    // Score — centered
    const scoreStr = _pad(myPlayer.score, 8);
    _drawTextCentered(scoreStr, y, myColor, 0.95, C.FONT_SIZE * 0.82, true);

    // Wave — right
    const waveStr = 'WAVE ' + _pad(gameState.wave, 2);
    _setFont(C.FONT_SIZE * 0.82, true);
    const ww = ctx.measureText(waveStr).width;
    ctx.fillStyle = C.COLOR.HUD;
    ctx.fillText(waveStr, C.CANVAS_W - ww - CW * 0.5, y);
    ctx.globalAlpha = 1;

    // Combo
    if (myPlayer.combo > 1) {
      _drawTextCentered(
        'x' + myPlayer.combo + ' COMBO',
        CH * 1.9, C.COLOR.ACCENT, 0.9, C.FONT_SIZE * 0.8, true
      );
    }

    // Bombs
    if ((myPlayer.bombs || 0) > 0) {
      ctx.fillStyle   = C.COLOR.WARN;
      ctx.globalAlpha = 0.85;
      _setFont(C.FONT_SIZE * 0.78);
      ctx.fillText('BOMB: ' + 'B'.repeat(myPlayer.bombs), CW * 0.5, CH * 1.9);
    }

    ctx.globalAlpha = 1;

    // Roll cooldown bar
    const rollFrac = myPlayer.rollCooldownFrac || 0;
    if (rollFrac > 0) {
      const barW = CW * 6;
      const barX = CW * 0.5;
      const barY = C.CANVAS_H - CH * 0.6;
      ctx.fillStyle   = C.COLOR.DIM;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(barX, barY, barW, 3);
      ctx.fillStyle   = myColor;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(barX, barY, barW * (1 - rollFrac), 3);
      ctx.globalAlpha = 1;
      _setFont(C.FONT_SIZE * 0.65);
      ctx.fillStyle   = C.COLOR.DIM;
      ctx.globalAlpha = 0.7;
      ctx.fillText('ROLL', barX, barY - 2);
      ctx.globalAlpha = 1;
    }

    // Powerup timers
    _drawPowerupTimers(myPlayer);

    // Other players' scores — small strip top right
    _drawOtherPlayerScores(gameState);
  }

  function _drawPowerupTimers(player) {
    if (!player.effects) return;
    _setFont(C.FONT_SIZE * 0.75);
    let col = C.CANVAS_W - CW * 8;
    const row = C.CANVAS_H - CH * 0.6;

    if (player.effects.rapid?.active) {
      const frac = player.effects.rapid.framesLeft / C.POWERUP.RAPID_DURATION;
      _drawTimerBar('RAPID', col, row, frac, C.COLOR.WARN);
      col -= CW * 8.5;
    }
    if (player.effects.spread?.active) {
      const frac = player.effects.spread.framesLeft / C.POWERUP.SPREAD_DURATION;
      _drawTimerBar('SPRD', col, row, frac, C.COLOR.ACCENT);
      col -= CW * 8.5;
    }
    if (player.shieldActive) {
      ctx.fillStyle   = C.COLOR.SHIELD;
      ctx.globalAlpha = 0.85;
      ctx.fillText('SHLD:' + (player.shieldHits || ''), col, row);
      ctx.globalAlpha = 1;
    }
  }

  function _drawTimerBar(label, x, y, frac, color) {
    const barW = CW * 5;
    ctx.fillStyle   = C.COLOR.DIM;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x, y, barW, 3);
    ctx.fillStyle   = color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, y, barW * frac, 3);
    ctx.globalAlpha = 0.7;
    ctx.fillText(label, x, y - 2);
    ctx.globalAlpha = 1;
  }

  function _drawOtherPlayerScores(gameState) {
    // Small scoreboard strip — all players, right side, below wave
    const others = gameState.players.filter(p => p.id !== gameState.myId);
    if (others.length === 0) return;

    _setFont(C.FONT_SIZE * 0.7);
    let y = CH * 2.2;
    const x = C.CANVAS_W - CW * 0.5;

    for (const p of others) {
      const color = PLAYER_IDENTITY[p.id]?.color || C.COLOR.DIM;
      const alpha = p.alive ? 0.7 : 0.25;
      const label = 'P' + (p.id + 1) + ' ' + _pad(p.score, 6);
      ctx.fillStyle   = color;
      ctx.globalAlpha = alpha;
      const w = ctx.measureText(label).width;
      ctx.fillText(label, x - w, y);
      ctx.globalAlpha = 1;
      y += CH * 1.1;
    }
  }

  // ---------- All players ----------

  function _drawPlayers(gameState) {
    _setFont(C.FONT_SIZE, true);

    for (const p of gameState.players) {
      if (!p.alive) continue;

      const identity = PLAYER_IDENTITY[p.id] || PLAYER_IDENTITY[0];
      const isMe     = p.id === gameState.myId;

      // Invincibility blink
      if (p.invincible && !p.rolling) {
        if (Math.floor(gameState.frame / 4) % 2 === 0) continue;
      }

      // Shield glow
      if (p.shieldActive) {
        const offsets = [[-1,0],[1,0],[0,-0.6],[0,0.6],
                         [-0.7,-0.4],[0.7,-0.4],[-0.7,0.4],[0.7,0.4]];
        for (const [ox, oy] of offsets) {
          _drawChar('·', p.x + ox, p.y + oy, C.COLOR.SHIELD, 0.5);
        }
      }

      // Roll afterimage
      if (p.rolling && p.rollDir) {
        _drawChar('^', p.x - p.rollDir * 0.8, p.y, C.COLOR.DIM, 0.25);
        _drawChar('^', p.x - p.rollDir * 1.6, p.y, C.COLOR.DIM, 0.10);
      }

      // Color shifts with active powerups
      let color = identity.color;
      if (p.effects?.spread?.active) color = C.COLOR.ACCENT;
      if (p.effects?.rapid?.active)  color = C.COLOR.WARN;

      // Slightly dim other players so local player pops
      const alpha = isMe ? 1.0 : 0.75;
      _drawChar('^', p.x, p.y, color, alpha);

      // Player label below ship — only for others
      if (!isMe) {
        _setFont(C.FONT_SIZE * 0.65);
        const label = 'P' + (p.id + 1);
        _drawChar(label, p.x - label.length * 0.3, p.y + 1.1, identity.color, 0.5);
        _setFont(C.FONT_SIZE, true);
      }
    }

    _setFont(C.FONT_SIZE);
  }

  // ---------- Enemies ----------

  function _drawEnemies(gameState) {
    for (const e of gameState.enemies) {
      const def   = C.ENEMY[e.type];
      if (!def) continue;

      const color = (e.flashTimer > 0 && Math.floor(e.flashTimer / 2) % 2 === 0)
        ? C.COLOR.WHITE
        : def.COLOR;

      _drawChar(e.char || def.CHAR, e.x, e.y, color, 0.95);

      // HP bar for tanks
      if (e.type === 'C' && e.hp < e.maxHp) {
        const barW = CW * 1.6;
        const barX = _cx(e.x) - barW / 2;
        const barY = _cy(e.y) - CH + 4;
        const frac = e.hp / e.maxHp;
        ctx.fillStyle   = '#330000';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(barX, barY, barW, 3);
        ctx.fillStyle   = C.COLOR.DANGER;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(barX, barY, barW * frac, 3);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------- Bullets ----------

  function _drawBullets(gameState) {
    for (const b of gameState.bullets) {
      _drawChar(b.char, b.x, b.y, b.color, 0.9);
    }
  }

  // ---------- Drops ----------

  function _drawDrops(gameState) {
    for (const d of gameState.drops) {
      const blink = d.life < 120 && Math.floor(d.life / 8) % 2 === 0;
      if (!blink) {
        _drawChar(d.char, d.x, d.y, d.color, 0.95);
      }
    }
  }

  // ---------- Particles ----------

  function _drawParticles() {
    for (const p of Particles.getParticles()) {
      _drawChar(p.char, p.x, p.y, p.color, p.alpha * 0.9);
    }
  }

  function _drawFloatTexts() {
    _setFont(C.FONT_SIZE * 0.8, true);
    for (const t of Particles.getFloatTexts()) {
      const alpha = t.life / t.maxLife;
      _drawChar(t.text, t.x - t.text.length * 0.3, t.y, t.color, alpha);
    }
    _setFont(C.FONT_SIZE);
  }

  // ============================================
  //   SHOP SCREEN
  // ============================================

  function _drawShop(gameState) {
    _drawBorder();
    const state    = Shop.getState();
    const myPlayer = gameState.players.find(p => p.id === gameState.myId);
    const credits  = myPlayer?.score || 0;

    // Header
    _drawTextCentered(
      '[ WAVE ' + state.wave + ' COMPLETE ]',
      CH * 1.5, C.COLOR.PRIMARY, 1, C.FONT_SIZE * 1.1, true
    );

    // Credits
    const selItem   = state.items[state.cursor];
    const canAfford = selItem?.cost !== null && credits >= (selItem?.cost || 0);
    const creditColor = canAfford ? C.COLOR.ACCENT : C.COLOR.WARN;
    _drawTextCentered('CREDITS', CH * 2.7, C.COLOR.DIM, 0.7, C.FONT_SIZE * 0.72);
    _drawTextCentered(credits + ' cr', CH * 3.7, creditColor, 1, C.FONT_SIZE * 1.3, true);

    // Divider
    _setFont(C.FONT_SIZE * 0.7);
    ctx.fillStyle   = C.COLOR.DIM;
    ctx.globalAlpha = 0.5;
    ctx.fillText('─'.repeat(Math.floor(C.COLS * 0.9)), CW * 0.5, CH * 4.7);
    ctx.globalAlpha = 1;

    _drawTextCentered('UPGRADES', CH * 5.5, C.COLOR.DIM, 0.7, C.FONT_SIZE * 0.8);

    // Items
    const startY = CH * 6.6;
    const lineH  = CH * 1.55;

    for (let i = 0; i < state.items.length; i++) {
      const item     = state.items[i];
      const selected = i === state.cursor;
      const y        = startY + i * lineH;

      if (selected) {
        ctx.fillStyle   = C.COLOR.PRIMARY;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(CW * 0.5, y - CH * 0.85, C.CANVAS_W - CW, CH * 1.1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.COLOR.PRIMARY;
        _setFont(C.FONT_SIZE * 0.7);
        ctx.fillText('>', CW * 0.8, y);
      }

      const labelColor = item.maxed ? C.COLOR.DIM : selected ? C.COLOR.PRIMARY : C.COLOR.WHITE;
      const labelAlpha = item.maxed ? 0.5 : selected ? 1 : 0.75;
      _setFont(C.FONT_SIZE * 0.9, selected);
      ctx.fillStyle   = labelColor;
      ctx.globalAlpha = labelAlpha;
      ctx.fillText(item.label, CW * 2, y);

      if (item.maxLevel !== null) {
        ctx.fillStyle   = C.COLOR.ACCENT;
        ctx.globalAlpha = 0.8;
        _setFont(C.FONT_SIZE * 0.75);
        ctx.fillText(_levelPips(item.level, item.maxLevel), CW * 20, y);
      }

      _setFont(C.FONT_SIZE * 0.82);
      if (item.id === 'leave') {
        ctx.fillStyle   = selected ? C.COLOR.ACCENT : C.COLOR.DIM;
        ctx.globalAlpha = selected ? 1 : 0.6;
        const lw = ctx.measureText('[ ENTER ]').width;
        ctx.fillText('[ ENTER ]', C.CANVAS_W - lw - CW, y);
      } else if (item.maxed) {
        ctx.fillStyle   = C.COLOR.DIM;
        ctx.globalAlpha = 0.5;
        const mw = ctx.measureText('MAXED').width;
        ctx.fillText('MAXED', C.CANVAS_W - mw - CW, y);
      } else {
        ctx.fillStyle   = credits >= item.cost ? C.COLOR.ACCENT : C.COLOR.DANGER;
        ctx.globalAlpha = 0.9;
        const costStr = item.cost + 'cr';
        const cw2     = ctx.measureText(costStr).width;
        ctx.fillText(costStr, C.CANVAS_W - cw2 - CW, y);
      }
      ctx.globalAlpha = 1;
    }

    // Selected item description
    if (selItem?.desc) {
      _drawTextCentered(selItem.desc, C.CANVAS_H - CH * 3.8,
        C.COLOR.DIM, 0.7, C.FONT_SIZE * 0.78);
    }

    // Feedback message
    if (state.message) {
      const fade = Math.min(1, state.messageTimer / 20);
      _drawTextCentered(state.message, C.CANVAS_H - CH * 2.8,
        C.COLOR.WARN, fade, C.FONT_SIZE * 0.85, true);
    }

    // Ready flags — who has pressed LAUNCH
    if (gameState.shopState) {
      _drawReadyFlags(gameState);
    }
  }

  function _drawReadyFlags(gameState) {
    const flags   = gameState.shopState.readyFlags || [];
    const y       = C.CANVAS_H - CH * 1.4;
    const slotW   = C.CANVAS_W / 5;

    _setFont(C.FONT_SIZE * 0.72);
    for (let i = 0; i < 4; i++) {
      if (!gameState.players.find(p => p.id === i)) continue;
      const ready   = flags[i];
      const color   = PLAYER_IDENTITY[i]?.color || C.COLOR.DIM;
      const label   = ready ? 'P' + (i+1) + ' READY' : 'P' + (i+1) + ' ...';
      const alpha   = ready ? 1 : 0.35;
      const x       = slotW + i * slotW;
      ctx.fillStyle   = color;
      ctx.globalAlpha = alpha;
      const w = ctx.measureText(label).width;
      ctx.fillText(label, x - w / 2, y);
      ctx.globalAlpha = 1;
    }
  }

  function _levelPips(level, max) {
    return '■'.repeat(level) + '□'.repeat(max - level);
  }

  // ============================================
  //   GAME OVER SCREEN
  // ============================================

  function _drawGameOver(gameState) {
    _drawBorder();

    _drawTextCentered('[ GAME OVER ]', C.CANVAS_H * 0.18,
      C.COLOR.DANGER, 1, C.FONT_SIZE * 1.4, true);

    _drawTextCentered('WAVE ' + (gameState.finalStats?.wave || gameState.wave),
      C.CANVAS_H * 0.3, C.COLOR.DIM, 0.8, C.FONT_SIZE * 0.9);

    // Per-player score table
    const stats   = gameState.finalStats?.stats || [];
    const startY  = C.CANVAS_H * 0.39;
    const lineH   = CH * 2.0;

    _setFont(C.FONT_SIZE * 0.78, true);
    ctx.fillStyle   = C.COLOR.DIM;
    ctx.globalAlpha = 0.5;
    ctx.fillText('PLAYER', CW * 3, startY);
    ctx.fillText('SCORE',  CW * 16, startY);
    ctx.fillText('KILLS',  CW * 28, startY);
    ctx.globalAlpha = 1;

    // Sort by score descending
    const sorted = [...stats].sort((a, b) => b.score - a.score);

    for (let i = 0; i < sorted.length; i++) {
      const s      = sorted[i];
      const y      = startY + (i + 1) * lineH;
      const color  = PLAYER_IDENTITY[s.id]?.color || C.COLOR.PRIMARY;
      const isMe   = s.id === gameState.myId;
      const prefix = i === 0 ? '# ' : '  ';

      _setFont(C.FONT_SIZE * 0.88, isMe);
      ctx.fillStyle   = color;
      ctx.globalAlpha = isMe ? 1 : 0.7;

      ctx.fillText(prefix + 'P' + (s.id + 1) + (isMe ? ' (YOU)' : ''), CW * 3, y);
      ctx.fillText(_pad(s.score, 7), CW * 16, y);
      ctx.fillText(_pad(s.kills, 5), CW * 28, y);
      ctx.globalAlpha = 1;
    }

    // New high score
    if (gameState.newHighScore) {
      const blink = Math.floor(gameState.frame / 20) % 2 === 0;
      if (blink) {
        _drawTextCentered('*** NEW HIGH SCORE ***',
          C.CANVAS_H * 0.76, C.COLOR.ACCENT, 1, C.FONT_SIZE * 0.9, true);
      }
    }

    // Restart prompt
    const blink2 = Math.floor(gameState.frame / 35) % 2 === 0;
    if (blink2) {
      _drawTextCentered('[ PRESS SPACE TO RETURN TO LOBBY ]',
        C.CANVAS_H * 0.86, C.COLOR.PRIMARY, 0.85);
    }
  }

  // ============================================
  //   RECONNECTING OVERLAY
  // ============================================

  function _drawReconnecting(gameState) {
    ctx.fillStyle   = '#000';
    ctx.globalAlpha = 0.72;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    ctx.globalAlpha = 1;

    const dots = '.'.repeat(Math.floor(Date.now() / 400) % 4);
    _drawTextCentered('CONNECTION LOST', C.CANVAS_H * 0.42,
      C.COLOR.DANGER, 1, C.FONT_SIZE * 1.05, true);
    _drawTextCentered('RECONNECTING' + dots, C.CANVAS_H * 0.55,
      C.COLOR.WARN, 0.85, C.FONT_SIZE * 0.85);
  }

  // ---------- Helpers ----------

  function _pad(n, len) {
    return String(Math.floor(n || 0)).padStart(len, '0');
  }

  return { draw };

})();
