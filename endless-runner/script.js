const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const restartButton = document.getElementById("restart");

const BASE_WIDTH = 960;
const BASE_HEIGHT = 540;
const GRAVITY = 2200; // px per second^2
const JUMP_VELOCITY = -900;
const DUCK_SCALE = 0.6;
const BASE_SPEED = 320; // px per second
const OBSTACLE_SPAWN_MIN = 700;
const OBSTACLE_SPAWN_MAX = 1400;
const DAY_DURATION = 45000; // ms for full cycle

let dpr = window.devicePixelRatio || 1;

const state = {
  running: true,
  gameOver: false,
  elapsed: 0,
  score: 0,
  speed: BASE_SPEED,
  spawnTimer: 0,
  obstacles: [],
  clouds: [],
  groundOffset: 0,
  dayTimer: 0,
  lastTimestamp: 0,
};

const input = {
  jump: false,
  duck: false,
  pointerLeft: false,
  pointerRight: false,
};

class Runner {
  constructor() {
    this.width = 70;
    this.height = 100;
    this.x = 120;
    this.y = BASE_HEIGHT * 0.75 - this.height;
    this.velocityY = 0;
    this.ducking = false;
    this.runningTime = 0;
  }

  reset() {
    this.y = getGroundY() - this.height;
    this.velocityY = 0;
    this.ducking = false;
    this.runningTime = 0;
  }

  update(delta) {
    this.runningTime += delta;

    if ((input.jump || input.pointerLeft) && this.onGround()) {
      this.velocityY = JUMP_VELOCITY;
      this.ducking = false;
    } else if ((input.duck || input.pointerRight) && this.onGround()) {
      this.ducking = true;
    } else if (!(input.duck || input.pointerRight)) {
      this.ducking = false;
    }

    this.y += this.velocityY * delta;
    this.velocityY += GRAVITY * delta;

    if (this.onGround()) {
      this.y = getGroundY() - this.getHeight();
      this.velocityY = 0;
    }
  }

  onGround() {
    return this.y >= getGroundY() - this.getHeight() - 1;
  }

  getHeight() {
    return this.ducking ? this.height * DUCK_SCALE : this.height;
  }

  draw(ctx) {
    const height = this.getHeight();
    const baseY = this.y + height;
    const frame = Math.floor((this.runningTime * 12) % 4);

    ctx.save();
    ctx.translate(this.x, baseY - height);

    // Body
    ctx.fillStyle = "#39ff14";
    ctx.fillRect(10, height * 0.15, 28, height * 0.55);

    // Head
    ctx.fillStyle = "#ff2bd6";
    ctx.fillRect(0, 0, 46, height * 0.25);
    ctx.fillStyle = "#0b0315";
    ctx.fillRect(8, height * 0.08, 12, height * 0.12);

    // Legs animation
    ctx.fillStyle = "#39ff14";
    const legOffset = this.onGround() ? Math.sin(this.runningTime * 18) * 12 : 0;
    const legWidth = 10;
    ctx.fillRect(12 + legOffset, height * 0.65, legWidth, height * 0.35);
    ctx.fillRect(24 - legOffset, height * 0.65, legWidth, height * 0.35);

    // Arms
    ctx.fillStyle = "#ff9ef6";
    const armSwing = this.onGround() ? Math.sin(this.runningTime * 18 + Math.PI) * 8 : 0;
    ctx.fillRect(38, height * 0.2, 8, height * 0.45 + armSwing);
    ctx.fillRect(0, height * 0.2, 8, height * 0.45 - armSwing);

    ctx.restore();

    // Neon trail
    ctx.save();
    ctx.globalAlpha = 0.35;
    const trailWidth = 60;
    ctx.fillStyle = "rgba(255, 43, 214, 0.2)";
    ctx.fillRect(this.x - trailWidth, baseY - height * 0.6, trailWidth, height * 0.55);
    ctx.restore();
  }
}

class Obstacle {
  constructor(type, speed) {
    this.type = type;
    this.speed = speed;
    if (type === "drone") {
      this.width = 70;
      this.height = 50;
      this.y = getGroundY() - this.height - 90;
    } else if (type === "wall") {
      this.width = 50;
      this.height = 120;
      this.y = getGroundY() - this.height;
    } else {
      this.width = 40;
      this.height = 80;
      this.y = getGroundY() - this.height;
    }
    this.x = canvas.width / dpr + 120;
  }

