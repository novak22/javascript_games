const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WALL_MARGIN = 56;
const WALL_THICKNESS = 22;
const RESPAWN_DELAY = 1.1;
const MESSAGE_DURATION = 1.6;
const SHAPE_CHANGE_INTERVAL = 5;

const OBSTACLE_SHAPES = [
  createSplitCorridor,
  createSpiralLoop,
  createStaggeredGates,
  createCornerArches,
];

const MIN_SPEED = 0;
const MAX_SPEED = 400;
const SPEED_ADJUST_RATE = 320;

const state = {
  player: {
    x: 0,
    y: 0,
    size: 44,
    color: "#4db5ff",
    speed: MIN_SPEED,
    dashSpeed: 400,
    dashCooldown: 0,
    angle: -Math.PI / 2,
    turnSpeed: Math.PI * 1.8,
    turnInput: 0,
  },
  keys: new Set(),
  star: null,
  score: 0,
  walls: [],
  playing: true,
  respawnTimer: 0,
  message: "",
  messageTimer: 0,
  layoutIndex: 0,
};

const VIRTUAL_CONTROL_MAP = {
  up: ['ArrowUp', 'w'],
  down: ['ArrowDown', 's'],
  left: ['ArrowLeft', 'a'],
  right: ['ArrowRight', 'd'],
  dash: [' '],
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle) {
  const fullTurn = Math.PI * 2;
  return ((angle % fullTurn) + fullTurn) % fullTurn;
}

