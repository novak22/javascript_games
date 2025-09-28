const languages = {
  sr: {
    name: "Srpski",
    rows: [
      ["q", "w", "e", "r", "t", "z", "u", "i", "o", "p"],
      ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
      ["č", "ć", "š", "đ", "ž", "y", "x", "c", "v", "b", "n", "m"],
    ],
    words: [],
  },
  en: {
    name: "English (demo)",
    rows: [
      ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
      ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
      ["z", "x", "c", "v", "b", "n", "m"],
    ],
    words: [
      "apple",
      "brain",
      "candy",
      "delta",
      "eager",
      "flame",
      "grape",
      "honey",
      "ivory",
      "jazzy",
    ],
  },
};

const ATTEMPTS = 6;
const WORD_LENGTH = 5;

const boardElement = document.getElementById("board");
const keyboardElement = document.getElementById("keyboard");
const languageSelect = document.getElementById("language-select");
const resetButton = document.getElementById("reset-button");
const statusBar = document.getElementById("status-bar");
const boardRowTemplate = document.getElementById("board-row-template");

let currentLanguageKey = "sr";
let targetWord = "";
let guesses = [];
let currentGuess = "";
let isGameOver = false;
let messageTimeout = null;
let isAnimating = false;

async function loadSerbianWords() {
  if (languages.sr.words.length > 0) return;
  try {
    const response = await fetch("data/serbian_nouns_5.json");
    if (!response.ok) {
      throw new Error(`Greška pri učitavanju reči: ${response.status}`);
    }
    const words = await response.json();
    languages.sr.words = words.map((word) => word.normalize("NFC"));
  } catch (error) {
    console.error("Failed to load Serbian nouns", error);
    throw error;
  }
}

function pickRandomWord(words) {
  return words[Math.floor(Math.random() * words.length)].toLowerCase();
}

function createBoard() {
  boardElement.innerHTML = "";
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const row = boardRowTemplate.content.firstElementChild.cloneNode(true);
    boardElement.appendChild(row);
  }
}

function createKeyboard(layout) {
  keyboardElement.innerHTML = "";
  layout.forEach((rowLetters, rowIndex) => {
    const row = document.createElement("div");
    row.className = "keyboard-row";

    if (rowIndex === layout.length - 1) {
      const enterKey = createKey("enter", "Potvrdi", "wide");
      row.appendChild(enterKey);
    }

    rowLetters.forEach((letter) => {
      row.appendChild(createKey(letter));
    });

    if (rowIndex === layout.length - 1) {
      const deleteKey = createKey("backspace", "Obriši", "wide");
      row.appendChild(deleteKey);
    }

    keyboardElement.appendChild(row);
  });
}

function createKey(value, label = value, extraClass = "") {
  const button = document.createElement("button");
  button.className = `keyboard-key ${extraClass}`.trim();
  button.dataset.key = value;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => handleKey(value));
  return button;
}

function updateBoard() {
  const rows = Array.from(boardElement.querySelectorAll(".board-row"));

  rows.forEach((row, rowIndex) => {
    row.classList.toggle("active", rowIndex === guesses.length && !isGameOver);
    const tiles = Array.from(row.children);
    tiles.forEach((tile, tileIndex) => {
      let letter = "";
      let status = "";

      if (rowIndex < guesses.length) {
        letter = guesses[rowIndex].letters[tileIndex] || "";
        status = guesses[rowIndex].revealed
          ? guesses[rowIndex].statuses[tileIndex]
          : "";
      } else if (rowIndex === guesses.length) {
        letter = currentGuess[tileIndex] || "";
      }

      tile.textContent = letter ? letter.toUpperCase() : "";
      tile.classList.toggle("filled", Boolean(letter));
      tile.classList.remove("correct", "present", "absent");
      if (status) {
        tile.classList.add(status);
      }
    });
  });
}

function updateKeyboard() {
  const keyButtons = keyboardElement.querySelectorAll(".keyboard-key");
  const statusByLetter = {};

  guesses.forEach((guessObj) => {
    guessObj.letters.forEach((letter, index) => {
      const status = guessObj.statuses[index];
      const existing = statusByLetter[letter];
      if (existing === "correct") return;
      if (status === "correct" || (status === "present" && existing !== "correct")) {
        statusByLetter[letter] = status;
      } else if (!existing) {
        statusByLetter[letter] = status;
      }
    });
  });

  keyButtons.forEach((button) => {
    const letter = button.dataset.key;
    if (!letter || letter === "enter" || letter === "backspace") return;
    button.classList.remove("correct", "present", "absent");
    const status = statusByLetter[letter];
    if (status) {
      button.classList.add(status);
    }
  });
}

function evaluateGuess(guess, solution) {
  const solutionLetters = solution.split("");
  const statuses = new Array(WORD_LENGTH).fill("absent");
  const solutionUsage = Array(WORD_LENGTH).fill(false);

  // First pass: mark correct letters
  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (guess[i] === solutionLetters[i]) {
      statuses[i] = "correct";
      solutionUsage[i] = true;
    }
  }

  // Second pass: mark present letters
  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (statuses[i] === "correct") continue;
    for (let j = 0; j < WORD_LENGTH; j += 1) {
      if (!solutionUsage[j] && guess[i] === solutionLetters[j]) {
        statuses[i] = "present";
        solutionUsage[j] = true;
        break;
      }
    }
  }

  return statuses;
}

