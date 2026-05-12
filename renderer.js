// ============================================
//   VOID SECTOR — renderer.js
//   All canvas drawing lives here.
//   No game logic. Reads state, draws pixels.
//   Called once per frame by main.js.
// ============================================

const Renderer = (() => {

  // ---------- Canvas setup ----------
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  canvas.width = C.CANVAS_W;
  canvas.height = C.CANVAS_H;

  const CW = C.CHAR_W;   // Pixel width of one grid cell
  const CH = C.CHAR_H;   // Pixel height of one grid cell

  // ---------- Utility ----------

  function _cx(col) { return col * CW; }          // Grid col → pixel x
  function _cy(row) { return row * CH + CH * 0.8; } // Grid row → pixel y (baseline)

  function _setFont(size = C.FONT_SIZE, bold = false) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${C.FONT_FAMILY}`;
  }

  function _drawChar(char, col, row, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillText(char, _cx(col), _cy(row));
    ctx.globalAlpha = 1;
  }

  function _drawText(text, x, y, color, alpha = 1, size = C.FONT_SIZE, bold = false) {
    _setFont(size, bold);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
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
    // Apply screen shake offset
    const shake = Particles.getShakeOffset();
    ctx.save();
    ctx.translate(shake.x * CW * 0.5, shake.y * CH * 0.5);

    _clearScreen();
    _drawStarfield(gameState);

    switch (gameState.screen) {
      case 'MENU': _drawMenu(gameState); break;
      case 'PLAYING': _drawPlaying(gameState); break;
      case 'SHOP': _drawShop(gameState); break;
      case 'GAMEOVER': _drawGameOver(gameState); break;
    }

    ctx.restore();

    // Flash overlay drawn OUTSIDE shake transform
    _drawFlash();
  }

  // ---------- Clear ----------

  function _clearScreen() {
    ctx.fillStyle = C.COLOR.BG;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
  }

  // ---------- Starfield ----------
  // Pre-generated star positions, drawn every frame.
  // Stars scroll slowly downward for parallax feel.

  const _stars = [];
  for (let i = 0; i < 55; i++) {
    _stars.push({
      x: Math.random() * C.COLS,
      y: Math.random() * C.ROWS,
      speed: 0.003 + Math.random() * 0.012,
      char: Math.random() < 0.15 ? '+' : '.',
      bright: Math.random() < 0.2,
    });
  }

  function _drawStarfield(gameState) {
    _setFont(C.FONT_SIZE * 0.75);
    for (const s of _stars) {
      if (gameState.screen === 'PLAYING' || gameState.screen === 'MENU') {
        s.y += s.speed;
        if (s.y > C.ROWS) s.y = 0;
      }
      const alpha = s.bright ? 0.55 : 0.22;
      const color = s.bright ? C.COLOR.DIM : '#003810';
      _drawChar(s.char, s.x, s.y, color, alpha);
    }
    _setFont(C.FONT_SIZE); // Reset
  }

  // ---------- Flash overlay ----------

  function _drawFlash() {
    const f = Particles.getFlash();
    if (f.alpha <= 0) return;
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.color;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    ctx.globalAlpha = 1;
  }

  // ---------- Border ----------

  function _drawBorder() {
    ctx.strokeStyle = C.COLOR.DIM;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.strokeRect(1, 1, C.CANVAS_W - 2, C.CANVAS_H - 2);
    ctx.globalAlpha = 1;
  }

  // ============================================
  //   MENU SCREEN
  // ============================================

  function _drawMenu(gameState) {
    _drawBorder();
    _setFont(C.FONT_SIZE, true);

    // Title — big, glowing
    const titleY = C.CANVAS_H * 0.22;
    _drawTextCentered('[ VOID SECTOR ]', titleY, C.COLOR.PRIMARY, 1, C.FONT_SIZE * 1.6, true);

    // Subtitle
    _drawTextCentered('ASCII SPACE SHOOTER', titleY + CH * 2.2, C.COLOR.DIM, 0.8, C.FONT_SIZE * 0.85);

    // Blinking prompt
    const blink = Math.floor(gameState.frame / 30) % 2 === 0;
    if (blink) {
      _drawTextCentered('[ PRESS SPACE TO START ]', C.CANVAS_H * 0.55, C.COLOR.ACCENT, 1, C.FONT_SIZE);
    }

    // Controls
    const cx = C.CANVAS_W * 0.18;
    const cy = C.CANVAS_H * 0.68;
    const lineH = CH * 1.4;
    _setFont(C.FONT_SIZE * 0.82);
    ctx.fillStyle = C.COLOR.DIM;
    ctx.globalAlpha = 0.85;
    const controls = [
      'ARROW KEYS / WASD  MOVE',
      'SPACE / Z          SHOOT',
      'SHIFT / X          DODGE ROLL',
      'B                  BOMB',
    ];
    for (let i = 0; i < controls.length; i++) {
      ctx.fillText(controls[i], cx, cy + i * lineH);
    }
    ctx.globalAlpha = 1;

    // High score
    const save = Save.load();
    if (save.highScore > 0) {
      _drawTextCentered(
        `HI-SCORE  ${_pad(save.highScore, 8)}`,
        C.CANVAS_H * 0.88,
        C.COLOR.ACCENT, 0.9, C.FONT_SIZE * 0.9
      );
    }

    // Version
    _setFont(C.FONT_SIZE * 0.7);
    ctx.fillStyle = C.COLOR.DIM;
    ctx.globalAlpha = 0.4;
    ctx.fillText('v1.0', 6, C.CANVAS_H - 6);
    ctx.globalAlpha = 1;
  }

  // ============================================
  //   PLAYING SCREEN
  // ============================================

  function _drawPlaying(gameState) {
    _drawHUD(gameState);
    _drawPowerupTimers(gameState);
    _drawBullets();
    _drawPowerupDrops();
    _drawEnemies();
    _drawPlayer(gameState);
    _drawParticles();
    _drawFloatTexts();
    _drawBorder();

    // Wave interlude banner
    if (Waves.isInInterlude()) {
      const frac = Waves.getInterludeFrac();
      const alpha = Math.min(1, frac * 3);
      _drawTextCentered(
        `-- WAVE ${Waves.getWave()} --`,
        C.CANVAS_H * 0.45,
        C.COLOR.PRIMARY, alpha, C.FONT_SIZE * 1.2, true
      );
    }
  }

  // ---------- HUD ----------

  function _drawHUD(gameState) {
    _setFont(C.FONT_SIZE * 0.88, true);
    const y = CH * 0.95;

    // Lives
    const livesStr = 'SHIP: ' + '^'.repeat(Math.max(0, Player.getLives()));
    ctx.fillStyle = C.COLOR.HUD;
    ctx.globalAlpha = 0.9;
    ctx.fillText(livesStr, CW * 0.5, y);

    // Score
    const scoreStr = _pad(Player.getScore(), 8);
    _drawTextCentered(scoreStr, y, C.COLOR.PRIMARY, 0.95, C.FONT_SIZE * 0.88, true);

    // Wave
    const waveStr = `WAVE ${_pad(Waves.getWave(), 2)}`;
    _setFont(C.FONT_SIZE * 0.88, true);
    const ww = ctx.measureText(waveStr).width;
    ctx.fillStyle = C.COLOR.HUD;
    ctx.fillText(waveStr, C.CANVAS_W - ww - CW * 0.5, y);

    // Combo (if active)
    if (Player.getCombo() > 1) {
      const comboStr = `x${Player.getCombo()} COMBO`;
      _drawTextCentered(
        comboStr,
        CH * 1.9,
        C.COLOR.ACCENT, 0.9, C.FONT_SIZE * 0.8, true
      );
    }

    // Bombs
    const bombs = Powerups.getBombCount();
    if (bombs > 0) {
      const bombStr = 'BOMB: ' + 'B'.repeat(bombs);
      ctx.fillStyle = C.COLOR.WARN;
      ctx.globalAlpha = 0.85;
      _setFont(C.FONT_SIZE * 0.8);
      ctx.fillText(bombStr, CW * 0.5, CH * 1.9);
    }

    ctx.globalAlpha = 1;

    // Roll cooldown bar (bottom-left)
    const rollFrac = Player.getRollCooldownFrac();
    if (rollFrac > 0) {
      const barW = CW * 6;
      const barX = CW * 0.5;
      const barY = C.CANVAS_H - CH * 0.6;
      const barH = 3;
      ctx.fillStyle = C.COLOR.DIM;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = C.COLOR.PRIMARY;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(barX, barY, barW * (1 - rollFrac), barH);
      ctx.globalAlpha = 1;

      _setFont(C.FONT_SIZE * 0.65);
      ctx.fillStyle = C.COLOR.DIM;
      ctx.globalAlpha = 0.7;
      ctx.fillText('ROLL', barX, barY - 2);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- Powerup timers ----------

  function _drawPowerupTimers(gameState) {
    _setFont(C.FONT_SIZE * 0.75);
    let col = C.CANVAS_W - CW * 8;
    const row = C.CANVAS_H - CH * 0.6;

    if (Powerups.isRapid()) {
      const frac = Powerups.getRapidFramesLeft() / C.POWERUP.RAPID_DURATION;
      _drawTimerBar('RAPID', col, row, frac, C.COLOR.WARN);
      col -= CW * 8.5;
    }
    if (Powerups.isSpread()) {
      const frac = Powerups.getSpreadFramesLeft() / C.POWERUP.SPREAD_DURATION;
      _drawTimerBar('SPRD', col, row, frac, C.COLOR.ACCENT);
      col -= CW * 8.5;
    }
    if (Powerups.isShield()) {
      const hits = Powerups.getShieldHitsLeft();
      const label = `SHLD:${hits}`;
      ctx.fillStyle = C.COLOR.SHIELD;
      ctx.globalAlpha = 0.85;
      ctx.fillText(label, col, row);
      ctx.globalAlpha = 1;
    }
  }

  function _drawTimerBar(label, x, y, frac, color) {
    const barW = CW * 5;
    ctx.fillStyle = C.COLOR.DIM;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x, y, barW, 3);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, y, barW * frac, 3);
    ctx.globalAlpha = 0.7;
    ctx.fillText(label, x, y - 2);
    ctx.globalAlpha = 1;
  }

  // ---------- Player ----------

  function _drawPlayer(gameState) {
    if (Player.isDead()) return;

    const px = Player.getX();
    const py = Player.getY();

    // Invincibility blink (every 4 frames)
    if (Player.isInvincible() && !Player.isRolling()) {
      if (Math.floor(gameState.frame / 4) % 2 === 0) return;
    }

    // Shield glow — draw a ring of dots around player
    if (Powerups.isShield()) {
      const offsets = [[-1, 0], [1, 0], [0, -0.6], [0, 0.6], [-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]];
      for (const [ox, oy] of offsets) {
        _drawChar('·', px + ox, py + oy, C.COLOR.SHIELD, 0.55);
      }
    }

    // Roll streak — draw afterimage behind player
    if (Player.isRolling()) {
      const rd = Player.getRollDir();
      _drawChar(C.PLAYER.CHAR, px - rd * 0.8, py, C.COLOR.DIM, 0.3);
      _drawChar(C.PLAYER.CHAR, px - rd * 1.6, py, C.COLOR.DIM, 0.12);
    }

    // Player char — bright during spread, accent during rapid
    let playerColor = C.COLOR.PRIMARY;
    if (Powerups.isSpread()) playerColor = C.COLOR.ACCENT;
    if (Powerups.isRapid()) playerColor = C.COLOR.WARN;

    _setFont(C.FONT_SIZE, true);
    _drawChar(C.PLAYER.CHAR, px, py, playerColor, 1);
    _setFont(C.FONT_SIZE);
  }

  // ---------- Enemies ----------

  function _drawEnemies() {
    for (const e of Enemies.getActive()) {
      // Hit flash — alternate between white and normal color
      const color = (e.flashTimer > 0 && Math.floor(e.flashTimer / 2) % 2 === 0)
        ? C.COLOR.WHITE
        : e.color;

      _drawChar(e.char, e.x, e.y, color, 0.95);

      // HP bar for tanks (only if damaged)
      if (e.type === 'C' && e.hp < e.maxHp) {
        const barW = CW * 1.6;
        const barX = _cx(e.x) - barW / 2;
        const barY = _cy(e.y) - CH + 4;
        const frac = e.hp / e.maxHp;
        ctx.fillStyle = '#330000';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(barX, barY, barW, 3);
        ctx.fillStyle = C.COLOR.DANGER;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(barX, barY, barW * frac, 3);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------- Bullets ----------

  function _drawBullets() {
    for (const b of Bullets.getActive()) {
      _drawChar(b.char, b.x, b.y, b.color, 0.9);
    }
  }

  // ---------- Powerup drops ----------

  function _drawPowerupDrops() {
    // Blink when close to expiring
    for (const d of Powerups.getDrops()) {
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

  // ---------- Float texts ----------

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
    const state = Shop.getState();

    // Header
    _drawTextCentered(
      `[ WAVE ${state.wave} COMPLETE ]`,
      CH * 1.5, C.COLOR.PRIMARY, 1, C.FONT_SIZE * 1.1, true
    );
    _drawTextCentered(
      `SCORE  ${_pad(Player.getScore(), 8)}`,
      CH * 2.9, C.COLOR.ACCENT, 0.85, C.FONT_SIZE * 0.85
    );

    // Divider
    _setFont(C.FONT_SIZE * 0.7);
    ctx.fillStyle = C.COLOR.DIM;
    ctx.globalAlpha = 0.5;
    ctx.fillText('─'.repeat(Math.floor(C.COLS * 0.9)), CW * 0.5, CH * 3.7);
    ctx.globalAlpha = 1;

    // Upgrade heading
    _drawTextCentered('UPGRADES', CH * 4.6, C.COLOR.DIM, 0.7, C.FONT_SIZE * 0.8);

    // Items
    const startY = CH * 5.8;
    const lineH = CH * 1.55;

    for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i];
      const selected = i === state.cursor;
      const y = startY + i * lineH;

      // Cursor
      if (selected) {
        ctx.fillStyle = C.COLOR.PRIMARY;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(CW * 0.5, y - CH * 0.85, C.CANVAS_W - CW, CH * 1.1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.COLOR.PRIMARY;
        ctx.fillText('>', CW * 0.8, y);
      }

      // Item label
      const labelColor = item.maxed
        ? C.COLOR.DIM
        : selected ? C.COLOR.PRIMARY : C.COLOR.WHITE;
      const labelAlpha = item.maxed ? 0.5 : selected ? 1 : 0.75;

      _setFont(C.FONT_SIZE * 0.9, selected);
      ctx.fillStyle = labelColor;
      ctx.globalAlpha = labelAlpha;
      ctx.fillText(item.label, CW * 2, y);

      // Level pips  ■■■□□
      if (item.maxLevel !== null) {
        const pipStr = _levelPips(item.level, item.maxLevel);
        ctx.fillStyle = C.COLOR.ACCENT;
        ctx.globalAlpha = 0.8;
        _setFont(C.FONT_SIZE * 0.75);
        ctx.fillText(pipStr, CW * 20, y);
      }

      // Cost or status
      _setFont(C.FONT_SIZE * 0.82, false);
      if (item.id === 'leave') {
        ctx.fillStyle = selected ? C.COLOR.ACCENT : C.COLOR.DIM;
        ctx.globalAlpha = selected ? 1 : 0.6;
        const lw = ctx.measureText('[ ENTER ]').width;
        ctx.fillText('[ ENTER ]', C.CANVAS_W - lw - CW, y);
      } else if (item.maxed) {
        ctx.fillStyle = C.COLOR.DIM;
        ctx.globalAlpha = 0.5;
        const mw = ctx.measureText('MAXED').width;
        ctx.fillText('MAXED', C.CANVAS_W - mw - CW, y);
      } else {
        ctx.fillStyle = Player.getScore() >= item.cost ? C.COLOR.ACCENT : C.COLOR.DANGER;
        ctx.globalAlpha = 0.9;
        const costStr = `${item.cost}cr`;
        const cw2 = ctx.measureText(costStr).width;
        ctx.fillText(costStr, C.CANVAS_W - cw2 - CW, y);
      }

      ctx.globalAlpha = 1;
    }

    // Description of selected item
    const sel = state.items[state.cursor];
    if (sel && sel.desc) {
      _setFont(C.FONT_SIZE * 0.78);
      ctx.fillStyle = C.COLOR.DIM;
      ctx.globalAlpha = 0.7;
      _drawTextCentered(sel.desc, C.CANVAS_H - CH * 2.8, C.COLOR.DIM, 0.7, C.FONT_SIZE * 0.78);
    }

    // Feedback message
    if (state.message) {
      const fade = Math.min(1, state.messageTimer / 20);
      _drawTextCentered(state.message, C.CANVAS_H - CH * 1.5, C.COLOR.WARN, fade, C.FONT_SIZE * 0.85, true);
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

    const cx = C.CANVAS_H * 0.3;
    _drawTextCentered('[ GAME OVER ]', cx, C.COLOR.DANGER, 1, C.FONT_SIZE * 1.4, true);

    const stats = gameState.finalStats || {};
    const lineH = CH * 1.6;
    const sy = C.CANVAS_H * 0.45;

    _setFont(C.FONT_SIZE * 0.9);
    const lines = [
      [`SCORE`, _pad(stats.score || 0, 8)],
      [`WAVE`, _pad(stats.wave || 0, 8)],
      [`KILLS`, _pad(stats.kills || 0, 8)],
    ];
    for (let i = 0; i < lines.length; i++) {
      const [label, val] = lines[i];
      const y = sy + i * lineH;
      ctx.fillStyle = C.COLOR.DIM;
      ctx.globalAlpha = 0.75;
      ctx.fillText(label, CW * 8, y);
      ctx.fillStyle = C.COLOR.PRIMARY;
      ctx.globalAlpha = 0.95;
      const vw = ctx.measureText(val).width;
      ctx.fillText(val, C.CANVAS_W - CW * 8 - vw, y);
      ctx.globalAlpha = 1;
    }

    // New high score
    if (gameState.newHighScore) {
      const blink = Math.floor(gameState.frame / 20) % 2 === 0;
      if (blink) {
        _drawTextCentered('*** NEW HIGH SCORE ***', sy + lineH * 3.5, C.COLOR.ACCENT, 1, C.FONT_SIZE * 0.95, true);
      }
    }

    // Restart prompt
    const blink2 = Math.floor(gameState.frame / 35) % 2 === 0;
    if (blink2) {
      _drawTextCentered('[ PRESS SPACE TO PLAY AGAIN ]', C.CANVAS_H * 0.82, C.COLOR.PRIMARY, 0.85);
    }
  }

  // ---------- Helpers ----------

  function _pad(n, len) {
    return String(Math.floor(n)).padStart(len, '0');
  }

  return { draw };

})();
