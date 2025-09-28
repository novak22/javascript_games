const STORAGE_KEY = 'online-hustle-sim-v1';
const MAX_LOG_ENTRIES = 60;
const BLOG_CHUNK = 3;
const BLOG_INTERVAL_SECONDS = 10;
const COFFEE_LIMIT = 3;

const HUSTLES = [
  {
    id: 'freelance',
    name: 'Freelance Writing',
    tag: { label: 'Instant', type: 'instant' },
    description: 'Crank out a quick article for a client. Not Pulitzer material, but it pays.',
    details: [
      () => '⏳ Time: <strong>2h</strong>',
      () => '💵 Payout: <strong>$18</strong>'
    ],
    action: {
      label: 'Write Now',
      className: 'primary',
      disabled: () => state.timeLeft < 2,
      onClick: () => executeAction(() => {
        spendTime(2);
        addMoney(18, 'You hustled an article for $18. Not Pulitzer material, but it pays the bills!');
      }, { checkDay: true })
    }
  },
  {
    id: 'flips',
    name: 'eBay Flips',
    tag: { label: 'Delayed', type: 'delayed' },
    description: 'Hunt for deals, flip them online. Profit arrives fashionably late.',
    details: [
      () => '⏳ Time: <strong>4h</strong>',
      () => '💵 Cost: <strong>$20</strong>',
      () => '💰 Payout: <strong>$48 after 30s</strong>'
    ],
    defaultState: {
      pending: []
    },
    action: {
      label: 'Start Flip',
      className: 'primary',
      disabled: () => state.timeLeft < 4 || state.money < 20,
      onClick: () => executeAction(() => {
        spendTime(4);
        spendMoney(20);
        scheduleFlip();
        addLog('You listed a spicy eBay flip. In 30 seconds it should cha-ching for $48!', 'delayed');
      }, { checkDay: true })
    },
    extraContent: card => {
      const status = document.createElement('div');
      status.className = 'pending';
      status.textContent = 'No flips in progress.';
      card.appendChild(status);
      return { status };
    },
    update: (_state, ui) => {
      updateFlipStatus(ui.extra.status);
    },
    process: (now, offline) => processFlipPayouts(now, offline)
  }
];

const ASSETS = [
  {
    id: 'blog',
    name: 'Personal Blog',
    tag: { label: 'Passive', type: 'passive' },
    description: 'Launch a blog that trickles income while you sip questionable coffee.',
    defaultState: {
      active: false,
      buffer: 0,
      multiplier: 1
    },
    details: [
      () => '⏳ Setup Time: <strong>3h</strong>',
      () => '💵 Setup Cost: <strong>$25</strong>',
      () => {
        const asset = getAssetState('blog');
        const income = BLOG_CHUNK * asset.multiplier;
        return `💸 Income: <strong>$${formatMoney(income)} / 10s</strong>`;
      }
    ],
    action: {
      label: () => getAssetState('blog').active ? 'Blog Running' : 'Launch Blog',
      className: 'primary',
      disabled: () => {
        const asset = getAssetState('blog');
        return asset.active || state.timeLeft < 3 || state.money < 25;
      },
      onClick: () => executeAction(() => {
        const asset = getAssetState('blog');
        spendTime(3);
        spendMoney(25);
        asset.active = true;
        asset.buffer = 0;
        addLog('You launched your blog! Expect slow trickles of internet fame and $3 every 10 seconds.', 'passive');
      }, { checkDay: true })
    },
    passiveIncome: {
      interval: BLOG_INTERVAL_SECONDS,
      logType: 'passive',
      message: amount => `Your blog quietly earned $${formatMoney(amount)} while you scrolled memes.`,
      offlineMessage: total => `Your blog earned $${formatMoney(total)} while you were offline. Not too shabby!`
    },
    isActive: (_state, assetState) => assetState.active,
    getIncomeAmount: (_state, assetState) => BLOG_CHUNK * assetState.multiplier
  }
];

