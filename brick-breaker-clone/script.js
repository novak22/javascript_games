const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const overlayAction = document.getElementById("overlay-action");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const livesEl = document.getElementById("lives");

const paddle = {
  width: 140,
  height: 18,
  x: 0,
  y: canvas.height - 70,
  speed: 540,
  moveDir: 0,
};

const ball = {
  radius: 10,
  x: canvas.width / 2,
  y: canvas.height - 90,
  vx: 0,
  vy: 0,
  speed: 360,
  onPaddle: true,
};

let bricks = [];
let score = 0;
let level = 1;
let lives = 3;
let gameState = "intro"; // intro | running | paused | between | over
let lastTime = performance.now();

const COLORS = ["#77f0ff", "#69f7a3", "#f7d96b", "#ff8cf9", "#ff6584"];

function updateHud() {
  scoreEl.textContent = score.toString();
  levelEl.textContent = level.toString();
  livesEl.textContent = lives.toString();
}

function showOverlay(title, message, actionLabel) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlayAction.textContent = actionLabel;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function resetBall() {
  ball.onPaddle = true;
  ball.x = paddle.x + paddle.width / 2;
  ball.y = paddle.y - ball.radius - 2;
  ball.vx = 0;
  ball.vy = 0;
  ball.speed = 360 + (level - 1) * 28;
}

function launchBall() {
  ball.onPaddle = false;
  const angle = (-25 + Math.random() * 50) * (Math.PI / 180);
  ball.vx = Math.sin(angle) * ball.speed;
  ball.vy = -Math.cos(angle) * ball.speed;
}

function buildBricks() {
  bricks = [];
  const cols = 10;
  const baseRows = 3 + Math.min(level - 1, 2);
  const extraRows = Math.floor((level - 1) / 3);
  const rows = Math.min(baseRows + extraRows, 8);
  const brickWidth = 76;
  const brickHeight = 26;
  const gap = 8;
  const totalWidth = cols * brickWidth + (cols - 1) * gap;
  const offsetX = (canvas.width - totalWidth) / 2;
  const offsetY = 90;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const durability = 1 + Math.floor((row + level - 1) / 3);
      bricks.push({
        x: offsetX + col * (brickWidth + gap),
        y: offsetY + row * (brickHeight + gap),
        width: brickWidth,
        height: brickHeight,
        hits: durability,
        maxHits: durability,
        alive: true,
      });
    }
  }
}

function startLevel(newLevel = false) {
  if (newLevel) {
    level += 1;
    lives = Math.min(lives + 1, 6);
  }
  paddle.width = Math.max(90, 140 - (level - 1) * 6);
  paddle.x = (canvas.width - paddle.width) / 2;
  buildBricks();
  resetBall();
  updateHud();
}

function startRun(launch = true) {
  gameState = "running";
  lastTime = performance.now();
  if (launch) {
    launchBall();
  }
}

function loseLife() {
  lives -= 1;
  updateHud();
  if (lives <= 0) {
    gameState = "over";
    showOverlay(
      "Game over",
      `You cleared ${level} ${level === 1 ? "level" : "levels"} and scored ${score} points.`,
      "Play again"
    );
  } else {
    resetBall();
    showOverlay("Ouch!", "You lost a life. Ready to jump back in?", "Resume");
    gameState = "between";
  }
}

