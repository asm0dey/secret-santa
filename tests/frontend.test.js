import { test, expect } from 'bun:test';
import { ERR } from '../tgcloud/lib/errors.js';
import { resolveTheme } from '../src/lib/theme.js';
import en from '../src/lib/strings/en.js';
import ru from '../src/lib/strings/ru.js';
import { parse, fromStartParam, replace, backOrReplace, initRouter } from '../src/lib/router.js';

test('theme: pref + scheme resolve to a daisyUI theme', () => {
  expect(resolveTheme('auto', 'dark')).toBe('tgdark');
  expect(resolveTheme('auto', 'light')).toBe('tglight');
  expect(resolveTheme('light', 'dark')).toBe('tglight');
  expect(resolveTheme('dark', 'light')).toBe('tgdark');
  expect(resolveTheme('christmas', 'light')).toBe('christmas');
  expect(resolveTheme('christmas', 'dark')).toBe('christmas');
});

test('strings: en and ru have identical keys and placeholders, none empty', () => {
  expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  const slots = (/** @type {string} */ s) => (s.match(/\{\w+\}/g) ?? []).sort();
  for (const [k, v] of Object.entries(en)) {
    expect(v.trim()).not.toBe('');
    expect(/** @type {Record<string, string>} */ (ru)[k].trim()).not.toBe('');
    expect(slots(/** @type {Record<string, string>} */ (ru)[k]), k).toEqual(slots(v));
  }
});

test('strings: every ERR code has a localized message, plus INTERNAL', () => {
  for (const code of [...Object.values(ERR), 'INTERNAL']) {
    expect(en).toHaveProperty([`errors.${code}`]);
    expect(ru).toHaveProperty([`errors.${code}`]);
  }
  expect(en['errors.NOT_FOUND']).toBe('No exchange with this code');
  expect(ru['errors.NOT_FOUND']).toBe('Обмен с таким кодом не найден');
});

test('router: hash parsing', () => {
  expect(parse('#/x/12/chat/santa')).toEqual({ name: 'chat', params: { id: '12', side: 'santa' } });
  expect(parse('#/x/12/chat/giftee')).toEqual({ name: 'chat', params: { id: '12', side: 'giftee' } });
  expect(parse('')).toEqual({ name: 'home', params: {} });
  expect(parse('#/')).toEqual({ name: 'home', params: {} });
  expect(parse('#/new')).toEqual({ name: 'new', params: {} });
  expect(parse('#/join/K7Q4MX')).toEqual({ name: 'join', params: { code: 'K7Q4MX' } });
  expect(parse('#/x/12')).toEqual({ name: 'exchange', params: { id: '12' } });
  expect(parse('#/x/12/gift')).toEqual({ name: 'exchange', params: { id: '12', tab: 'gift' } });
  expect(parse('#/x/12/progress')).toEqual({ name: 'exchange', params: { id: '12', tab: 'progress' } });
  expect(parse('#/x/12/giftee')).toEqual({ name: 'exchange', params: { id: '12', tab: 'giftee' } });
  expect(parse('#/x/12/edit')).toEqual({ name: 'edit', params: { id: '12' } });
  expect(parse('#/x/12/details')).toEqual({ name: 'details', params: { id: '12' } });
  expect(parse('#/blocked')).toEqual({ name: 'blocked', params: {} });
  expect(parse('#/appeal/3')).toEqual({ name: 'appeal', params: { blockId: '3' } });
  expect(parse('#/x/12/chat/nobody')).toEqual({ name: 'home', params: {} });
  expect(parse('#/nonsense')).toEqual({ name: 'home', params: {} });
});

test('router: start param maps to a hash', () => {
  expect(fromStartParam('x12_gift')).toBe('#/x/12/gift');
  expect(fromStartParam('x12')).toBe('#/x/12');
  expect(fromStartParam('x12_chat_santa')).toBe('#/x/12/chat/santa');
  expect(fromStartParam('K7Q-4MX')).toBe('#/join/K7Q4MX');
  expect(fromStartParam('k7q4mx')).toBe('#/join/K7Q4MX');
  expect(fromStartParam('x23456')).toBe('#/x/23456'); // lowercase x + digits is an exchange id, not a code
  expect(fromStartParam('')).toBeNull();
  expect(fromStartParam(null)).toBeNull();
  expect(fromStartParam('garbage!')).toBeNull();
});

