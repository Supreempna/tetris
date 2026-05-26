(function() {
  // ── Constants ──────────────────────────────
  const COLS = 10, ROWS = 20, CELL = 30;
  const BOARD_W = COLS * CELL, BOARD_H = ROWS * CELL;
  const PREVIEW_SIZE = 120;

  const COLORS = {
    I: '#00e5ff',
    O: '#ffd600',
    T: '#d500f9',
    S: '#00e676',
    Z: '#ff1744',
    J: '#2979ff',
    L: '#ff9100'
  };

  // Tetromino shapes (0/1 matrices, initial rotation)
  const SHAPES = {
    I: [
      [0,0,0,0],
      [1,1,1,1],
      [0,0,0,0],
      [0,0,0,0]
    ],
    O: [
      [1,1],
      [1,1]
    ],
    T: [
      [0,1,0],
      [1,1,1],
      [0,0,0]
    ],
    S: [
      [0,1,1],
      [1,1,0],
      [0,0,0]
    ],
    Z: [
      [1,1,0],
      [0,1,1],
      [0,0,0]
    ],
    J: [
      [1,0,0],
      [1,1,1],
      [0,0,0]
    ],
    L: [
      [0,0,1],
      [1,1,1],
      [0,0,0]
    ]
  };

  const PIECE_TYPES = ['I','O','T','S','Z','J','L'];

  const LINE_SCORES = [0, 100, 300, 500, 800];

  // ── DOM ─────────────────────────────────────
  const boardCanvas = document.getElementById('boardCanvas');
  const boardCtx = boardCanvas.getContext('2d');
  boardCanvas.width = BOARD_W;
  boardCanvas.height = BOARD_H;

  const previewCanvas = document.getElementById('previewCanvas');
  const previewCtx = previewCanvas.getContext('2d');
  previewCanvas.width = PREVIEW_SIZE;
  previewCanvas.height = PREVIEW_SIZE;

  const scoreEl = document.getElementById('scoreVal');
  const levelEl = document.getElementById('levelVal');
  const linesEl = document.getElementById('linesVal');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const finalScoreEl = document.getElementById('finalScore');
  const controlsHint = document.getElementById('controlsHint');
  const controlsBar = document.getElementById('controlsBar');

  // ── State ───────────────────────────────────
  let board = [];
  let currentType = null;
  let currentShape = null;
  let currentX = 0, currentY = 0;
  let nextType = null;
  let score = 0, level = 1, lines = 0;
  let gameOver = false, paused = false;
  let dropTimer = 0;
  let bag = [];
  let clearingRows = [];
  let clearFlashTimer = 0;
  let clearMemeText = '';
  let lastTime = 0;
  let keyState = {};
  let dasTimer = {}; // Delayed Auto Shift

  // DAS settings
  const DAS_DELAY = 170;    // ms before auto-repeat starts
  const DAS_RATE = 50;      // ms between auto-repeat moves

  // ── Bag Randomizer ──────────────────────────
  function refillBag() {
    bag = [...PIECE_TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }

  function nextFromBag() {
    if (bag.length === 0) refillBag();
    return bag.pop();
  }

  // ── Rotation ────────────────────────────────
  function rotateCW(matrix) {
    const N = matrix.length;
    const r = Array.from({length: N}, () => Array(N).fill(0));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        r[x][N - 1 - y] = matrix[y][x];
      }
    }
    return r;
  }

  // ── Board ───────────────────────────────────
  function initBoard() {
    board = Array.from({length: ROWS}, () => Array(COLS).fill(null));
  }

  // ── Collision ───────────────────────────────
  function collision(shape, px, py) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const bx = px + c;
        const by = py + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx] !== null) return true;
      }
    }
    return false;
  }

  // ── Piece Spawning ──────────────────────────
  function spawnPiece() {
    currentType = nextType || nextFromBag();
    nextType = nextFromBag();
    currentShape = SHAPES[currentType];
    currentX = Math.floor((COLS - currentShape[0].length) / 2);
    currentY = -1;

    if (collision(currentShape, currentX, currentY)) {
      triggerGameOver();
      return false;
    }
    return true;
  }

  // ── Lock Piece ──────────────────────────────
  function lockPiece() {
    for (let r = 0; r < currentShape.length; r++) {
      for (let c = 0; c < currentShape[r].length; c++) {
        if (!currentShape[r][c]) continue;
        const by = currentY + r;
        const bx = currentX + c;
        if (by < 0) {
          triggerGameOver();
          return;
        }
        board[by][bx] = COLORS[currentType];
      }
    }
    checkLines();
  }

  // ── Line Clearing ───────────────────────────
  function checkLines() {
    clearingRows = [];
    for (let r = 0; r < ROWS; r++) {
      if (board[r].every(c => c !== null)) {
        clearingRows.push(r);
      }
    }
    if (clearingRows.length > 0) {
      clearFlashTimer = 500;
      const memes = ['萝卜', '纸巾', '真棒'];
      clearMemeText = memes[Math.floor(Math.random() * memes.length)];
    } else {
      if (!spawnPiece()) return;
      dropTimer = 0;
    }
  }

  function finishClearLines() {
    const count = clearingRows.length;
    clearingRows.sort((a, b) => b - a);
    for (const row of clearingRows) {
      board.splice(row, 1);
      board.unshift(Array(COLS).fill(null));
    }
    lines += count;
    score += LINE_SCORES[count] * level;
    level = Math.floor(lines / 10) + 1;
    updateUI();
    clearMemeText = '';
    clearingRows = [];
    if (!spawnPiece()) return;
    dropTimer = 0;
  }

  // ── Ghost Y ─────────────────────────────────
  function getGhostY() {
    let gy = currentY;
    while (!collision(currentShape, currentX, gy + 1)) {
      gy++;
    }
    return gy;
  }

  // ── Movement ────────────────────────────────
  function movePiece(dx, dy) {
    if (!collision(currentShape, currentX + dx, currentY + dy)) {
      currentX += dx;
      currentY += dy;
    }
  }

  function tryRotate() {
    const newShape = rotateCW(currentShape);
    const kicks = [0, -1, 1, -2, 2];
    for (const dx of kicks) {
      if (!collision(newShape, currentX + dx, currentY)) {
        currentShape = newShape;
        currentX += dx;
        return;
      }
    }
  }

  function hardDrop() {
    let dropped = 0;
    while (!collision(currentShape, currentX, currentY + 1)) {
      currentY++;
      dropped++;
    }
    score += dropped * 2;
    lockPiece();
    updateUI();
    dropTimer = 0;
  }

  function softDrop() {
    if (!collision(currentShape, currentX, currentY + 1)) {
      currentY++;
      score += 1;
      updateUI();
      dropTimer = 0;
    }
  }

  // ── Game State ──────────────────────────────
  function triggerGameOver() {
    gameOver = true;
    finalScoreEl.textContent = '最终得分: ' + score;
    gameOverOverlay.classList.remove('hidden');
  }

  function restart() {
    initBoard();
    bag = [];
    nextType = null;
    currentType = null;
    currentShape = null;
    score = 0;
    level = 1;
    lines = 0;
    gameOver = false;
    paused = false;
    clearingRows = [];
    clearFlashTimer = 0;
    clearMemeText = '';
    dropTimer = 0;
    lastTime = 0;
    keyState = {};
    dasTimer = {};
    gameOverOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    updateUI();
    nextType = nextFromBag();
    spawnPiece();
  }

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    if (paused) {
      pauseOverlay.classList.remove('hidden');
    } else {
      pauseOverlay.classList.add('hidden');
      lastTime = 0;
    }
  }

  function updateUI() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = lines;
  }

  function getDropInterval() {
    return Math.max(50, 800 - (level - 1) * 70);
  }

  // ── Drawing ─────────────────────────────────

  // Draw classic meme Doge face + random text for line-clear effect
  function drawMemeDoge(ctx, alpha) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;

    const cx = BOARD_W / 2;
    const cy = 160;
    const s = 0.72;
    const now = Date.now();

    const E = (x, y, rx, ry, rot) => {
      ctx.beginPath();
      ctx.ellipse(cx + x*s, cy + y*s, rx*s, ry*s, rot || 0, 0, Math.PI*2);
      ctx.fill();
    };
    const C = (x, y, r) => { ctx.beginPath(); ctx.arc(cx + x*s, cy + y*s, r*s, 0, Math.PI*2); ctx.fill(); };

    // ── Drop shadow ──
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    E(5, 7, 50, 46);

    // ── Ears ──
    // Left ear
    ctx.fillStyle = '#D49B4A';
    ctx.beginPath();
    ctx.moveTo(cx - 38*s, cy - 20*s);
    ctx.lineTo(cx - 50*s, cy - 62*s);
    ctx.lineTo(cx - 16*s, cy - 40*s);
    ctx.closePath();
    ctx.fill();
    // Right ear
    ctx.beginPath();
    ctx.moveTo(cx + 38*s, cy - 20*s);
    ctx.lineTo(cx + 50*s, cy - 62*s);
    ctx.lineTo(cx + 16*s, cy - 40*s);
    ctx.closePath();
    ctx.fill();
    // Inner ear pink
    ctx.fillStyle = '#F2C4C4';
    ctx.beginPath();
    ctx.moveTo(cx - 34*s, cy - 24*s);
    ctx.lineTo(cx - 43*s, cy - 53*s);
    ctx.lineTo(cx - 20*s, cy - 38*s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 34*s, cy - 24*s);
    ctx.lineTo(cx + 43*s, cy - 53*s);
    ctx.lineTo(cx + 20*s, cy - 38*s);
    ctx.closePath();
    ctx.fill();

    // ── Main face (round, slightly wide) ──
    ctx.fillStyle = '#E8B86D';
    E(0, 0, 50, 44);

    // ── Cheek fluff ──
    ctx.fillStyle = '#E8B86D';
    E(-44, 6, 13, 20);
    E(44, 6, 13, 20);

    // ── Muzzle (cream/white) ──
    ctx.fillStyle = '#FDF5E6';
    E(0, 10, 26, 20);

    // ── Eyes (classic Doge: small, spaced apart) ──
    ctx.fillStyle = '#1a1a1a';
    C(-20, -10, 5);
    C(20, -10, 5);
    // Pupils slightly off-center (side-eye to the left)
    ctx.fillStyle = '#fff';
    C(-18, -12, 2);
    C(22, -12, 2);
    // Eye white reflection
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    C(-21, -12, 1.5);
    C(19, -12, 1.5);

    // ── Iconic DOGE eyebrows (raised inner ends) ──
    ctx.strokeStyle = '#5C3A1E';
    ctx.lineWidth = 3.5 * s;
    ctx.lineCap = 'round';
    // Left eyebrow — inner end much higher
    ctx.beginPath();
    ctx.moveTo(cx - 32*s, cy - 16*s);
    ctx.quadraticCurveTo(cx - 22*s, cy - 34*s, cx - 8*s, cy - 30*s);
    ctx.stroke();
    // Right eyebrow — inner end much higher (mirror)
    ctx.beginPath();
    ctx.moveTo(cx + 32*s, cy - 16*s);
    ctx.quadraticCurveTo(cx + 22*s, cy - 34*s, cx + 8*s, cy - 30*s);
    ctx.stroke();

    // ── Nose ──
    ctx.fillStyle = '#2a2a2a';
    E(0, 0, 6, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    E(-2, -1.5, 3, 2);

    // ── Mouth: slight open smirk ──
    // Mouth opening (dark)
    ctx.fillStyle = '#3a1a0a';
    ctx.beginPath();
    ctx.ellipse(cx + 3*s, cy + 12*s, 9*s, 4.5*s, -0.1, 0, Math.PI);
    ctx.fill();
    // Tiny tongue
    ctx.fillStyle = '#F48C8C';
    ctx.beginPath();
    ctx.ellipse(cx + 1*s, cy + 14*s, 5*s, 3*s, 0, 0, Math.PI);
    ctx.fill();
    // Mouth outline
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 1.8 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx + 3*s, cy + 7*s, 9*s, 0.15, Math.PI - 0.15);
    ctx.stroke();

    // ── Blush ──
    ctx.fillStyle = 'rgba(255,150,150,0.4)';
    E(-32, 3, 9, 6);
    E(32, 3, 9, 6);

    // ── Meme text ──
    if (clearMemeText) {
      const chars = [...clearMemeText];
      const totalW = chars.length * 32 * s;
      const startX = cx - totalW / 2;
      const textY = cy + 80*s;

      // Fun color palette for meme text
      const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF8C32', '#E84A7A'];

      chars.forEach((ch, i) => {
        const chX = startX + i * 32 * s + 16*s;
        // Wobble animation
        const wobbleY = Math.sin(now * 0.008 + i * 1.2) * 5;
        const wobbleRot = Math.sin(now * 0.006 + i * 0.9) * 6 * (Math.PI / 180);
        const color = colors[i % colors.length];

        ctx.save();
        ctx.translate(chX, textY + wobbleY);
        ctx.rotate(wobbleRot);

        // Text shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.font = `bold ${28*s}px "Comic Sans MS", "Comic Neue", "KaiTi", cursive, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch, 2, 2);

        // Text outline (sticker effect)
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4 * s;
        ctx.lineJoin = 'round';
        ctx.strokeText(ch, 0, 0);

        // Main text fill
        ctx.fillStyle = color;
        ctx.fillText(ch, 0, 0);

        // Inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(ch, -1, -1);

        ctx.restore();
      });
    }

    // ── Sparkles ──
    const sparkles = [
      [-55, -55], [52, -52], [-56, -8], [55, -5],
      [-45, 35], [48, 32], [-22, -63], [23, -63]
    ];
    for (const [sx, sy] of sparkles) {
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(now * 0.006 + sx * 0.1));
      ctx.globalAlpha = alpha * twinkle;
      ctx.fillStyle = '#fff';
      C(sx, sy, 2.5);
      // Cross sparkle
      ctx.fillRect(cx + sx*s - 0.7, cy + sy*s - 4.5, 1.4, 9);
      ctx.fillRect(cx + sx*s - 4.5, cy + sy*s - 0.7, 9, 1.4);
    }

    ctx.restore();
  }

  function drawCell(ctx, cx, cy, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(cx + 1, cy + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(cx + 1, cy + 1, CELL - 2, 3);
    ctx.fillRect(cx + 1, cy + 1, 3, CELL - 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(cx + 1, cy + CELL - 4, CELL - 2, 3);
    ctx.fillRect(cx + CELL - 4, cy + 1, 3, CELL - 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 1.5, cy + 1.5, CELL - 3, CELL - 3);
    ctx.globalAlpha = 1;
  }

  function drawBoardCanvas() {
    const ctx = boardCtx;
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, BOARD_H);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(BOARD_W, y * CELL);
      ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== null) {
          if (clearingRows.includes(r)) {
            // Flash only during first 350ms of the 500ms cycle
            const flash = clearFlashTimer > 150 && Math.sin(clearFlashTimer * 0.04) > 0;
            drawCell(ctx, c * CELL, r * CELL, flash ? '#fff' : board[r][c]);
          } else {
            drawCell(ctx, c * CELL, r * CELL, board[r][c]);
          }
        }
      }
    }

    if (gameOver || !currentShape) return;

    if (clearingRows.length === 0) {
      const ghostY = getGhostY();
      if (ghostY !== currentY) {
        for (let r = 0; r < currentShape.length; r++) {
          for (let c = 0; c < currentShape[r].length; c++) {
            if (!currentShape[r][c]) continue;
            const cy = ghostY + r;
            const cx = currentX + c;
            if (cy < 0) continue;
            ctx.strokeStyle = COLORS[currentType];
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(cx * CELL + 2, cy * CELL + 2, CELL - 4, CELL - 4);
            ctx.setLineDash([]);
            ctx.lineWidth = 1;
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    for (let r = 0; r < currentShape.length; r++) {
      for (let c = 0; c < currentShape[r].length; c++) {
        if (!currentShape[r][c]) continue;
        const cy = currentY + r;
        const cx = currentX + c;
        if (cy < 0) continue;
        drawCell(ctx, cx * CELL, cy * CELL, COLORS[currentType]);
      }
    }

    // ── Doge "摸鱼" effect during line clear ──
    if (clearingRows.length > 0) {
      const elapsed = 500 - clearFlashTimer;
      let dogeAlpha;
      if (elapsed < 150) {
        dogeAlpha = elapsed / 150;
      } else if (elapsed < 400) {
        dogeAlpha = 1;
      } else {
        dogeAlpha = 1 - (elapsed - 400) / 100;
      }
      drawMemeDoge(ctx, dogeAlpha);
    }
  }

  function drawPreview() {
    const ctx = previewCtx;
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    if (!nextType) return;
    const shape = SHAPES[nextType];
    const size = shape.length;
    const cellSize = 24;
    const offsetX = (PREVIEW_SIZE - size * cellSize) / 2;
    const offsetY = (PREVIEW_SIZE - size * cellSize) / 2;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!shape[r][c]) continue;
        ctx.fillStyle = COLORS[nextType];
        ctx.fillRect(offsetX + c * cellSize + 1, offsetY + r * cellSize + 1, cellSize - 2, cellSize - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(offsetX + c * cellSize + 1, offsetY + r * cellSize + 1, cellSize - 2, 2);
        ctx.fillRect(offsetX + c * cellSize + 1, offsetY + r * cellSize + 1, 2, cellSize - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(offsetX + c * cellSize + 1, offsetY + r * cellSize + cellSize - 3, cellSize - 2, 2);
        ctx.fillRect(offsetX + c * cellSize + cellSize - 3, offsetY + r * cellSize + 1, 2, cellSize - 2);
      }
    }
  }

  function render() {
    drawBoardCanvas();
    drawPreview();
  }

  // ── Input ───────────────────────────────────
  function handleAction(action) {
    if (gameOver) {
      if (action === 'restart') restart();
      return;
    }
    if (clearingRows.length > 0) return;

    switch (action) {
      case 'left':  movePiece(-1, 0); break;
      case 'right': movePiece(1, 0); break;
      case 'rotate': tryRotate(); break;
      case 'softDrop': softDrop(); break;
      case 'hardDrop': hardDrop(); break;
      case 'pause': togglePause(); break;
      case 'restart': restart(); break;
    }
  }

  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    keyState[e.code] = true;
    dasTimer[e.code] = 0;

    switch (e.code) {
      case 'ArrowLeft':  handleAction('left'); break;
      case 'ArrowRight': handleAction('right'); break;
      case 'ArrowUp':    handleAction('rotate'); break;
      case 'ArrowDown':  handleAction('softDrop'); break;
      case 'Space':      e.preventDefault(); handleAction('hardDrop'); break;
      case 'KeyP':       handleAction('pause'); break;
      case 'KeyR':       handleAction('restart'); break;
    }
  });

  document.addEventListener('keyup', e => {
    keyState[e.code] = false;
    dasTimer[e.code] = 0;
  });

  // Mobile controls
  document.getElementById('btnLeft').addEventListener('pointerdown', () => handleAction('left'));
  document.getElementById('btnRight').addEventListener('pointerdown', () => handleAction('right'));
  document.getElementById('btnRotate').addEventListener('pointerdown', () => handleAction('rotate'));
  document.getElementById('btnDrop').addEventListener('pointerdown', () => handleAction('hardDrop'));

  // Touch/swipe on canvas
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  boardCanvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
  }, {passive: false});

  boardCanvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (!e.changedTouches.length) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dt = Date.now() - touchStartTime;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const minSwipe = 20;

    if (absDx < minSwipe && absDy < minSwipe && dt < 300) {
      handleAction('rotate');
    } else if (absDy > absDx && dy > minSwipe) {
      handleAction('hardDrop');
    } else if (absDx > absDy && absDx > minSwipe) {
      handleAction(dx > 0 ? 'right' : 'left');
    }
  }, {passive: false});

  function updateMobileUI() {
    const isMobile = window.innerWidth <= 500;
    controlsBar.style.display = isMobile ? 'flex' : 'none';
    controlsHint.style.display = isMobile ? 'none' : 'block';
  }
  window.addEventListener('resize', updateMobileUI);
  updateMobileUI();

  // ── Game Loop ───────────────────────────────
  function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    if (gameOver) {
      render();
      return;
    }

    if (paused) {
      lastTime = 0;
      render();
      return;
    }

    if (lastTime === 0) {
      lastTime = timestamp;
      render();
      return;
    }

    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (clearingRows.length > 0) {
      clearFlashTimer -= dt;
      if (clearFlashTimer <= 0) {
        finishClearLines();
      }
      render();
      return;
    }

    ['ArrowLeft', 'ArrowRight'].forEach(code => {
      if (keyState[code]) {
        dasTimer[code] = (dasTimer[code] || 0) + dt;
        if (dasTimer[code] >= DAS_DELAY) {
          const repeats = Math.floor((dasTimer[code] - DAS_DELAY) / DAS_RATE);
          const prevRepeats = Math.floor((dasTimer[code] - dt - DAS_DELAY) / DAS_RATE);
          if (repeats > prevRepeats) {
            handleAction(code === 'ArrowLeft' ? 'left' : 'right');
          }
        }
      }
    });

    if (keyState['ArrowDown']) {
      dasTimer['ArrowDown'] = (dasTimer['ArrowDown'] || 0) + dt;
      const softRate = 50;
      const repeats = Math.floor(dasTimer['ArrowDown'] / softRate);
      const prevRepeats = Math.floor((dasTimer['ArrowDown'] - dt) / softRate);
      if (repeats > prevRepeats) {
        handleAction('softDrop');
      }
    }

    dropTimer += dt;
    const interval = getDropInterval();
    if (dropTimer >= interval) {
      dropTimer -= interval;
      if (!collision(currentShape, currentX, currentY + 1)) {
        currentY++;
      } else {
        lockPiece();
        updateUI();
        dropTimer = 0;
      }
    }

    render();
  }

  // ── Start ───────────────────────────────────
  initBoard();
  nextType = nextFromBag();
  spawnPiece();
  updateUI();
  requestAnimationFrame(gameLoop);
})();
