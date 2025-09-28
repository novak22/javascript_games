(() => {
  const GRID_SIZE = 6;
  const DIRECTIONS = [
    { row: -1, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
  ];
  const ROTATABLE = new Set(['mirror', 'splitter', 'straight']);

  let tiles = [];
  let initialTiles = [];
  let moves = 0;
  let totalTargets = 0;
  let cells = [];

  const boardEl = document.querySelector('[data-board]');
  const statusEl = document.querySelector('[data-status]');
  const statsCrystalsEl = document.querySelector('[data-stat="crystals"]');
  const statsTotalEl = document.querySelector('[data-stat="total"]');
  const statsMovesEl = document.querySelector('[data-stat="moves"]');
  const resetButton = document.querySelector('[data-action="reset"]');
  const newPuzzleButton = document.querySelector('[data-action="new"]');

  if (
    !boardEl ||
    !statusEl ||
    !statsCrystalsEl ||
    !statsTotalEl ||
    !statsMovesEl ||
    !resetButton ||
    !newPuzzleButton
  ) {
    return;
  }

  startNewPuzzle();

  resetButton.addEventListener('click', () => {
    tiles = initialTiles.map(cloneTile);
    moves = 0;
    updateBoard();
    announceStatus('Puzzle reset. Emitters cooled and ready.');
  });

  newPuzzleButton.addEventListener('click', () => {
    startNewPuzzle(true);
  });

  function startNewPuzzle(announce = false) {
    try {
      const puzzle = generatePuzzle();
      initialTiles = puzzle.initial.map(cloneTile);
      tiles = initialTiles.map(cloneTile);
      totalTargets = puzzle.totalTargets;
      statsTotalEl.textContent = totalTargets.toString();
      moves = 0;
      cells = createCells();
      updateBoard();
      if (announce) {
        announceStatus('Fresh puzzle forged. Realign the emitters.');
      }
    } catch (error) {
      console.error(error);
      announceStatus('Photon foundry is offline. Try again.');
    }
  }

  function createCells() {
    boardEl.innerHTML = '';
    const items = [];
    boardEl.setAttribute('aria-rowcount', GRID_SIZE.toString());
    boardEl.setAttribute('aria-colcount', GRID_SIZE.toString());

    tiles.forEach((tile, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'trail-cell';
      button.dataset.index = index.toString();
      button.setAttribute('role', 'gridcell');

      if (tile.fixed || !ROTATABLE.has(tile.type)) {
        button.disabled = true;
      }

      if (tile.fixed) {
        button.classList.add('is-fixed');
      }

      button.addEventListener('click', () => rotateTile(index));
      boardEl.append(button);
      items.push(button);
    });

    return items;
  }

  function rotateTile(index) {
    const tile = tiles[index];
    if (!tile || tile.fixed || !ROTATABLE.has(tile.type)) {
      return;
    }

    const max = rotationSteps(tile.type);
    tile.rotation = (tile.rotation + 1) % max;
    moves += 1;
    updateBoard();
  }

  function updateBoard() {
    const { beamMap, litTargets } = traceBeams();

    tiles.forEach((tile, index) => {
      const cell = cells[index];
      if (!cell) return;

      cell.dataset.type = tile.type;
      cell.dataset.rotation = tile.rotation.toString();
      cell.classList.toggle('is-fixed', Boolean(tile.fixed));
      cell.disabled = tile.fixed || !ROTATABLE.has(tile.type);

      if (tile.type === 'source' && typeof tile.direction === 'number') {
        cell.dataset.direction = tile.direction.toString();
      } else {
        cell.removeAttribute('data-direction');
      }

      const lit = litTargets.has(index);
      if (tile.type === 'target') {
        cell.classList.toggle('is-lit', lit);
      } else {
        cell.classList.remove('is-lit');
      }

      const beamDirs = beamMap.get(index);
      if (beamDirs && beamDirs.size) {
        cell.dataset.beam = Array.from(beamDirs)
          .sort((a, b) => a - b)
          .join('-');
      } else {
        cell.removeAttribute('data-beam');
      }

      cell.setAttribute('aria-label', describeTile(tile, { lit }));
    });

    statsCrystalsEl.textContent = litTargets.size.toString();
    statsMovesEl.textContent = moves.toString();
    updateStatusMessage(litTargets.size);
  }

  function traceBeams(tileSet = tiles) {
    const beamMap = new Map();
    const litTargets = new Set();
    const queue = [];
    const seen = new Set();

    tileSet.forEach((tile, index) => {
      if (tile.type === 'source' && typeof tile.direction === 'number') {
        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;
        const key = `${index}-${tile.direction}`;
        queue.push({ row, col, dir: tile.direction });
        seen.add(key);
      }
    });

    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      const { row, col, dir } = current;
      const nextRow = row + DIRECTIONS[dir].row;
      const nextCol = col + DIRECTIONS[dir].col;

      if (nextRow < 0 || nextCol < 0 || nextRow >= GRID_SIZE || nextCol >= GRID_SIZE) {
        continue;
      }

      const index = nextRow * GRID_SIZE + nextCol;
      const tile = tileSet[index];
      if (!tile) {
        continue;
      }

      const entryDir = (dir + 2) % 4;
      addBeamDirection(beamMap, index, entryDir);

      if (tile.type === 'target') {
        litTargets.add(index);
      }

      const exits = getExitDirections(tile, dir);
      if (!exits.length) {
        continue;
      }

      exits.forEach((exitDir) => {
        addBeamDirection(beamMap, index, exitDir);
        const key = `${index}-${exitDir}`;
        if (!seen.has(key)) {
          seen.add(key);
          queue.push({ row: nextRow, col: nextCol, dir: exitDir });
        }
      });
    }

    return { beamMap, litTargets };
  }

  function generatePuzzle() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const solvedLayout = createSolvedLayout();
      if (!solvedLayout) {
        continue;
      }

      const total = solvedLayout.filter((tile) => tile.type === 'target').length;
      if (total === 0) {
        continue;
      }

      const { litTargets } = traceBeams(solvedLayout);
      if (litTargets.size !== total) {
        continue;
      }

      const puzzleTiles = solvedLayout.map((tile) => {
        const copy = cloneTile(tile);
        copy.rotation = tile.rotation ?? 0;
        copy.initialRotation = tile.rotation ?? 0;
        copy.fixed = tile.fixed ?? false;
        copy.direction = tile.direction;

        if (!copy.fixed && ROTATABLE.has(copy.type)) {
          const max = rotationSteps(copy.type);
          if (max > 0) {
            let rotation = randomInt(max);
            let guard = 0;
            while (rotation === (tile.rotation ?? 0) && guard < 4) {
              rotation = randomInt(max);
              guard += 1;
            }
            copy.rotation = rotation;
            copy.initialRotation = rotation;
          }
        }

        return copy;
      });

      const solvedMatch = puzzleTiles.every((tile, index) => {
        const solved = solvedLayout[index];
        return tile.rotation === (solved.rotation ?? 0);
      });

      if (solvedMatch) {
        continue;
      }

      return { initial: puzzleTiles, totalTargets: total };
    }

    throw new Error('Unable to forge a solvable photon puzzle.');
  }

  function createSolvedLayout() {
    const tiles = Array(GRID_SIZE * GRID_SIZE).fill(null);
    const targetCount = Math.min(4, Math.max(2, 2 + randomInt(3)));

    const edgeSources = shuffleArray(generateEdgeSources());
    const sourceStartIndices = new Set();
    const sources = [];

    for (const candidate of edgeSources) {
      if (sources.length >= targetCount) {
        break;
      }

      const startRow = candidate.row + DIRECTIONS[candidate.direction].row;
      const startCol = candidate.col + DIRECTIONS[candidate.direction].col;
      if (!inBounds(startRow, startCol)) {
        continue;
      }

      const sourceIndex = indexFromCoord(candidate.row, candidate.col);
      const startIndex = indexFromCoord(startRow, startCol);
      if (sourceStartIndices.has(startIndex)) {
        continue;
      }

      sourceStartIndices.add(startIndex);
      sources.push({
        row: candidate.row,
        col: candidate.col,
        direction: candidate.direction,
        startRow,
        startCol,
        index: sourceIndex,
      });
    }

    if (sources.length < targetCount) {
      return null;
    }

    const interiorCells = shuffleArray(generateInteriorCells());
    const blockedForTargets = new Set(sources.map((source) => source.index));
    sourceStartIndices.forEach((index) => blockedForTargets.add(index));

    const targets = [];
    for (const cell of interiorCells) {
      if (targets.length >= targetCount) {
        break;
      }

      const index = indexFromCoord(cell.row, cell.col);
      if (blockedForTargets.has(index)) {
        continue;
      }

      targets.push({ row: cell.row, col: cell.col, index });
      blockedForTargets.add(index);
    }

    if (targets.length < targetCount) {
      return null;
    }

    const occupied = new Set();
    sources.forEach((source) => {
      occupied.add(source.index);
      occupied.add(indexFromCoord(source.startRow, source.startCol));
    });

    for (let i = 0; i < targetCount; i += 1) {
      const source = sources[i];
      const target = targets[i];

      tiles[source.index] = createTile('source', {
        rotation: 0,
        direction: source.direction,
        fixed: true,
      });

      const allowed = new Set([indexFromCoord(source.startRow, source.startCol)]);
      const path = findPath(
        { row: source.startRow, col: source.startCol },
        { row: target.row, col: target.col },
        occupied,
        allowed
      );

      if (!path || path.length < 2) {
        return null;
      }

      applyPath(tiles, source, path);

      path.forEach((cell) => {
        const index = indexFromCoord(cell.row, cell.col);
        occupied.add(index);
      });
    }

    fillRemainingCells(tiles);
    return tiles;
  }

  function applyPath(tiles, source, path) {
    for (let i = 0; i < path.length; i += 1) {
      const cell = path[i];
      const index = indexFromCoord(cell.row, cell.col);
      const isLast = i === path.length - 1;

      if (isLast) {
        tiles[index] = createTile('target', { rotation: 0, fixed: true });
        continue;
      }

      const entry = i === 0 ? oppositeDirection(source.direction) : directionBetween(path[i - 1], cell);
      const exit = directionBetween(cell, path[i + 1]);
      tiles[index] = createConnectorTile(entry, exit);
    }
  }

  function createConnectorTile(entry, exit) {
    if ((entry + 2) % 4 === exit) {
      const rotation = entry === 0 || entry === 2 ? 1 : 0;
      return createTile('straight', { rotation, fixed: false });
    }

    const mirrorKey = `${entry}-${exit}`;
    const mirrorOrientation = {
      '0-1': 0,
      '1-0': 0,
      '2-3': 0,
      '3-2': 0,
      '0-3': 1,
      '3-0': 1,
      '2-1': 1,
      '1-2': 1,
    }[mirrorKey];

    if (mirrorOrientation !== undefined) {
      return createTile('mirror', { rotation: mirrorOrientation, fixed: false });
    }

    const fallbackRotation = entry === 0 || entry === 2 ? 1 : 0;
    return createTile('straight', { rotation: fallbackRotation, fixed: false });
  }

  function fillRemainingCells(tiles) {
    for (let index = 0; index < tiles.length; index += 1) {
      const tile = tiles[index];
      if (tile) {
        tile.initialRotation = tile.rotation ?? 0;
        continue;
      }

      if (Math.random() < 0.3) {
        tiles[index] = createTile('wall', { rotation: 0, fixed: true });
      } else {
        tiles[index] = createTile('empty', { rotation: 0, fixed: true });
      }
    }
  }

  function findPath(start, goal, blocked, allowed = new Set()) {
    const startIndex = indexFromCoord(start.row, start.col);
    const goalIndex = indexFromCoord(goal.row, goal.col);

    if (startIndex === goalIndex) {
      return null;
    }

    const queue = [start];
    const visited = new Set([startIndex]);
    const cameFrom = new Map();

    allowed.add(startIndex);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      const currentIndex = indexFromCoord(current.row, current.col);
      if (currentIndex === goalIndex) {
        break;
      }

      for (let dir = 0; dir < DIRECTIONS.length; dir += 1) {
        const nextRow = current.row + DIRECTIONS[dir].row;
        const nextCol = current.col + DIRECTIONS[dir].col;
        if (!inBounds(nextRow, nextCol)) {
          continue;
        }

        const nextIndex = indexFromCoord(nextRow, nextCol);
        if (visited.has(nextIndex)) {
          continue;
        }

        if (blocked.has(nextIndex) && nextIndex !== goalIndex && !allowed.has(nextIndex)) {
          continue;
        }

        visited.add(nextIndex);
        cameFrom.set(nextIndex, currentIndex);
        queue.push({ row: nextRow, col: nextCol });
      }
    }

    if (!cameFrom.has(goalIndex)) {
      return null;
    }

    const path = [goal];
    let currentIndex = goalIndex;
    while (currentIndex !== startIndex) {
      const prevIndex = cameFrom.get(currentIndex);
      if (prevIndex === undefined) {
        return null;
      }
      const prevCoord = {
        row: Math.floor(prevIndex / GRID_SIZE),
        col: prevIndex % GRID_SIZE,
      };
      path.push(prevCoord);
      currentIndex = prevIndex;
    }

    path.push(start);
    path.reverse();
    return path;
  }

  function directionBetween(a, b) {
    if (a.row === b.row) {
      return b.col > a.col ? 1 : 3;
    }
    if (a.col === b.col) {
      return b.row > a.row ? 2 : 0;
    }
    return 0;
  }

  function oppositeDirection(dir) {
    return (dir + 2) % 4;
  }

  function inBounds(row, col) {
    return row >= 0 && col >= 0 && row < GRID_SIZE && col < GRID_SIZE;
  }

  function indexFromCoord(row, col) {
    return row * GRID_SIZE + col;
  }

  function randomInt(max) {
    return Math.floor(Math.random() * Math.max(1, max));
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function generateEdgeSources() {
    const options = [];
    for (let col = 0; col < GRID_SIZE; col += 1) {
      options.push({ row: 0, col, direction: 2 });
      options.push({ row: GRID_SIZE - 1, col, direction: 0 });
    }
    for (let row = 1; row < GRID_SIZE - 1; row += 1) {
      options.push({ row, col: 0, direction: 1 });
      options.push({ row, col: GRID_SIZE - 1, direction: 3 });
    }
    return options;
  }

  function generateInteriorCells() {
    const cells = [];
    for (let row = 1; row < GRID_SIZE - 1; row += 1) {
      for (let col = 1; col < GRID_SIZE - 1; col += 1) {
        cells.push({ row, col });
      }
    }
    return cells;
  }

  function getExitDirections(tile, dir) {
    switch (tile.type) {
      case 'wall':
      case 'empty':
        return [];
      case 'straight': {
        const orientation = tile.rotation % 2;
        if (orientation === 0) {
          return dir === 1 || dir === 3 ? [dir] : [];
        }
        return dir === 0 || dir === 2 ? [dir] : [];
      }
      case 'mirror': {
        const orientation = tile.rotation % 2;
        if (orientation === 0) {
          if (dir === 1) return [0];
          if (dir === 3) return [2];
          if (dir === 0) return [1];
          if (dir === 2) return [3];
        } else {
          if (dir === 1) return [2];
          if (dir === 3) return [0];
          if (dir === 0) return [3];
          if (dir === 2) return [1];
        }
        return [];
      }
      case 'splitter': {
        const orientation = tile.rotation % 2;
        if (orientation === 0) {
          if (dir === 1 || dir === 3) {
            return [0, 2];
          }
          return [dir];
        }
        if (dir === 0 || dir === 2) {
          return [1, 3];
        }
        return [dir];
      }
      case 'target':
        return [dir];
      case 'source':
        return [dir];
      default:
        return [dir];
    }
  }

  function addBeamDirection(map, index, dir) {
    if (!map.has(index)) {
      map.set(index, new Set());
    }
    map.get(index)?.add(dir);
  }

  function rotationSteps(type) {
    if (type === 'straight' || type === 'mirror' || type === 'splitter') {
      return 2;
    }
    return 4;
  }

  function describeTile(tile, { lit } = {}) {
    const rotatable = ROTATABLE.has(tile.type) && !tile.fixed;
    const directionNames = ['north', 'east', 'south', 'west'];
    const parts = [];

    switch (tile.type) {
      case 'source':
        parts.push(`Photon emitter facing ${directionNames[tile.direction ?? 1]}`);
        break;
      case 'target':
        parts.push(`Crystal node ${lit ? 'energised' : 'dormant'}`);
        break;
      case 'straight':
        parts.push(tile.rotation % 2 === 0 ? 'Horizontal conduit' : 'Vertical conduit');
        break;
      case 'mirror':
        parts.push(tile.rotation % 2 === 0 ? 'Mirror leaning backslash' : 'Mirror leaning slash');
        break;
      case 'splitter':
        parts.push(tile.rotation % 2 === 0 ? 'Splitter aiming vertically' : 'Splitter aiming horizontally');
        break;
      case 'wall':
        parts.push('Dense wall');
        break;
      default:
        parts.push('Void tile');
    }

    if (tile.type === 'target') {
      parts.push(lit ? 'Resonating with light' : 'Needs a beam');
    }

    if (rotatable) {
      parts.push('Activate to rotate');
    }

    return parts.join('. ');
  }

  function updateStatusMessage(litCount) {
    if (litCount >= totalTargets && totalTargets > 0) {
      const moveWord = moves === 1 ? 'move' : 'moves';
      statusEl.textContent = `All crystals humming! Trails aligned in ${moves} ${moveWord}.`;
      return;
    }

    if (moves === 0) {
      statusEl.textContent = 'Calibrate the emitters and chart a path for the beam.';
      return;
    }

    const remaining = totalTargets - litCount;
    if (remaining <= 0) {
      statusEl.textContent = 'The array is stable. Bask in the glow.';
    } else if (remaining === 1) {
      statusEl.textContent = 'One crystal remains dormant. Adjust the trails.';
    } else {
      statusEl.textContent = `${remaining} crystals are still dormant. Reroute the beam.`;
    }
  }

  function announceStatus(message) {
    statusEl.textContent = message;
  }

  function createTile(type, options = {}) {
    const rotation = options.rotation ?? 0;
    return {
      type,
      rotation,
      initialRotation: rotation,
      fixed: options.fixed ?? false,
      direction: options.direction,
    };
  }

  function cloneTile(tile) {
    return {
      type: tile.type,
      rotation: tile.initialRotation ?? tile.rotation ?? 0,
      initialRotation: tile.initialRotation ?? tile.rotation ?? 0,
      fixed: tile.fixed ?? false,
      direction: tile.direction,
    };
  }
})();
