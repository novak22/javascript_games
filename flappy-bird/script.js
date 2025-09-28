const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreDisplay = document.getElementById("scoreDisplay");
const gameOverOverlay = document.getElementById("gameOver");
const finalScoreEl = document.getElementById("finalScore");
const retryButton = document.getElementById("retryButton");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_HEIGHT = 90;

const GRAVITY = 1500; // pixels per second squared
const FLAP_VELOCITY = -480; // pixels per second
const PIPE_SPEED = 220;
const PIPE_INTERVAL = 1.55; // seconds
const PIPE_WIDTH = 90;
const PIPE_GAP_MIN = 150;
const PIPE_GAP_MAX = 220;

const bird = {
  x: WIDTH * 0.32,
  y: HEIGHT * 0.5,
  radius: 18,
  velocity: 0,
  rotation: 0,
};

const pipes = [];
let pipeTimer = 0;
let score = 0;
let bestScore = 0;
let lastTimestamp = 0;
let idleTimer = 0;

let gameState = "ready"; // ready | running | gameover

const stars = Array.from({ length: 42 }, () => ({
  x: Math.random() * WIDTH,
  y: Math.random() * HEIGHT * 0.55,
  radius: Math.random() * 1.8 + 0.4,
  speed: 16 + Math.random() * 24,
  alpha: 0.5 + Math.random() * 0.5,
}));

const clouds = Array.from({ length: 4 }, (_, i) => ({
  x: WIDTH * (i / 4) + Math.random() * WIDTH,
  y: 60 + i * 45 + Math.random() * 60,
  width: 160 + Math.random() * 80,
  height: 40 + Math.random() * 20,
  speed: 25 + Math.random() * 20,
}));

const groundTiles = {
  offset: 0,
  speed: PIPE_SPEED,
  patternWidth: 80,
};

let audioContext = null;
let audioEnabled = false;

const audioQueue = [];

function ensureAudio() {
  if (audioEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    audioEnabled = false;
    return;
  }
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  audioEnabled = true;
  while (audioQueue.length) {
    const fn = audioQueue.shift();
    fn();
  }
}

function playTone(frequency, duration, type = "sine", volume = 0.2) {
  const play = () => {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  };

  if (!audioEnabled) {
    audioQueue.push(play);
    return;
  }

  play();
}

function playFlapSound() {
  playTone(620, 0.12, "triangle", 0.18);
}

function playScoreSound() {
  playTone(880, 0.18, "sine", 0.22);
}

function playHitSound() {
  playTone(220, 0.35, "sawtooth", 0.22);
}

function resetGame() {
  score = 0;
  pipeTimer = 0;
  idleTimer = 0;
  bird.y = HEIGHT * 0.45;
  bird.velocity = 0;
  bird.rotation = 0;
  pipes.length = 0;
  updateScore();
  gameState = "ready";
  gameOverOverlay.classList.add("hidden");
}

function startGame() {
  if (gameState === "running") return;
  ensureAudio();
  gameState = "running";
  bird.velocity = FLAP_VELOCITY;
  playFlapSound();
}

function gameOver() {
  if (gameState === "gameover") return;
  gameState = "gameover";
  playHitSound();
  bestScore = Math.max(bestScore, score);
  finalScoreEl.textContent = `${score} (Best ${bestScore})`;
  gameOverOverlay.classList.remove("hidden");
}

function flap() {
  if (gameState === "gameover") {
    restart(true);
    return;
  }

  if (gameState === "ready") {
    resetGame();
    startGame();
    return;
  }

  if (gameState !== "running") {
    startGame();
    return;
  }

  bird.velocity = FLAP_VELOCITY;
  playFlapSound();
}

function restart(startImmediately = false) {
  resetGame();
  if (startImmediately) {
    startGame();
  }
}

function updateScore() {
  scoreDisplay.textContent = score;
}

function spawnPipe() {
  const gapSize = PIPE_GAP_MIN + Math.random() * (PIPE_GAP_MAX - PIPE_GAP_MIN);
  const maxCenter = HEIGHT - GROUND_HEIGHT - gapSize / 2 - 40;
  const minCenter = 120 + gapSize / 2;
  const gapCenter = Math.max(minCenter, Math.min(maxCenter, Math.random() * (HEIGHT - GROUND_HEIGHT - 160) + 100));

  pipes.push({
    x: WIDTH + PIPE_WIDTH,
    width: PIPE_WIDTH,
    gapTop: gapCenter - gapSize / 2,
    gapBottom: gapCenter + gapSize / 2,
    scored: false,
  });
}

