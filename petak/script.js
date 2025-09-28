const languages = {
  sr: {
    name: "Srpski",
    rows: [
      ["q", "w", "e", "r", "t", "z", "u", "i", "o", "p"],
      ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
      ["č", "ć", "š", "đ", "ž", "y", "x", "c", "v", "b", "n", "m"],
    ],
    wordsFile: "words-sr.txt",
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
const boardRowTemplate = document.getElementById("board-row-template");

let currentLanguageKey = "sr";
let targetWord = "";
let guesses = [];
let currentGuess = "";
let isGameOver = false;

const wordListCache = {};
let startGameRequestId = 0;

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

async function loadWords(languageKey) {
  const language = languages[languageKey];

  if (!language) {
    throw new Error("Nepoznat jezik.");
  }

  if (wordListCache[languageKey]) {
    language.words = wordListCache[languageKey];
    return language.words;
  }

  if (Array.isArray(language.words)) {
    const normalized = language.words
      .map((word) => word.normalize("NFC").toLowerCase())
      .filter((word) => word.length === WORD_LENGTH);
    wordListCache[languageKey] = normalized;
    language.words = normalized;
    return normalized;
  }

  if (language.wordsFile) {
    const response = await fetch(language.wordsFile, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Ne mogu da učitam reči za jezik "${language.name}".`);
    }

    const text = await response.text();
    const words = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((word) => word.normalize("NFC").toLowerCase())
      .filter((word) => word.length === WORD_LENGTH);

    const uniqueWords = [];
    const seen = new Set();
    words.forEach((word) => {
      if (!seen.has(word)) {
        seen.add(word);
        uniqueWords.push(word);
      }
    });

    wordListCache[languageKey] = uniqueWords;
    language.words = uniqueWords;
    return uniqueWords;
  }

  throw new Error(`Lista reči za jezik "${language.name}" nije definisana.`);
}

function updateBoard() {
  const rows = Array.from(boardElement.querySelectorAll(".board-row"));

  rows.forEach((row, rowIndex) => {
    const tiles = Array.from(row.children);
    tiles.forEach((tile, tileIndex) => {
      let letter = "";
      let status = "";

      if (rowIndex < guesses.length) {
        letter = guesses[rowIndex].letters[tileIndex] || "";
        status = guesses[rowIndex].statuses[tileIndex];
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

function showMessage(message) {
  window.alert(message);
}

function finishGame(won) {
  isGameOver = true;
  const message = won ? `Bravo! Reč je "${targetWord.toUpperCase()}".` : `Više sreće sledeći put! Reč je "${targetWord.toUpperCase()}".`;
  setTimeout(() => showMessage(message), 100);
}

function submitGuess() {
  if (currentGuess.length !== WORD_LENGTH) {
    showMessage("Reč mora imati pet slova.");
    return;
  }

  const { words } = languages[currentLanguageKey];
  if (!words.includes(currentGuess)) {
    showMessage("Reč nije u listi.");
    return;
  }

  const statuses = evaluateGuess(currentGuess.split(""), targetWord);
  guesses.push({ letters: currentGuess.split(""), statuses });

  if (currentGuess === targetWord) {
    updateBoard();
    updateKeyboard();
    finishGame(true);
    return;
  }

  if (guesses.length >= ATTEMPTS) {
    updateBoard();
    updateKeyboard();
    finishGame(false);
    return;
  }

  currentGuess = "";
  updateBoard();
  updateKeyboard();
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
  if (isGameOver) return;

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

async function startGame(languageKey) {
  const language = languages[languageKey];
  if (!language) {
    showMessage("Nepoznat jezik.");
    return;
  }

  try {
    const requestId = ++startGameRequestId;
    const words = await loadWords(languageKey);
    if (requestId !== startGameRequestId) {
      return;
    }
    currentLanguageKey = languageKey;
    targetWord = pickRandomWord(words);
    guesses = [];
    currentGuess = "";
    isGameOver = false;

    createBoard();
    createKeyboard(language.rows);
    updateBoard();
    updateKeyboard();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Došlo je do greške pri učitavanju reči.");
    throw error;
  }
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
    startGame(event.target.value).catch(() => {
      // Greška je već prikazana korisniku.
    });
  });
}

populateLanguageSelect();
startGame(currentLanguageKey).catch(() => {
  // Greška je već prikazana korisniku.
});

window.addEventListener("keydown", handlePhysicalKeyboard);

// Helper for developers: add new languages by pushing objects into the `languages` map.
// Each language requires a `name`, `rows` definition for the on-screen keyboard,
// and a `words` array with exactly five-letter entries for the gameplay.
