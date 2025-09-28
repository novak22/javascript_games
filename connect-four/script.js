const ROWS = 6;
const COLS = 7;
const HUMAN = 1;
const AI = 2;
const MAX_DEPTH = 4;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

let boardState = [];
let cellMatrix = [];
let gameActive = true;
let allowInput = true;
let currentPlayer = HUMAN;
let previewDisc;
let columnTargets = [];

function init() {
  buildBoard();
  attachListeners();
  resetGame();
}

function buildBoard() {
  boardEl.replaceChildren();
  boardEl.style.setProperty('--cols', COLS);
  boardEl.style.setProperty('--rows', ROWS);

  cellMatrix = Array.from({ length: ROWS }, () => Array(COLS));

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}`);
      cellMatrix[row][col] = cell;
      boardEl.appendChild(cell);
    }
  }

  previewDisc = document.createElement('div');
  previewDisc.className = 'preview-disc';
  boardEl.appendChild(previewDisc);

  columnTargets = [];

  for (let col = 0; col < COLS; col += 1) {
    const target = document.createElement('button');
    target.type = 'button';
    target.className = 'column-target';
    target.dataset.col = String(col);
    target.setAttribute('aria-label', `Drop disc in column ${col + 1}`);
    boardEl.appendChild(target);
    columnTargets.push(target);
  }

  requestAnimationFrame(() => {
    updateColumnTargets();
    updateColumnAvailability();
  });
}

function attachListeners() {
  boardEl.addEventListener('pointermove', handlePointerMove);
  boardEl.addEventListener('pointerleave', hidePreview);
  boardEl.addEventListener('pointerdown', handlePointerDown);
  resetBtn.addEventListener('click', resetGame);
  window.addEventListener('resize', updateColumnTargets);

  columnTargets.forEach((target) => {
    target.addEventListener('focus', handleColumnFocus);
    target.addEventListener('blur', hidePreview);
    target.addEventListener('keydown', handleColumnKeyDown);
  });
}

function resetGame() {
  boardState = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  gameActive = true;
  allowInput = true;
  currentPlayer = HUMAN;
  updateStatus('Your turn! Tap or click a column to drop a disc.');
  boardEl.classList.remove('disabled');
  hidePreview();
  previewDisc?.classList.remove('ai-turn');
  setActiveColumn(-1);
  updateColumnAvailability();
  requestAnimationFrame(updateColumnTargets);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = cellMatrix[row][col];
      if (!cell) continue;
      const disc = cell.querySelector('.disc');
      if (disc) {
        disc.remove();
      }
    }
  }
}

function handlePointerMove(event) {
  if (!gameActive || !allowInput) {
    hidePreview();
    return;
  }
  const target = event.target.closest('.column-target, .cell');
  if (!target) {
    hidePreview();
    return;
  }

  if (target.classList.contains('column-target') && target.disabled) {
    hidePreview();
    return;
  }

  const col = Number(target.dataset.col);
  if (Number.isNaN(col) || getAvailableRow(boardState, col) === -1) {
    hidePreview();
    return;
  }

  showPreview(col);
}

function handlePointerDown(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  const target = event.target.closest('.column-target, .cell');
  if (!target) return;
  if (target.classList.contains('column-target') && target.disabled) return;
  const col = Number(target.dataset.col);
  if (Number.isNaN(col)) return;
  handlePlayerMove(col);
}

async function handlePlayerMove(col) {
  if (!gameActive || !allowInput) return;

  const availableRow = getAvailableRow(boardState, col);
  if (availableRow === -1) {
    return;
  }

  allowInput = false;
  updateColumnAvailability();
  hidePreview();
  const { disc } = dropDisc(availableRow, col, HUMAN);
  await waitForAnimation(disc);
  updateColumnAvailability();

  if (checkWin(boardState, HUMAN)) {
    finishGame('You connected four! Victory!');
    return;
  }

  if (isBoardFull(boardState)) {
    finishGame("Stalemate! It's a draw.");
    return;
  }

  currentPlayer = AI;
  previewDisc.classList.add('ai-turn');
  updateStatus('Arcade AI is thinking...');
  await pause(280);
  await performAiMove();
}

async function performAiMove() {
  if (!gameActive) return;
  const aiColumn = chooseAiColumn(boardState);
  if (aiColumn === null) {
    finishGame("Stalemate! It's a draw.");
    return;
  }
  const row = getAvailableRow(boardState, aiColumn);
  if (row === -1) {
    finishGame("Stalemate! It's a draw.");
    return;
  }

  const { disc } = dropDisc(row, aiColumn, AI);
  await waitForAnimation(disc);
  updateColumnAvailability();

  if (checkWin(boardState, AI)) {
    finishGame('Arcade AI lines up four. Better luck next time!');
    return;
  }

  if (isBoardFull(boardState)) {
    finishGame("Stalemate! It's a draw.");
    return;
  }

  currentPlayer = HUMAN;
  previewDisc.classList.remove('ai-turn');
  allowInput = true;
  updateColumnAvailability();
  updateStatus('Your turn! Drop another disc.');
}

function dropDisc(row, col, player) {
  boardState[row][col] = player;
  const cell = cellMatrix[row][col];
  const disc = document.createElement('div');
  disc.className = `disc ${player === HUMAN ? 'player-disc' : 'ai-disc'}`;
  disc.style.setProperty('--row-index', row);
  cell.appendChild(disc);
  return { row, disc };
}

function waitForAnimation(element) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }
    element.addEventListener(
      'animationend',
      () => {
        resolve();
      },
      { once: true }
    );
  });
}

function pause(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function finishGame(message) {
  gameActive = false;
  allowInput = false;
  updateStatus(message);
  boardEl.classList.add('disabled');
  hidePreview();
  updateColumnAvailability();
}

function showPreview(col) {
  if (!previewDisc) return;
  const targetCell = cellMatrix[0][col];
  if (!targetCell) return;
  const boardRect = boardEl.getBoundingClientRect();
  const cellRect = targetCell.getBoundingClientRect();
  const offsetX = cellRect.left - boardRect.left;
  previewDisc.style.setProperty('--preview-x', `${offsetX}px`);
  previewDisc.classList.toggle('ai-turn', currentPlayer === AI);
  previewDisc.classList.add('visible');
  setActiveColumn(col);
}

function hidePreview() {
  previewDisc?.classList.remove('visible');
  setActiveColumn(-1);
}

function updateStatus(message) {
  statusEl.textContent = message;
}

function setActiveColumn(col) {
  columnTargets.forEach((target, index) => {
    if (!target) return;
    const isActive = index === col;
    target.classList.toggle('is-active', isActive);
  });
}

function handleColumnFocus(event) {
  if (!gameActive || !allowInput) {
    hidePreview();
    return;
  }
  const col = Number(event.currentTarget.dataset.col);
  if (Number.isNaN(col) || getAvailableRow(boardState, col) === -1) {
    hidePreview();
    return;
  }
  showPreview(col);
}

function handleColumnKeyDown(event) {
  if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
    return;
  }
  event.preventDefault();
  const col = Number(event.currentTarget.dataset.col);
  if (Number.isNaN(col)) {
    return;
  }
  handlePlayerMove(col);
}

function updateColumnTargets() {
  if (!columnTargets.length) {
    return;
  }
  const boardRect = boardEl.getBoundingClientRect();

  columnTargets.forEach((target, col) => {
    const topCell = cellMatrix[0]?.[col];
    if (!target || !topCell) {
      return;
    }
    const cellRect = topCell.getBoundingClientRect();
    const width = cellRect.width;
    const left = cellRect.left - boardRect.left;
    target.style.left = `${left}px`;
    target.style.width = `${width}px`;
  });
}

function updateColumnAvailability() {
  const interactive = gameActive && allowInput;

  columnTargets.forEach((target, col) => {
    if (!target) return;
    const availableRow = getAvailableRow(boardState, col);
    const disabled = !interactive || availableRow === -1;
    target.disabled = disabled;
    target.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    target.classList.toggle('is-disabled', disabled);
  });
}

function getAvailableRow(state, col) {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (state[row][col] === 0) {
      return row;
    }
  }
  return -1;
}

function isBoardFull(state) {
  return state.every((row) => row.every((cell) => cell !== 0));
}

function checkWin(state, player) {
  // Horizontal
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col <= COLS - 4; col += 1) {
      if (
        state[row][col] === player &&
        state[row][col + 1] === player &&
        state[row][col + 2] === player &&
        state[row][col + 3] === player
      ) {
        return true;
      }
    }
  }

  // Vertical
  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row <= ROWS - 4; row += 1) {
      if (
        state[row][col] === player &&
        state[row + 1][col] === player &&
        state[row + 2][col] === player &&
        state[row + 3][col] === player
      ) {
        return true;
      }
    }
  }

  // Diagonal (\)
  for (let row = 0; row <= ROWS - 4; row += 1) {
    for (let col = 0; col <= COLS - 4; col += 1) {
      if (
        state[row][col] === player &&
        state[row + 1][col + 1] === player &&
        state[row + 2][col + 2] === player &&
        state[row + 3][col + 3] === player
      ) {
        return true;
      }
    }
  }

  // Diagonal (/)
  for (let row = 3; row < ROWS; row += 1) {
    for (let col = 0; col <= COLS - 4; col += 1) {
      if (
        state[row][col] === player &&
        state[row - 1][col + 1] === player &&
        state[row - 2][col + 2] === player &&
        state[row - 3][col + 3] === player
      ) {
        return true;
      }
    }
  }

  return false;
}

function chooseAiColumn(state) {
  const validColumns = getValidColumns(state);
  if (validColumns.length === 0) {
    return null;
  }
  const stateCopy = cloneBoard(state);
  const { column } = minimax(stateCopy, MAX_DEPTH, -Infinity, Infinity, true);
  if (column !== null && validColumns.includes(column)) {
    return column;
  }
  // Fallback in case minimax returns null
  return validColumns[Math.floor(Math.random() * validColumns.length)];
}

function cloneBoard(state) {
  return state.map((row) => row.slice());
}

function getValidColumns(state) {
  const columns = [];
  for (let col = 0; col < COLS; col += 1) {
    if (state[0][col] === 0) {
      columns.push(col);
    }
  }
  return columns;
}

function minimax(state, depth, alpha, beta, maximizingPlayer) {
  const validColumns = getValidColumns(state);
  const terminal =
    checkWin(state, AI) || checkWin(state, HUMAN) || validColumns.length === 0;

  if (depth === 0 || terminal) {
    if (terminal) {
      if (checkWin(state, AI)) {
        return { column: null, score: 1000000 + depth };
      }
      if (checkWin(state, HUMAN)) {
        return { column: null, score: -1000000 - depth };
      }
      return { column: null, score: 0 };
    }
    return { column: null, score: scorePosition(state, AI) };
  }

  let bestColumn = validColumns[Math.floor(Math.random() * validColumns.length)] ?? null;

  if (maximizingPlayer) {
    let value = -Infinity;
    for (const col of shuffle(validColumns)) {
      const tempBoard = cloneBoard(state);
      const row = getAvailableRow(tempBoard, col);
      if (row === -1) continue;
      tempBoard[row][col] = AI;
      const { score } = minimax(tempBoard, depth - 1, alpha, beta, false);
      if (score > value) {
        value = score;
        bestColumn = col;
      }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) {
        break;
      }
    }
    return { column: bestColumn, score: value };
  }

  let value = Infinity;
  for (const col of shuffle(validColumns)) {
    const tempBoard = cloneBoard(state);
    const row = getAvailableRow(tempBoard, col);
    if (row === -1) continue;
    tempBoard[row][col] = HUMAN;
    const { score } = minimax(tempBoard, depth - 1, alpha, beta, true);
    if (score < value) {
      value = score;
      bestColumn = col;
    }
    beta = Math.min(beta, value);
    if (alpha >= beta) {
      break;
    }
  }
  return { column: bestColumn, score: value };
}

function scorePosition(state, player) {
  let score = 0;
  const opponent = player === HUMAN ? AI : HUMAN;
  const centerIndex = Math.floor(COLS / 2);
  const centerArray = [];
  for (let row = 0; row < ROWS; row += 1) {
    centerArray.push(state[row][centerIndex]);
  }
  const centerCount = centerArray.filter((value) => value === player).length;
  score += centerCount * 30;

  // Horizontal
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col <= COLS - 4; col += 1) {
      const windowSlice = [
        state[row][col],
        state[row][col + 1],
        state[row][col + 2],
        state[row][col + 3],
      ];
      score += evaluateWindow(windowSlice, player, opponent);
    }
  }

  // Vertical
  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row <= ROWS - 4; row += 1) {
      const windowSlice = [
        state[row][col],
        state[row + 1][col],
        state[row + 2][col],
        state[row + 3][col],
      ];
      score += evaluateWindow(windowSlice, player, opponent);
    }
  }

  // Positive Diagonals
  for (let row = 0; row <= ROWS - 4; row += 1) {
    for (let col = 0; col <= COLS - 4; col += 1) {
      const windowSlice = [
        state[row][col],
        state[row + 1][col + 1],
        state[row + 2][col + 2],
        state[row + 3][col + 3],
      ];
      score += evaluateWindow(windowSlice, player, opponent);
    }
  }

  // Negative Diagonals
  for (let row = 3; row < ROWS; row += 1) {
    for (let col = 0; col <= COLS - 4; col += 1) {
      const windowSlice = [
        state[row][col],
        state[row - 1][col + 1],
        state[row - 2][col + 2],
        state[row - 3][col + 3],
      ];
      score += evaluateWindow(windowSlice, player, opponent);
    }
  }

  return score;
}

function evaluateWindow(windowSlice, player, opponent) {
  let score = 0;
  const playerCount = windowSlice.filter((value) => value === player).length;
  const opponentCount = windowSlice.filter((value) => value === opponent).length;
  const emptyCount = windowSlice.filter((value) => value === 0).length;

  if (playerCount === 4) {
    score += 10000;
  } else if (playerCount === 3 && emptyCount === 1) {
    score += 120;
  } else if (playerCount === 2 && emptyCount === 2) {
    score += 12;
  }

  if (opponentCount === 3 && emptyCount === 1) {
    score -= 140;
  } else if (opponentCount === 2 && emptyCount === 2) {
    score -= 16;
  }

  return score;
}

function shuffle(array) {
  const clone = array.slice();
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

document.addEventListener('DOMContentLoaded', init);
