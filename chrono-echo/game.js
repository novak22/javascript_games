const TILE_SIZE = 44;
const CLONE_COLORS = ['#7be0ff', '#ff9ad5', '#9cff6d', '#ffd273'];

const levels = [
  {
    id: 'vault-aperture',
    name: 'Vault Aperture',
    loops: 3,
    stepLimit: 24,
    story:
      'Breaching the outer seals demands cooperation with your past runs. Record an echo to hold the glyph gate while your present self slips through.',
    layout: [
      '#############',
      '#S..C....A..#',
      '#.#.#.##.#..#',
      '#..C..##aE..#',
      '#.#.##...#C.#',
      '#....##.....#',
      '#############',
    ],
  },
  {
    id: 'harmonic-locks',
    name: 'Harmonic Locks',
    loops: 4,
    stepLimit: 30,
    story:
      'Twin force gates must hum in unison. Chain your echoes: one holds the upper glyph, another slips beneath to trigger the lower lock, clearing a route to the portal.',
    layout: [
      '#################',
      '#S..##..C.A...aE#',
      '#.#.##.###.###..#',
      '#..A....#....#..#',
      '#.####.#.##B.#..#',
      '#..C..##.#..#...#',
      '#.#.##.#.##.#.#.#',
      '#..b..#.C..C....#',
      '#################',
    ],
  },
  {
    id: 'prism-core',
    name: 'Prism Core Singularity',
    loops: 5,
    stepLimit: 36,
    story:
      'The innermost vault routes energy through layered glyphs. Each echo must maintain a circuit so the next can slip deeper. Sustain three glyphs at once to pry open the portal.',
    layout: [
      '###################',
      '#S..##C.###p...E..#',
      '#..C#...#.#.C.C...#',
      '#.###.##.B..##....#',
      '#.A..#.C..a#......#',
      '#...C##..C.##.b...#',
      '#.C##..###...##...#',
      '#.C.##C.P##..C....#',
      '#....C##...C......#',
      '#.................#',
      '###################',
    ],
  },
];

const moveVectors = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
  wait: { dx: 0, dy: 0 },
};

const keyBindings = new Map([
  ['ArrowUp', 'up'],
  ['KeyW', 'up'],
  ['ArrowDown', 'down'],
  ['KeyS', 'down'],
  ['ArrowLeft', 'left'],
  ['KeyA', 'left'],
  ['ArrowRight', 'right'],
  ['KeyD', 'right'],
  ['Space', 'wait'],
]);

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const levelNameEl = document.querySelector('[data-level-name]');
const loopEl = document.querySelector('[data-loop]');
const totalLoopsEl = document.querySelector('[data-total-loops]');
const stepsEl = document.querySelector('[data-steps]');
const stepLimitEl = document.querySelector('[data-step-limit]');
const shardsEl = document.querySelector('[data-shards]');
const totalShardsEl = document.querySelector('[data-total-shards]');
const storyEl = document.querySelector('[data-level-story]');
const nextButton = document.querySelector('[data-action="next"]');
const overlay = document.querySelector('[data-overlay]');
const overlayTitle = overlay?.querySelector('[data-overlay-title]');
const overlaySubtitle = overlay?.querySelector('[data-overlay-subtitle]');
const overlayResume = overlay?.querySelector('[data-action="resume"]');
const overlayReset = overlay?.querySelector('[data-action="reset"]');
const touchControls = document.querySelectorAll('[data-move]');

const state = {
  levelIndex: 0,
  level: null,
  grid: [],
  width: 0,
  height: 0,
  start: { x: 0, y: 0 },
  exit: { x: 0, y: 0 },
  gates: new Map(),
  plates: new Map(),
  shards: new Set(),
  collectedShards: new Set(),
  shardsCollectedThisLoop: new Set(),
  clones: [],
  currentPath: [],
  playerPos: { x: 0, y: 0 },
  loopIndex: 0,
  stepsUsed: 0,
  tick: 0,
  status: 'intro', // intro | active | victory | failed
  bumpTimer: 0,
};