  update(delta, speedBoost) {
    this.x -= (this.speed + speedBoost) * delta;
  }

  isOffscreen() {
    return this.x + this.width < -200;
  }

  collides(runner) {
    const runnerHeight = runner.getHeight();
    const runnerY = runner.y + runnerHeight;
    const runnerX = runner.x;

    return (
      runnerX < this.x + this.width - 12 &&
      runnerX + 46 > this.x + 12 &&
      runnerY > this.y + 12 &&
      runner.y < this.y + this.height - 12
    );
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type === "drone") {
      drawDrone(ctx, this.width, this.height);
    } else if (this.type === "wall") {
      drawWall(ctx, this.width, this.height);
    } else {
      drawSpikes(ctx, this.width, this.height);
    }

    ctx.restore();
  }
}

function getGroundY() {
  return canvas.height / dpr * 0.8;
}

const runner = new Runner();

function resetGame() {
  state.running = true;
  state.gameOver = false;
  state.elapsed = 0;
  state.score = 0;
  state.speed = BASE_SPEED;
  state.spawnTimer = randomRange(OBSTACLE_SPAWN_MIN, OBSTACLE_SPAWN_MAX);
  state.obstacles = [];
  state.dayTimer = 0;
  state.groundOffset = 0;
  state.clouds = generateClouds();
  runner.reset();
  restartButton.classList.add("hidden");
  scoreEl.textContent = "0";
  state.lastTimestamp = performance.now();
  requestAnimationFrame(loop);
}

function generateClouds() {
  const clouds = [];
  const total = 6;
  for (let i = 0; i < total; i += 1) {
    clouds.push({
      x: Math.random() * canvas.width,
      y: Math.random() * (canvas.height * 0.4),
      speed: 30 + Math.random() * 40,
      scale: 0.6 + Math.random() * 0.8,
      alpha: 0.25 + Math.random() * 0.2,
    });
  }
  return clouds;
}

function loop(timestamp) {
  if (!state.running) return;
  if (!state.lastTimestamp) state.lastTimestamp = timestamp;
  const delta = Math.min((timestamp - state.lastTimestamp) / 1000, 0.05);
  state.lastTimestamp = timestamp;

  update(delta);
  draw();

  if (!state.gameOver) {
    requestAnimationFrame(loop);
  }
}

function update(delta) {
  state.elapsed += delta;
  state.dayTimer = (state.dayTimer + delta * 1000) % DAY_DURATION;
  const difficulty = 1 + state.score / 5000;
  const speedBoost = (difficulty - 1) * 150;
  state.speed = BASE_SPEED * difficulty;

  runner.update(delta);

  state.obstacles.forEach((obstacle) => obstacle.update(delta, speedBoost));
  state.obstacles = state.obstacles.filter((o) => !o.isOffscreen());

  state.spawnTimer -= delta * 1000;
  if (state.spawnTimer <= 0) {
    const typeRoll = Math.random();
    let type = "spike";
    if (typeRoll > 0.8) type = "drone";
    else if (typeRoll > 0.5) type = "wall";
    state.obstacles.push(new Obstacle(type, state.speed));
    state.spawnTimer = randomRange(OBSTACLE_SPAWN_MIN / difficulty, OBSTACLE_SPAWN_MAX / difficulty);
  }

  for (const obstacle of state.obstacles) {
    if (obstacle.collides(runner)) {
      handleGameOver();
      break;
    }
  }

  state.clouds.forEach((cloud) => {
    cloud.x -= cloud.speed * delta;
    if (cloud.x + 120 * cloud.scale < 0) {
      cloud.x = canvas.width + Math.random() * 200;
      cloud.y = Math.random() * (canvas.height * 0.4);
      cloud.speed = 30 + Math.random() * 40;
      cloud.alpha = 0.25 + Math.random() * 0.2;
    }
  });

  const groundSpeed = state.speed * delta;
  state.groundOffset = (state.groundOffset + groundSpeed) % (canvas.width / 4);

  state.score += delta * 120 * difficulty;
  scoreEl.textContent = Math.floor(state.score).toString();
}

