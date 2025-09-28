const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const SCORE_TABLE = [0, 100, 300, 500, 800];
const COLORS = {
  I: "#38bdf8",
  J: "#3b82f6",
  L: "#f97316",
  O: "#facc15",
  S: "#22c55e",
  T: "#a855f7",
  Z: "#ef4444",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const canvas = document.getElementById("board");
const context = canvas.getContext("2d");
context.scale(BLOCK, BLOCK);

const nextCanvas = document.getElementById("next");
const nextContext = nextCanvas.getContext("2d");
nextContext.scale(BLOCK, BLOCK);

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const restartBtn = document.getElementById("restart");

let board;
let piece;
let nextPiece;
let dropCounter = 0;
let lastTime = 0;
let score = 0;
let lines = 0;
let level = 1;
let isGameOver = false;

function createMatrix(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(0));
}

function randomType() {
  const keys = Object.keys(SHAPES);
  const index = Math.floor(Math.random() * keys.length);
  return keys[index];
}

function createPiece(type) {
  const matrix = SHAPES[type].map((row) => row.slice());
  return {
    pos: { x: 0, y: 0 },
    matrix,
    type,
  };
}

function rotate(matrix, dir) {
  const cloned = matrix.map((row) => row.slice());
  const size = cloned.length;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < y; x += 1) {
      [cloned[x][y], cloned[y][x]] = [cloned[y][x], cloned[x][y]];
    }
  }

  if (dir > 0) {
    cloned.forEach((row) => row.reverse());
  } else {
    cloned.reverse();
  }

  return cloned;
}

function collide(boardState, pieceState) {
  const { matrix, pos } = pieceState;
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (matrix[y][x] === 0) continue;
      const boardY = y + pos.y;
      const boardX = x + pos.x;
      if (
        boardY < 0 ||
        boardY >= boardState.length ||
        boardX < 0 ||
        boardX >= boardState[boardY].length ||
        boardState[boardY][boardX] !== 0
      ) {
        return true;
      }
    }
  }
  return false;
}

function merge(boardState, pieceState) {
  pieceState.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        boardState[y + pieceState.pos.y][x + pieceState.pos.x] = pieceState.type;
      }
    });
  });
}

function sweep() {
  let cleared = 0;
  outer: for (let y = board.length - 1; y >= 0; y -= 1) {
    if (board[y].every((value) => value !== 0)) {
      const row = board.splice(y, 1)[0].fill(0);
      board.unshift(row);
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    score += SCORE_TABLE[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    updateStats();
  }
}

function drawMatrix(matrix, offset, ctx = context, options = {}) {
  const { ghost = false } = options;
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value === 0) return;
      const type = piece.type;
      ctx.save();
      if (ghost) {
        ctx.globalAlpha = 0.2;
      }
      ctx.fillStyle = ghost ? COLORS[type] : COLORS[board[y + offset.y]?.[x + offset.x] || type];
      ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
      ctx.restore();
    });
  });
}

function drawBoard() {
  context.clearRect(0, 0, COLS, ROWS);
  context.fillStyle = "rgba(148, 163, 184, 0.08)";
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      context.fillRect(x, y, 1, 1);
    }
  }

  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        context.fillStyle = COLORS[value];
        context.fillRect(x, y, 1, 1);
      }
    });
  });
}

function getGhostPosition() {
  const ghostPiece = {
    matrix: piece.matrix,
    pos: { x: piece.pos.x, y: piece.pos.y },
    type: piece.type,
  };
  while (!collide(board, { ...ghostPiece, pos: { x: ghostPiece.pos.x, y: ghostPiece.pos.y + 1 } })) {
    ghostPiece.pos.y += 1;
  }
  return ghostPiece.pos.y;
}