function parseLevel(level) {
  const grid = level.layout.map((row) => row.split(''));
  const gates = new Map();
  const plates = new Map();
  const shards = new Set();
  let start = null;
  let exit = null;

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const char = grid[y][x];

      if (char === 'S') {
        start = { x, y };
        grid[y][x] = '.';
      } else if (char === 'E') {
        exit = { x, y };
        grid[y][x] = '.';
      } else if (char === 'C') {
        shards.add(`${x},${y}`);
        // keep the marker for drawing but treat as floor for collisions
      } else if (char >= 'a' && char <= 'z') {
        const key = char;
        if (!gates.has(key)) {
          gates.set(key, []);
        }
        gates.get(key)?.push({ x, y });
      } else if (char >= 'A' && char <= 'Z') {
        const key = char.toLowerCase();
        if (!plates.has(key)) {
          plates.set(key, []);
        }
        plates.get(key)?.push({ x, y });
      }
    }
  }

  if (!start || !exit) {
    throw new Error('Level missing start or exit.');
  }

  return {
    grid,
    gates,
    plates,
    shards,
    start,
    exit,
    width: grid[0]?.length ?? 0,
    height: grid.length,
  };
}

function loadLevel(index) {
  const level = levels[index];
  if (!level) {
    return;
  }

  const parsed = parseLevel(level);
  state.levelIndex = index;
  state.level = level;
  state.grid = parsed.grid;
  state.width = parsed.width;
  state.height = parsed.height;
  state.start = parsed.start;
  state.exit = parsed.exit;
  state.gates = parsed.gates;
  state.plates = parsed.plates;
  state.shards = parsed.shards;
  state.collectedShards = new Set();
  state.shardsCollectedThisLoop = new Set();
  state.clones = [];
  state.currentPath = [{ ...parsed.start }];
  state.playerPos = { ...parsed.start };
  state.loopIndex = 0;
  state.stepsUsed = 0;
  state.tick = 0;
  state.status = 'intro';
  state.bumpTimer = 0;

  canvas.width = state.width * TILE_SIZE;
  canvas.height = state.height * TILE_SIZE;

  if (levelNameEl) levelNameEl.textContent = level.name;
  if (storyEl) storyEl.textContent = level.story;
  if (loopEl) loopEl.textContent = '1';
  if (totalLoopsEl) totalLoopsEl.textContent = String(level.loops);
  if (stepsEl) stepsEl.textContent = '0';
  if (stepLimitEl) stepLimitEl.textContent = String(level.stepLimit);
  if (shardsEl) shardsEl.textContent = '0';
  if (totalShardsEl) totalShardsEl.textContent = String(parsed.shards.size);

  if (nextButton) {
    nextButton.hidden = true;
    nextButton.textContent = index === levels.length - 1 ? 'Restart the Timeline' : 'Advance to Next Sector';
  }

  showOverlay('Mission Ready', 'Press a direction or tap Resume to deploy.', {
    resume: true,
    reset: true,
  });
}

function showOverlay(title, subtitle, options = {}) {
  if (!overlay) return;
  if (overlayTitle) overlayTitle.textContent = title;
  if (overlaySubtitle) overlaySubtitle.textContent = subtitle;
  const { resume = false, reset = true } = options;
  if (overlayResume) overlayResume.hidden = !resume;
  if (overlayReset) overlayReset.hidden = !reset;
  overlay.hidden = false;
}

function hideOverlay() {
  if (!overlay) return;
  overlay.hidden = true;
}

function updateHUD() {
  if (loopEl) loopEl.textContent = String(state.loopIndex + 1);
  if (stepsEl) stepsEl.textContent = String(state.stepsUsed);
  if (shardsEl) shardsEl.textContent = String(state.collectedShards.size);
}

function clonePositionAt(path, tick) {
  if (!path.length) return null;
  const index = Math.min(tick, path.length - 1);
  return path[index];
}

function getClonePositions(tick) {
  return state.clones
    .map((path) => clonePositionAt(path, tick))
    .filter((pos) => pos != null);
}

function getOpenGates(tick) {
  const open = new Set();
  const occupants = [state.playerPos, ...getClonePositions(tick)];
  for (const pos of occupants) {
    if (!pos) continue;
    const tile = getTile(pos.x, pos.y);
    if (!tile) continue;
    if (tile >= 'A' && tile <= 'Z' && tile !== 'C') {
      open.add(tile.toLowerCase());
    }
  }
  return open;
}

