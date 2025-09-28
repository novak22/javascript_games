(() => {
  const GRID_SIZE = 6;
  const DIRECTIONS = [
    { row: -1, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
  ];
  const ROTATABLE = new Set(['mirror', 'splitter', 'straight']);

  const layout = [
    [
      { type: 'empty', fixed: true },
      { type: 'wall', fixed: true },
      { type: 'target', fixed: true },
      { type: 'empty', fixed: true },
      { type: 'wall', fixed: true },
      { type: 'empty', fixed: true },
    ],
    [
      { type: 'empty', fixed: true },
      { type: 'wall', fixed: true },
      { type: 'straight', rotation: 0 },
      { type: 'wall', fixed: true },
      { type: 'empty', fixed: true },
      { type: 'wall', fixed: true },
    ],
    [
      { type: 'empty', fixed: true },
      { type: 'wall', fixed: true },
      { type: 'straight', rotation: 0 },
      { type: 'wall', fixed: true },
      { type: 'empty', fixed: true },
      { type: 'target', fixed: true },
    ],
    [
      { type: 'source', direction: 1, fixed: true },
      { type: 'straight', rotation: 0, fixed: true },
      { type: 'splitter', rotation: 1 },
      { type: 'wall', fixed: true },
      { type: 'empty', fixed: true },
      { type: 'straight', rotation: 1, fixed: true },
    ],
    [
      { type: 'empty', fixed: true },
      { type: 'empty', fixed: true },
      { type: 'straight', rotation: 0 },
      { type: 'mirror', rotation: 1 },
      { type: 'straight', rotation: 0, fixed: true },
      { type: 'mirror', rotation: 1 },
    ],
    [
      { type: 'target', fixed: true },
      { type: 'straight', rotation: 0, fixed: true },
      { type: 'splitter', rotation: 0 },
      { type: 'mirror', rotation: 1 },
      { type: 'wall', fixed: true },
      { type: 'empty', fixed: true },
    ],
  ];

  const initialTiles = layout.flat().map((tile) => ({
    type: tile.type,
    rotation: tile.rotation ?? 0,
    initialRotation: tile.rotation ?? 0,
    fixed: tile.fixed ?? false,
    direction: tile.direction,
  }));

  let tiles = initialTiles.map(cloneTile);
  let moves = 0;

  const boardEl = document.querySelector('[data-board]');
  const statusEl = document.querySelector('[data-status]');
  const statsCrystalsEl = document.querySelector('[data-stat="crystals"]');
  const statsTotalEl = document.querySelector('[data-stat="total"]');
  const statsMovesEl = document.querySelector('[data-stat="moves"]');
  const resetButton = document.querySelector('[data-action="reset"]');

  if (!boardEl || !statusEl || !statsCrystalsEl || !statsTotalEl || !statsMovesEl || !resetButton) {
    return;
  }

  const totalTargets = tiles.filter((tile) => tile.type === 'target').length;
  statsTotalEl.textContent = totalTargets.toString();

  const cells = createCells();
  updateBoard();

  resetButton.addEventListener('click', () => {
    tiles = initialTiles.map(cloneTile);
    moves = 0;
    updateBoard();
    announceStatus('Puzzle reset. Emitters cooled and ready.');
  });

  function createCells() {
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

  function traceBeams() {
    const beamMap = new Map();
    const litTargets = new Set();
    const queue = [];
    const seen = new Set();

    tiles.forEach((tile, index) => {
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
      const tile = tiles[index];
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
