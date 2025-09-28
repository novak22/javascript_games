const SYMBOLS = ['💾', '👾', '🛸', '🎹', '🎯', '🔮'];
const boardEl = document.querySelector('.memory__board');
const matchesEl = document.querySelector('[data-stat="matches"]');
const turnsEl = document.querySelector('[data-stat="turns"]');
const timeEl = document.querySelector('[data-stat="time"]');
const statusEl = document.querySelector('[data-memory-status]');
const resetBtn = document.querySelector('[data-action="reset"]');

let deck = [];
let firstCard = null;
let secondCard = null;
let lockBoard = false;
let matches = 0;
let turns = 0;
let timerId = null;
let startTime = null;

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function updateStats() {
  if (matchesEl) {
    matchesEl.textContent = matches.toString();
  }
  if (turnsEl) {
    turnsEl.textContent = turns.toString();
  }
}

function updateTimer() {
  if (!timeEl) return;
  if (!startTime) {
    timeEl.textContent = '0:00';
    return;
  }
  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
  timeEl.textContent = formatTime(elapsedSeconds);
}

function stopTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function startTimer() {
  if (timerId) return;
  startTime = Date.now();
  updateTimer();
  timerId = window.setInterval(updateTimer, 1000);
}

function announce(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function resetBoard() {
  stopTimer();
  startTime = null;
  matches = 0;
  turns = 0;
  firstCard = null;
  secondCard = null;
  lockBoard = false;
  updateStats();
  updateTimer();
  announce('Flip two cards to get started.');

  deck = shuffle([...SYMBOLS, ...SYMBOLS]);
  boardEl.innerHTML = '';
  boardEl.setAttribute('aria-label', `Neon memory board with ${deck.length} cards`);

  deck.forEach((symbol, index) => {
    const cardButton = document.createElement('button');
    cardButton.type = 'button';
    cardButton.className = 'memory-card';
    cardButton.dataset.symbol = symbol;
    cardButton.dataset.index = index.toString();
    cardButton.setAttribute('aria-pressed', 'false');
    cardButton.setAttribute('aria-label', 'Hidden card');
    cardButton.setAttribute('role', 'gridcell');

    cardButton.innerHTML = `
      <span class="memory-card__face memory-card__face--back" aria-hidden="true"></span>
      <span class="memory-card__face memory-card__face--front">${symbol}</span>
    `;

    cardButton.addEventListener('click', () => onCardSelect(cardButton));
    boardEl.append(cardButton);
  });
}

function lockMatch(cardA, cardB) {
  cardA.classList.add('is-matched');
  cardB.classList.add('is-matched');
  cardA.disabled = true;
  cardB.disabled = true;
  cardA.setAttribute('aria-pressed', 'true');
  cardB.setAttribute('aria-pressed', 'true');
  cardA.setAttribute('aria-label', `Matched card showing ${cardA.dataset.symbol}`);
  cardB.setAttribute('aria-label', `Matched card showing ${cardB.dataset.symbol}`);

  matches += 1;
  updateStats();

  if (matches === deck.length / 2) {
    stopTimer();
    const finalTime = timeEl ? timeEl.textContent : '';
    announce(`Board cleared in ${turns} turns and ${finalTime}. Stellar memory!`);
  } else {
    announce('Nice match! Keep the streak going.');
  }

  firstCard = null;
  secondCard = null;
  lockBoard = false;
}

function hidePair(cardA, cardB) {
  window.setTimeout(() => {
    cardA.classList.remove('is-flipped');
    cardB.classList.remove('is-flipped');
    cardA.setAttribute('aria-pressed', 'false');
    cardB.setAttribute('aria-pressed', 'false');
    cardA.setAttribute('aria-label', 'Hidden card');
    cardB.setAttribute('aria-label', 'Hidden card');
    firstCard = null;
    secondCard = null;
    lockBoard = false;
    announce('So close! Keep pairing those icons.');
  }, 700);
}

function onCardSelect(card) {
  if (lockBoard || card === firstCard || card.classList.contains('is-matched')) {
    return;
  }

  if (!startTime) {
    startTimer();
  }

  card.classList.add('is-flipped');
  card.setAttribute('aria-pressed', 'true');
  card.setAttribute('aria-label', `Card showing ${card.dataset.symbol}`);

  if (!firstCard) {
    firstCard = card;
    announce('Choose another card to find a match.');
    return;
  }

  secondCard = card;
  lockBoard = true;
  turns += 1;
  updateStats();

  if (firstCard.dataset.symbol === secondCard.dataset.symbol) {
    lockMatch(firstCard, secondCard);
  } else {
    hidePair(firstCard, secondCard);
  }
}

resetBtn?.addEventListener('click', resetBoard);

resetBoard();