test('router: ids must be numeric, start params only x<digits>[_tab]', () => {
  expect(parse('#/x/abc')).toEqual({ name: 'home', params: {} });
  expect(parse('#/x/12abc/edit')).toEqual({ name: 'home', params: {} });
  expect(parse('#/x/1.5/gift')).toEqual({ name: 'home', params: {} });
  expect(parse('#/appeal/abc')).toEqual({ name: 'home', params: {} });
  expect(fromStartParam('x12abc')).toBeNull(); // not an exchange, and not a valid code either
  expect(fromStartParam('xabc_gift')).toBeNull();
  expect(fromStartParam('x12_nonsense')).toBeNull();
});

test('api: a synchronous throw inside the call rejects with INTERNAL', async () => {
  const g = /** @type {any} */ (globalThis);
  g.Telegram = { WebApp: { initData: 'x', Serverless: {} } }; // no .call
  try {
    const { call } = await import('../src/lib/api.js');
    await expect(call('home')).rejects.toEqual({ code: 'INTERNAL' });
  } finally {
    delete g.Telegram;
  }
});

test('theme: a pref picked while loading is not overwritten by the loaded one', async () => {
  const g = /** @type {any} */ (globalThis);
  const store = new Map([['theme', 'dark']]);
  g.localStorage = { getItem: (/** @type {string} */ k) => store.get(k) ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => store.set(k, v) };
  try {
    const { loadThemePref, saveThemePref, mirroredPref } = await import('../src/lib/theme.js');
    expect(mirroredPref()).toBe('dark');
    const loading = loadThemePref();
    await saveThemePref('christmas'); // user picks before the load resolves
    expect(await loading).toBe('christmas');
    expect(store.get('theme')).toBe('christmas');
  } finally {
    delete g.localStorage;
  }
});

test('router: replace swaps the history entry instead of pushing one', () => {
  const g = /** @type {any} */ (globalThis);
  /** @type {string[]} */
  const calls = [];
  g.location = { hash: '#/join/K7Q4MX', replace: (/** @type {string} */ u) => calls.push(u) };
  try {
    replace('#/x/5');
    replace('/blocked');
    expect(calls).toEqual(['#/x/5', '#/blocked']);
    expect(g.location.hash).toBe('#/join/K7Q4MX'); // untouched: no assignment (which would push)
  } finally {
    delete g.location;
  }
});

test('i18n: member count wording follows plural rules', async () => {
  const { tn } = await import('../src/lib/i18n.js');
  expect(tn('home.members', 1)).toBe('1 person');
  expect(tn('home.members', 5)).toBe('5 people');
});

test('router: backOrReplace goes back when the previous entry is that path, else replaces', async () => {
  const g = /** @type {any} */ (globalThis);
  /** @type {(() => void)[]} */
  const listeners = [];
  /** @type {string[]} */
  const log = [];
  // A tiny browser: entries[], current index; hash assignment pushes, replace swaps, back moves.
  /** @type {{ hash: string, state: any }[]} */
  let entries = [{ hash: '#/', state: null }];
  let i = 0;
  const fire = () => listeners.forEach((l) => l());
  g.addEventListener = (/** @type {string} */ _e, /** @type {() => void} */ l) => listeners.push(l);
  g.location = {
    search: '',
    get hash() { return entries[i].hash; },
    set hash(h) { entries = [...entries.slice(0, i + 1), { hash: h, state: null }]; i += 1; fire(); },
    replace(/** @type {string} */ h) { if (h !== entries[i].hash) { entries[i] = { hash: h, state: null }; fire(); } log.push('replace ' + h); },
  };
  g.history = {
    get state() { return entries[i].state; },
    replaceState(/** @type {any} */ s) { entries[i].state = s; },
    back() { i -= 1; log.push('back'); fire(); },
  };
  try {
    initRouter();
    const go = (/** @type {string} */ h) => { g.location.hash = h; };
    go('#/x/3'); go('#/x/3/edit');
    backOrReplace('/x/3'); // previous entry is #/x/3
    expect(log).toEqual(['back']);
    expect(g.location.hash).toBe('#/x/3');
    log.length = 0;
    go('#/x/3/edit'); // pushed after going back: trail is cut and rebuilt
    backOrReplace('#/x/3');
    expect(log).toEqual(['back']);
    log.length = 0;
    go('#/x/3/details'); replace('#/x/9/details'); // replace keeps the slot, so the previous entry is still #/x/3
    backOrReplace('#/x/3');
    expect(log).toEqual(['replace #/x/9/details', 'back']);
    log.length = 0;
    go('#/join/K7Q4MX'); // came from #/x/3, saving to somewhere else: replace
    backOrReplace('#/x/77');
    expect(log).toEqual(['replace #/x/77']);
    expect(entries.map((e) => e.hash).at(-1)).toBe('#/x/77');
  } finally {
    for (const k of ['addEventListener', 'location', 'history']) delete g[k];
  }
});

