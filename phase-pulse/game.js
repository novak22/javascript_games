const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('[data-overlay]');
const startButton = document.querySelector('[data-start]');
const scoreEl = document.querySelector('[data-score]');
const streakEl = document.querySelector('[data-streak]');
const bestEl = document.querySelector('[data-best]');
const surgeEl = document.querySelector('[data-surge]');

const LANES = [140, 240, 340];
const PLAYER_X = 180;
const PLAYER_RADIUS = 18;
const SURGE_TARGET = 1;

const storageKey = 'phase-pulse-best-score';
let bestScore = Number.parseInt(localStorage.getItem(storageKey) ?? '0', 10) || 0;
bestEl.textContent = bestScore.toString();

const state = {
  running: false,
  time: 0,
  speed: 260,
  score: 0,
  streak: 0,
  surge: 0,
  surgeMode: false,
  surgeTime: 0,
  spawnTimer: 0,
  spawnInterval: 1,
  entities: [],
  gateCooldown: 0,
};

const player = {
  laneIndex: 1,
  y: LANES[1],
  targetLane: 1,
  transition: 0,
};

function resetRun() {
  state.time = 0;
  state.speed = 260;
  state.score = 0;
  state.streak = 0;
  state.surge = 0;
  state.surgeMode = false;
  state.surgeTime = 0;
  state.spawnTimer = 0;
  state.spawnInterval = 1;
  state.entities = [];
  state.gateCooldown = 0;
  player.laneIndex = 1;
  player.targetLane = 1;
  player.y = LANES[1];
  player.transition = 0;
  updateHUD();
  updateSurgeBar();
}

function startRun() {
  resetRun();
  overlay.hidden = true;
  state.running = true;
}

function endRun() {
  state.running = false;
  overlay.hidden = false;
  overlay.querySelector('h2').textContent = 'Run Over';
  overlay.querySelector('p').textContent = 'You clipped a mine. Smash restart to chase a hotter streak.';
  overlay.querySelector('button').textContent = 'Run Again';
  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(storageKey, String(bestScore));
  }
  bestEl.textContent = bestScore.toString();
}

function updateHUD() {
  scoreEl.textContent = Math.round(state.score).toString();
  streakEl.textContent = state.streak.toString();
}

function updateSurgeBar() {
  const pct = Math.min(state.surge / SURGE_TARGET, 1) * 100;
  surgeEl.style.width = `${pct}%`;
}

function cycleLane(direction) {
  if (!state.running) return;
  const next = (player.targetLane + direction + LANES.length) % LANES.length;
  player.targetLane = next;
}

function snapLane(index) {
  if (!state.running) return;
  if (index < 0 || index >= LANES.length) return;
  player.targetLane = index;
}

function spawnEntity() {
  const roll = Math.random();
  if (roll < 0.55) {
    const lane = Math.floor(Math.random() * LANES.length);
    state.entities.push({
      type: 'orb',
      x: canvas.width + 60,
      lane,
      radius: 12,
      pulse: Math.random() * Math.PI * 2,
    });
  } else if (roll < 0.85 || state.gateCooldown > 0) {
    const lane = Math.floor(Math.random() * LANES.length);
    state.entities.push({
      type: 'hazard',
      x: canvas.width + 60,
      lane,
      radius: 16,
      spin: Math.random() * Math.PI * 2,
    });
  } else {
    const openLane = Math.floor(Math.random() * LANES.length);
    state.entities.push({
      type: 'gate',
      x: canvas.width + 80,
      width: 70,
      openLane,
      hit: false,
    });
    state.gateCooldown = 2.5;
  }
}

function updateEntities(dt) {
  const speedMultiplier = state.surgeMode ? 1.25 : 1;
  const velocity = state.speed * dt * speedMultiplier;
  for (const entity of state.entities) {
    entity.x -= velocity;
    if (entity.type === 'orb') {
      entity.pulse += dt * 6;
    }
    if (entity.type === 'hazard') {
      entity.spin += dt * 5;
    }
  }
  state.entities = state.entities.filter((entity) => entity.x > -120);
}