function draw() {
  drawBoard();

  if (!isGameOver) {
    const ghostY = getGhostPosition();
    drawMatrix(piece.matrix, { x: piece.pos.x, y: ghostY }, context, { ghost: true });
    drawMatrix(piece.matrix, piece.pos);
  } else {
    drawMatrix(piece.matrix, piece.pos);
    context.save();
    context.fillStyle = "rgba(15, 23, 42, 0.8)";
    context.fillRect(0, ROWS / 2 - 2, COLS, 4);
    context.fillStyle = "#f8fafc";
    context.font = "1px 'Segoe UI', sans-serif";
    context.textAlign = "center";
    context.fillText("Game Over", COLS / 2, ROWS / 2);
    context.restore();
  }
}

function drawPreview() {
  nextContext.clearRect(0, 0, nextCanvas.width / BLOCK, nextCanvas.height / BLOCK);
  const matrix = nextPiece.matrix;
  const offsetX = Math.floor((4 - matrix[0].length) / 2);
  const offsetY = Math.floor((4 - matrix.length) / 2);

  nextContext.fillStyle = "rgba(148, 163, 184, 0.1)";
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      nextContext.fillRect(x, y, 1, 1);
    }
  }

  nextContext.fillStyle = COLORS[nextPiece.type];
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        nextContext.fillRect(x + offsetX, y + offsetY, 1, 1);
      }
    });
  });
}

function playerReset() {
  piece = nextPiece;
  piece.pos.y = 0;
  piece.pos.x = Math.floor(COLS / 2 - piece.matrix[0].length / 2);
  nextPiece = createPiece(randomType());
  dropCounter = 0;
  if (collide(board, piece)) {
    isGameOver = true;
    updateStats();
  }
  drawPreview();
}

function updateStats() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;

  const dropInterval = Math.max(120, 1000 - (level - 1) * 80);

  if (!isGameOver && dropCounter > dropInterval) {
    playerDrop();
  }
  draw();
  requestAnimationFrame(update);
}

function playerDrop() {
  piece.pos.y += 1;
  if (collide(board, piece)) {
    piece.pos.y -= 1;
    merge(board, piece);
    sweep();
    playerReset();
    if (isGameOver) {
      return;
    }
  } else {
    score += 1;
    updateStats();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (isGameOver) return;
  while (!collide(board, { ...piece, pos: { x: piece.pos.x, y: piece.pos.y + 1 } })) {
    piece.pos.y += 1;
    score += 2;
  }
  updateStats();
  playerDrop();
}

function playerMove(offset) {
  if (isGameOver) return;
  piece.pos.x += offset;
  if (collide(board, piece)) {
    piece.pos.x -= offset;
  }
}

function playerRotate(dir) {
  if (isGameOver) return;
  const cloned = piece.matrix.map((row) => row.slice());
  piece.matrix = rotate(piece.matrix, dir);
  const pos = piece.pos.x;
  let offset = 1;
  while (collide(board, piece)) {
    piece.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > piece.matrix[0].length) {
      piece.matrix = cloned;
      piece.pos.x = pos;
      return;
    }
  }
}

function restartGame() {
  board = createMatrix(COLS, ROWS);
  score = 0;
  lines = 0;
  level = 1;
  isGameOver = false;
  dropCounter = 0;
  lastTime = 0;
  piece = createPiece(randomType());
  nextPiece = createPiece(randomType());
  piece.pos.x = Math.floor(COLS / 2 - piece.matrix[0].length / 2);
  drawPreview();
  updateStats();
}

document.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "ArrowLeft":
    case "KeyA":
      playerMove(-1);
      break;
    case "ArrowRight":
    case "KeyD":
      playerMove(1);
      break;
    case "ArrowDown":
    case "KeyS":
      playerDrop();
      break;
    case "ArrowUp":
    case "KeyW":
      playerRotate(1);
      break;
    case "Space":
      event.preventDefault();
      hardDrop();
      break;
  }
});

restartBtn.addEventListener("click", () => {
  restartGame();
});

restartGame();
updateStats();
requestAnimationFrame(update);
