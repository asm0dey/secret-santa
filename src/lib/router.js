import { writable } from 'svelte/store';
import { normalizeCode } from '../../tgcloud/lib/code.js';
import { startParam } from './tg.js';

/** @typedef {{ name: string, params: Record<string, string> }} Route */

const NUM = /^\d+$/;

/** @type {Route} */
const HOME = { name: 'home', params: {} };

/**
 * Hash to route. Names: home, new, join, exchange (params.tab optional: giftee|gift|progress), edit, details, chat, blocked, appeal, privacy.
 * @param {string} hash
 * @returns {Route}
 */
export function parse(hash) {
  // Telegram appends its launch data to a web_app button's hash after '?': '#/x/5/giftee?tgWebAppData=…'.
  const p = hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  const [a, b, c, d] = p;
  if (p.length === 0) return HOME;
  if (a === 'new' && p.length === 1) return { name: 'new', params: {} };
  if (a === 'blocked' && p.length === 1) return { name: 'blocked', params: {} };
  if (a === 'privacy' && p.length === 1) return { name: 'privacy', params: {} };
  if (a === 'join' && b && p.length === 2) return { name: 'join', params: { code: b } };
  if (a === 'appeal' && b && NUM.test(b) && p.length === 2) return { name: 'appeal', params: { blockId: b } };
  if (a === 'x' && b && NUM.test(b)) {
    if (p.length === 2) return { name: 'exchange', params: { id: b } };
    if (p.length === 3 && c === 'edit') return { name: 'edit', params: { id: b } };
    if (p.length === 3 && c === 'details') return { name: 'details', params: { id: b } };
    if (p.length === 3 && ['giftee', 'gift', 'progress'].includes(c)) return { name: 'exchange', params: { id: b, tab: c } };
    if (p.length === 4 && c === 'chat' && (d === 'giftee' || d === 'santa')) return { name: 'chat', params: { id: b, side: d } };
  }
  return HOME;
}

/**
 * Telegram start param to a hash: a invite code, or `x<id>[_gift|_chat_santa|…]`.
 * The x form is lowercase-x only: invite links carry the code upper-cased, so no real code can clash.
 * @param {string | null | undefined} sp
 * @returns {string | null}
 */
export function fromStartParam(sp) {
  if (!sp) return null;
  if (/^x\d+(_|$)/.test(sp)) {
    const [head, ...rest] = sp.split('_');
    const hash = '#/' + ['x', head.slice(1), ...rest].join('/');
    return parse(hash).name === 'home' ? null : hash;
  }
  const code = normalizeCode(sp);
  return code ? `#/join/${code}` : null;
}

const store = writable(HOME);
/** Subscribe-only view: `$route` in components. */
export const route = { subscribe: store.subscribe };

const hashOf = (/** @type {string} */ path) => (path.startsWith('#') ? path : '#' + path);

// History trail: the hash of each entry by index, kept in history.state.n so Back/Forward land on the right slot.
// A reload keeps the index but loses the trail, which only means backOrReplace falls back to replace.
/** @type {string[]} */
let trail = [];
let at = 0;
let replacing = false;

/** Record where the browser now is. Called on every hashchange. */
function track() {
  const n = history.state?.n;
  if (typeof n === 'number') at = n;
  else {
    if (trail.length && !replacing) at += 1;
    history.replaceState({ n: at }, '');
    trail.length = at + 1;
  }
  trail[at] = location.hash || '#/'; // a cold start has an empty hash: same place as '#/'
  replacing = false;
}

/** @param {string} path e.g. '#/new' or '/new' */
export function go(path) {
  location.hash = hashOf(path);
}

/** Like go, but replaces the current history entry: for redirects and after-action moves, so Back never lands on a form that bounces forward. @param {string} path */
export function replace(path) {
  replacing = hashOf(path) !== location.hash; // replacing with the same hash fires no hashchange
  location.replace(hashOf(path));
}

/** After saving a form: Back to `path` if that is the previous entry (so Back is not a dead step later), else replace the form's entry with it. @param {string} path */
export function backOrReplace(path) {
  if (at > 0 && trail[at - 1] === hashOf(path)) history.back();
  else replace(path);
}

/** Call once at launch. A start param only decides where the app opens, never later navigation. */
export function initRouter() {
  const target = fromStartParam(startParam());
  if (target) history.replaceState(null, '', target);
  else if (location.hash.includes('?')) history.replaceState(null, '', location.hash.split('?')[0]); // drop Telegram's launch data (telegram-web-app.js has already read it)
  trail = [];
  at = history.state?.n ?? 0;
  const sync = () => {
    track();
    store.set(parse(location.hash));
  };
  addEventListener('hashchange', sync);
  track();
  store.set(parse(location.hash));
}