const UPGRADES = [
  {
    id: 'assistant',
    name: 'Hire Virtual Assistant',
    tag: { label: 'Unlock', type: 'unlock' },
    description: 'Add +2h to your daily grind. They handle the boring stuff.',
    defaultState: {
      purchased: false
    },
    details: [
      () => '💵 Cost: <strong>$180</strong>'
    ],
    action: {
      label: () => getUpgradeState('assistant').purchased ? 'Assistant Hired' : 'Hire Assistant',
      className: 'secondary',
      disabled: () => {
        const upgrade = getUpgradeState('assistant');
        return upgrade.purchased || state.money < 180;
      },
      onClick: () => executeAction(() => {
        const upgrade = getUpgradeState('assistant');
        if (upgrade.purchased) return;
        spendMoney(180);
        upgrade.purchased = true;
        state.bonusTime += 2;
        gainTime(2);
        addLog('You hired a virtual assistant who adds +2h to your day and handles inbox chaos.', 'upgrade');
      })
    },
    cardState: (_state, card) => {
      const purchased = getUpgradeState('assistant').purchased;
      card.classList.toggle('locked', purchased);
    }
  },
  {
    id: 'coffee',
    name: 'Turbo Coffee',
    tag: { label: 'Boost', type: 'boost' },
    description: 'Instantly gain +1h of focus for today. Side effects include jittery success.',
    defaultState: {
      usedToday: 0
    },
    details: [
      () => '💵 Cost: <strong>$40</strong>',
      () => `Daily limit: <strong>${COFFEE_LIMIT}</strong>`
    ],
    action: {
      label: () => {
        const upgrade = getUpgradeState('coffee');
        return upgrade.usedToday >= COFFEE_LIMIT ? 'Too Much Caffeine' : 'Brew Boost';
      },
      className: 'secondary',
      disabled: () => {
        const upgrade = getUpgradeState('coffee');
        return state.money < 40 || upgrade.usedToday >= COFFEE_LIMIT || state.timeLeft <= 0;
      },
      onClick: () => executeAction(() => {
        const upgrade = getUpgradeState('coffee');
        if (upgrade.usedToday >= COFFEE_LIMIT) return;
        spendMoney(40);
        upgrade.usedToday += 1;
        state.dailyBonusTime += 1;
        gainTime(1);
        addLog('Turbo coffee acquired! You feel invincible for another hour (ish).', 'boost');
      })
    }
  },
  {
    id: 'course',
    name: 'Automation Course',
    tag: { label: 'Unlock', type: 'unlock' },
    description: 'Unlocks smarter blogging tools, boosting passive income by +50%.',
    defaultState: {
      purchased: false
    },
    initialClasses: ['locked'],
    details: [
      () => '💵 Cost: <strong>$260</strong>',
      () => 'Requires active blog'
    ],
    action: {
      label: () => {
        const upgrade = getUpgradeState('course');
        if (upgrade.purchased) return 'Automation Ready';
        return getAssetState('blog').active ? 'Study Up' : 'Requires Active Blog';
      },
      className: 'secondary',
      disabled: () => {
        const upgrade = getUpgradeState('course');
        if (upgrade.purchased) return true;
        const blogActive = getAssetState('blog').active;
        if (!blogActive) return true;
        return state.money < 260;
      },
      onClick: () => executeAction(() => {
        const upgrade = getUpgradeState('course');
        const blog = getAssetState('blog');
        if (upgrade.purchased || !blog.active) return;
        spendMoney(260);
        upgrade.purchased = true;
        blog.multiplier = 1.5;
        addLog('Automation course complete! Your blog now earns +50% more while you nap.', 'upgrade');
      })
    },
    cardState: (_state, card) => {
      const upgrade = getUpgradeState('course');
      const blogActive = getAssetState('blog').active;
      card.classList.toggle('locked', !blogActive && !upgrade.purchased);
    }
  }
];

const HUSTLE_MAP = new Map(HUSTLES.map(item => [item.id, item]));
const ASSET_MAP = new Map(ASSETS.map(item => [item.id, item]));
const UPGRADE_MAP = new Map(UPGRADES.map(item => [item.id, item]));

const DEFAULT_STATE = buildDefaultState();
let state = structuredClone(DEFAULT_STATE);
let lastTick = Date.now();

const moneyEl = document.getElementById('money');
const timeEl = document.getElementById('time');
const timeProgressEl = document.getElementById('time-progress');
const dayEl = document.getElementById('day');
const logFeed = document.getElementById('log-feed');
const logTemplate = document.getElementById('log-template');
const logTip = document.getElementById('log-tip');
const hustleGrid = document.getElementById('hustle-grid');
const assetGrid = document.getElementById('asset-grid');
const upgradeGrid = document.getElementById('upgrade-grid');
const endDayBtn = document.getElementById('end-day');

function structuredClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function ensureStateShape(target = state) {
  target.hustles = target.hustles || {};
  for (const def of HUSTLES) {
    const defaults = structuredClone(def.defaultState || {});
    const existing = target.hustles[def.id];
    target.hustles[def.id] = existing ? { ...defaults, ...existing } : defaults;
  }

  target.assets = target.assets || {};
  for (const def of ASSETS) {
    const defaults = structuredClone(def.defaultState || {});
    const existing = target.assets[def.id];
    target.assets[def.id] = existing ? { ...defaults, ...existing } : defaults;
  }

  target.upgrades = target.upgrades || {};
  for (const def of UPGRADES) {
    const defaults = structuredClone(def.defaultState || {});
    const existing = target.upgrades[def.id];
    target.upgrades[def.id] = existing ? { ...defaults, ...existing } : defaults;
  }
}

function buildDefaultState() {
  const base = {
    money: 45,
    timeLeft: 14,
    baseTime: 14,
    bonusTime: 0,
    dailyBonusTime: 0,
    day: 1,
    hustles: {},
    assets: {},
    upgrades: {},
    log: [],
    lastSaved: Date.now()
  };
  ensureStateShape(base);
  return base;
}

function getHustleState(id, target = state) {
  target.hustles = target.hustles || {};
  if (!target.hustles[id]) {
    const def = HUSTLE_MAP.get(id);
    target.hustles[id] = structuredClone(def?.defaultState || {});
  }
  return target.hustles[id];
}

function getAssetState(id, target = state) {
  target.assets = target.assets || {};
  if (!target.assets[id]) {
    const def = ASSET_MAP.get(id);
    target.assets[id] = structuredClone(def?.defaultState || {});
  }
  return target.assets[id];
}

function getUpgradeState(id, target = state) {
  target.upgrades = target.upgrades || {};
  if (!target.upgrades[id]) {
    const def = UPGRADE_MAP.get(id);
    target.upgrades[id] = structuredClone(def?.defaultState || {});
  }
  return target.upgrades[id];
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (!saved.assets && saved.blog) {
        state = migrateLegacyState(saved);
      } else {
        state = {
          ...structuredClone(DEFAULT_STATE),
          ...saved,
          hustles: {
            ...structuredClone(DEFAULT_STATE.hustles),
            ...(saved.hustles || {})
          },
          assets: {
            ...structuredClone(DEFAULT_STATE.assets),
            ...(saved.assets || {})
          },
          upgrades: {
            ...structuredClone(DEFAULT_STATE.upgrades),
            ...(saved.upgrades || {})
          },
          log: saved.log || []
        };
      }
      ensureStateShape(state);
      handleOfflineProgress(saved.lastSaved || Date.now());
      addLog('Welcome back! Your hustles kept buzzing while you were away.', 'info');
    } else {
      state = structuredClone(DEFAULT_STATE);
      ensureStateShape(state);
      addLog('Welcome to Online Hustle Simulator! Time to make that side cash.', 'info');
    }
  } catch (err) {
    console.error('Failed to load state', err);
    state = structuredClone(DEFAULT_STATE);
    ensureStateShape(state);
  }
  lastTick = Date.now();
  renderLog();
}

