const canvas = document.getElementById('sandbox');
const ctx = canvas.getContext('2d');

const state = {
  width: canvas.width,
  height: canvas.height,
  balls: [],
  lastTime: performance.now(),
};

const settings = {
  gravity: 600,
  elasticity: 0.8,
  drag: 0.08,
  spawnEnergy: 280,
};

const outputs = {
  gravity: document.getElementById('gravityValue'),
  elasticity: document.getElementById('elasticityValue'),
  drag: document.getElementById('dragValue'),
  energy: document.getElementById('energyValue'),
  orbCount: document.getElementById('orbCount'),
  energyReadout: document.getElementById('energyReadout'),
};

const sliders = {
  gravity: document.getElementById('gravity'),
  elasticity: document.getElementById('elasticity'),
  drag: document.getElementById('drag'),
  energy: document.getElementById('energy'),
};

const formatters = {
  gravity: (v) => `${Math.round(v)} px/s²`,
  elasticity: (v) => v.toFixed(2),
  drag: (v) => v.toFixed(2),
  energy: (v) => `${Math.round(v)} px/s`,
};

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  state.width = rect.width;
  state.height = rect.height;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  if (typeof ctx.resetTransform === 'function') {
    ctx.resetTransform();
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function spawnBall(x, y, energyMultiplier = 1) {
  const radius = randomInRange(14, 38);
  const mass = Math.PI * radius * radius;
  const hue = (performance.now() * 0.05 + Math.random() * 120) % 360;
  const speedBase = settings.spawnEnergy * energyMultiplier;
  const speed = speedBase > 0 ? speedBase * (0.35 + Math.random() * 0.65) / Math.max(radius / 16, 0.75) : 0;
  const angle = -Math.PI / 2 + randomInRange(-Math.PI / 3, Math.PI / 3);
  const ball = {
    x: Math.min(Math.max(x, radius), state.width - radius),
    y: Math.min(Math.max(y, radius), state.height - radius),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    mass,
    hue,
  };
  state.balls.push(ball);
}

function spawnBurst() {
  const count = 10 + Math.floor(Math.random() * 6);
  const cx = state.width * 0.5;
  const cy = state.height * 0.35;
  for (let i = 0; i < count; i += 1) {
    const offsetR = randomInRange(-60, 60);
    const offsetY = randomInRange(-60, 40);
    spawnBall(cx + offsetR, cy + offsetY, 1.2);
  }
}

function clearAll() {
  state.balls.length = 0;
}

canvas.addEventListener(
  'pointerdown',
  (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    spawnBall(x, y, 1);
  },
  { passive: true }
);

document.getElementById('addBurst').addEventListener('click', () => {
  spawnBurst();
});

document.getElementById('clearAll').addEventListener('click', () => {
  clearAll();
});

Object.entries(sliders).forEach(([key, input]) => {
  const update = () => {
    const value = parseFloat(input.value);
    settings[key] = value;
    outputs[key].textContent = formatters[key](value);
  };
  input.addEventListener('input', update);
  update();
});

function resolveWallCollision(ball) {
  const { radius } = ball;
  const { width, height } = state;
  const e = settings.elasticity;

  if (ball.x - radius < 0) {
    ball.x = radius;
    if (ball.vx < 0) {
      ball.vx = -ball.vx * e;
    }
  } else if (ball.x + radius > width) {
    ball.x = width - radius;
    if (ball.vx > 0) {
      ball.vx = -ball.vx * e;
    }
  }

  if (ball.y - radius < 0) {
    ball.y = radius;
    if (ball.vy < 0) {
      ball.vy = -ball.vy * e;
    }
  } else if (ball.y + radius > height) {
    ball.y = height - radius;
    if (ball.vy > 0) {
      ball.vy = -ball.vy * e;
      if (Math.abs(ball.vy) < 12) {
        ball.vy = 0;
      }
    }
  }
}

function resolveBallCollisions() {
  const balls = state.balls;
  const e = settings.elasticity;
  for (let i = 0; i < balls.length; i += 1) {
    const a = balls[i];
    for (let j = i + 1; j < balls.length; j += 1) {
      const b = balls[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy;
      const minDist = a.radius + b.radius;
      if (distSq === 0 || distSq > minDist * minDist) continue;

      const dist = Math.sqrt(distSq) || 0.0001;
      const nx = dx / dist;
      const ny = dy / dist;
      const penetration = minDist - dist;
      const totalMass = a.mass + b.mass;

      // Positional correction to prevent sinking
      const correction = penetration / (totalMass);
      a.x -= nx * correction * b.mass;
      a.y -= ny * correction * b.mass;
      b.x += nx * correction * a.mass;
      b.y += ny * correction * a.mass;

      // Relative velocity
      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const velAlongNormal = rvx * nx + rvy * ny;
      if (velAlongNormal > 0) continue;

      const impulse = (-(1 + e) * velAlongNormal) / (1 / a.mass + 1 / b.mass);
      const ix = impulse * nx;
      const iy = impulse * ny;

      a.vx -= ix / a.mass;
      a.vy -= iy / a.mass;
      b.vx += ix / b.mass;
      b.vy += iy / b.mass;
    }
  }
}

function drawBall(ball) {
  const gradient = ctx.createRadialGradient(
    ball.x - ball.radius * 0.35,
    ball.y - ball.radius * 0.35,
    ball.radius * 0.25,
    ball.x,
    ball.y,
    ball.radius
  );
  gradient.addColorStop(0, `hsla(${ball.hue}, 92%, 75%, 0.95)`);
  gradient.addColorStop(0.6, `hsla(${(ball.hue + 30) % 360}, 88%, 62%, 0.85)`);
  gradient.addColorStop(1, `hsla(${(ball.hue + 60) % 360}, 70%, 45%, 0.7)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
}

function updateStatus(dt) {
  outputs.orbCount.textContent = state.balls.length.toString();
  if (!state.balls.length) {
    outputs.energyReadout.textContent = '0';
    return;
  }

  let energyTotal = 0;
  for (const ball of state.balls) {
    energyTotal += 0.5 * ball.mass * (ball.vx * ball.vx + ball.vy * ball.vy);
  }
  const average = energyTotal / state.balls.length;
  if (average >= 10000) {
    outputs.energyReadout.textContent = `${(average / 1000).toFixed(1)}k`;
  } else {
    outputs.energyReadout.textContent = average.toFixed(0);
  }
}

function step(now) {
  const dt = Math.min((now - state.lastTime) / 1000, 0.035);
  state.lastTime = now;
  const balls = state.balls;
  const gravity = settings.gravity;
  const drag = Math.max(0, settings.drag);
  const damping = drag > 0 ? Math.exp(-drag * dt) : 1;

  for (const ball of balls) {
    ball.vy += gravity * dt;
    ball.vx *= damping;
    ball.vy *= damping;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    resolveWallCollision(ball);
  }

  resolveBallCollisions();

  ctx.clearRect(0, 0, state.width, state.height);
  for (const ball of balls) {
    drawBall(ball);
  }

  updateStatus(dt);
  requestAnimationFrame(step);
}

spawnBurst();
requestAnimationFrame(step);