function getArenaBounds() {
  const left = WALL_MARGIN + WALL_THICKNESS;
  const top = WALL_MARGIN + WALL_THICKNESS;
  const right = canvas.width - WALL_MARGIN - WALL_THICKNESS;
  const bottom = canvas.height - WALL_MARGIN - WALL_THICKNESS;

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function roundRect(rect) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function createBorderWalls() {
  const width = canvas.width - WALL_MARGIN * 2;
  const height = canvas.height - WALL_MARGIN * 2;

  return [
    {
      x: WALL_MARGIN,
      y: WALL_MARGIN,
      width,
      height: WALL_THICKNESS,
    },
    {
      x: WALL_MARGIN,
      y: canvas.height - WALL_MARGIN - WALL_THICKNESS,
      width,
      height: WALL_THICKNESS,
    },
    {
      x: WALL_MARGIN,
      y: WALL_MARGIN,
      width: WALL_THICKNESS,
      height,
    },
    {
      x: canvas.width - WALL_MARGIN - WALL_THICKNESS,
      y: WALL_MARGIN,
      width: WALL_THICKNESS,
      height,
    },
  ];
}

function selectObstacleLayout(preferredIndex, playerRect) {
  const bounds = getArenaBounds();
  const total = OBSTACLE_SHAPES.length;

  for (let offset = 0; offset < total; offset += 1) {
    const index = (preferredIndex + offset) % total;
    const candidate = OBSTACLE_SHAPES[index](bounds).map(roundRect);
    const intersectsPlayer =
      playerRect &&
      candidate.some((rect) => rectIntersect(rect, playerRect));

    if (!intersectsPlayer) {
      return { index, obstacles: candidate };
    }
  }

  return { index: preferredIndex % total, obstacles: [] };
}

function buildWalls(preferredIndex = 0, playerRect) {
  const baseWalls = createBorderWalls();
  const { index, obstacles } = selectObstacleLayout(preferredIndex, playerRect);
  state.layoutIndex = index;
  state.walls = baseWalls.concat(obstacles);
}

function cycleArena() {
  const playerRect = getPlayerRect();
  buildWalls(state.layoutIndex + 1, playerRect);

  if (collidesWithWalls(playerRect)) {
    resetPlayerPosition();
  }

  state.star = null;

  if (state.playing) {
    state.message = "Arena layout shifted!";
    state.messageTimer = MESSAGE_DURATION;
  }
}

function createSplitCorridor(bounds) {
  const { left, top, width, height } = bounds;
  const barThickness = Math.round(WALL_THICKNESS * 1.4);
  const topY = top + Math.round(height * 0.25);
  const bottomY = top + Math.round(height * 0.62);
  const span = Math.round(width * 0.6);
  const gap = Math.round(width * 0.22);
  const startX = left + Math.round((width - span) / 2);
  const segment = Math.max(barThickness, Math.round((span - gap) / 2));
  const bottomWidth = Math.round(width * 0.64);
  const bottomX = left + Math.round((width - bottomWidth) / 2);

  return [
    {
      x: startX,
      y: topY,
      width: segment,
      height: barThickness,
    },
    {
      x: startX + segment + gap,
      y: topY,
      width: segment,
      height: barThickness,
    },
    {
      x: bottomX,
      y: bottomY,
      width: bottomWidth,
      height: barThickness,
    },
  ];
}

function createSpiralLoop(bounds) {
  const { left, top, width, height } = bounds;
  const legThickness = Math.round(WALL_THICKNESS * 1.3);
  const outerX = left + Math.round(width * 0.14);
  const outerY = top + Math.round(height * 0.14);
  const horizontalSpan = Math.round(width * 0.52);
  const verticalSpan = Math.round(height * 0.54);
  const innerOffset = Math.round(legThickness * 1.6);

  return [
    {
      x: outerX,
      y: outerY,
      width: horizontalSpan,
      height: legThickness,
    },
    {
      x: outerX,
      y: outerY,
      width: legThickness,
      height: verticalSpan,
    },
    {
      x: outerX + horizontalSpan - legThickness,
      y: outerY + legThickness,
      width: legThickness,
      height: Math.round(height * 0.52),
    },
    {
      x: outerX + innerOffset,
      y: outerY + verticalSpan,
      width: Math.round(width * 0.36),
      height: legThickness,
    },
  ];
}

function createStaggeredGates(bounds) {
  const { left, top, width, height } = bounds;
  const gateWidth = Math.round(WALL_THICKNESS * 1.2);
  const gateHeight = Math.round(height * 0.56);
  const step = Math.round(width * 0.18);
  const baseX = left + Math.round(width * 0.2);
  const topY = top + Math.round(height * 0.18);
  const middleY = Math.min(top + height - gateHeight, topY + Math.round(height * 0.18));
  const lowY = Math.max(top, topY - Math.round(height * 0.14));

  return [
    {
      x: baseX,
      y: topY,
      width: gateWidth,
      height: gateHeight,
    },
    {
      x: baseX + step,
      y: middleY,
      width: gateWidth,
      height: gateHeight,
    },
    {
      x: baseX + step * 2,
      y: lowY,
      width: gateWidth,
      height: gateHeight,
    },
  ];
}

function createCornerArches(bounds) {
  const { left, top, right, bottom, width, height } = bounds;
  const legThickness = Math.round(WALL_THICKNESS * 1.1);
  const horizontalLength = Math.round(width * 0.22);
  const verticalLength = Math.round(height * 0.32);
  const offsetX = Math.round(width * 0.08);
  const offsetY = Math.round(height * 0.1);

  return [
    {
      x: left + offsetX,
      y: top + offsetY,
      width: horizontalLength,
      height: legThickness,
    },
    {
      x: left + offsetX,
      y: top + offsetY,
      width: legThickness,
      height: verticalLength,
    },
    {
      x: right - offsetX - horizontalLength,
      y: bottom - offsetY - legThickness,
      width: horizontalLength,
      height: legThickness,
    },
    {
      x: right - offsetX - legThickness,
      y: bottom - offsetY - verticalLength,
      width: legThickness,
      height: verticalLength,
    },
  ];
}

function spawnStar() {
  const padding = 110;
  let x;
  let y;
  const size = 16;
  const playerRect = getPlayerRect();

  do {
    x = randInt(padding, canvas.width - padding - size);
    y = randInt(padding, canvas.height - padding - size);
  } while (
    state.walls.some((wall) =>
      rectIntersect(
        { x, y, width: size, height: size },
        wall
      )
    ) ||
    rectIntersect({ x, y, width: size, height: size }, playerRect)
  );

  state.star = { x, y, size, color: "#ffd966" };
}

function rectIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function collidesWithWalls(rect) {
  return state.walls.some((wall) => rectIntersect(rect, wall));
}

function getPlayerRect() {
  return {
    x: state.player.x,
    y: state.player.y,
    width: state.player.size,
    height: state.player.size,
  };
}

function getSpawnRect() {
  const size = state.player.size;
  return {
    x: Math.round(canvas.width / 2 - size / 2),
    y: Math.round(canvas.height / 2 - size / 2),
    width: size,
    height: size,
  };
}

function updatePlayer(delta) {
  const p = state.player;
  if (!state.playing) {
    p.turnInput = 0;
    return;
  }

  const turningLeft = state.keys.has("ArrowLeft") || state.keys.has("a");
  const turningRight = state.keys.has("ArrowRight") || state.keys.has("d");
  const turnInput = (turningRight ? 1 : 0) - (turningLeft ? 1 : 0);

  if (turnInput !== 0) {
    p.angle = normalizeAngle(p.angle + turnInput * p.turnSpeed * delta);
  }

  p.turnInput = turnInput;

  const accelerating = state.keys.has("ArrowUp") || state.keys.has("w");
  const decelerating = state.keys.has("ArrowDown") || state.keys.has("s");

  if (accelerating && !decelerating) {
    p.speed = clamp(p.speed + SPEED_ADJUST_RATE * delta, MIN_SPEED, MAX_SPEED);
  } else if (decelerating && !accelerating) {
    p.speed = clamp(p.speed - SPEED_ADJUST_RATE * delta, MIN_SPEED, MAX_SPEED);
  }

  const isDashing = state.keys.has(" ") && state.player.dashCooldown <= 0;
  const speed = isDashing ? p.dashSpeed : p.speed;

  const distance = speed * delta;
  const nextX = p.x + Math.cos(p.angle) * distance;
  const nextY = p.y + Math.sin(p.angle) * distance;

  const playerRect = { x: nextX, y: nextY, width: p.size, height: p.size };

  if (state.walls.some((wall) => rectIntersect(playerRect, wall))) {
    endGame();
    return;
  }

  p.x = Math.max(0, Math.min(canvas.width - p.size, nextX));
  p.y = Math.max(0, Math.min(canvas.height - p.size, nextY));

  if (isDashing) {
    state.player.dashCooldown = 0.6;
  }

  if (
    state.star &&
    rectIntersect(playerRect, {
      x: state.star.x,
      y: state.star.y,
      width: state.star.size,
      height: state.star.size,
    })
  ) {
    state.score += 1;
    if (state.score % SHAPE_CHANGE_INTERVAL === 0) {
      cycleArena();
    }
    spawnStar();
  }
}

function drawPlayer() {
  const p = state.player;
  const size = p.size;
  const half = size / 2;
  const centerX = p.x + half;
  const centerY = p.y + half;
  const now = performance.now ? performance.now() : Date.now();
  const pulse = Math.sin(now / 220) * (size * 0.04);
  const rotation = p.angle + Math.PI / 2;
  const tilt = p.turnInput * 0.12;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation + tilt);

  const glow = ctx.createRadialGradient(0, 0, size * 0.15, 0, 0, size * 0.6 + pulse);
  glow.addColorStop(0, "rgba(77, 181, 255, 0.9)");
  glow.addColorStop(1, "rgba(77, 181, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.6 + pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#4db5ff";
  ctx.beginPath();
  ctx.moveTo(0, -half * 0.95);
  ctx.lineTo(half * 0.75, half * 0.6);
  ctx.lineTo(-half * 0.75, half * 0.6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(9, 22, 38, 0.65)";
  ctx.beginPath();
  ctx.moveTo(0, -half * 0.55);
  ctx.quadraticCurveTo(half * 0.4, half * 0.2, 0, half * 0.45);
  ctx.quadraticCurveTo(-half * 0.4, half * 0.2, 0, -half * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f2fbff";
  ctx.beginPath();
  ctx.ellipse(0, -half * 0.18, half * 0.35, half * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(77, 181, 255, 0.35)";
  ctx.beginPath();
  ctx.ellipse(0, -half * 0.16, half * 0.25, half * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  const thrusterBase = half * 0.55;
  const thrusterLength = half * 0.35 + pulse * 0.6;
  const thruster = ctx.createLinearGradient(0, thrusterBase, 0, thrusterBase + thrusterLength);
  thruster.addColorStop(0, "rgba(255, 174, 94, 0.85)");
  thruster.addColorStop(1, "rgba(255, 109, 132, 0.6)");
  ctx.fillStyle = thruster;
  ctx.beginPath();
  ctx.moveTo(-half * 0.32, thrusterBase);
  ctx.lineTo(0, thrusterBase + thrusterLength);
  ctx.lineTo(half * 0.32, thrusterBase);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function draw() {
  ctx.fillStyle = "#030712";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(77, 181, 255, 0.4)";
  ctx.lineWidth = 6;
  ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

  state.walls.forEach((wall) => {
    ctx.fillStyle = "#ff4d6d";
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
  });

  drawPlayer();

  if (state.star) {
    ctx.save();
    ctx.translate(
      state.star.x + state.star.size / 2,
      state.star.y + state.star.size / 2
    );
    ctx.rotate(Date.now() / 300);
    ctx.fillStyle = state.star.color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(0, state.star.size / 2);
      ctx.rotate((Math.PI * 2) / 10);
      ctx.lineTo(0, state.star.size);
      ctx.rotate((Math.PI * 2) / 10);
    }
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "#c7dfff";
  ctx.font = "20px 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${state.score}`, 24, 36);

  if (state.messageTimer > 0) {
    const alpha = Math.min(1, state.messageTimer / MESSAGE_DURATION);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#f2f8ff";
    ctx.font = "28px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      state.message,
      canvas.width / 2,
      canvas.height / 2 - WALL_THICKNESS * 2
    );
    ctx.restore();
  }

  if (!state.playing) {
    ctx.save();
    ctx.fillStyle = "rgba(199, 223, 255, 0.85)";
    ctx.font = "22px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Respawning...",
      canvas.width / 2,
      canvas.height / 2 + WALL_THICKNESS * 4
    );
    ctx.restore();
  }
}

let previous = performance.now();

function loop(now) {
  const delta = (now - previous) / 1000;
  previous = now;

  if (state.playing) {
    updatePlayer(delta);
  }

  if (state.player.dashCooldown > 0) {
    state.player.dashCooldown = Math.max(
      0,
      state.player.dashCooldown - delta
    );
  }

  if (!state.playing && state.respawnTimer > 0) {
    state.respawnTimer -= delta;
    if (state.respawnTimer <= 0) {
      resetGame();
    }
  }

  if (state.messageTimer > 0) {
    state.messageTimer = Math.max(0, state.messageTimer - delta);
  }

  draw();
  requestAnimationFrame(loop);
}

function resetPlayerPosition() {
  const p = state.player;
  const centerX = canvas.width / 2 - p.size / 2;
  const topLimit = WALL_MARGIN + WALL_THICKNESS + 16;
  const bottomLimit = canvas.height - WALL_MARGIN - WALL_THICKNESS - p.size - 16;
  const preferredY = clamp(canvas.height / 2 - p.size / 2, topLimit, bottomLimit);

  const step = 4;
  const span = Math.max(0, bottomLimit - topLimit);
  const maxIterations = Math.floor(span / step) + 1;
  const offsets = [0];

  for (let i = 1; i <= maxIterations; i += 1) {
    offsets.push(i * step, -i * step);
  }

  for (const offset of offsets) {
    const candidateY = clamp(preferredY + offset, topLimit, bottomLimit);
    const candidateRect = {
      x: centerX,
      y: candidateY,
      width: p.size,
      height: p.size,
    };

    if (!collidesWithWalls(candidateRect)) {
      p.x = centerX;
      p.y = candidateY;
      p.angle = -Math.PI / 2;
      p.turnInput = 0;
      return;
    }
  }

  p.x = centerX;
  p.y = topLimit;
  p.angle = -Math.PI / 2;
  p.turnInput = 0;
}

function resetGame(message = "Collect the stars!") {
  state.score = 0;
  state.player.dashCooldown = 0;
  state.player.speed = MIN_SPEED;
  const spawnRect = getSpawnRect();
  state.player.x = spawnRect.x;
  state.player.y = spawnRect.y;
  state.player.angle = -Math.PI / 2;
  state.player.turnInput = 0;
  buildWalls(0, spawnRect);
  resetPlayerPosition();
  spawnStar();
  state.playing = true;
  state.respawnTimer = 0;
  state.message = message;
  state.messageTimer = MESSAGE_DURATION;
  previous = performance.now();
}

function endGame() {
  if (!state.playing) {
    return;
  }

  state.playing = false;
  state.respawnTimer = RESPAWN_DELAY;
  state.message = `Score: ${state.score}`;
  state.messageTimer = MESSAGE_DURATION;
  state.keys.clear();
}

function applyVirtualKeys(keys, isActive) {
  keys.forEach((key) => {
    if (isActive) {
      state.keys.add(key);
    } else {
      state.keys.delete(key);
    }
  });
}

function setupTouchControls() {
  const buttons = document.querySelectorAll('[data-control]');
  if (!buttons.length) {
    return;
  }

  const activePointers = new Map();

  const releasePointer = (pointerId) => {
    const entry = activePointers.get(pointerId);
    if (!entry) {
      return;
    }
    applyVirtualKeys(entry.keys, false);
    entry.button.classList.remove('is-active');
    activePointers.delete(pointerId);
  };

  buttons.forEach((button) => {
    button.addEventListener(
      'pointerdown',
      (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) {
          return;
        }
        const action = button.dataset.control;
        const keys = VIRTUAL_CONTROL_MAP[action];
        if (!keys) {
          return;
        }
        event.preventDefault();
        applyVirtualKeys(keys, true);
        const pointerId = event.pointerId ?? 'mouse';
        activePointers.set(pointerId, { keys, button });
        button.classList.add('is-active');
        if (typeof button.setPointerCapture === 'function' && event.pointerId !== undefined) {
          button.setPointerCapture(event.pointerId);
        }
      },
      { passive: false }
    );

    const endHandler = (event) => {
      const pointerId = event.pointerId ?? 'mouse';
      releasePointer(pointerId);
    };

    button.addEventListener('pointerup', endHandler);
    button.addEventListener('pointercancel', endHandler);
    button.addEventListener('lostpointercapture', endHandler);
    button.addEventListener('pointerleave', (event) => {
      const pointerId = event.pointerId ?? 'mouse';
      releasePointer(pointerId);
    });
  });

  window.addEventListener('blur', () => {
    activePointers.forEach(({ keys, button }) => {
      applyVirtualKeys(keys, false);
      button.classList.remove('is-active');
    });
    activePointers.clear();
  });
}

function init() {
  resetGame();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const isMovementKey = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    " ",
    "w",
    "a",
    "s",
    "d",
  ].includes(event.key);

  if (!state.playing) {
    if (event.key.toLowerCase() === "r") {
      resetGame();
    }
    return;
  }

  state.keys.add(event.key);

  if (isMovementKey) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.key);
});

setupTouchControls();
init();
