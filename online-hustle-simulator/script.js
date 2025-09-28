const STORAGE_KEY = 'online-hustle-sim-v1';
const MAX_LOG_ENTRIES = 60;
const BLOG_CHUNK = 3; // dollars per payout cycle
const BLOG_INTERVAL_SECONDS = 10;

const DEFAULT_STATE = {
  money: 45,
  timeLeft: 14,
  baseTime: 14,
  bonusTime: 0,
  dailyBonusTime: 0,
  day: 1,
  blog: {
    active: false,
    multiplier: 1,
    buffer: 0
  },
  pendingFlips: [],
  assistantHired: false,
  coffeesToday: 0,
  coursePurchased: false,
  log: [],
  lastSaved: Date.now()
};

let state = structuredClone(DEFAULT_STATE);
let lastTick = Date.now();

const moneyEl = document.getElementById('money');
const timeEl = document.getElementById('time');
const timeProgressEl = document.getElementById('time-progress');
const dayEl = document.getElementById('day');
const logFeed = document.getElementById('log-feed');
const logTemplate = document.getElementById('log-template');
const logTip = document.getElementById('log-tip');

const freelanceBtn = document.getElementById('freelance-btn');
const blogBtn = document.getElementById('blog-btn');
const flipBtn = document.getElementById('flip-btn');
const flipStatus = document.getElementById('flip-status');
const endDayBtn = document.getElementById('end-day');
const assistantBtn = document.getElementById('assistant-btn');
const assistantCard = document.getElementById('assistant-card');
const coffeeBtn = document.getElementById('coffee-btn');
const courseBtn = document.getElementById('course-btn');
const courseCard = document.getElementById('course-card');
const blogIncomeRateEl = document.getElementById('blog-income-rate');

function structuredClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = {
        ...structuredClone(DEFAULT_STATE),
        ...saved,
        blog: {
          ...structuredClone(DEFAULT_STATE.blog),
          ...saved.blog
        },
        pendingFlips: saved.pendingFlips || [],
        log: saved.log || []
      };
      handleOfflineProgress(saved.lastSaved || Date.now());
      addLog('Welcome back! Your hustles kept buzzing while you were away.', 'info');
    } else {
      state = structuredClone(DEFAULT_STATE);
      addLog('Welcome to Online Hustle Simulator! Time to make that side cash.', 'info');
    }
  } catch (err) {
    console.error('Failed to load state', err);
    state = structuredClone(DEFAULT_STATE);
  }
  lastTick = Date.now();
  renderLog();
}

function saveState() {
  state.lastSaved = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save game', err);
  }
}

function handleOfflineProgress(lastSaved) {
  const now = Date.now();
  const elapsed = Math.max(0, (now - lastSaved) / 1000);
  if (!elapsed) return;

  if (state.blog.active) {
    const offlineMoney = collectBlogIncome(elapsed, true);
    if (offlineMoney > 0) {
      addLog(`Your blog earned $${formatMoney(offlineMoney)} while you were offline. Not too shabby!`, 'passive');
    }
  }

  if (state.pendingFlips.length) {
    processFlips(now, true);
  }
}

function getTimeCap() {
  return state.baseTime + state.bonusTime + state.dailyBonusTime;
}

function formatMoney(value) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function formatHours(hours) {
  if (Math.abs(hours - Math.round(hours)) < 0.05) {
    return `${Math.round(hours)}h`;
  }
  return `${hours.toFixed(1)}h`;
}

function addMoney(amount, message, type = 'info') {
  state.money = Math.max(0, Number(state.money) + Number(amount));
  flashValue(moneyEl);
  if (message) {
    addLog(message, type);
  }
}

function spendMoney(amount) {
  state.money = Math.max(0, state.money - amount);
  flashValue(moneyEl, true);
}

function flashValue(el, negative = false) {
  const className = negative ? 'flash-negative' : 'flash';
  el.classList.remove('flash', 'flash-negative');
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), 500);
}

function addLog(message, type = 'info') {
  const entry = {
    id: createId(),
    timestamp: Date.now(),
    message,
    type
  };
  state.log.push(entry);
  if (state.log.length > MAX_LOG_ENTRIES) {
    state.log.splice(0, state.log.length - MAX_LOG_ENTRIES);
  }
  renderLog();
}

