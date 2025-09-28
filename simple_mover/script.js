const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const state = {
  player: {
    x: canvas.width / 2 - 16,
    y: canvas.height / 2 - 16,
    size: 32,
    color: "#4db5ff",
    speed: 150,
    dashSpeed: 320,
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
  state.walls = [
    { x: 40, y: 40, width: 400, height: 20 },
    { x: 40, y: 260, width: 400, height: 20 },
    { x: 40, y: 40, width: 20, height: 240 },
    { x: 420, y: 40, width: 20, height: 240 },
    { x: 150, y: 120, width: 180, height: 20 },
    { x: 150, y: 200, width: 180, height: 20 },
  ];
}

function spawnStar() {
  const padding = 48;
  let x;
  let y;
  const size = 14;

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
    state.playing = false;
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
    ctx.fillStyle = "rgba(10, 12, 21, 0.8)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "28px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = "18px 'Segoe UI', sans-serif";
    ctx.fillText("Refresh the page to try again", canvas.width / 2, canvas.height / 2 + 20);
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

function init() {
  createWalls();
  spawnStar();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  state.keys.add(event.key);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d"].includes(event.key)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.key);
});

init();
