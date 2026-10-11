import { test, expect, beforeEach } from 'bun:test';
import { api, db, BotApiError, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { resetDb, ctxFor, setNow } from '../test/helpers.js';
import { users, exchanges, members, blocks } from '../tgcloud/schema.js';
import { enter } from '../tgcloud/lib/session.js';
import { loadExchange, requireMember, requireOrganiser, requireStatus } from '../tgcloud/lib/access.js';
import { send, sendPhoto, esc, hooks } from '../tgcloud/lib/notify.js';
import { APP_URL } from '../tgcloud/lib/config.js';

beforeEach(resetDb);

/** @param {() => unknown} fn */
const code = async (fn) => { try { await fn(); } catch (/** @type {any} */ e) { expect(e).toBeInstanceOf(EndpointError); return e.parameters.code; } };

test('enter creates then updates a user', async () => {
  setNow(1000);
  let me = await enter(ctxFor({ id: 7, first_name: 'Ann', username: 'ann', language_code: 'en', allows_write_to_pm: true }));
  expect(me).toEqual({ id: 7, firstName: 'Ann', username: 'ann', lang: 'en', canMessage: true, blocked: false });
  expect((await db.select().from(users).get())?.createdAt).toBe(1000);
  setNow(2000);
  me = await enter(ctxFor({ id: 7, first_name: 'Anna', language_code: 'ru' }));
  expect(me).toMatchObject({ firstName: 'Anna', username: null, lang: 'ru', canMessage: true });
  const rows = await db.select().from(users).all();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ firstName: 'Anna', createdAt: 1000 });
});

test('enter canMessage: unknown stays null, false is stored', async () => {
  expect((await enter(ctxFor({ id: 1, first_name: 'A' }))).canMessage).toBeNull();
  expect((await enter(ctxFor({ id: 1, first_name: 'A', allows_write_to_pm: false }))).canMessage).toBe(false);
});

test('enter computes blocked from active blocks only', async () => {
  const u = ctxFor({ id: 5, first_name: 'B' });
  expect((await enter(u)).blocked).toBe(false);
  await db.insert(blocks).values({ userId: 5, organiserId: 9, exchangeId: 1, decision: 'unblocked' }).run();
  expect((await enter(u)).blocked).toBe(false);
  await db.insert(blocks).values({ userId: 5, organiserId: 9, exchangeId: 1, decision: 'kept' }).run();
  expect((await enter(u)).blocked).toBe(true);
  await db.delete(blocks).run();
  await db.insert(blocks).values({ userId: 5, organiserId: 9, exchangeId: 1 }).run();
  expect((await enter(u)).blocked).toBe(true);
});

async function seed(status = 'open') {
  await db.insert(exchanges).values({ code: 'ABC', name: 'X', organiserId: 1, status }).run();
  await db.insert(members).values({ exchangeId: 1, userId: 2 }).run();
  return loadExchange(1);
}

test('access: loadExchange / requireMember / requireOrganiser', async () => {
  expect(await code(() => loadExchange(99))).toBe('NOT_FOUND');
  const ex = await seed();
  expect((await requireMember(ex, 2)).userId).toBe(2);
  expect(await code(() => requireMember(ex, 3))).toBe('FORBIDDEN');
  expect(await code(() => requireOrganiser(ex, 2))).toBe('FORBIDDEN');
  requireOrganiser(ex, 1);
});

test('access: requireStatus', async () => {
  const ex = (/** @type {string} */ status) => /** @type {any} */ ({ status });
  requireStatus(ex('open'), 'open');
  requireStatus(ex('drawn'), 'open', 'drawn');
  expect(await code(() => requireStatus(ex('drawn'), 'open'))).toBe('ALREADY_DRAWN');
  expect(await code(() => requireStatus(ex('open'), 'drawn'))).toBe('NOT_DRAWN');
  expect(await code(() => requireStatus(ex('closed'), 'open'))).toBe('CLOSED');
  expect(await code(() => requireStatus(ex('closed'), 'drawn'))).toBe('CLOSED');
});

test('esc escapes & < > "', () => {
  expect(esc('<b>')).toBe('&lt;b&gt;');
  expect(esc('a&b "c"')).toBe('a&amp;b &quot;c&quot;');
});

test('send posts HTML text with buttons mapped', async () => {
  const ok = await send(5, '<b>hi</b>', [[{ text: 'Open', app: '#/x/5' }, { text: 'Site', url: 'https://e.x' }], [{ text: 'Go', data: 'go:1' }]]);
  expect(ok).toBe(true);
  expect(api.calls[0].params).toEqual({
    chat_id: 5, text: '<b>hi</b>', parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [
      [{ text: 'Open', web_app: { url: APP_URL + '#/x/5' } }, { text: 'Site', url: 'https://e.x' }],
      [{ text: 'Go', callback_data: 'go:1' }],
    ] },
  });
});

test('send without buttons has no reply_markup; sendPhoto uses sendPhoto', async () => {
  await send(5, 'x');
  expect('reply_markup' in api.calls[0].params).toBe(false);
  expect(await sendPhoto(5, 'https://p/1.png', 'cap', [[{ text: 'T', data: 'd' }]])).toBe(true);
  expect(api.calls[1]).toMatchObject({ method: 'sendPhoto', params: { chat_id: 5, photo: 'https://p/1.png', caption: 'cap', parse_mode: 'HTML' } });
});

test('send returns false on 403 without throwing', async () => {
  api.failFor = () => new BotApiError('Forbidden: bot was blocked by the user', { error_code: 403 });
  expect(await send(5, 'x')).toBe(false);
  expect(await sendPhoto(5, 'u', 'c')).toBe(false);
});

test('send retries once after 429, waiting retry_after', async () => {
  /** @type {number[]} */
  const waits = [];
  const orig = hooks.sleep;
  hooks.sleep = async (s) => { waits.push(s); };
  try {
    let n = 0;
    api.failFor = () => (n++ === 0 ? new BotApiError('Too Many Requests', { retry_after: 3 }) : undefined);
    expect(await send(5, 'x')).toBe(true);
    expect(waits).toEqual([3]);
    expect(api.calls).toHaveLength(1);
    api.failFor = () => new BotApiError('Too Many Requests', { retry_after: 1 });
    expect(await send(5, 'x')).toBe(false); // second 429 gives up
    expect(waits).toEqual([3, 1]);
  } finally { hooks.sleep = orig; }
});