function getTile(x, y) {
  if (y < 0 || y >= state.height || x < 0 || x >= state.width) {
    return '#';
  }
  return state.grid[y][x];
}

function canEnter(x, y, openGates) {
  const tile = getTile(x, y);
  if (tile === '#') return false;
  if (tile >= 'a' && tile <= 'z') {
    if (!openGates.has(tile)) {
      return false;
    }
  }
  return true;
}

function recordShardIfPresent(pos) {
  const key = `${pos.x},${pos.y}`;
  if (state.shards.has(key) && !state.collectedShards.has(key)) {
    state.collectedShards.add(key);
    state.shardsCollectedThisLoop.add(key);
  }
}

function advanceTurn(target) {
  state.playerPos = { ...target };
  state.currentPath.push({ ...target });
  state.tick += 1;
  state.stepsUsed += 1;
  state.bumpTimer = 0;

  recordShardIfPresent(target);
  updateHUD();

  if (hasReachedExit() && collectedAllShards()) {
    return completeLevel();
  }

  if (state.stepsUsed >= (state.level?.stepLimit ?? 0)) {
    return completeLoop();
  }
}

function collectedAllShards() {
  return state.collectedShards.size === state.shards.size;
}

function hasReachedExit() {
  return state.playerPos.x === state.exit.x && state.playerPos.y === state.exit.y;
}

function completeLevel() {
  state.status = 'victory';
  if (nextButton) {
    nextButton.hidden = false;
  }
  showOverlay('Sector Cleared', 'Echo alignment complete. Advance when ready.', {
    resume: false,
    reset: true,
  });
}

function completeLoop() {
  state.clones.push(state.currentPath.map((pos) => ({ ...pos })));
  state.loopIndex += 1;
  if (state.loopIndex >= (state.level?.loops ?? 0)) {
    state.status = 'failed';
    updateHUD();
    showOverlay('Protocol Collapsed', 'All echoes spent. Restart the sector to recalibrate.', {
      resume: false,
      reset: true,
    });
    return;
  }
  resetCurrentLoop();
}

function resetCurrentLoop() {
  state.playerPos = { ...state.start };
  state.currentPath = [{ ...state.start }];
  state.stepsUsed = 0;
  state.tick = 0;
  state.shardsCollectedThisLoop = new Set();
  state.status = 'active';
  state.bumpTimer = 0;
  updateHUD();
}

function rewindLoop() {
  if (!state.level || (state.status !== 'active' && state.status !== 'intro')) {
    return;
  }

  for (const key of state.shardsCollectedThisLoop) {
    state.collectedShards.delete(key);
  }
  state.shardsCollectedThisLoop.clear();

  state.playerPos = { ...state.start };
  state.currentPath = [{ ...state.start }];
  state.stepsUsed = 0;
  state.tick = 0;
  state.bumpTimer = 0;
  updateHUD();
}

function resetLevel() {
  loadLevel(state.levelIndex);
}

function handleMove(direction) {
  if (!state.level) return;
  if (state.status === 'victory' || state.status === 'failed') return;

  if (!overlay?.hidden && state.status === 'intro') {
    hideOverlay();
    state.status = 'active';
  }

  if (direction === 'wait') {
    advanceTurn(state.playerPos);
    return;
  }

  const vector = moveVectors[direction];
  if (!vector) return;

  const openGates = getOpenGates(state.tick);
  const target = {
    x: state.playerPos.x + vector.dx,
    y: state.playerPos.y + vector.dy,
  };

  if (!canEnter(target.x, target.y, openGates)) {
    state.bumpTimer = 8;
    return;
  }

  advanceTurn(target);
}

function collectedShardAt(x, y) {
  return state.collectedShards.has(`${x},${y}`);
}

