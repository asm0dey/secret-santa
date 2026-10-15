import { test, expect, beforeEach } from 'bun:test';
import { api, db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { resetDb, ctxFor, setNow } from '../test/helpers.js';
import { exchanges, members, assignments, blocks } from '../tgcloud/schema.js';
import createExchange from '../tgcloud/endpoints/createExchange.js';
import join from '../tgcloud/endpoints/join.js';
import draw from '../tgcloud/endpoints/draw.js';
import home from '../tgcloud/endpoints/home.js';
import markSent from '../tgcloud/endpoints/markSent.js';
import block from '../tgcloud/endpoints/block.js';
import submitAppeal from '../tgcloud/endpoints/submitAppeal.js';
import decideAppeal from '../tgcloud/endpoints/decideAppeal.js';
import callbackQuery from '../tgcloud/handlers/callback_query.js';
import message from '../tgcloud/handlers/message.js';
import { APP_URL } from '../tgcloud/lib/config.js';
import { closeExchange } from '../tgcloud/lib/closing.js';
import { loadExchange } from '../tgcloud/lib/access.js';

const T0 = Date.parse('2026-10-11T12:00:00Z');
const LATE = Date.parse('2026-12-21T00:00:01Z'); // just past the 2026-12-20 deadline
beforeEach(() => { resetDb(); setNow(T0); });

/** @param {number} id */
const user = (id) => ctxFor({ id, first_name: `First${id}`, language_code: id === 1002 ? 'ru' : 'en' });
const ann = user(1001);
/** @param {() => unknown} fn */
const code = async (fn) => { try { await fn(); } catch (/** @type {any} */ e) { expect(e).toBeInstanceOf(EndpointError); return e.parameters.code; } };
const sent = () => api.calls.filter((c) => c.method === 'sendMessage');
const to = (/** @type {number} */ uid) => sent().filter((c) => c.params.chat_id === uid);
const answers = () => api.calls.filter((c) => c.method === 'answerCallbackQuery');
const edits = () => api.calls.filter((c) => c.method === 'editMessageReplyMarkup');
/** @param {number} id */
const mine = (id) => db.select().from(members).where(eq(members.userId, id)).all();
const blockRows = () => db.select().from(blocks).orderBy(blocks.id).all();

// A drawn exchange by `org` (not a member) with the given Santas.
async function mk(org = 1001, santas = [1002, 1003, 1004, 1005], name = 'Office <Santa>') {
  const { id, code: c } = await createExchange({ name, budget: { kind: 'any' }, deadline: '2026-12-20' }, user(org));
  for (const s of santas) await join({ code: c, details: { nickname: `Nick${s}`, address: 'x', wishMode: 'surprise' } }, user(s));
  await draw({ id }, user(org));
  api.calls.length = 0;
  return id;
}

/** @param {number} fromId @param {string} data @param {Record<string, any>} [extra] */
const cq = (fromId, data, extra = {}) => ({
  id: 'q1', from: { id: fromId, first_name: `First${fromId}`, language_code: 'en' }, data,
  message: { message_id: 77, chat: { id: fromId } }, ...extra,
});

test('block before the deadline is NOT_YET; a Santa who marked sent, a non-organiser, an open exchange: refused', async () => {
  const id = await mk();
  expect(await code(() => block({ id, santaUserId: 1003 }, ann))).toBe('NOT_YET');
  setNow(LATE);
  await markSent({ id }, user(1003));
  expect(await code(() => block({ id, santaUserId: 1003 }, ann))).toBe('FORBIDDEN');
  expect(await code(() => block({ id, santaUserId: 1004 }, user(1002)))).toBe('FORBIDDEN');
  expect(await code(() => block({ id, santaUserId: 1001 }, ann))).toBe('FORBIDDEN'); // not a Santa
  const open = (await createExchange({ name: 'Open', budget: { kind: 'any' }, deadline: '2027-01-30' }, ann)).id;
  expect(await code(() => block({ id: open, santaUserId: 1004 }, ann))).toBe('NOT_DRAWN');
  expect(await blockRows()).toEqual([]);
});

test('block: blocks row, home.me.blocks, join/create refused, memberships and exchanges handled, user told', async () => {
  const id = await mk();
  // victim 1003: member of an open exchange by 1005 (not 1001), and organises an open exchange with a member
  const other = (await createExchange({ name: 'Other', budget: { kind: 'any' }, deadline: '2026-12-20' }, user(1005)));
  await join({ code: other.code, details: { nickname: 'V', address: 'x', wishMode: 'surprise' } }, user(1003));
  const own = (await createExchange({ name: 'Mine <b>', budget: { kind: 'any' }, deadline: '2026-12-20' }, user(1003)));
  await join({ code: own.code, details: { nickname: 'Pal', address: 'x', wishMode: 'surprise' } }, user(1006));
  const before = await db.select().from(assignments).where(eq(assignments.exchangeId, id)).all();
  api.calls.length = 0;

  setNow(LATE);
  expect(await block({ id, santaUserId: 1003 }, ann)).toEqual({ ok: true });
  const [b] = await blockRows();
  expect(b).toMatchObject({ userId: 1003, organiserId: 1001, exchangeId: id, exchangeName: 'Office <Santa>', createdAt: LATE, appealAt: null, decision: null });

  expect((await home({}, user(1003))).me.blocks).toEqual([{ id: b.id, exchangeName: 'Office <Santa>', createdAt: LATE, appealed: false, decision: null }]);
  expect(await code(() => join({ code: other.code, details: { nickname: 'V', address: 'x', wishMode: 'surprise' } }, user(1003)))).toBe('BLOCKED');
  expect(await code(() => createExchange({ name: 'N', budget: { kind: 'any' }, deadline: '2026-12-30' }, user(1003)))).toBe('BLOCKED');

  // open memberships gone / own open exchange deleted and members told; drawn membership stays
  expect((await mine(1003)).map((m) => m.exchangeId)).toEqual([id]);
  expect((await db.select().from(members).where(eq(members.exchangeId, other.id)).all()).map((m) => m.userId)).toEqual([]);
  expect(await db.select().from(exchanges).where(eq(exchanges.id, own.id)).get()).toBeUndefined();
  expect(await db.select().from(exchanges).where(eq(exchanges.id, other.id)).get()).toBeTruthy();
  expect(to(1006).map((c) => c.params.text)).toEqual(['"Mine &lt;b&gt;" was cancelled by its organiser.']);
  // pairing invariant untouched
  expect(await db.select().from(assignments).where(eq(assignments.exchangeId, id)).all()).toEqual(before);
  expect((await db.select().from(members).where(eq(members.exchangeId, id)).all()).length).toBe(4);

  // the blocked user is told, with an Appeal button
  const told = to(1003);
  expect(told.length).toBe(1);
  expect(told[0].params.text).toContain("You've been blocked from Secret Santa");
  expect(told[0].params.text).toContain('Office &lt;Santa&gt;');
  expect(told[0].params.parse_mode).toBe('HTML');
  expect(told[0].params.reply_markup.inline_keyboard).toEqual([[{ text: 'Appeal', web_app: { url: APP_URL + '#/blocked' } }]]);
});

test('block is told in the user\'s language; blocking twice makes one block and one message', async () => {
  const id = await mk();
  setNow(LATE);
  await block({ id, santaUserId: 1002 }, ann); // 1002 is ru
  await block({ id, santaUserId: 1002 }, ann);
  expect((await blockRows()).length).toBe(1);
  expect(to(1002).length).toBe(1);
  expect(to(1002)[0].params.text).toContain('Вас заблокировали');
  expect(to(1002)[0].params.reply_markup.inline_keyboard[0][0].text).toBe('Обжаловать');
});

test('a closed exchange can still be blocked from (assignment survives the wipe)', async () => {
  const id = await mk();
  setNow(LATE);
  await closeExchange(await loadExchange(id), 'timeout');
  await block({ id, santaUserId: 1004 }, ann);
  expect((await blockRows())[0].userId).toBe(1004);
});

/** @param {number} id */
async function blocked(id) {
  setNow(LATE);
  await block({ id, santaUserId: 1003 }, ann);
  api.calls.length = 0;
  return (await blockRows())[0].id;
}

test('appeal: validated, goes to the organiser with escaped values and Unblock/Keep buttons, only once', async () => {
  const id = await mk();
  const bid = await blocked(id);
  expect(await code(() => submitAppeal({ blockId: bid, text: '' }, user(1003)))).toBe('BAD_INPUT');
  expect(await code(() => submitAppeal({ blockId: bid, text: 'x'.repeat(1001) }, user(1003)))).toBe('BAD_INPUT');
  expect(await code(() => submitAppeal({ blockId: bid, text: 'ok', tracking: 'x'.repeat(65) }, user(1003)))).toBe('BAD_INPUT');
  expect(await code(() => submitAppeal({ blockId: bid, text: 'ok' }, user(1004)))).toBe('FORBIDDEN'); // not theirs
  expect(await code(() => submitAppeal({ blockId: 9999, text: 'ok' }, user(1003)))).toBe('NOT_FOUND');
  expect(sent().length).toBe(0);

  expect(await submitAppeal({ blockId: bid, text: 'It <i>got</i> lost', tracking: 'AB<1>' }, user(1003))).toEqual({ ok: true });
  const [row] = await blockRows();
  expect(row).toMatchObject({ appealText: 'It <i>got</i> lost', appealTracking: 'AB<1>', appealAt: LATE });
  const m = to(1001);
  expect(m.length).toBe(1);
  expect(m[0].params.text).toBe('<b>Nick1003 appealed their block</b>\nOffice &lt;Santa&gt; · blocked 2026-12-21\n<blockquote>It &lt;i&gt;got&lt;/i&gt; lost</blockquote>\nTracking: <code>AB&lt;1&gt;</code>');
  expect(m[0].params.reply_markup.inline_keyboard).toEqual([[
    { text: 'Unblock', callback_data: `appeal:${bid}:unblock` },
    { text: 'Keep blocked', callback_data: `appeal:${bid}:keep` },
  ]]);

  expect(await code(() => submitAppeal({ blockId: bid, text: 'again' }, user(1003)))).toBe('FORBIDDEN');
  expect(to(1001).length).toBe(1);
});

test('appeal without tracking omits the line; name falls back to first name when no longer a member', async () => {
  const id = await mk();
  const bid = await blocked(id);
  await db.delete(members).where(eq(members.userId, 1003)).run();
  await submitAppeal({ blockId: bid, text: 'hi' }, user(1003));
  expect(to(1001)[0].params.text).toBe('<b>First1003 appealed their block</b>\nOffice &lt;Santa&gt; · blocked 2026-12-21\n<blockquote>hi</blockquote>');
});

test('appeal to an organiser who speaks Russian', async () => {
  const id = await mk(1002, [1003, 1004, 1005]);
  setNow(LATE);
  await block({ id, santaUserId: 1003 }, user(1002));
  const bid = (await blockRows())[0].id;
  await submitAppeal({ blockId: bid, text: 'hi', tracking: 'T1' }, user(1003));
  expect(to(1002).at(-1)?.params.text).toContain('Nick1003 обжалует блокировку');
  expect(to(1002).at(-1)?.params.text).toContain('Трек-номер: <code>T1</code>');
});

test('decide: unblock lifts it (join works again), tells the user; second decision refused with no second message', async () => {
  const id = await mk();
  const bid = await blocked(id);
  expect(await code(() => decideAppeal({ blockId: bid, decision: 'unblock' }, ann))).toBe('FORBIDDEN'); // not appealed yet
  await submitAppeal({ blockId: bid, text: 'hi' }, user(1003));
  api.calls.length = 0;
  expect(await code(() => decideAppeal({ blockId: bid, decision: 'unblock' }, user(1004)))).toBe('FORBIDDEN'); // not the organiser
  expect(await code(() => decideAppeal({ blockId: bid, decision: /** @type {any} */ ('maybe') }, ann))).toBe('BAD_INPUT');
  expect(await decideAppeal({ blockId: bid, decision: 'unblock' }, ann)).toEqual({ ok: true });
  expect(await blockRows()).toMatchObject([{ decision: 'unblocked', decidedAt: LATE }]);
  expect(to(1003).map((c) => c.params.text)).toEqual(['Good news: the organiser of "Office &lt;Santa&gt;" lifted your block.']);
  expect((await home({}, user(1003))).me.blocks).toEqual([]);
  const open = await createExchange({ name: 'Free', budget: { kind: 'any' }, deadline: '2026-12-30' }, user(1003));
  expect(open.id).toBeGreaterThan(0);

  expect(await code(() => decideAppeal({ blockId: bid, decision: 'unblock' }, ann))).toBe('FORBIDDEN');
  expect(await code(() => decideAppeal({ blockId: bid, decision: 'keep' }, ann))).toBe('FORBIDDEN');
  expect(to(1003).length).toBe(1);
});

test('decide keep: stays blocked, user told, no second appeal', async () => {
  const id = await mk();
  const bid = await blocked(id);
  await submitAppeal({ blockId: bid, text: 'hi' }, user(1003));
  api.calls.length = 0;
  await decideAppeal({ blockId: bid, decision: 'keep' }, ann);
  expect((await blockRows())[0].decision).toBe('kept');
  expect(to(1003)[0].params.text).toBe('The organiser of "Office &lt;Santa&gt;" reviewed your appeal and kept the block.');
  expect((await home({}, user(1003))).me.blocks).toMatchObject([{ id: bid, appealed: true, decision: 'kept' }]);
  expect(await code(() => submitAppeal({ blockId: bid, text: 'again' }, user(1003)))).toBe('FORBIDDEN');
});

test('two blocks: lifting one keeps the user blocked', async () => {
  const id1 = await mk();
  const id2 = await mk(1010, [1003, 1004, 1005], 'Second');
  setNow(LATE);
  await block({ id: id1, santaUserId: 1003 }, ann);
  await block({ id: id2, santaUserId: 1003 }, user(1010));
  const [b1] = await blockRows();
  await submitAppeal({ blockId: b1.id, text: 'hi' }, user(1003));
  await decideAppeal({ blockId: b1.id, decision: 'unblock' }, ann);
  expect((await home({}, user(1003))).me.blocks.length).toBe(1);
  expect(await code(() => createExchange({ name: 'N', budget: { kind: 'any' }, deadline: '2026-12-30' }, user(1003)))).toBe('BLOCKED');
});

test('callback block: non-organiser gets an error answer and nothing changes', async () => {
  const id = await mk();
  setNow(LATE);
  await callbackQuery(cq(1002, `block:${id}:1003`), {});
  expect(await blockRows()).toEqual([]);
  expect(answers().length).toBe(1);
  expect(answers()[0].params).toMatchObject({ callback_query_id: 'q1' });
  expect(answers()[0].params.text).not.toBe('Done');
  expect(edits().length).toBe(0);
  expect(sent().length).toBe(0);
});

test('callback block by the organiser: blocks, answers Done, removes the keyboard', async () => {
  const id = await mk();
  setNow(LATE);
  await callbackQuery(cq(1001, `block:${id}:1003`), {});
  expect((await blockRows()).map((b) => b.userId)).toEqual([1003]);
  expect(answers()[0].params).toEqual({ callback_query_id: 'q1', text: 'Done' });
  expect(edits()[0].params).toEqual({ chat_id: 1001, message_id: 77, reply_markup: { inline_keyboard: [] } });
  expect(to(1003).length).toBe(1);
});

test('callback block before the deadline answers with a not-yet error; failing keyboard removal is ignored', async () => {
  const id = await mk();
  await callbackQuery(cq(1001, `block:${id}:1003`), {});
  expect(await blockRows()).toEqual([]);
  expect(answers()[0].params.text).toContain('deadline');
  api.failFor = (m) => (m === 'editMessageReplyMarkup' ? 'message is not modified' : undefined);
  setNow(LATE);
  await callbackQuery(cq(1001, `block:${id}:1003`), {});
  expect(answers()[1].params.text).toBe('Done');
  expect((await blockRows()).length).toBe(1);
});

test('callback error text uses the stored language of the user', async () => {
  const id = await mk(1002, [1003, 1004, 1005]);
  await callbackQuery(cq(1002, `block:${id}:1003`), {}); // before the deadline
  expect(answers()[0].params.text).not.toMatch(/deadline/);
  expect(answers()[0].params.text).toMatch(/[а-я]/);
});

test('callback letgo only answers and removes the keyboard; garbage data is answered gracefully', async () => {
  const id = await mk();
  setNow(LATE);
  await callbackQuery(cq(1001, `letgo:${id}:1003`), {});
  expect(await blockRows()).toEqual([]);
  expect(answers()[0].params.text).toBe('Done');
  expect(edits().length).toBe(1);
  api.calls.length = 0;
  for (const data of ['', 'block', 'block:1:x', 'block:1.5:2', 'block:1:2:3', 'block:-1:2', 'appeal:1:maybe', 'drop table', 'block:99999999999999999999:1', undefined])
    await callbackQuery(cq(1001, /** @type {any} */ (data)), {});
  expect(answers().length).toBe(10);
  expect(edits().length).toBe(0);
  expect(await blockRows()).toEqual([]);
});

test('callback appeal: only the blocking organiser decides; the second tap gets an error and no second message', async () => {
  const id = await mk();
  const bid = await blocked(id);
  await submitAppeal({ blockId: bid, text: 'hi' }, user(1003));
  api.calls.length = 0;
  await callbackQuery(cq(1004, `appeal:${bid}:unblock`), {});
  expect((await blockRows())[0].decision).toBeNull();
  expect(answers()[0].params.text).not.toBe('Done');
  await callbackQuery(cq(1001, `appeal:${bid}:unblock`), {});
  expect(answers()[1].params.text).toBe('Done');
  expect((await blockRows())[0].decision).toBe('unblocked');
  await callbackQuery(cq(1001, `appeal:${bid}:unblock`), {});
  expect(answers()[2].params.text).not.toBe('Done');
  expect(to(1003).length).toBe(1);
  expect(edits().length).toBe(1);
});

test('/start (with or without payload, with bot name) replies with an Open button; everything else is ignored', async () => {
  await message({ message_id: 1, from: { id: 5, first_name: 'A', language_code: 'en' }, chat: { id: 5 }, text: '/start' }, {});
  await message({ message_id: 2, from: { id: 5, first_name: 'A', language_code: 'ru' }, chat: { id: 5 }, text: '/start abc123' }, {});
  await message({ message_id: 3, from: { id: 5, first_name: 'A' }, chat: { id: 5 }, text: '/start@secret_santanabot' }, {});
  expect(sent().length).toBe(3);
  expect(sent()[0].params).toMatchObject({ chat_id: 5, text: 'Secret Santa: draw names with friends, right here in Telegram.' });
  expect(sent()[0].params.reply_markup.inline_keyboard).toEqual([[{ text: 'Open', web_app: { url: APP_URL + '#/' } }]]);
  expect(sent()[1].params.text).toContain('Тайный Санта');
  expect(sent()[1].params.reply_markup.inline_keyboard[0][0].text).toBe('Открыть');
  api.calls.length = 0;
  for (const text of ['hello', '/startx', '/help', undefined])
    await message({ message_id: 4, from: { id: 5, first_name: 'A' }, chat: { id: 5 }, text }, {});
  await message({ message_id: 5, chat: { id: 5 } }, {});
  expect(api.calls.length).toBe(0);
});

test('before the deadline every block target is NOT_YET, whether the Santa marked sent or not (no pair oracle)', async () => {
  const id = await mk();
  await markSent({ id }, user(1003));
  for (const s of [1002, 1003, 1004, 9999]) expect(await code(() => block({ id, santaUserId: s }, ann))).toBe('NOT_YET');
  await callbackQuery(cq(1001, `block:${id}:1003`), {});
  await callbackQuery(cq(1001, `block:${id}:1004`), {});
  expect(answers()[0].params.text).toBe(answers()[1].params.text);
  expect(await blockRows()).toEqual([]);
});

test('a block lifted on appeal cannot be placed again for the same exchange; the unique index holds one row', async () => {
  const id = await mk();
  const bid = await blocked(id);
  await submitAppeal({ blockId: bid, text: 'hi' }, user(1003));
  await decideAppeal({ blockId: bid, decision: 'unblock' }, ann);
  api.calls.length = 0;
  expect(await code(() => block({ id, santaUserId: 1003 }, ann))).toBe('FORBIDDEN');
  expect((await blockRows()).length).toBe(1);
  expect(sent().length).toBe(0);
  await expect(async () => {
    await db.insert(blocks).values({ userId: 1003, organiserId: 1001, exchangeId: id, createdAt: 1 }).run();
  }).toThrow();
});

test('two concurrent blocks: one row, one message, both succeed', async () => {
  const id = await mk();
  setNow(LATE);
  expect(await Promise.all([block({ id, santaUserId: 1003 }, ann), block({ id, santaUserId: 1003 }, ann)])).toEqual([{ ok: true }, { ok: true }]);
  expect((await blockRows()).length).toBe(1);
  expect(to(1003).length).toBe(1);
});

test('a repeated block finishes the side effects a crashed first call left undone, without a second message', async () => {
  const id = await mk();
  const other = await createExchange({ name: 'Other', budget: { kind: 'any' }, deadline: '2026-12-20' }, user(1005));
  await join({ code: other.code, details: { nickname: 'V', address: 'x', wishMode: 'surprise' } }, user(1003));
  setNow(LATE);
  // the first call died right after its insert
  await db.insert(blocks).values({ userId: 1003, organiserId: 1001, exchangeId: id, exchangeName: 'Office <Santa>', createdAt: LATE }).run();
  api.calls.length = 0;
  expect(await block({ id, santaUserId: 1003 }, ann)).toEqual({ ok: true });
  expect((await mine(1003)).map((m) => m.exchangeId)).toEqual([id]);
  expect(to(1003).length).toBe(0);
});

test('the organiser cannot block themself', async () => {
  const { id, code: c } = await createExchange({ name: 'Self', budget: { kind: 'any' }, deadline: '2026-12-20' }, ann);
  for (const s of [1001, 1002, 1003]) await join({ code: c, details: { nickname: `Nick${s}`, address: 'x', wishMode: 'surprise' } }, user(s));
  await draw({ id }, ann);
  setNow(LATE);
  expect(await code(() => block({ id, santaUserId: 1001 }, ann))).toBe('FORBIDDEN');
  expect(await blockRows()).toEqual([]);
});

test('ids from input must be safe integers', async () => {
  const id = await mk();
  const bid = await blocked(id);
  expect(await code(() => block({ id: /** @type {any} */ (String(id)), santaUserId: 1004 }, ann))).toBe('BAD_INPUT');
  expect(await code(() => block({ id, santaUserId: /** @type {any} */ ('1004') }, ann))).toBe('BAD_INPUT');
  expect(await code(() => block({ id, santaUserId: 2 ** 53 }, ann))).toBe('BAD_INPUT');
  expect(await code(() => submitAppeal({ blockId: /** @type {any} */ (String(bid)), text: 'hi' }, user(1003)))).toBe('BAD_INPUT');
  expect(await code(() => decideAppeal({ blockId: /** @type {any} */ ({}), decision: 'keep' }, ann))).toBe('BAD_INPUT');
  expect((await blockRows()).length).toBe(1);
});

test('callback: a failing users lookup still answers; 16-digit ids are accepted', async () => {
  const id = await mk();
  setNow(LATE);
  const orig = db.select;
  /** @type {any} */ (db).select = () => { /** @type {any} */ (db).select = orig; throw new Error('db down'); };
  await callbackQuery(cq(1001, `letgo:${id}:1003`), {});
  expect(answers()[0].params.text).toBe('Done');
  await callbackQuery(cq(1001, 'appeal:1234567890123456:keep'), {});
  expect(answers()[1].params.text).toBe('Not found.');
  await callbackQuery(cq(1001, 'appeal:9999999999999999:keep'), {}); // over 2^53
  expect(answers()[2].params.text).not.toBe('Not found.');
});