function migrateLegacyState(saved) {
  const migrated = structuredClone(DEFAULT_STATE);
  migrated.money = saved.money ?? migrated.money;
  migrated.timeLeft = saved.timeLeft ?? migrated.timeLeft;
  migrated.baseTime = saved.baseTime ?? migrated.baseTime;
  migrated.bonusTime = saved.bonusTime ?? migrated.bonusTime;
  migrated.dailyBonusTime = saved.dailyBonusTime ?? migrated.dailyBonusTime;
  migrated.day = saved.day ?? migrated.day;
  migrated.lastSaved = saved.lastSaved || Date.now();

  if (saved.blog) {
    const blogState = getAssetState('blog', migrated);
    blogState.active = !!saved.blog.active;
    blogState.buffer = Number(saved.blog.buffer) || 0;
    blogState.multiplier = Number(saved.blog.multiplier) || blogState.multiplier;
  }

  if (Array.isArray(saved.pendingFlips)) {
    getHustleState('flips', migrated).pending = saved.pendingFlips;
  }

  if (saved.assistantHired) {
    getUpgradeState('assistant', migrated).purchased = true;
  }

  getUpgradeState('coffee', migrated).usedToday = saved.coffeesToday || 0;

  if (saved.coursePurchased) {
    getUpgradeState('course', migrated).purchased = true;
    const blogState = getAssetState('blog', migrated);
    blogState.multiplier = saved.blog?.multiplier || blogState.multiplier;
  }

  migrated.log = saved.log || [];
  return migrated;
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

  for (const asset of ASSETS) {
    if (!asset.passiveIncome) continue;
    if (asset.isActive && !asset.isActive(state, getAssetState(asset.id))) continue;
    const earned = collectPassiveIncome(asset, elapsed, true);
    if (earned > 0 && asset.passiveIncome.offlineMessage) {
      addLog(asset.passiveIncome.offlineMessage(earned), asset.passiveIncome.logType || 'passive');
    }
  }

  for (const hustle of HUSTLES) {
    if (typeof hustle.process === 'function') {
      const result = hustle.process(now, true);
      if (result && result.offlineLog) {
        addLog(result.offlineLog.message, result.offlineLog.type || 'info');
      }
    }
  }
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

function spendTime(hours) {
  state.timeLeft = Math.max(0, state.timeLeft - hours);
}

function gainTime(hours) {
  state.timeLeft = Math.min(getTimeCap(), state.timeLeft + hours);
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

function getTimeCap() {
  return state.baseTime + state.bonusTime + state.dailyBonusTime;
}

function executeAction(effect, options = {}) {
  if (typeof effect === 'function') {
    effect();
  }
  if (options.checkDay) {
    checkDayEnd();
  }
  updateUI();
  saveState();
}

function renderCards() {
  renderCollection(HUSTLES, hustleGrid);
  renderCollection(ASSETS, assetGrid);
  renderCollection(UPGRADES, upgradeGrid);
}

function renderCollection(definitions, container) {
  container.innerHTML = '';
  for (const def of definitions) {
    createCard(def, container);
  }
}

function createCard(def, container) {
  const card = document.createElement('article');
  card.className = 'card';
  card.id = `${def.id}-card`;
  if (Array.isArray(def.initialClasses)) {
    for (const cls of def.initialClasses) {
      card.classList.add(cls);
    }
  }

  const header = document.createElement('div');
  header.className = 'card-header';
  const title = document.createElement('h3');
  title.textContent = def.name;
  header.appendChild(title);
  if (def.tag) {
    const tagEl = document.createElement('span');
    tagEl.className = `tag ${def.tag.type || ''}`.trim();
    tagEl.textContent = def.tag.label;
    header.appendChild(tagEl);
  }
  card.appendChild(header);

  if (def.description) {
    const description = document.createElement('p');
    description.textContent = def.description;
    card.appendChild(description);
  }

  const detailEntries = [];
  if (def.details && def.details.length) {
    const list = document.createElement('ul');
    list.className = 'details';
    for (const detail of def.details) {
      const li = document.createElement('li');
      li.innerHTML = typeof detail === 'function' ? detail(state) : detail;
      list.appendChild(li);
      detailEntries.push({ render: detail, element: li });
    }
    card.appendChild(list);
  }

  let button = null;
  if (def.action) {
    button = document.createElement('button');
    button.className = def.action.className || 'primary';
    const label = typeof def.action.label === 'function' ? def.action.label(state) : def.action.label;
    button.textContent = label;
    button.disabled = typeof def.action.disabled === 'function' ? def.action.disabled(state) : !!def.action.disabled;
    button.addEventListener('click', () => {
      if (button.disabled) return;
      def.action.onClick();
    });
    card.appendChild(button);
  }

  const extra = typeof def.extraContent === 'function' ? (def.extraContent(card, state) || {}) : {};

  container.appendChild(card);
  def.ui = {
    card,
    button,
    details: detailEntries,
    extra
  };
}

function updateCard(def) {
  if (!def.ui) return;
  for (const detail of def.ui.details) {
    if (typeof detail.render === 'function') {
      detail.element.innerHTML = detail.render(state);
    }
  }
  if (def.action && def.ui.button) {
    const label = typeof def.action.label === 'function' ? def.action.label(state) : def.action.label;
    def.ui.button.textContent = label;
    const disabled = typeof def.action.disabled === 'function' ? def.action.disabled(state) : !!def.action.disabled;
    def.ui.button.disabled = disabled;
  }
  if (typeof def.cardState === 'function') {
    def.cardState(state, def.ui.card);
  }
  if (typeof def.update === 'function') {
    def.update(state, def.ui);
  }
}

function updateUI() {
  moneyEl.textContent = `$${formatMoney(state.money)}`;
  timeEl.textContent = `${formatHours(state.timeLeft)} / ${formatHours(getTimeCap())}`;
  dayEl.textContent = state.day;

  const cap = getTimeCap();
  const percent = cap === 0 ? 0 : Math.min(100, Math.max(0, (state.timeLeft / cap) * 100));
  timeProgressEl.style.width = `${percent}%`;

  for (const def of HUSTLES) {
    updateCard(def);
  }
  for (const def of ASSETS) {
    updateCard(def);
  }
  for (const def of UPGRADES) {
    updateCard(def);
  }
}

function scheduleFlip() {
  const flipState = getHustleState('flips');
  flipState.pending.push({
    id: createId(),
    readyAt: Date.now() + 30000,
    payout: 48
  });
}

function updateFlipStatus(element) {
  if (!element) return;
  const flipState = getHustleState('flips');
  if (!flipState.pending.length) {
    element.textContent = 'No flips in progress.';
    return;
  }
  const now = Date.now();
  const nextFlip = flipState.pending.reduce((soonest, flip) =>
    flip.readyAt < soonest.readyAt ? flip : soonest
  );
  const timeRemaining = Math.max(0, Math.round((nextFlip.readyAt - now) / 1000));
  const label = timeRemaining === 0 ? 'any moment' : `${timeRemaining}s`;
  const descriptor = flipState.pending.length === 1 ? 'flip' : 'flips';
  element.textContent = `${flipState.pending.length} ${descriptor} in progress. Next payout in ${label}.`;
}

function collectPassiveIncome(assetDef, elapsedSeconds, offline = false) {
  if (!assetDef.passiveIncome) return 0;
  const assetState = getAssetState(assetDef.id);
  if (assetDef.isActive && !assetDef.isActive(state, assetState)) return 0;
  const chunkValue = assetDef.getIncomeAmount ? assetDef.getIncomeAmount(state, assetState) : 0;
  if (!chunkValue || !assetDef.passiveIncome.interval) return 0;

  const ratePerSecond = chunkValue / assetDef.passiveIncome.interval;
  assetState.buffer += ratePerSecond * elapsedSeconds;

  let payouts = 0;
  while (assetState.buffer >= chunkValue) {
    assetState.buffer -= chunkValue;
    payouts += chunkValue;
    if (offline) {
      state.money += chunkValue;
    } else {
      addMoney(chunkValue, assetDef.passiveIncome.message ? assetDef.passiveIncome.message(chunkValue) : null, assetDef.passiveIncome.logType || 'passive');
    }
  }

  return payouts;
}

function processFlipPayouts(now = Date.now(), offline = false) {
  const flipState = getHustleState('flips');
  if (!flipState.pending.length) {
    return { changed: false };
  }

  const remaining = [];
  let completed = 0;
  let offlineTotal = 0;

  for (const flip of flipState.pending) {
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

  flipState.pending = remaining;

  if (!completed) {
    return { changed: false };
  }

  const result = { changed: true };
  if (offline && offlineTotal > 0) {
    result.offlineLog = {
      message: `While you were away, ${completed} eBay ${completed === 1 ? 'flip' : 'flips'} paid out. $${formatMoney(offlineTotal)} richer!`,
      type: 'delayed'
    };
  }
  return result;
}

function endDay(auto = false) {
  const message = auto ? 'You ran out of time. The grind resets tomorrow.' : 'You called it a day. Fresh hustle awaits tomorrow.';
  addLog(`${message} Day ${state.day + 1} begins with renewed energy.`, 'info');
  state.day += 1;
  state.dailyBonusTime = 0;
  getUpgradeState('coffee').usedToday = 0;
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

function gameLoop() {
  const now = Date.now();
  const dt = Math.min(5, (now - lastTick) / 1000);
  lastTick = now;

  if (dt <= 0) return;

  for (const asset of ASSETS) {
    if (asset.passiveIncome) {
      collectPassiveIncome(asset, dt, false);
    }
  }

  for (const hustle of HUSTLES) {
    if (typeof hustle.process === 'function') {
      hustle.process(now, false);
    }
  }

  updateUI();
  saveState();
}

endDayBtn.addEventListener('click', () => endDay(false));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    lastTick = Date.now();
  }
});

window.addEventListener('beforeunload', saveState);

loadState();
renderCards();
updateUI();
setInterval(gameLoop, 1000);
