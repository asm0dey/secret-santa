import { writable } from 'svelte/store';
import { normalizeCode } from '../../tgcloud/lib/code.js';
import { startParam } from './tg.js';

/** @typedef {{ name: string, params: Record<string, string> }} Route */

const NUM = /^\d+$/;

/** @type {Route} */
const HOME = { name: 'home', params: {} };

/**
 * Hash to route. Names: home, new, join, exchange (params.tab optional: giftee|gift|progress), edit, details, chat, blocked, appeal.
 * @param {string} hash
 * @returns {Route}
 */
export function parse(hash) {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b, c, d] = p;
  if (p.length === 0) return HOME;
  if (a === 'new' && p.length === 1) return { name: 'new', params: {} };
  if (a === 'blocked' && p.length === 1) return { name: 'blocked', params: {} };
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

/** @param {string} path e.g. '#/new' or '/new' */
export function go(path) {
  location.hash = path.startsWith('#') ? path : '#' + path;
}

/** Call once at launch. A start param only decides where the app opens, never later navigation. */
export function initRouter() {
  const target = fromStartParam(startParam());
  if (target) history.replaceState(null, '', target);
  const sync = () => store.set(parse(location.hash));
  addEventListener('hashchange', sync);
  sync();
}
