import { test, expect, beforeEach } from 'bun:test';
import { api, db, BotApiError, EndpointError } from 'sdk';
import { resetDb, ctxFor, setNow } from '../test/helpers.js';
import { blocks } from '../tgcloud/schema.js';
import createExchange from '../tgcloud/endpoints/createExchange.js';
import join from '../tgcloud/endpoints/join.js';
import draw from '../tgcloud/endpoints/draw.js';
import getExchange from '../tgcloud/endpoints/getExchange.js';
import markSent from '../tgcloud/endpoints/markSent.js';
import nudge from '../tgcloud/endpoints/nudge.js';
import messageSanta from '../tgcloud/endpoints/messageSanta.js';
import block from '../tgcloud/endpoints/block.js';
import submitAppeal from '../tgcloud/endpoints/submitAppeal.js';
import decideAppeal from '../tgcloud/endpoints/decideAppeal.js';

const T0 = Date.parse('2026-10-11T12:00:00Z');
const LATE = Date.parse('2026-12-21T00:00:01Z'); // just past the 2026-12-20 deadline
beforeEach(() => { resetDb(); setNow(T0); });

/** @param {number} id */
const user = (id) => ctxFor({ id, first_name: `First${id}`, username: id === 1002 ? undefined : `user${id}`, language_code: id === 1002 ? 'ru' : 'en' });
const ann = user(1001);
/** @param {() => unknown} fn */
const code = async (fn) => { try { await fn(); } catch (/** @type {any} */ e) { expect(e).toBeInstanceOf(EndpointError); return e.parameters.code; } };
const sent = () => api.calls.filter((c) => c.method === 'sendMessage');

// Organiser is user 1001 (not a member); Santas are 1002..1005.
async function mk() {
  const { id, code: c } = await createExchange({ name: 'Office <Santa>', budget: { kind: 'any' }, deadline: '2026-12-20' }, ann);
  for (let i = 2; i <= 5; i++) await join({ code: c, details: { nickname: `Nick${1000 + i}`, address: 'x', wishMode: 'surprise' } }, user(1000 + i));
  await draw({ id }, ann);
  api.calls.length = 0;
  return id;
}

test('before the deadline: overdue empty, nudge NOT_YET', async () => {
  const id = await mk();
  expect((await getExchange({ id }, ann)).overdue).toEqual([]);
  expect(await code(() => nudge({ id }, ann))).toBe('NOT_YET');
  expect(await code(() => messageSanta({ id, santaUserId: 1003, text: 'hi' }, ann))).toBe('FORBIDDEN');
});

test('deadline boundary: still on time at 23:59:59 UTC of the deadline day, overdue from 00:00:00 next day', async () => {
  const id = await mk();
  setNow(Date.parse('2026-12-20T23:59:59Z'));
  expect((await getExchange({ id }, ann)).overdue).toEqual([]);
  expect(await code(() => nudge({ id }, ann))).toBe('NOT_YET');
  setNow(Date.parse('2026-12-21T00:00:00Z'));
  expect((await getExchange({ id }, ann)).overdue.length).toBe(4);
  expect((await nudge({ id }, ann)).sent).toBe(4);
});

test('after the deadline the organiser sees only Santas who have not sent', async () => {
  const id = await mk();
  await markSent({ id }, user(1003));
  setNow(LATE);
  const ov = (await getExchange({ id }, ann)).overdue;
  expect(ov.map((o) => o.santaUserId).sort()).toEqual([1002, 1004, 1005]);
  const r = ov.find((o) => o.santaUserId === 1002);
  expect(r).toMatchObject({ santaName: 'Nick1002', santaUsername: null });
  expect(ov.find((o) => o.santaUserId === 1004)?.santaUsername).toBe('user1004');
  expect(ov.every((o) => o.gifteeName.startsWith('Nick'))).toBe(true);
});

test('non-organisers never get overdue Santa names', async () => {
  const id = await mk();
  setNow(LATE);
  for (const uid of [1002, 1003]) {
    const v = await getExchange({ id }, user(uid));
    expect(v.overdue).toEqual([]);
    expect(JSON.stringify(v)).not.toContain('santaName');
    // the member's own view must not name any other Santa
    expect(JSON.stringify(v)).not.toContain('user1004');
  }
});

test('overdue is empty when the exchange is closed or still open', async () => {
  const { id } = await createExchange({ name: 'x', budget: { kind: 'any' }, deadline: '2026-12-20' }, ann);
  setNow(LATE);
  expect((await getExchange({ id }, ann)).overdue).toEqual([]);
});

test('nudge messages each overdue Santa once, in their language, with the giftee button', async () => {
  const id = await mk();
  await markSent({ id }, user(1003));
  api.calls.length = 0;
  setNow(LATE);
  expect(await nudge({ id }, ann)).toEqual({ sent: 3 });
  const out = sent();
  expect(out.map((c) => c.params.chat_id).sort()).toEqual([1002, 1004, 1005]);
  const en = out.find((c) => c.params.chat_id === 1004);
  expect(en?.params.text).toBe("<b>Office &lt;Santa&gt;</b>\nReminder: gifts were due by 2026-12-20, and your giftee hasn't received theirs yet. If it's on the way, mark it as sent or tell them in the anonymous chat.");
  expect(en?.params.reply_markup.inline_keyboard[0][0].web_app.url).toEndWith(`#/x/${id}/giftee`);
  expect(en?.params.reply_markup.inline_keyboard[0][0].text).toBe('Open my giftee');
  expect(out.find((c) => c.params.chat_id === 1002)?.params.reply_markup.inline_keyboard[0][0].text).toBe('Кому я дарю');
  expect(out.find((c) => c.params.chat_id === 1002)?.params.text).toContain('Напоминание');
  expect(out.some((c) => /Nick|First/.test(c.params.text))).toBe(false); // no names in the nudge
});