function handleBrickHit(brick) {
  brick.hits -= 1;
  score += 100 * brick.maxHits;
  updateHud();
  if (brick.hits <= 0) {
    brick.alive = false;
  }

  const remaining = bricks.filter((b) => b.alive).length;
  if (remaining === 0) {
    gameState = "between";
    showOverlay("Level clear!", `Level ${level} complete. Ready for more heat?`, "Next level");
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawRoundedRectPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function update(delta) {
  // Paddle movement
  paddle.x += paddle.moveDir * paddle.speed * delta;
  paddle.x = clamp(paddle.x, 0, canvas.width - paddle.width);

  if (ball.onPaddle) {
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.radius - 2;
  } else {
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;
  }

  // Wall collisions
  if (ball.x - ball.radius <= 0 && ball.vx < 0) {
    ball.x = ball.radius;
    ball.vx *= -1;
  }

  if (ball.x + ball.radius >= canvas.width && ball.vx > 0) {
    ball.x = canvas.width - ball.radius;
    ball.vx *= -1;
  }

  if (ball.y - ball.radius <= 0 && ball.vy < 0) {
    ball.y = ball.radius;
    ball.vy *= -1;
  }

  if (ball.y - ball.radius > canvas.height) {
    loseLife();
  }

  // Paddle collision
  if (!ball.onPaddle) {
    const withinX = ball.x + ball.radius >= paddle.x && ball.x - ball.radius <= paddle.x + paddle.width;
    const withinY = ball.y + ball.radius >= paddle.y && ball.y - ball.radius <= paddle.y + paddle.height;
    if (withinX && withinY && ball.vy > 0) {
      ball.y = paddle.y - ball.radius;
      const relative = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
      const maxBounce = (70 * Math.PI) / 180; // 70 degrees
      const clamped = clamp(relative, -1, 1);
      const angle = clamped * maxBounce;
      const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.03, 760);
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
    }
  }

  // Brick collisions
  if (!ball.onPaddle) {
    for (const brick of bricks) {
      if (!brick.alive) continue;
      if (
        ball.x + ball.radius < brick.x ||
        ball.x - ball.radius > brick.x + brick.width ||
        ball.y + ball.radius < brick.y ||
        ball.y - ball.radius > brick.y + brick.height
      ) {
        continue;
      }

      const overlapLeft = ball.x + ball.radius - brick.x;
      const overlapRight = brick.x + brick.width - (ball.x - ball.radius);
      const overlapTop = ball.y + ball.radius - brick.y;
      const overlapBottom = brick.y + brick.height - (ball.y - ball.radius);
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      if (minOverlap === overlapLeft || minOverlap === overlapRight) {
        ball.vx *= -1;
      } else {
        ball.vy *= -1;
      }

      handleBrickHit(brick);
      break;
    }
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#06071b");
  gradient.addColorStop(0.45, "#0e1234");
  gradient.addColorStop(1, "#06071b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(120, 150, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let y = 80; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  for (let x = 0; x < canvas.width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 80);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

function drawPaddle() {
  ctx.fillStyle = "rgba(108, 247, 255, 0.9)";
  const radius = 12;
  const { x, y, width, height } = paddle;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  const gradient = ctx.createRadialGradient(ball.x - 4, ball.y - 4, 2, ball.x, ball.y, ball.radius);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.4, "#b6f9ff");
  gradient.addColorStop(1, "#61a1ff");
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawBricks() {
  for (const brick of bricks) {
    if (!brick.alive) continue;
    const strength = brick.maxHits;
    const colorIndex = Math.min(COLORS.length - 1, strength - 1);
    const color = COLORS[colorIndex];

    const gradient = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.25, color);
    gradient.addColorStop(1, "#1a1e44");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1.3;

    drawRoundedRectPath(brick.x, brick.y, brick.width, brick.height, 10);
    ctx.fill();
    ctx.stroke();
  }
}

function draw() {
  drawBackground();
  drawPaddle();
  drawBall();
  drawBricks();
}

function gameLoop(timestamp) {
  const delta = Math.min((timestamp - lastTime) / 1000, 0.04);
  lastTime = timestamp;

  if (gameState === "running") {
    update(delta);
  }

  draw();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

overlayAction.addEventListener("click", () => {
  if (gameState === "intro") {
    score = 0;
    level = 1;
    lives = 3;
    startLevel();
    hideOverlay();
    updateHud();
    startRun(true);
  } else if (gameState === "between") {
    if (bricks.every((brick) => !brick.alive)) {
      startLevel(true);
      hideOverlay();
      startRun(true);
    } else {
      hideOverlay();
      startRun(false);
    }
  } else if (gameState === "over") {
    score = 0;
    level = 1;
    lives = 3;
    startLevel();
    hideOverlay();
    updateHud();
    startRun(true);
  } else if (gameState === "paused") {
    hideOverlay();
    startRun(false);
  }
});

function togglePause() {
  if (gameState === "running") {
    gameState = "paused";
    showOverlay("Paused", "Take a breather. Ready when you are!", "Resume");
  } else if (gameState === "paused") {
    gameState = "between";
    hideOverlay();
    startRun(false);
  }
}

document.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    paddle.moveDir = -1;
    event.preventDefault();
  } else if (event.code === "ArrowRight" || event.code === "KeyD") {
    paddle.moveDir = 1;
    event.preventDefault();
  } else if (event.code === "Space") {
    event.preventDefault();
    if (gameState === "intro" || gameState === "over") return;
    if (gameState === "running" && !ball.onPaddle) {
      togglePause();
    } else if (gameState === "paused") {
      togglePause();
    } else if (ball.onPaddle && gameState === "running") {
      launchBall();
    }
  }
});

document.addEventListener("keyup", (event) => {
  if (
    event.code === "ArrowLeft" ||
    event.code === "ArrowRight" ||
    event.code === "KeyA" ||
    event.code === "KeyD"
  ) {
    if (
      (event.code === "ArrowLeft" || event.code === "KeyA") &&
      paddle.moveDir === -1
    ) {
      paddle.moveDir = 0;
    } else if (
      (event.code === "ArrowRight" || event.code === "KeyD") &&
      paddle.moveDir === 1
    ) {
      paddle.moveDir = 0;
    }
  }
});

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const position = event.clientX - rect.left;
  paddle.x = clamp(position - paddle.width / 2, 0, canvas.width - paddle.width);
});

canvas.addEventListener("pointerdown", () => {
  if (gameState === "running" && ball.onPaddle) {
    launchBall();
  }
});

showOverlay(
  "Neon Brick Breaker",
  "Smash through neon blocks with your paddle. Clear waves to climb levels and earn extra lives.",
  "Start game"
);
updateHud();