function drawGrid() {
  const openGates = getOpenGates(state.tick);
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = state.grid[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      ctx.fillStyle = '#050914';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      if (tile === '#') {
        ctx.fillStyle = '#0d1428';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'rgba(123, 209, 255, 0.12)';
        ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        continue;
      }

      ctx.fillStyle = 'rgba(19, 28, 58, 0.9)';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = 'rgba(123, 209, 255, 0.08)';
      ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

      if (state.exit.x === x && state.exit.y === y) {
        ctx.fillStyle = 'rgba(123, 209, 255, 0.25)';
        ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        ctx.strokeStyle = 'rgba(123, 209, 255, 0.6)';
        ctx.strokeRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      }

      if (tile >= 'A' && tile <= 'Z' && tile !== 'C') {
        ctx.fillStyle = 'rgba(123, 209, 255, 0.12)';
        ctx.fillRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12);
        ctx.strokeStyle = 'rgba(123, 209, 255, 0.45)';
        ctx.strokeRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12);
      }

      if (tile >= 'a' && tile <= 'z') {
        const isOpen = openGates.has(tile);
        ctx.fillStyle = isOpen ? 'rgba(123, 209, 255, 0.18)' : 'rgba(48, 64, 112, 0.65)';
        ctx.fillRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12);
        ctx.strokeStyle = isOpen ? 'rgba(123, 209, 255, 0.55)' : 'rgba(123, 209, 255, 0.25)';
        ctx.strokeRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12);
      }

      if (state.shards.has(`${x},${y}`) && !collectedShardAt(x, y)) {
        drawShard(px, py);
      }
    }
  }
}

function drawShard(px, py) {
  const centerX = px + TILE_SIZE / 2;
  const centerY = py + TILE_SIZE / 2;
  const radius = TILE_SIZE * 0.22;

  const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
  gradient.addColorStop(0, 'rgba(123, 209, 255, 0.9)');
  gradient.addColorStop(1, 'rgba(123, 209, 255, 0.1)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(123, 209, 255, 0.6)';
  ctx.stroke();
}

function drawClones() {
  const positions = getClonePositions(state.tick);
  positions.forEach((pos, index) => {
    const px = pos.x * TILE_SIZE + TILE_SIZE / 2;
    const py = pos.y * TILE_SIZE + TILE_SIZE / 2;
    const color = CLONE_COLORS[index % CLONE_COLORS.length];
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(px, py, TILE_SIZE * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, TILE_SIZE * 0.28, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawPlayer() {
  const offset = state.bumpTimer > 0 ? Math.sin(state.bumpTimer) * 2 : 0;
  const px = state.playerPos.x * TILE_SIZE + TILE_SIZE / 2 + offset;
  const py = state.playerPos.y * TILE_SIZE + TILE_SIZE / 2;

  const gradient = ctx.createRadialGradient(px, py, 4, px, py, TILE_SIZE * 0.32);
  gradient.addColorStop(0, '#fff9ff');
  gradient.addColorStop(1, '#7b5bff');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(px, py, TILE_SIZE * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.stroke();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawClones();
  drawPlayer();

  if (state.bumpTimer > 0) {
    state.bumpTimer -= 0.6;
  } else {
    state.bumpTimer = 0;
  }

  requestAnimationFrame(render);
}

function onKeyDown(event) {
  if (keyBindings.has(event.code)) {
    event.preventDefault();
    const direction = keyBindings.get(event.code);
    handleMove(direction);
  } else if (event.code === 'KeyR') {
    event.preventDefault();
    resetLevel();
  } else if (event.code === 'Backspace') {
    event.preventDefault();
    rewindLoop();
  }
}

window.addEventListener('keydown', onKeyDown);

touchControls.forEach((button) => {
  button.addEventListener('click', () => {
    const direction = button.dataset.move;
    if (direction) {
      handleMove(direction);
    }
  });
});

if (overlayResume) {
  overlayResume.addEventListener('click', () => {
    hideOverlay();
    if (state.status === 'intro') {
      state.status = 'active';
    }
  });
}

if (overlayReset) {
  overlayReset.addEventListener('click', () => {
    resetLevel();
  });
}

if (nextButton) {
  nextButton.addEventListener('click', () => {
    if (state.levelIndex === levels.length - 1) {
      loadLevel(0);
    } else {
      loadLevel(state.levelIndex + 1);
    }
  });
}

loadLevel(0);
requestAnimationFrame(render);