test('nudge counts only successful sends; non-organiser FORBIDDEN', async () => {
  const id = await mk();
  setNow(LATE);
  expect(await code(() => nudge({ id }, user(1002)))).toBe('FORBIDDEN');
  api.failFor = (_m, p) => (p.chat_id === 1004 ? new BotApiError('blocked') : undefined);
  expect(await nudge({ id }, ann)).toEqual({ sent: 3 });
});

test('messageSanta sends the escaped text with a reply button and returns delivered', async () => {
  const id = await mk();
  setNow(LATE);
  expect(await messageSanta({ id, santaUserId: 1004, text: '  where is <it>?  ' }, ann)).toEqual({ ok: true, delivered: true });
  const [c] = sent();
  expect(c.params.chat_id).toBe(1004);
  expect(c.params.text).toBe('<b>Message from First1001, organiser of "Office &lt;Santa&gt;"</b>\nwhere is &lt;it&gt;?');
  expect(c.params.reply_markup.inline_keyboard[0][0]).toEqual({ text: 'Reply to First1001', url: 'tg://user?id=1001' });
});

test('messageSanta uses the recipient language', async () => {
  const id = await mk();
  setNow(LATE);
  await messageSanta({ id, santaUserId: 1002, text: 'привет' }, ann);
  expect(sent()[0].params.text).toStartWith('<b>Сообщение от First1001');
  expect(sent()[0].params.reply_markup.inline_keyboard[0][0].text).toBe('Ответить First1001');
});

test('messageSanta retries without the button when the first send fails', async () => {
  const id = await mk();
  setNow(LATE);
  api.failFor = (_m, p) => (p.reply_markup ? new BotApiError('Bad Request: BUTTON_USER_PRIVACY_RESTRICTED') : undefined);
  expect(await messageSanta({ id, santaUserId: 1004, text: 'hey' }, ann)).toEqual({ ok: true, delivered: true });
  expect(sent().length).toBe(1);
  expect(sent()[0].params.reply_markup).toBeUndefined();
});

test('messageSanta reports delivered:false when nothing gets through', async () => {
  const id = await mk();
  setNow(LATE);
  api.failFor = () => new BotApiError('blocked');
  expect(await messageSanta({ id, santaUserId: 1004, text: 'hey' }, ann)).toEqual({ ok: true, delivered: false });
});

test('messageSanta validation and authorisation', async () => {
  const id = await mk();
  await markSent({ id }, user(1003));
  setNow(LATE);
  api.calls.length = 0;
  expect(await code(() => messageSanta({ id, santaUserId: 1003, text: 'hi' }, ann))).toBe('FORBIDDEN'); // already sent
  expect(await code(() => messageSanta({ id, santaUserId: 9999, text: 'hi' }, ann))).toBe('FORBIDDEN');
  expect(await code(() => messageSanta({ id, santaUserId: 1004, text: 'hi' }, user(1002)))).toBe('FORBIDDEN');
  expect(await code(() => messageSanta({ id, santaUserId: /** @type {any} */ ('1004'), text: 'hi' }, ann))).toBe('BAD_INPUT');
  expect(await code(() => messageSanta({ id, santaUserId: 1004, text: '   ' }, ann))).toBe('BAD_INPUT');
  expect(await code(() => messageSanta({ id, santaUserId: 1004, text: 'x'.repeat(1001) }, ann))).toBe('BAD_INPUT');
  expect(await code(() => messageSanta({ id, santaUserId: 1004, text: /** @type {any} */ (5) }, ann))).toBe('BAD_INPUT');
  expect(sent().length).toBe(0);
});

test('organiser name is escaped; the organiser need not be a member', async () => {
  const id = await mk();
  setNow(LATE);
  await messageSanta({ id, santaUserId: 1004, text: 'hi' }, ctxFor({ id: 1001, first_name: 'Ann <A>' }));
  expect(sent()[0].params.text).toContain('Message from Ann &lt;A&gt;,');
});

test('a blocked Santa stays in overdue with blocked:true and is no longer nudged; unblocking restores them', async () => {
  const id = await mk();
  setNow(LATE);
  expect((await getExchange({ id }, ann)).overdue.every((o) => o.blocked === false)).toBe(true);
  await block({ id, santaUserId: 1004 }, ann);
  api.calls.length = 0;
  const ov = (await getExchange({ id }, ann)).overdue;
  expect(ov.length).toBe(4);
  expect(ov.filter((o) => o.blocked).map((o) => o.santaUserId)).toEqual([1004]);
  expect(await nudge({ id }, ann)).toEqual({ sent: 3 });
  expect(sent().map((c) => c.params.chat_id).sort()).toEqual([1002, 1003, 1005]);
  // the block is lifted on appeal: the Santa is overdue again and gets reminded
  const blockId = /** @type {{ id: number }} */ (await db.select().from(blocks).get()).id;
  await submitAppeal({ blockId, text: 'sorry' }, user(1004));
  await decideAppeal({ blockId, decision: 'unblock' }, ann);
  expect((await getExchange({ id }, ann)).overdue.some((o) => o.blocked)).toBe(false);
  api.calls.length = 0;
  expect((await nudge({ id }, ann)).sent).toBe(4);
});