function draw() {
  const cycleProgress = state.dayTimer / DAY_DURATION;
  const skyGradient = getSkyGradient(cycleProgress);
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars(cycleProgress);
  drawClouds();
  drawMountains();
  drawGround();
  runner.draw(ctx);
  state.obstacles.forEach((obstacle) => obstacle.draw(ctx));

  if (state.gameOver) {
    drawGameOver();
  }
}

function drawClouds() {
  ctx.save();
  state.clouds.forEach((cloud) => {
    ctx.globalAlpha = cloud.alpha;
    ctx.fillStyle = "#fdf6ff";
    drawCloud(ctx, cloud.x, cloud.y, 60 * cloud.scale, 24 * cloud.scale);
  });
  ctx.restore();
}

function drawCloud(ctx, x, y, width, height) {
  ctx.beginPath();
  ctx.ellipse(x, y, width, height, 0, 0, Math.PI * 2);
  ctx.ellipse(x - width * 0.8, y + height * 0.2, width * 0.7, height * 0.8, 0, 0, Math.PI * 2);
  ctx.ellipse(x + width * 0.8, y + height * 0.2, width * 0.7, height * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMountains() {
  ctx.save();
  ctx.fillStyle = "rgba(10, 4, 25, 0.65)";
  ctx.beginPath();
  ctx.moveTo(0, getGroundY());
  ctx.lineTo(canvas.width * 0.2, getGroundY() - 120);
  ctx.lineTo(canvas.width * 0.35, getGroundY());
  ctx.lineTo(canvas.width * 0.55, getGroundY() - 150);
  ctx.lineTo(canvas.width * 0.8, getGroundY());
  ctx.lineTo(canvas.width, getGroundY() - 110);
  ctx.lineTo(canvas.width, getGroundY());
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGround() {
  ctx.save();
  const groundY = getGroundY();
  ctx.fillStyle = "#160a34";
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

  ctx.strokeStyle = "rgba(255, 43, 214, 0.35)";
  ctx.lineWidth = 4;
  const segmentWidth = canvas.width / 6;
  ctx.beginPath();
  for (let x = -segmentWidth; x < canvas.width + segmentWidth; x += segmentWidth) {
    const offset = (x + state.groundOffset) % (canvas.width + segmentWidth);
    ctx.moveTo(offset, groundY + 6);
    ctx.lineTo(offset + segmentWidth * 0.4, groundY + 18);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSpikes(ctx, width, height) {
  ctx.fillStyle = "#39ff14";
  const spikes = 4;
  const spikeWidth = width / spikes;
  for (let i = 0; i < spikes; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * spikeWidth, height);
    ctx.lineTo(i * spikeWidth + spikeWidth / 2, 0);
    ctx.lineTo((i + 1) * spikeWidth, height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawWall(ctx, width, height) {
  ctx.fillStyle = "#ff2bd6";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(57, 255, 20, 0.6)";
  for (let y = 10; y < height; y += 22) {
    ctx.fillRect(6, y, width - 12, 6);
  }
}

function drawDrone(ctx, width, height) {
  ctx.fillStyle = "#ff9ef6";
  ctx.fillRect(0, height * 0.4, width, height * 0.4);
  ctx.fillStyle = "#0b0315";
  ctx.fillRect(width * 0.1, height * 0.5, width * 0.8, height * 0.2);
  ctx.fillStyle = "#39ff14";
  ctx.fillRect(width * 0.4, 0, width * 0.2, height * 0.4);
  ctx.fillStyle = "rgba(255, 43, 214, 0.8)";
  ctx.fillRect(width * 0.1, height * 0.82, width * 0.2, height * 0.1);
  ctx.fillRect(width * 0.7, height * 0.82, width * 0.2, height * 0.1);
}

function drawStars(progress) {
  if (progress < 0.2 || progress > 0.8) {
    ctx.save();
    const alpha = progress < 0.2 ? 1 - progress / 0.2 : (progress - 0.8) / 0.2;
    ctx.globalAlpha = Math.min(alpha, 1) * 0.8;
    ctx.fillStyle = "white";
    for (let i = 0; i < 60; i += 1) {
      const x = (i * 97) % canvas.width;
      const y = (i * 53) % (canvas.height * 0.5);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }
}

function getSkyGradient(progress) {
  const dayColorTop = [18, 6, 43];
  const dayColorBottom = [4, 1, 14];
  const duskColorTop = [5, 2, 15];
  const duskColorBottom = [2, 0, 6];
  const nightColorTop = [2, 0, 6];
  const nightColorBottom = [1, 0, 3];

  let topColor;
  let bottomColor;

  if (progress < 0.25) {
    const t = progress / 0.25;
    topColor = lerpColor(duskColorTop, dayColorTop, t);
    bottomColor = lerpColor(duskColorBottom, dayColorBottom, t);
  } else if (progress < 0.5) {
    const t = (progress - 0.25) / 0.25;
    topColor = lerpColor(dayColorTop, duskColorTop, t);
    bottomColor = lerpColor(dayColorBottom, duskColorBottom, t);
  } else if (progress < 0.75) {
    const t = (progress - 0.5) / 0.25;
    topColor = lerpColor(duskColorTop, nightColorTop, t);
    bottomColor = lerpColor(duskColorBottom, nightColorBottom, t);
  } else {
    const t = (progress - 0.75) / 0.25;
    topColor = lerpColor(nightColorTop, duskColorTop, t);
    bottomColor = lerpColor(nightColorBottom, duskColorBottom, t);
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, colorToCss(topColor));
  gradient.addColorStop(1, colorToCss(bottomColor));
  return gradient;
}

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function colorToCss(rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function drawGameOver() {
  ctx.save();
  ctx.fillStyle = "rgba(5, 2, 15, 0.8)";
  ctx.fillRect(canvas.width / 2 - 180, canvas.height / 2 - 70, 360, 140);
  ctx.strokeStyle = "#ff2bd6";
  ctx.lineWidth = 3;
  ctx.strokeRect(canvas.width / 2 - 180, canvas.height / 2 - 70, 360, 140);

  ctx.fillStyle = "#39ff14";
  ctx.font = `${32 * dpr}px 'Press Start 2P', 'Segoe UI', sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 10);

  ctx.fillStyle = "#fdf6ff";
  ctx.font = `${18 * dpr}px 'Press Start 2P', 'Segoe UI', sans-serif`;
  ctx.fillText("Tap / Press Restart", canvas.width / 2, canvas.height / 2 + 40);
  ctx.restore();
}

function handleGameOver() {
  state.gameOver = true;
  state.running = false;
  restartButton.classList.remove("hidden");
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function handleKeyDown(event) {
  if (event.repeat) return;
  switch (event.code) {
    case "ArrowUp":
    case "Space":
    case "KeyW":
      input.jump = true;
      break;
    case "ArrowDown":
    case "KeyS":
      input.duck = true;
      break;
    case "Enter":
      if (state.gameOver) resetGame();
      break;
  }
}

function handleKeyUp(event) {
  switch (event.code) {
    case "ArrowUp":
    case "Space":
    case "KeyW":
      input.jump = false;
      break;
    case "ArrowDown":
    case "KeyS":
      input.duck = false;
      break;
  }
}

function handlePointerDown(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX || (event.touches && event.touches[0].clientX)) - rect.left;
  const half = rect.width / 2;
  const isLeft = x < half;
  input.pointerLeft = isLeft;
  input.pointerRight = !isLeft;
}

function handlePointerUp() {
  input.pointerLeft = false;
  input.pointerRight = false;
}

function resize() {
  dpr = window.devicePixelRatio || 1;
  const displayWidth = canvas.clientWidth || BASE_WIDTH;
  const displayHeight = (displayWidth / BASE_WIDTH) * BASE_HEIGHT;
  canvas.height = displayHeight * dpr;
  canvas.width = displayWidth * dpr;
  canvas.style.height = `${displayHeight}px`;
  canvas.style.width = `${displayWidth}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  runner.reset();
  state.clouds = generateClouds();
}

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("resize", resize);
canvas.addEventListener("mousedown", handlePointerDown);
canvas.addEventListener("mouseup", handlePointerUp);
canvas.addEventListener("mouseleave", handlePointerUp);
canvas.addEventListener("touchstart", (event) => {
  handlePointerDown(event.touches[0]);
  event.preventDefault();
});
canvas.addEventListener("touchend", () => handlePointerUp());
canvas.addEventListener("touchcancel", () => handlePointerUp());

restartButton.addEventListener("click", resetGame);

resize();
resetGame();