test('router: a cold start with an empty hash counts as #/ for backOrReplace', () => {
  const g = /** @type {any} */ (globalThis);
  /** @type {(() => void)[]} */
  const listeners = [];
  /** @type {string[]} */
  const log = [];
  /** @type {{ hash: string, state: any }[]} */
  const entries = [{ hash: '', state: null }];
  let i = 0;
  g.addEventListener = (/** @type {string} */ _e, /** @type {() => void} */ l) => listeners.push(l);
  g.location = {
    search: '',
    get hash() { return entries[i].hash; },
    set hash(h) { entries.length = i + 1; entries.push({ hash: h, state: null }); i += 1; listeners.forEach((l) => l()); },
    replace(/** @type {string} */ h) { entries[i] = { hash: h, state: null }; log.push('replace ' + h); },
  };
  g.history = {
    get state() { return entries[i].state; },
    replaceState(/** @type {any} */ s) { entries[i].state = s; },
    back() { i -= 1; log.push('back'); listeners.forEach((l) => l()); },
  };
  try {
    initRouter();
    g.location.hash = '#/x/3'; // opened the exchange from the cold-start page
    backOrReplace('#/'); // the previous entry has an empty hash: that is #/, so go back
    expect(log).toEqual(['back']);
    g.location.hash = '#/x/4';
    log.length = 0;
    backOrReplace('/x/9'); // the previous entry is #/, not /x/9: replace
    expect(log).toEqual(['replace #/x/9']);
  } finally {
    for (const k of ['addEventListener', 'location', 'history']) delete g[k];
  }
});

test('i18n: join and exchange summaries pluralise with extra params', async () => {
  const { tn } = await import('../src/lib/i18n.js');
  expect(tn('join.summary', 1, { organiser: 'Anna' })).toBe('Anna is organising · 1 person joined');
  expect(tn('join.summary', 4, { organiser: 'Anna' })).toBe('Anna is organising · 4 people joined');
  expect(tn('exchange.summary', 5, { budget: 'any budget', date: '20 Dec' })).toBe('5 people joined · any budget · gifts by 20 Dec');
});

test('format: deadlines read "20 Dec" (UTC, day first); chat stamps drop the day for today', async () => {
  const { shortDate, stamp } = await import('../src/lib/format.js');
  expect(shortDate('2026-12-20')).toBe('20\u00a0Dec');
  expect(shortDate('2026-01-01')).toBe('1\u00a0Jan'); // not shifted by the local zone
  const noon = Date.parse('2026-12-20T12:00:00');
  expect(stamp(noon, noon + 60_000)).toMatch(/^12:00$/);
  expect(stamp(noon, noon + 2 * 86_400_000)).toMatch(/^20\u00a0Dec 12:00$/);
});

test('overlay: BackButton closes the topmost dialog first, then reports there is none', async () => {
  const { onBackClose, closeTopOverlay } = await import('../src/lib/overlay.js');
  /** @type {string[]} */
  const closed = [];
  const off1 = onBackClose(() => closed.push('sheet'));
  onBackClose(() => closed.push('confirm'));
  expect(closeTopOverlay()).toBe(true);
  expect(closed).toEqual(['confirm']);
  off1(); // unmounted on its own
  expect(closeTopOverlay()).toBe(false);
});

test('strings: plural keys carry all four forms in both languages', () => {
  for (const base of ['progress.deadlinePassed', 'progress.nudged']) {
    for (const form of ['one', 'few', 'many', 'other']) {
      expect(`${base}.${form}` in en).toBe(true);
      expect(`${base}.${form}` in ru).toBe(true);
    }
  }
});