function handleCollisions() {
  for (const entity of state.entities) {
    if (entity.type === 'orb' && entity.lane === player.targetLane) {
      if (entity.x < PLAYER_X + PLAYER_RADIUS && entity.x > PLAYER_X - PLAYER_RADIUS) {
        collectOrb(entity);
      }
    } else if (entity.type === 'hazard' && entity.lane === player.targetLane) {
      if (Math.abs(entity.x - PLAYER_X) < PLAYER_RADIUS + entity.radius - 4) {
        crash();
        return;
      }
    } else if (entity.type === 'gate') {
      if (!entity.hit && entity.x < PLAYER_X + PLAYER_RADIUS && entity.x + entity.width > PLAYER_X - PLAYER_RADIUS) {
        if (player.targetLane !== entity.openLane) {
          crash();
          return;
        } else {
          entity.hit = true;
        }
      }
    }
  }
}

function collectOrb(orb) {
  state.entities = state.entities.filter((entity) => entity !== orb);
  state.streak += 1;
  const combo = 1 + state.streak * 0.12;
  const surgeBoost = state.surgeMode ? 2 : 1;
  state.score += 12 * combo * surgeBoost;
  state.surge += 0.11;
  if (!state.surgeMode && state.surge >= SURGE_TARGET) {
    state.surgeMode = true;
    state.surgeTime = 6;
    state.surge = SURGE_TARGET;
  }
  state.speed = Math.min(state.speed + 4.5, 420);
  state.spawnInterval = Math.max(0.45, state.spawnInterval - 0.015);
  updateHUD();
  updateSurgeBar();
}

function crash() {
  state.streak = 0;
  state.surge = 0;
  state.surgeMode = false;
  updateHUD();
  updateSurgeBar();
  endRun();
}

function updatePlayer(dt) {
  const current = player.laneIndex;
  const target = player.targetLane;
  if (current !== target) {
    player.transition += dt * 6;
    if (player.transition >= 1) {
      player.transition = 0;
      player.laneIndex = target;
      player.y = LANES[target];
    } else {
      const startY = LANES[current];
      const targetY = LANES[target];
      player.y = startY + (targetY - startY) * easeInOut(player.transition);
    }
  } else {
    player.y = LANES[current];
    player.transition = 0;
  }
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

let lastTime = 0;

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.033);
  lastTime = timestamp;

  if (state.running) {
    state.time += dt;
    state.spawnTimer += dt;
    if (state.gateCooldown > 0) {
      state.gateCooldown -= dt;
    }
    if (state.spawnTimer >= state.spawnInterval) {
      state.spawnTimer = 0;
      spawnEntity();
    }

    if (state.surgeMode) {
      state.surgeTime -= dt;
      state.surge = SURGE_TARGET;
      if (state.surgeTime <= 0) {
        state.surgeMode = false;
        state.surge = 0;
      }
      updateSurgeBar();
    } else {
      state.surge = Math.max(0, state.surge - dt * 0.04);
      updateSurgeBar();
    }

    updatePlayer(dt);
    updateEntities(dt);
    handleCollisions();
  }

  draw();
  requestAnimationFrame(loop);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawEntities();
  drawPlayer();
  if (state.running) {
    drawSpeedLines();
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#030616');
  gradient.addColorStop(1, '#05091f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#6ee7ff';
  ctx.lineWidth = 2;
  LANES.forEach((laneY, index) => {
    ctx.beginPath();
    drawRoundedRect(ctx, 70, laneY - 36, canvas.width - 140, 72, 28);
    ctx.stroke();

    ctx.fillStyle = index === player.targetLane ? 'rgba(126, 255, 254, 0.08)' : 'rgba(110, 231, 255, 0.03)';
    ctx.fill();
  });
  ctx.restore();
}

function drawEntities() {
  for (const entity of state.entities) {
    if (entity.type === 'orb') {
      drawOrb(entity);
    } else if (entity.type === 'hazard') {
      drawHazard(entity);
    } else if (entity.type === 'gate') {
      drawGate(entity);
    }
  }
}

function drawOrb(orb) {
  const y = LANES[orb.lane];
  const radius = orb.radius + Math.sin(orb.pulse) * 2;
  const gradient = ctx.createRadialGradient(orb.x, y, radius * 0.2, orb.x, y, radius);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.45, '#7bfffe');
  gradient.addColorStop(1, 'rgba(123, 255, 255, 0.05)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(orb.x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawHazard(hazard) {
  const y = LANES[hazard.lane];
  ctx.save();
  ctx.translate(hazard.x, y);
  ctx.rotate(hazard.spin);
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(14, 0);
  ctx.lineTo(0, 18);
  ctx.lineTo(-14, 0);
  ctx.closePath();
  ctx.fillStyle = '#ff5c97';
  ctx.shadowColor = '#ff5c97';
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();
}

function drawGate(gate) {
  const laneHeight = 72;
  const gapHeight = laneHeight * 0.86;
  ctx.fillStyle = 'rgba(255, 92, 151, 0.08)';
  ctx.strokeStyle = 'rgba(255, 92, 151, 0.5)';
  ctx.lineWidth = 3;

  LANES.forEach((laneY, index) => {
    if (index === gate.openLane) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = 'rgba(126, 255, 254, 0.22)';
      ctx.fillRect(gate.x - gate.width / 2, laneY - gapHeight / 2, gate.width, gapHeight);
      ctx.restore();
      return;
    }
    ctx.beginPath();
    drawRoundedRect(
      ctx,
      gate.x - gate.width / 2,
      laneY - laneHeight / 2,
      gate.width,
      laneHeight,
      12
    );
    ctx.fill();
    ctx.stroke();
  });
}

