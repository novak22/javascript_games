const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const gameOverOverlay = document.getElementById("game-over");
const retryButton = document.getElementById("retry-btn");
const finalScoreEl = document.getElementById("final-score");

const WALL_MARGIN = 90;
const WALL_THICKNESS = 30;

const state = {
  player: {
    x: 0,
    y: 0,
    size: 36,
    color: "#4db5ff",
    speed: 200,
    dashSpeed: 380,
    dashCooldown: 0,
  },
  keys: new Set(),
  star: null,
  score: 0,
  walls: [],
  playing: true,
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createWalls() {
  const innerSpan = canvas.width - WALL_MARGIN * 2 - WALL_THICKNESS * 2;

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
      x: WALL_MARGIN + WALL_THICKNESS + innerSpan * 0.1,
      y: canvas.height / 2 - WALL_THICKNESS * 1.5,
      width: innerSpan * 0.8,
      height: WALL_THICKNESS,
    },
    {
      x: WALL_MARGIN + WALL_THICKNESS + innerSpan * 0.1,
      y: canvas.height / 2 + WALL_THICKNESS * 0.5,
      width: innerSpan * 0.8,
      height: WALL_THICKNESS,
    },
  ];
}

function spawnStar() {
  const padding = 120;
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

  const length = Math.hypot(dx, dy) || 1;
  dx /= length;
  dy /= length;

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

  if (state.player.dashCooldown > 0) {
    state.player.dashCooldown -= delta;
  }

  if (state.player.dashCooldown < 0) {
    state.player.dashCooldown = 0;
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
    ctx.translate(state.star.x + state.star.size / 2, state.star.y + state.star.size / 2);
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
  ctx.fillText(`Score: ${state.score}`, 24, 36);

  if (!state.playing) {
    ctx.textAlign = "left";
  }
}

let previous = performance.now();

function loop(now) {
  const delta = (now - previous) / 1000;
  previous = now;

  updatePlayer(delta);
  draw();
  requestAnimationFrame(loop);
}

function resetPlayerPosition() {
  const p = state.player;

  p.x = canvas.width / 2 - p.size / 2;

  const upperSafeY = WALL_MARGIN + WALL_THICKNESS + 20;
  const lowerSafeY =
    canvas.height / 2 - WALL_THICKNESS * 1.5 - p.size - 20;

  const preferredY = canvas.height / 2 - p.size / 2;
  const clampedY = Math.min(lowerSafeY, preferredY);

  p.y = Math.max(upperSafeY, clampedY);
}

function resetGame() {
  state.score = 0;
  state.player.dashCooldown = 0;
  state.keys.clear();
  resetPlayerPosition();
  createWalls();
  spawnStar();
  state.playing = true;
  gameOverOverlay.hidden = true;
  previous = performance.now();
}

function endGame() {
  if (!state.playing) {
    return;
  }
  state.playing = false;
  finalScoreEl.textContent = state.score.toString();
  gameOverOverlay.hidden = false;
  retryButton.focus();
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

  if (!gameOverOverlay.hidden) {
    resetGame();
  }

  if (!state.playing) {
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

retryButton.addEventListener("click", () => {
  resetGame();
});

init();