function renderLog() {
  if (!state.log.length) {
    logTip.style.display = 'block';
    logFeed.innerHTML = '';
    return;
  }
  logTip.style.display = 'none';
  logFeed.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const entries = [...state.log].sort((a, b) => b.timestamp - a.timestamp);
  for (const item of entries) {
    const node = logTemplate.content.cloneNode(true);
    const entryEl = node.querySelector('.log-entry');
    entryEl.classList.add(`type-${item.type}`);
    node.querySelector('.timestamp').textContent = new Date(item.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    node.querySelector('.message').textContent = item.message;
    fragment.appendChild(node);
  }
  logFeed.appendChild(fragment);
  logFeed.scrollTop = 0;
}

function updateUI() {
  moneyEl.textContent = `$${formatMoney(state.money)}`;
  timeEl.textContent = `${formatHours(state.timeLeft)} / ${formatHours(getTimeCap())}`;
  dayEl.textContent = state.day;

  const cap = getTimeCap();
  const percent = cap === 0 ? 0 : Math.min(100, Math.max(0, (state.timeLeft / cap) * 100));
  timeProgressEl.style.width = `${percent}%`;

  freelanceBtn.disabled = state.timeLeft < 2;
  blogBtn.disabled = state.blog.active || state.timeLeft < 3 || state.money < 25;
  flipBtn.disabled = state.timeLeft < 4 || state.money < 20;

  assistantBtn.disabled = state.assistantHired || state.money < 180;
  assistantBtn.textContent = state.assistantHired ? 'Assistant Hired' : 'Hire Assistant';
  assistantCard.classList.toggle('locked', state.assistantHired);

  const coffeeLimit = 3;
  coffeeBtn.disabled = state.money < 40 || state.coffeesToday >= coffeeLimit || state.timeLeft <= 0;
  coffeeBtn.textContent = state.coffeesToday >= coffeeLimit ? 'Too Much Caffeine' : 'Brew Boost';

  const blogReadyForCourse = state.blog.active;
  const courseLocked = !blogReadyForCourse || state.coursePurchased;
  courseCard.classList.toggle('locked', !blogReadyForCourse && !state.coursePurchased);
  courseBtn.disabled = courseLocked || state.money < 260;
  if (state.coursePurchased) {
    courseBtn.textContent = 'Automation Ready';
  } else if (!blogReadyForCourse) {
    courseBtn.textContent = 'Requires Active Blog';
  } else {
    courseBtn.textContent = 'Study Up';
  }

  blogBtn.textContent = state.blog.active ? 'Blog Running' : 'Launch Blog';
  if (blogIncomeRateEl) {
    const income = BLOG_CHUNK * state.blog.multiplier;
    blogIncomeRateEl.textContent = `$${formatMoney(income)} / 10s`;
  }

  updateFlipStatus();
}

function updateFlipStatus() {
  if (!state.pendingFlips.length) {
    flipStatus.textContent = 'No flips in progress.';
    return;
  }
  const now = Date.now();
  const nextFlip = state.pendingFlips.reduce((soonest, flip) =>
    flip.readyAt < soonest.readyAt ? flip : soonest
  );
  const timeRemaining = Math.max(0, Math.round((nextFlip.readyAt - now) / 1000));
  const label = timeRemaining === 0 ? 'any moment' : `${timeRemaining}s`;
  const descriptor = state.pendingFlips.length === 1 ? 'flip' : 'flips';
  flipStatus.textContent = `${state.pendingFlips.length} ${descriptor} in progress. Next payout in ${label}.`;
}

function performFreelance() {
  if (state.timeLeft < 2) return;
  state.timeLeft -= 2;
  addMoney(18, 'You hustled an article for $18. Not Pulitzer material, but it pays the bills!');
  checkDayEnd();
  updateUI();
  saveState();
}

function launchBlog() {
  if (state.blog.active || state.timeLeft < 3 || state.money < 25) return;
  state.timeLeft -= 3;
  spendMoney(25);
  state.blog.active = true;
  state.blog.buffer = 0;
  addLog('You launched your blog! Expect slow trickles of internet fame and $3 every 10 seconds.', 'passive');
  checkDayEnd();
  updateUI();
  saveState();
}

function startFlip() {
  if (state.timeLeft < 4 || state.money < 20) return;
  state.timeLeft -= 4;
  spendMoney(20);
  const flip = {
    id: createId(),
    readyAt: Date.now() + 30000,
    payout: 48
  };
  state.pendingFlips.push(flip);
  addLog('You listed a spicy eBay flip. In 30 seconds it should cha-ching for $48!', 'delayed');
  checkDayEnd();
  updateUI();
  saveState();
}

function hireAssistant() {
  if (state.assistantHired || state.money < 180) return;
  spendMoney(180);
  state.assistantHired = true;
  state.bonusTime += 2;
  state.timeLeft = Math.min(state.timeLeft + 2, getTimeCap());
  addLog('You hired a virtual assistant who adds +2h to your day and handles inbox chaos.', 'upgrade');
  updateUI();
  saveState();
}

function brewCoffee() {
  const coffeeLimit = 3;
  if (state.money < 40 || state.coffeesToday >= coffeeLimit || state.timeLeft <= 0) return;
  spendMoney(40);
  state.coffeesToday += 1;
  state.dailyBonusTime += 1;
  state.timeLeft = Math.min(state.timeLeft + 1, getTimeCap());
  addLog('Turbo coffee acquired! You feel invincible for another hour (ish).', 'boost');
  updateUI();
  saveState();
}

function purchaseCourse() {
  if (state.coursePurchased || !state.blog.active || state.money < 260) return;
  spendMoney(260);
  state.coursePurchased = true;
  state.blog.multiplier = 1.5;
  addLog('Automation course complete! Your blog now earns +50% more while you nap.', 'upgrade');
  updateUI();
  saveState();
}

function endDay(auto = false) {
  const message = auto ? 'You ran out of time. The grind resets tomorrow.' : 'You called it a day. Fresh hustle awaits tomorrow.';
  addLog(`${message} Day ${state.day + 1} begins with renewed energy.`, 'info');
  state.day += 1;
  state.coffeesToday = 0;
  state.dailyBonusTime = 0;
  state.timeLeft = getTimeCap();
  updateUI();
  saveState();
}

function checkDayEnd() {
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    updateUI();
    setTimeout(() => endDay(true), 400);
  }
}