function drawPlayer() {
  const x = PLAYER_X;
  const y = player.y;

  const gradient = ctx.createRadialGradient(x, y, 4, x, y, PLAYER_RADIUS + 6);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.35, '#7bfffe');
  gradient.addColorStop(1, 'rgba(123, 255, 255, 0.1)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  if (state.surgeMode) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#74f7ff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, PLAYER_RADIUS + 12 + Math.sin(state.time * 6) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSpeedLines() {
  ctx.save();
  ctx.globalAlpha = state.surgeMode ? 0.3 : 0.18;
  ctx.strokeStyle = state.surgeMode ? '#7bfffe' : 'rgba(123, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  const spacing = state.surgeMode ? 48 : 72;
  const offset = (state.time * state.speed) % spacing;
  for (let x = -spacing + spacing - offset; x < canvas.width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 80);
    ctx.lineTo(x + 14, canvas.height - 80);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoundedRect(context, x, y, width, height, radius) {
  if (context.roundRect) {
    context.roundRect(x, y, width, height, radius);
    return;
  }

  const r = typeof radius === 'number'
    ? { tl: radius, tr: radius, br: radius, bl: radius }
    : { tl: 0, tr: 0, br: 0, bl: 0, ...radius };

  context.moveTo(x + r.tl, y);
  context.lineTo(x + width - r.tr, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r.tr);
  context.lineTo(x + width, y + height - r.br);
  context.quadraticCurveTo(x + width, y + height, x + width - r.br, y + height);
  context.lineTo(x + r.bl, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r.bl);
  context.lineTo(x, y + r.tl);
  context.quadraticCurveTo(x, y, x + r.tl, y);
  context.closePath();
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
    event.preventDefault();
    cycleLane(-1);
  } else if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
    event.preventDefault();
    cycleLane(1);
  } else if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault();
    cycleLane(1);
  } else if (event.key === '1') {
    snapLane(0);
  } else if (event.key === '2') {
    snapLane(1);
  } else if (event.key === '3') {
    snapLane(2);
  }
});

canvas.addEventListener('pointerdown', () => {
  if (!state.running) {
    startRun();
  } else {
    cycleLane(1);
  }
});

startButton.addEventListener('click', () => {
  startRun();
});

resetRun();
requestAnimationFrame(loop);