function showMessage(message, type = "info") {
  if (!statusBar) return;

  statusBar.textContent = message;
  statusBar.classList.remove("visible", "success", "error");
  if (type === "success") {
    statusBar.classList.add("success");
  } else if (type === "error") {
    statusBar.classList.add("error");
  }

  requestAnimationFrame(() => {
    statusBar.classList.add("visible");
  });

  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }

  messageTimeout = setTimeout(() => {
    statusBar.classList.remove("visible", "success", "error");
    messageTimeout = null;
  }, type === "error" ? 4000 : 3000);
}

function shakeActiveRow() {
  const rows = boardElement.querySelectorAll(".board-row");
  const activeRow = rows[guesses.length] || rows[rows.length - 1];
  if (!activeRow) return;
  activeRow.classList.remove("shake");
  void activeRow.offsetWidth; // restart animation
  activeRow.classList.add("shake");
}

function revealLastGuess(onComplete) {
  const rowIndex = guesses.length - 1;
  const rows = boardElement.querySelectorAll(".board-row");
  const row = rows[rowIndex];
  if (!row) {
    if (onComplete) onComplete();
    return;
  }

  isAnimating = true;
  const tiles = Array.from(row.children);
  const guess = guesses[rowIndex];

  tiles.forEach((tile, index) => {
    const status = guess.statuses[index];
    const letter = guess.letters[index] || "";
    const delay = index * 320;

    setTimeout(() => {
      tile.classList.remove("correct", "present", "absent", "flip");
      tile.textContent = letter.toUpperCase();
      tile.classList.add("flip");
      setTimeout(() => {
        tile.classList.add(status);
        tile.classList.remove("flip");
      }, 250);

      if (index === tiles.length - 1) {
        setTimeout(() => {
          guess.revealed = true;
          updateBoard();
          updateKeyboard();
          isAnimating = false;
          if (onComplete) onComplete();
        }, 350);
      }
    }, delay);
  });
}

function finishGame(won) {
  isGameOver = true;
  const message = won
    ? `Bravo! Reč je "${targetWord.toUpperCase()}".`
    : `Više sreće sledeći put! Reč je "${targetWord.toUpperCase()}".`;
  showMessage(message, won ? "success" : "error");
}

function submitGuess() {
  if (currentGuess.length !== WORD_LENGTH) {
    showMessage("Reč mora imati pet slova.", "error");
    shakeActiveRow();
    return;
  }

  const { words } = languages[currentLanguageKey];
  if (!words.includes(currentGuess)) {
    showMessage("Reč nije u listi.", "error");
    shakeActiveRow();
    return;
  }

  const statuses = evaluateGuess(currentGuess.split(""), targetWord);
  guesses.push({ letters: currentGuess.split(""), statuses, revealed: false });
  const lastGuessWord = currentGuess;
  currentGuess = "";
  updateBoard();

  revealLastGuess(() => {
    const won = lastGuessWord === targetWord;
    if (won) {
      finishGame(true);
      return;
    }

    if (guesses.length >= ATTEMPTS) {
      finishGame(false);
      return;
    }

    showMessage("Pokušaj ponovo!", "info");
  });
}

function removeLetter() {
  currentGuess = currentGuess.slice(0, -1);
  updateBoard();
}

function addLetter(letter) {
  if (currentGuess.length >= WORD_LENGTH) return;
  currentGuess += letter;
  updateBoard();
}

function handleKey(key) {
  if (isGameOver || isAnimating) return;

  if (key === "enter") {
    submitGuess();
  } else if (key === "backspace") {
    removeLetter();
  } else {
    const normalizedKey = key.toLowerCase();
    const allowedLetters = languages[currentLanguageKey].rows.flat();
    if (allowedLetters.includes(normalizedKey)) {
      addLetter(normalizedKey);
    }
  }
}

function handlePhysicalKeyboard(event) {
  const key = event.key.toLowerCase();
  if (key === "enter" || key === "backspace") {
    event.preventDefault();
    handleKey(key);
    return;
  }

  const allowedLetters = languages[currentLanguageKey].rows.flat();
  if (allowedLetters.includes(key)) {
    event.preventDefault();
    handleKey(key);
  }
}

function startGame(languageKey) {
  currentLanguageKey = languageKey;
  const { words, rows } = languages[languageKey];
  targetWord = pickRandomWord(words);
  guesses = [];
  currentGuess = "";
  isGameOver = false;
  showMessage("Nova igra! Srećno!", "info");

  createBoard();
  createKeyboard(rows);
  updateBoard();
  updateKeyboard();
}

function populateLanguageSelect() {
  Object.entries(languages).forEach(([key, config]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = config.name;
    languageSelect.appendChild(option);
  });

  languageSelect.value = currentLanguageKey;
  languageSelect.addEventListener("change", (event) => {
    startGame(event.target.value);
  });
}

async function initializeGame() {
  try {
    await loadSerbianWords();
  } catch (error) {
    showMessage("Nije moguće učitati listu reči. Osvežite stranicu ili pokušajte kasnije.", "error");
    return;
  }

  populateLanguageSelect();
  startGame(currentLanguageKey);
}

initializeGame();

if (resetButton) {
  resetButton.addEventListener("click", () => {
    startGame(currentLanguageKey);
  });
}

window.addEventListener("keydown", handlePhysicalKeyboard);

// Helper for developers: add new languages by pushing objects into the `languages` map.
// Each language requires a `name`, `rows` definition for the on-screen keyboard,
// and a `words` array with exactly five-letter entries for the gameplay.