function collectBlogIncome(elapsedSeconds, offline = false) {
  if (!state.blog.active) return 0;
  const chunkValue = BLOG_CHUNK * state.blog.multiplier;
  const ratePerSecond = chunkValue / BLOG_INTERVAL_SECONDS;
  state.blog.buffer += ratePerSecond * elapsedSeconds;
  let payouts = 0;
  while (state.blog.buffer >= chunkValue) {
    state.blog.buffer -= chunkValue;
    payouts += chunkValue;
    if (!offline) {
      addMoney(chunkValue, `Your blog quietly earned $${formatMoney(chunkValue)} while you scrolled memes.`, 'passive');
    }
  }
  if (offline && payouts > 0) {
    state.money += payouts;
  }
  return payouts;
}

function processFlips(now = Date.now(), offline = false) {
  const remaining = [];
  let offlineTotal = 0;
  let completed = 0;
  for (const flip of state.pendingFlips) {
    if (flip.readyAt <= now) {
      completed += 1;
      if (offline) {
        state.money += flip.payout;
        offlineTotal += flip.payout;
      } else {
        addMoney(flip.payout, `Your eBay flip sold for $${formatMoney(flip.payout)}! Shipping label time.`, 'delayed');
      }
    } else {
      remaining.push(flip);
    }
  }
  if (completed > 0 && offline) {
    addLog(`While you were away, ${completed} eBay ${completed === 1 ? 'flip' : 'flips'} paid out. $${formatMoney(offlineTotal)} richer!`, 'delayed');
  }
  state.pendingFlips = remaining;
}

function gameLoop() {
  const now = Date.now();
  const dt = Math.min(5, (now - lastTick) / 1000);
  lastTick = now;

  if (dt <= 0) return;

  if (state.blog.active) {
    collectBlogIncome(dt, false);
  }

  if (state.pendingFlips.length) {
    const maturedBefore = state.pendingFlips.length;
    processFlips(now, false);
    if (maturedBefore !== state.pendingFlips.length) {
      updateFlipStatus();
    }
  }

  updateUI();
  saveState();
}

freelanceBtn.addEventListener('click', performFreelance);
blogBtn.addEventListener('click', launchBlog);
flipBtn.addEventListener('click', startFlip);
assistantBtn.addEventListener('click', hireAssistant);
coffeeBtn.addEventListener('click', brewCoffee);
courseBtn.addEventListener('click', purchaseCourse);
endDayBtn.addEventListener('click', () => endDay(false));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    lastTick = Date.now();
  }
});

window.addEventListener('beforeunload', saveState);

loadState();
updateUI();
setInterval(gameLoop, 1000);
