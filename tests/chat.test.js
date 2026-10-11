import { test, expect, beforeEach } from 'bun:test';
import { api, db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { resetDb, ctxFor, setNow } from '../test/helpers.js';
import { assignments, messages } from '../tgcloud/schema.js';
import createExchange from '../tgcloud/endpoints/createExchange.js';
import join from '../tgcloud/endpoints/join.js';
import draw from '../tgcloud/endpoints/draw.js';
import getThread from '../tgcloud/endpoints/getThread.js';
import sendMessage from '../tgcloud/endpoints/sendMessage.js';
import { closeExchange } from '../tgcloud/lib/closing.js';
import { loadExchange } from '../tgcloud/lib/access.js';

const T0 = Date.parse('2026-10-11T12:00:00Z');
beforeEach(() => { resetDb(); setNow(T0); });

/** @param {number} id */
const user = (id) => ctxFor({ id, first_name: `First${id}`, language_code: id === 1002 ? 'ru' : 'en' });
const ann = user(1001);
/** @param {() => unknown} fn */
const code = async (fn) => { try { await fn(); } catch (/** @type {any} */ e) { expect(e).toBeInstanceOf(EndpointError); return e.parameters.code; } };
const sent = () => api.calls.filter((c) => c.method === 'sendMessage');

/** @param {number} n @param {boolean} [doDraw] */
async function mk(n, doDraw = true) {
  const { id, code: c } = await createExchange({ name: 'Office <Santa>', budget: { kind: 'any' }, deadline: '2026-12-20' }, ann);
  for (let i = 1; i <= n; i++) {
    const nickname = `Nick${1000 + i}`;
    await join({ code: c, details: { nickname, address: 'x', wishMode: 'surprise' } }, user(1000 + i));
  }
  if (doDraw) await draw({ id }, ann);
  api.calls.length = 0;
  return id;
}
/** @param {number} id @param {number} [skipSanta] */
async function pair(id, skipSanta = 1001) {
  const all = await db.select().from(assignments).where(eq(assignments.exchangeId, id)).all();
  const a = all.find((r) => r.santaId !== skipSanta) ?? all[0];
  return { santa: a.santaId, giftee: a.gifteeId, a };
}

test('Santa -> giftee message is mine:false for the giftee and mine:true for the Santa', async () => {
  const id = await mk(4);
  const { santa, giftee } = await pair(id);
  expect(await sendMessage({ id, side: 'giftee', text: '  hello <b>  ' }, user(santa))).toEqual({ ok: true });
  const g = await getThread({ id, side: 'santa' }, user(giftee));
  expect(g).toEqual({ title: null, exchangeName: 'Office <Santa>', messages: [{ mine: false, text: 'hello <b>', at: T0 }] });
  const s = await getThread({ id, side: 'giftee' }, user(santa));
  expect(s).toEqual({ title: `Nick${giftee}`, exchangeName: 'Office <Santa>', messages: [{ mine: true, text: 'hello <b>', at: T0 }] });
  // reply
  setNow(T0 + 1000);
  await sendMessage({ id, side: 'santa', text: 'thanks' }, user(giftee));
  expect((await getThread({ id, side: 'santa' }, user(giftee))).messages.map((m) => [m.mine, m.text])).toEqual([[false, 'hello <b>'], [true, 'thanks']]);
  expect((await getThread({ id, side: 'giftee' }, user(santa))).messages.map((m) => [m.mine, m.text])).toEqual([[true, 'hello <b>'], [false, 'thanks']]);
});

test('messages ordered by createdAt then id', async () => {
  const id = await mk(3);
  const { santa, giftee, a } = await pair(id);
  await db.insert(messages).values({ exchangeId: id, assignmentId: a.id, fromSanta: 1, text: 'late', createdAt: T0 + 50 }).run();
  await db.insert(messages).values({ exchangeId: id, assignmentId: a.id, fromSanta: 0, text: 'b', createdAt: T0 }).run();
  await db.insert(messages).values({ exchangeId: id, assignmentId: a.id, fromSanta: 1, text: 'c', createdAt: T0 }).run();
  expect((await getThread({ id, side: 'giftee' }, user(santa))).messages.map((m) => m.text)).toEqual(['b', 'c', 'late']);
  expect(giftee).toBe(a.gifteeId);
});

test('giftee thread and notification never carry the Santa id/nickname or the text', async () => {
  const id = await mk(5);
  const { santa, giftee } = await pair(id);
  await sendMessage({ id, side: 'giftee', text: 'SECRETWORDS' }, user(santa));
  const out = sent();
  expect(out.length).toBe(1);
  expect(out[0].params.chat_id).toBe(giftee);
  const expected = giftee === 1002
    ? '<b>Office &lt;Santa&gt;</b>\nТайный Санта прислал вам сообщение.'
    : '<b>Office &lt;Santa&gt;</b>\nYour Secret Santa sent you a message.';
  expect(out[0].params.text).toBe(expected);
  const btn = out[0].params.reply_markup.inline_keyboard[0][0];
  expect(btn.web_app.url).toEndWith(`#/x/${id}/chat/santa`);
  expect(btn.text).toBe(giftee === 1002 ? 'Открыть чат' : 'Open chat');
  for (const s of [JSON.stringify(out[0].params), JSON.stringify(await getThread({ id, side: 'santa' }, user(giftee)))]) {
    expect(s).not.toContain(String(santa));
    expect(s).not.toContain(`Nick${santa}`);
    expect(s).not.toContain(`First${santa}`);
  }
  expect(out[0].params.text).not.toContain('SECRETWORDS');
  expect(out[0].params.text).not.toContain(`Nick${giftee}`);
});

test('giftee reply notifies the Santa without nickname or text', async () => {
  const id = await mk(4);
  const { santa, giftee } = await pair(id);
  await sendMessage({ id, side: 'santa', text: 'secret reply' }, user(giftee));
  const out = sent();
  expect(out.length).toBe(1);
  expect(out[0].params.chat_id).toBe(santa);
  expect(out[0].params.text).toBe(santa === 1002
    ? '<b>Office &lt;Santa&gt;</b>\nВаш получатель ответил вам.'
    : '<b>Office &lt;Santa&gt;</b>\nYour giftee replied to you.');
  expect(JSON.stringify(out[0].params)).not.toContain(`Nick${giftee}`);
  expect(out[0].params.reply_markup.inline_keyboard[0][0].web_app.url).toEndWith(`#/x/${id}/chat/giftee`);
});

test('callers only ever reach their own pairs', async () => {
  const id = await mk(4);
  const all = await db.select().from(assignments).where(eq(assignments.exchangeId, id)).all();
  for (const a of all) await sendMessage({ id, side: 'giftee', text: `from${a.santaId}` }, user(a.santaId));
  for (const a of all) {
    const asSanta = await getThread({ id, side: 'giftee' }, user(a.santaId));
    const asGiftee = await getThread({ id, side: 'santa' }, user(a.gifteeId));
    expect(asSanta.messages.map((m) => m.text)).toEqual([`from${a.santaId}`]);
    expect(asGiftee.messages.map((m) => m.text)).toEqual([`from${a.santaId}`]);
  }
  // a caller with no reply yet sees only their own thread, never others
  const u = all[0].gifteeId;
  expect((await getThread({ id, side: 'giftee' }, user(u))).messages.map((m) => m.text)).toEqual([`from${u}`]);
});

test('validation: side, text, membership', async () => {
  const id = await mk(3);
  const { santa } = await pair(id);
  for (const side of ['x', 'Giftee', undefined, null, 1, ['giftee']])
    expect(await code(() => sendMessage({ id, side: /** @type {any} */ (side), text: 'hi' }, user(santa)))).toBe('BAD_INPUT');
  expect(await code(() => getThread({ id, side: /** @type {any} */ ('santa ') }, user(santa)))).toBe('BAD_INPUT');
  for (const text of ['', '   ', 'x'.repeat(2001), undefined, 5])
    expect(await code(() => sendMessage({ id, side: 'giftee', text: /** @type {any} */ (text) }, user(santa)))).toBe('BAD_INPUT');
  expect(await code(() => sendMessage({ id, side: 'giftee', text: 'x'.repeat(2000) }, user(santa)))).toBeUndefined();
  expect(await code(() => sendMessage({ id, side: 'giftee', text: 'hi' }, user(999)))).toBe('FORBIDDEN');
  expect(await code(() => getThread({ id, side: 'giftee' }, user(999)))).toBe('FORBIDDEN');
  expect(await code(() => getThread({ id: 9999, side: 'giftee' }, ann))).toBe('NOT_FOUND');
});

test('status: open -> NOT_DRAWN, closed -> CLOSED and messages are gone', async () => {
  const open = await mk(3, false);
  expect(await code(() => sendMessage({ id: open, side: 'giftee', text: 'hi' }, ann))).toBe('NOT_DRAWN');
  expect(await code(() => getThread({ id: open, side: 'giftee' }, ann))).toBe('NOT_DRAWN');
  const id = await mk(3);
  const { santa } = await pair(id);
  await sendMessage({ id, side: 'giftee', text: 'hi' }, user(santa));
  await closeExchange(await loadExchange(id), 'complete');
  expect(await code(() => sendMessage({ id, side: 'giftee', text: 'hi' }, user(santa)))).toBe('CLOSED');
  expect(await code(() => getThread({ id, side: 'giftee' }, user(santa)))).toBe('CLOSED');
});
