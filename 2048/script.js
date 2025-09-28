class Game2048 {
  constructor(root = document) {
    this.size = 4;
    this.root = root;
    this.grid = this.createEmptyGrid();
    this.score = 0;
    this.bestScoreKey = "pastel-2048-best";
    this.bestScore = this.loadBestScore();
    this.tileId = 0;
    this.tileElements = new Map();

    this.tileContainer = root.querySelector(".tile-container");
    this.scoreEl = root.getElementById("score");
    this.bestEl = root.getElementById("best");
    this.messageEl = root.getElementById("message");
    this.messageTextEl = root.getElementById("message-text");
    this.keepPlayingBtn = root.getElementById("keep-playing");
    this.resetBtn = root.getElementById("reset");
    this.boardEl = root.querySelector(".board");
    this.gridEl = root.querySelector(".grid");

    this.keepPlaying = false;
    this.touchStart = null;
    this.messageState = null;
    this.tileMetrics = null;
    this.resizeRaf = null;

    this.handleResize = this.handleResize.bind(this);

    this.bindEvents();
    this.updateScore();
    this.startNewGame();
  }

  loadBestScore() {
    try {
      return Number.parseInt(localStorage.getItem(this.bestScoreKey) || "0", 10);
    } catch (error) {
      console.warn("Unable to access localStorage", error);
      return 0;
    }
  }

  createEmptyGrid() {
    return Array.from({ length: this.size }, () => Array(this.size).fill(null));
  }

  bindEvents() {
    window.addEventListener("resize", this.handleResize);

    window.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      const direction = this.directionFromKey(event.key);
      if (!direction) return;
      event.preventDefault();
      this.move(direction);
    });

    this.resetBtn.addEventListener("click", () => this.startNewGame());
    this.keepPlayingBtn.addEventListener("click", () => this.handleMessageAction());

    this.boardEl.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        this.touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      },
      { passive: true }
    );

    this.boardEl.addEventListener(
      "touchmove",
      (event) => {
        if (!this.touchStart) return;
        if (event.touches.length !== 1) {
          this.touchStart = null;
          return;
        }
        // prevent scroll when swiping intentionally
        event.preventDefault();
      },
      { passive: false }
    );

    this.boardEl.addEventListener(
      "touchend",
      (event) => {
        if (!this.touchStart) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - this.touchStart.x;
        const dy = touch.clientY - this.touchStart.y;
        const elapsed = Date.now() - this.touchStart.time;
        this.touchStart = null;

        if (elapsed > 500) return; // swipe must be quick
        if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;

        if (Math.abs(dx) > Math.abs(dy)) {
          this.move(dx > 0 ? "right" : "left");
        } else {
          this.move(dy > 0 ? "down" : "up");
        }
      },
      { passive: true }
    );

    this.boardEl.addEventListener(
      "touchcancel",
      () => {
        this.touchStart = null;
      },
      { passive: true }
    );
  }

  directionFromKey(key) {
    switch (key) {
      case "ArrowLeft":
      case "a":
      case "A":
        return "left";
      case "ArrowRight":
      case "d":
      case "D":
        return "right";
      case "ArrowUp":
      case "w":
      case "W":
        return "up";
      case "ArrowDown":
      case "s":
      case "S":
        return "down";
      default:
        return null;
    }
  }

  startNewGame() {
    this.grid = this.createEmptyGrid();
    this.score = 0;
    this.keepPlaying = false;
    this.messageState = null;
    this.hideMessage();
    this.tileElements.forEach((el) => el.remove());
    this.tileElements.clear();
    this.tileId = 0;
    this.addRandomTile();
    this.addRandomTile();
    this.updateScore();
    this.render(true);
  }

  resumeAfterWin() {
    this.keepPlaying = true;
    this.hideMessage();
  }

  hideMessage() {
    this.messageEl.hidden = true;
    this.messageEl.setAttribute("aria-hidden", "true");
    this.messageState = null;
  }

  showMessage(text, mode = "info") {
    this.messageState = mode;
    if (mode === "win") {
      this.keepPlayingBtn.textContent = "Keep Playing";
    } else if (mode === "over") {
      this.keepPlayingBtn.textContent = "Play Again";
    } else {
      this.keepPlayingBtn.textContent = "Dismiss";
    }
    this.messageTextEl.textContent = text;
    this.messageEl.hidden = false;
    this.messageEl.setAttribute("aria-hidden", "false");
  }

  handleMessageAction() {
    if (this.messageState === "win") {
      this.resumeAfterWin();
    } else if (this.messageState === "over") {
      this.startNewGame();
    } else {
      this.hideMessage();
    }
  }

  updateScore() {
    this.scoreEl.textContent = this.score.toString();
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        localStorage.setItem(this.bestScoreKey, String(this.bestScore));
      } catch (error) {
        console.warn("Unable to persist best score", error);
      }
    }
    this.bestEl.textContent = this.bestScore.toString();
  }

  addRandomTile() {
    const cells = this.availableCells();
    if (cells.length === 0) return;
    const index = Math.floor(Math.random() * cells.length);
    const { row, col } = cells[index];
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = {
      id: this.tileId++,
      row,
      col,
      value,
      previousRow: row,
      previousCol: col,
      merged: false,
      new: true,
    };
    this.grid[row][col] = tile;
  }

  availableCells() {
    const cells = [];
    for (let row = 0; row < this.size; row += 1) {
      for (let col = 0; col < this.size; col += 1) {
        if (!this.grid[row][col]) {
          cells.push({ row, col });
        }
      }
    }
    return cells;
  }

  move(direction) {
    if (this.messageEl.hidden === false && !this.keepPlaying) {
      return;
    }
    const vector = this.getVector(direction);
    if (!vector) return;

    this.prepareTiles();
    const traversals = this.buildTraversals(vector);
    let moved = false;

    traversals.rows.forEach((row) => {
      traversals.cols.forEach((col) => {
        const tile = this.grid[row][col];
        if (!tile) return;

        const positions = this.findFarthestPosition({ row, col }, vector);
        const next = this.cellContent(positions.next);

        if (next && next.value === tile.value && !next.merged) {
          this.removeTile(next);
          this.grid[row][col] = null;
          tile.row = next.row;
          tile.col = next.col;
          tile.value *= 2;
          tile.merged = true;
          this.grid[tile.row][tile.col] = tile;
          this.score += tile.value;
          moved = true;
        } else {
          const { row: targetRow, col: targetCol } = positions.farthest;
          if (targetRow !== row || targetCol !== col) {
            this.grid[row][col] = null;
            tile.row = targetRow;
            tile.col = targetCol;
            this.grid[targetRow][targetCol] = tile;
            moved = true;
          }
        }
      });
    });

    if (moved) {
      this.addRandomTile();
      this.updateScore();
      this.render();
      if (!this.keepPlaying && this.has2048()) {
        this.showMessage("You reached 2048! Keep going?", "win");
      } else if (!this.movesAvailable()) {
        this.showMessage("No more moves left. Try again!", "over");
      }
    }
  }

  prepareTiles() {
    for (let row = 0; row < this.size; row += 1) {
      for (let col = 0; col < this.size; col += 1) {
        const tile = this.grid[row][col];
        if (!tile) continue;
        tile.previousRow = tile.row;
        tile.previousCol = tile.col;
        tile.merged = false;
      }
    }
  }

  getVector(direction) {
    switch (direction) {
      case "left":
        return { x: -1, y: 0 };
      case "right":
        return { x: 1, y: 0 };
      case "up":
        return { x: 0, y: -1 };
      case "down":
        return { x: 0, y: 1 };
      default:
        return null;
    }
  }

  buildTraversals(vector) {
    const rows = [...Array(this.size).keys()];
    const cols = [...Array(this.size).keys()];

    if (vector.y === 1) rows.reverse();
    if (vector.x === 1) cols.reverse();

    return { rows, cols };
  }

  findFarthestPosition(start, vector) {
    let previous;
    let cell = { row: start.row, col: start.col };

    do {
      previous = cell;
      cell = { row: previous.row + vector.y, col: previous.col + vector.x };
    } while (this.withinBounds(cell) && this.cellAvailable(cell));

    return {
      farthest: previous,
      next: cell,
    };
  }

  cellAvailable(cell) {
    return this.withinBounds(cell) && !this.grid[cell.row][cell.col];
  }

  cellContent(cell) {
    if (!this.withinBounds(cell)) return null;
    return this.grid[cell.row][cell.col];
  }

  withinBounds(cell) {
    return cell.row >= 0 && cell.row < this.size && cell.col >= 0 && cell.col < this.size;
  }

  removeTile(tile) {
    this.grid[tile.row][tile.col] = null;
    const element = this.tileElements.get(tile.id);
    if (element) {
      element.remove();
    }
    this.tileElements.delete(tile.id);
  }

  render(initial = false) {
    this.updateTileMetrics();
    if (!this.tileMetrics) {
      return;
    }
    const activeIds = new Set();

    for (let row = 0; row < this.size; row += 1) {
      for (let col = 0; col < this.size; col += 1) {
        const tile = this.grid[row][col];
        if (!tile) continue;
        this.updateTileElement(tile, initial);
        activeIds.add(tile.id);
        tile.previousRow = tile.row;
        tile.previousCol = tile.col;
        tile.new = false;
        tile.merged = false;
      }
    }

    // remove any leftover DOM nodes
    for (const [id, element] of Array.from(this.tileElements.entries())) {
      if (!activeIds.has(id)) {
        element.remove();
        this.tileElements.delete(id);
      }
    }
  }

  updateTileElement(tile, initial) {
    const { step } = this.tileMetrics;
    const previousX = tile.previousCol * step;
    const previousY = tile.previousRow * step;
    const currentX = tile.col * step;
    const currentY = tile.row * step;

    let element = this.tileElements.get(tile.id);
    if (!element) {
      element = document.createElement("div");
      element.className = "tile";
      element.dataset.value = tile.value;
      element.textContent = tile.value;
      element.style.setProperty("--tx", `${previousX}px`);
      element.style.setProperty("--ty", `${previousY}px`);
      if (tile.new) {
        element.classList.add("tile-new");
        element.addEventListener(
          "animationend",
          () => element.classList.remove("tile-new"),
          { once: true }
        );
      }
      this.tileContainer.appendChild(element);
      this.tileElements.set(tile.id, element);
      requestAnimationFrame(() => {
        element.style.setProperty("--tx", `${currentX}px`);
        element.style.setProperty("--ty", `${currentY}px`);
      });
    } else {
      if (element.dataset.value !== String(tile.value)) {
        element.dataset.value = tile.value;
        element.textContent = tile.value;
      }
      const needsMove = previousX !== currentX || previousY !== currentY;
      if (needsMove && !initial) {
        element.style.setProperty("--tx", `${previousX}px`);
        element.style.setProperty("--ty", `${previousY}px`);
        requestAnimationFrame(() => {
          element.style.setProperty("--tx", `${currentX}px`);
          element.style.setProperty("--ty", `${currentY}px`);
        });
      } else {
        element.style.setProperty("--tx", `${currentX}px`);
        element.style.setProperty("--ty", `${currentY}px`);
      }
      if (tile.merged) {
        element.classList.add("tile-merged");
        element.addEventListener(
          "animationend",
          () => element.classList.remove("tile-merged"),
          { once: true }
        );
      }
    }
  }

  has2048() {
    for (let row = 0; row < this.size; row += 1) {
      for (let col = 0; col < this.size; col += 1) {
        const tile = this.grid[row][col];
        if (tile && tile.value >= 2048) {
          return true;
        }
      }
    }
    return false;
  }

  movesAvailable() {
    if (this.availableCells().length > 0) return true;

    for (let row = 0; row < this.size; row += 1) {
      for (let col = 0; col < this.size; col += 1) {
        const tile = this.grid[row][col];
        if (!tile) continue;
        const neighbors = [
          { row, col: col + 1 },
          { row, col: col - 1 },
          { row: row + 1, col },
          { row: row - 1, col },
        ];
        if (neighbors.some((cell) => this.cellContent(cell)?.value === tile.value)) {
          return true;
        }
      }
    }
    return false;
  }

  handleResize() {
    if (this.resizeRaf) {
      cancelAnimationFrame(this.resizeRaf);
    }
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = null;
      this.updateTileMetrics();
      this.render(true);
    });
  }

  updateTileMetrics() {
    if (!this.boardEl || !this.gridEl) return;
    const boardStyles = window.getComputedStyle(this.boardEl);
    const paddingLeft = Number.parseFloat(boardStyles.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(boardStyles.paddingRight) || 0;
    const paddingTop = Number.parseFloat(boardStyles.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(boardStyles.paddingBottom) || 0;
    const innerWidth = this.boardEl.clientWidth - paddingLeft - paddingRight;
    const innerHeight = this.boardEl.clientHeight - paddingTop - paddingBottom;
    if (innerWidth <= 0 || innerHeight <= 0) {
      return;
    }
    const gridStyles = window.getComputedStyle(this.gridEl);
    const columnGap = Number.parseFloat(gridStyles.columnGap) || 0;
    const rowGap = Number.parseFloat(gridStyles.rowGap) || columnGap;
    const gap = Math.max(columnGap, rowGap);
    const tileSize = (Math.min(innerWidth, innerHeight) - (this.size - 1) * gap) / this.size;
    if (!Number.isFinite(tileSize) || tileSize <= 0) {
      return;
    }
    const step = tileSize + gap;
    this.tileMetrics = { gap, tileSize, step };
    this.boardEl.style.setProperty("--tile-size", `${tileSize}px`);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  // eslint-disable-next-line no-new
  new Game2048();
});
