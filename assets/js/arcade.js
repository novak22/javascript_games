(() => {
  const year = new Date().getFullYear();
  document.querySelectorAll('.js-year').forEach((el) => {
    el.textContent = year;
  });

  const allCards = Array.from(document.querySelectorAll('.game-grid .game-card'));
  const playableCards = allCards.filter((card) => card.getAttribute('aria-disabled') !== 'true');
  const totalGamesEl = document.querySelector('[data-total-games]');
  const newGamesEl = document.querySelector('[data-new-games]');
  const statusEl = document.querySelector('[data-status-rotator]');
  const shuffleButton = document.querySelector('[data-action="shuffle"]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (totalGamesEl) {
    totalGamesEl.textContent = playableCards.length.toString();
  }

  if (newGamesEl) {
    const newGames = playableCards.filter((card) => card.dataset.status === 'new').length;
    newGamesEl.textContent = newGames.toString();
  }

  const statusMessages = [
    'Queueing power-ups... almost there!',
    'Cycling neon lights for optimal vibes.',
    'Listening for high-score whispers in the cabinet.',
    'Syncing the uniform cabinet shell for your run.',
    'Spinning the arcade wheel for your next run.',
  ];

  if (statusEl) {
    let statusIndex = 0;
    setInterval(() => {
      statusIndex = (statusIndex + 1) % statusMessages.length;
      statusEl.textContent = statusMessages[statusIndex];
    }, 7000);
  }

  if (shuffleButton && playableCards.length) {
    let highlightTimeout;

    shuffleButton.addEventListener('click', () => {
      const choice = playableCards[Math.floor(Math.random() * playableCards.length)];

      allCards.forEach((card) => card.classList.remove('is-highlighted'));
      choice.classList.add('is-highlighted');

      const gameName = choice.querySelector('h2')?.textContent?.trim() ?? 'your next game';

      if (statusEl) {
        statusEl.textContent = `Arcade selected: ${gameName}!`;
      }

      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
      }

      highlightTimeout = window.setTimeout(() => {
        choice.classList.remove('is-highlighted');
      }, 4000);

      choice.focus?.({ preventScroll: true });
      choice.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    });
  }
})();