function updatePipes(dt) {
  for (let i = pipes.length - 1; i >= 0; i -= 1) {
    const pipe = pipes[i];
    pipe.x -= PIPE_SPEED * dt;

    if (!pipe.scored && pipe.x + pipe.width < bird.x - bird.radius) {
      pipe.scored = true;
      score += 1;
      updateScore();
      playScoreSound();
    }

    if (pipe.x + pipe.width < -10) {
      pipes.splice(i, 1);
    }
  }
}

function updateBackground(dt) {
  stars.forEach((star) => {
    star.x -= star.speed * dt;
    if (star.x < -star.radius) {
      star.x = WIDTH + Math.random() * WIDTH;
      star.y = Math.random() * HEIGHT * 0.55;
      star.radius = Math.random() * 1.8 + 0.4;
      star.speed = 16 + Math.random() * 24;
      star.alpha = 0.5 + Math.random() * 0.5;
    }
  });

  clouds.forEach((cloud) => {
    const speed = gameState === "running" ? cloud.speed : cloud.speed * 0.6;
    cloud.x -= speed * dt;
    if (cloud.x + cloud.width < -20) {
      cloud.x = WIDTH + Math.random() * WIDTH;
      cloud.y = 60 + Math.random() * 160;
      cloud.width = 160 + Math.random() * 80;
      cloud.height = 40 + Math.random() * 20;
    }
  });

  const groundSpeed = gameState === "running" ? groundTiles.speed : groundTiles.speed * 0.5;
  groundTiles.offset = (groundTiles.offset - groundSpeed * dt) % groundTiles.patternWidth;
}

function circleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function checkCollisions() {
  if (bird.y - bird.radius <= 0) {
    bird.y = bird.radius;
    bird.velocity = 0;
  }

  if (bird.y + bird.radius >= HEIGHT - GROUND_HEIGHT) {
    bird.y = HEIGHT - GROUND_HEIGHT - bird.radius;
    gameOver();
    return;
  }

  for (const pipe of pipes) {
    const topCollision = circleRectCollision(
      bird.x,
      bird.y,
      bird.radius,
      pipe.x,
      0,
      pipe.width,
      pipe.gapTop
    );
    const bottomCollision = circleRectCollision(
      bird.x,
      bird.y,
      bird.radius,
      pipe.x,
      pipe.gapBottom,
      pipe.width,
      HEIGHT - GROUND_HEIGHT - pipe.gapBottom
    );

    if (topCollision || bottomCollision) {
      gameOver();
      return;
    }
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#05091e");
  gradient.addColorStop(0.35, "#0d1c3f");
  gradient.addColorStop(0.8, "#0b1230");
  gradient.addColorStop(1, "#050816");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  stars.forEach((star) => {
    ctx.save();
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#dff9ff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  clouds.forEach((cloud) => {
    const gradientCloud = ctx.createLinearGradient(cloud.x, cloud.y, cloud.x, cloud.y + cloud.height);
    gradientCloud.addColorStop(0, "rgba(112, 196, 255, 0.45)");
    gradientCloud.addColorStop(1, "rgba(82, 148, 255, 0.25)");
    ctx.fillStyle = gradientCloud;
    ctx.beginPath();
    const segments = 5;
    const segmentWidth = cloud.width / segments;
    for (let i = 0; i <= segments; i += 1) {
      const arcX = cloud.x + i * segmentWidth;
      const arcY = cloud.y + (i % 2 === 0 ? 0 : 10);
      ctx.ellipse(arcX, arcY, segmentWidth * 0.9, cloud.height * 0.6, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  });
}

function drawPipes() {
  pipes.forEach((pipe) => {
    const topHeight = pipe.gapTop;
    const bottomY = pipe.gapBottom;
    const bottomHeight = HEIGHT - GROUND_HEIGHT - pipe.gapBottom;

    const gradientTop = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
    gradientTop.addColorStop(0, "#3ddad7");
    gradientTop.addColorStop(1, "#4b9dff");

    const gradientBottom = ctx.createLinearGradient(pipe.x, bottomY, pipe.x + pipe.width, bottomY + bottomHeight);
    gradientBottom.addColorStop(0, "#ff61c7");
    gradientBottom.addColorStop(1, "#6f7dff");

    ctx.fillStyle = gradientTop;
    ctx.fillRect(pipe.x, 0, pipe.width, topHeight);

    ctx.fillStyle = gradientBottom;
    ctx.fillRect(pipe.x, bottomY, pipe.width, bottomHeight);

    // pipe caps
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(pipe.x - 6, topHeight - 12, pipe.width + 12, 12);
    ctx.fillRect(pipe.x - 6, bottomY, pipe.width + 12, 12);
  });
}

function drawGround() {
  const groundY = HEIGHT - GROUND_HEIGHT;
  const gradient = ctx.createLinearGradient(0, groundY, 0, HEIGHT);
  gradient.addColorStop(0, "#0f2d3f");
  gradient.addColorStop(1, "#06131d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, groundY, WIDTH, GROUND_HEIGHT);

  ctx.save();
  ctx.translate(groundTiles.offset, 0);
  ctx.fillStyle = "rgba(130, 255, 227, 0.2)";
  for (let x = -groundTiles.patternWidth; x < WIDTH + groundTiles.patternWidth; x += groundTiles.patternWidth) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + groundTiles.patternWidth * 0.5, groundY - 16);
    ctx.lineTo(x + groundTiles.patternWidth, groundY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  const angle = Math.max(-0.6, Math.min(0.6, bird.velocity / 400));
  ctx.rotate(angle);

  const bodyGradient = ctx.createLinearGradient(-bird.radius, -bird.radius, bird.radius, bird.radius);
  bodyGradient.addColorStop(0, "#ffec9f");
  bodyGradient.addColorStop(0.5, "#ff9af1");
  bodyGradient.addColorStop(1, "#70f5ff");
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, bird.radius * 1.05, bird.radius * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#04070c";
  ctx.beginPath();
  ctx.arc(bird.radius * 0.45, -bird.radius * 0.15, bird.radius * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffde73";
  ctx.beginPath();
  ctx.moveTo(bird.radius * 0.7, 0);
  ctx.lineTo(bird.radius * 1.25, bird.radius * 0.12);
  ctx.lineTo(bird.radius * 0.7, bird.radius * 0.24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.beginPath();
  ctx.ellipse(-bird.radius * 0.5, bird.radius * 0.25, bird.radius * 0.7, bird.radius * 0.3, Math.PI / 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawStartText() {
  ctx.save();
  ctx.fillStyle = "rgba(130, 255, 227, 0.85)";
  ctx.font = "600 32px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Tap or press space to start", WIDTH / 2, HEIGHT * 0.45);
  ctx.font = "500 20px 'Segoe UI', sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.fillText("Stay between the neon pipes!", WIDTH / 2, HEIGHT * 0.45 + 32);
  ctx.restore();
}

function updateBird(dt) {
  if (gameState === "ready") {
    idleTimer += dt;
    bird.y = HEIGHT * 0.45 + Math.sin(idleTimer * 4) * 10;
    bird.velocity = Math.cos(idleTimer * 3) * 20;
    return;
  }

  if (gameState === "gameover") {
    bird.velocity += GRAVITY * dt;
    bird.y += bird.velocity * dt;
    if (bird.y + bird.radius >= HEIGHT - GROUND_HEIGHT) {
      bird.y = HEIGHT - GROUND_HEIGHT - bird.radius;
      bird.velocity = 0;
    }
    return;
  }

  bird.velocity += GRAVITY * dt;
  bird.y += bird.velocity * dt;
  bird.rotation = bird.velocity / 500;
}

function update(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const delta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  updateBackground(delta);
  updateBird(delta);

  if (gameState === "running") {
    pipeTimer += delta;
    if (pipeTimer >= PIPE_INTERVAL) {
      spawnPipe();
      pipeTimer = 0;
    }
    updatePipes(delta);
    checkCollisions();
  }

  drawBackground();
  drawPipes();
  drawGround();
  drawBird();

  if (gameState === "ready") {
    drawStartText();
  }

  requestAnimationFrame(update);
}

function attachControls() {
  function onPointer(event) {
    event.preventDefault();
    ensureAudio();
    flap();
  }

  canvas.addEventListener("pointerdown", onPointer);
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "ArrowUp") {
      event.preventDefault();
      ensureAudio();
      flap();
    }
    if (event.key === "r" || event.key === "R") {
      ensureAudio();
      restart(true);
    }
  });
  retryButton.addEventListener("click", () => {
    ensureAudio();
    restart(true);
  });
}

attachControls();
resetGame();
requestAnimationFrame(update);
