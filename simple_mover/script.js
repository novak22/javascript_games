const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WALL_MARGIN = 60;
const WALL_THICKNESS = 24;
const RESPAWN_DELAY = 1.1;
const MESSAGE_DURATION = 1.6;

const state = {
  player: {
    x: 0,
    y: 0,
    size: 36,
    color: "#4db5ff",
    speed: 220,
    dashSpeed: 400,
    dashCooldown: 0,
  },
  keys: new Set(),
  star: null,
  score: 0,
  walls: [],
  playing: true,
  respawnTimer: 0,
  message: "",
  messageTimer: 0,
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createWalls() {
  const innerSpan = canvas.width - WALL_MARGIN * 2 - WALL_THICKNESS * 2;
  const horizontalWidth = Math.round(innerSpan * 0.72);
  const horizontalOffset = Math.round((innerSpan - horizontalWidth) / 2);

  const topMidY = Math.round(canvas.height / 2 - WALL_THICKNESS * 2.2);
  const bottomMidY = Math.round(canvas.height / 2 + WALL_THICKNESS * 0.9);
  const pillarHeight = Math.max(
    80,
    Math.round(
      canvas.height / 2 - WALL_MARGIN - WALL_THICKNESS * 3.2 - 40
    )
  );

  state.walls = [
    {
      x: WALL_MARGIN,
      y: WALL_MARGIN,
      width: canvas.width - WALL_MARGIN * 2,
      height: WALL_THICKNESS,
    },
    {
      x: WALL_MARGIN,
      y: canvas.height - WALL_MARGIN - WALL_THICKNESS,
      width: canvas.width - WALL_MARGIN * 2,
      height: WALL_THICKNESS,
    },
    {
      x: WALL_MARGIN,
      y: WALL_MARGIN,
      width: WALL_THICKNESS,
      height: canvas.height - WALL_MARGIN * 2,
    },
    {
      x: canvas.width - WALL_MARGIN - WALL_THICKNESS,
      y: WALL_MARGIN,
      width: WALL_THICKNESS,
      height: canvas.height - WALL_MARGIN * 2,
    },
    {
      x: WALL_MARGIN + WALL_THICKNESS + horizontalOffset,
      y: topMidY,
      width: horizontalWidth,
      height: WALL_THICKNESS,
    },
    {
      x: WALL_MARGIN + WALL_THICKNESS + Math.round(horizontalOffset / 2),
      y: bottomMidY,
      width: horizontalWidth + horizontalOffset,
      height: WALL_THICKNESS,
    },
    {
      x: Math.round(canvas.width / 2 - WALL_THICKNESS * 1.5),
      y: WALL_MARGIN + WALL_THICKNESS + 40,
      width: WALL_THICKNESS * 3,
      height: pillarHeight,
    },
  ];
}

function spawnStar() {
  const padding = 110;
  let x;
  let y;
  const size = 16;

  do {
    x = randInt(padding, canvas.width - padding - size);
    y = randInt(padding, canvas.height - padding - size);
  } while (
    state.walls.some((wall) =>
      rectIntersect(
        { x, y, width: size, height: size },
        wall
      )
    )
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

function updatePlayer(delta) {
  if (!state.playing) {
    return;
  }

  const p = state.player;
  let dx = 0;
  let dy = 0;

  if (state.keys.has("ArrowLeft") || state.keys.has("a")) dx -= 1;
  if (state.keys.has("ArrowRight") || state.keys.has("d")) dx += 1;
  if (state.keys.has("ArrowUp") || state.keys.has("w")) dy -= 1;
  if (state.keys.has("ArrowDown") || state.keys.has("s")) dy += 1;

  const length = Math.hypot(dx, dy);
  if (length > 0) {
    dx /= length;
    dy /= length;
  }

  const isDashing = state.keys.has(" ") && state.player.dashCooldown <= 0;
  const speed = isDashing ? p.dashSpeed : p.speed;

  const distance = speed * delta;
  const nextX = p.x + dx * distance;
  const nextY = p.y + dy * distance;

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

  const starRect = {
    x: state.star.x,
    y: state.star.y,
    width: state.star.size,
    height: state.star.size,
  };

  if (rectIntersect(playerRect, starRect)) {
    state.score += 1;
    spawnStar();
  }
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

  const p = state.player;
  ctx.fillStyle = p.color;
  ctx.fillRect(p.x, p.y, p.size, p.size);

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
  p.x = canvas.width / 2 - p.size / 2;

  const upperSafeY = WALL_MARGIN + WALL_THICKNESS + 24;
  const blockingWalls = state.walls.filter(
    (wall) =>
      wall.height === WALL_THICKNESS &&
      wall.y > WALL_MARGIN &&
      wall.y < canvas.height / 2
  );

  let lowerSafeY = canvas.height / 2 - p.size - 24;

  if (blockingWalls.length > 0) {
    const minBlocking = Math.min(
      ...blockingWalls.map((wall) => wall.y - p.size - 24)
    );
    lowerSafeY = Math.min(lowerSafeY, minBlocking);
  }

  const preferredY = canvas.height / 2 - p.size / 2;
  p.y = Math.max(upperSafeY, Math.min(lowerSafeY, preferredY));
}

function resetGame(message = "Collect the stars!") {
  state.score = 0;
  state.player.dashCooldown = 0;
  createWalls();
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

init();
