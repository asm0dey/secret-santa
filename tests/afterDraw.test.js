import { test, expect, beforeEach } from 'bun:test';
import { api, db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { resetDb, ctxFor, setNow } from '../test/helpers.js';
import { exchanges, members, assignments, messages } from '../tgcloud/schema.js';
import createExchange from '../tgcloud/endpoints/createExchange.js';
import join from '../tgcloud/endpoints/join.js';
import draw from '../tgcloud/endpoints/draw.js';
import getExchange from '../tgcloud/endpoints/getExchange.js';
import home from '../tgcloud/endpoints/home.js';
import updateMyDetails from '../tgcloud/endpoints/updateMyDetails.js';
import markSent from '../tgcloud/endpoints/markSent.js';
import markReceived from '../tgcloud/endpoints/markReceived.js';
import { closeExchange } from '../tgcloud/lib/closing.js';
import { loadExchange } from '../tgcloud/lib/access.js';

beforeEach(() => { resetDb(); setNow(Date.parse('2026-10-11T12:00:00Z')); });

// Large ids so a substring check for an id is meaningful.
/** @param {number} id */
const user = (id) => ctxFor({ id, first_name: `First${id}`, language_code: id === 1002 ? 'ru' : 'en' });
const ann = user(1001);
/** @param {() => unknown} fn */
const code = async (fn) => { try { await fn(); } catch (/** @type {any} */ e) { expect(e).toBeInstanceOf(EndpointError); return e.parameters.code; } };
/** @param {string} nickname @returns {import('../tgcloud/lib/types.js').Details} */
const det = (nickname) => ({ nickname, address: `Home of ${nickname}`, wishMode: 'ideas', wishlistUrl: 'https://w.example/x', wishes: `likes of ${nickname}` });
const sent = () => api.calls.filter((c) => c.method === 'sendMessage');

// Drawn exchange: organiser 1001 (nick Nick1001) + users 1002..(1000+n).
/** @param {number} n @param {boolean} [doDraw] */
async function mk(n, doDraw = true) {
  const { id, code: c } = await createExchange({ name: 'Office <Santa>', budget: { kind: 'any' }, deadline: '2026-12-20' }, ann);
  for (let i = 1; i <= n; i++) await join({ code: c, details: det(`Nick${1000 + i}`) }, user(1000 + i));
  if (doDraw) await draw({ id }, ann);
  api.calls.length = 0;
  return id;
}
/** @param {number} id @returns {Promise<{ santa: number, giftee: number, a: any }>} a non-organiser Santa and their giftee */
async function pair(id) {
  const all = await db.select().from(assignments).where(eq(assignments.exchangeId, id)).all();
  const a = all.find((r) => r.santaId !== 1001) ?? all[0];
  return { santa: a.santaId, giftee: a.gifteeId, a };
}
const asg = async (/** @type {number} */ santa) => /** @type {any} */ (await db.select().from(assignments).where(eq(assignments.santaId, santa)).get());

test('Santa sees the giftee, including an address the giftee changes later', async () => {
  const id = await mk(4);
  const { santa, giftee } = await pair(id);
  const v1 = await getExchange({ id }, user(santa));
  expect(v1.giftee).toEqual({
    nickname: `Nick${giftee}`, address: `Home of Nick${giftee}`, wishMode: 'ideas', wishlistUrl: 'https://w.example/x',
    wishes: `likes of Nick${giftee}`, sentAt: null, tracking: null,
  });
  await updateMyDetails({ id, details: { ...det(`Nick${giftee}`), address: 'New place 5' } }, user(giftee));
  expect((await getExchange({ id }, user(santa))).giftee?.address).toBe('New place 5');
});

test('giftee side never carries the Santa id or nickname', async () => {
  const id = await mk(5); // odd size: there is always a cycle longer than 2, where the giftee's own giftee is not their Santa
  const all = await db.select().from(assignments).where(eq(assignments.exchangeId, id)).all();
  const a = /** @type {any} */ (all.find((r) => r.santaId !== 1001 && all.find((x) => x.santaId === r.gifteeId)?.gifteeId !== r.santaId));
  const { santaId: santa, gifteeId: giftee } = a;
  await markSent({ id, tracking: 'TRK-1' }, user(santa));
  const res = await getExchange({ id }, user(giftee));
  const { members: _m, progress, ...rest } = res; // the member list and progress name everybody by design
  const json = JSON.stringify(rest);
  expect(json).not.toContain(String(santa));
  expect(json).not.toContain(`Nick${santa}`);
  expect(json).not.toContain(`First${santa}`);
  expect(json).not.toMatch(/"santa/i); // no santa-ish key
  expect(Object.keys(/** @type {object} */ (res.myGift)).sort()).toEqual(['sentAt', 'status', 'tracking']);
  for (const p of progress) expect(Object.keys(p).sort()).toEqual(['gift', 'nickname', 'userId']);
  expect(res.giftee).not.toBeNull(); // their own giftee, a different person
  expect(res.giftee?.nickname).not.toBe(`Nick${santa}`);
});

test('progress lists every member with the status of the gift they will receive', async () => {
  const id = await mk(3);
  const { santa, giftee } = await pair(id);
  const state = async () => Object.fromEntries((await getExchange({ id }, user(santa))).progress.map((p) => [p.userId, p.gift]));
  expect(Object.keys(await state()).length).toBe(3);
  expect(Object.values(await state())).toEqual(['not_sent', 'not_sent', 'not_sent']);
  await markSent({ id }, user(santa));
  expect((await state())[giftee]).toBe('on_way');
  await markReceived({ id }, user(giftee));
  expect((await state())[giftee]).toBe('received');
});

test('markSent: tracking shows to the giftee, one anonymous message, button to the gift tab', async () => {
  const id = await mk(4);
  const { santa, giftee } = await pair(id);
  expect((await getExchange({ id }, user(giftee))).myGift).toEqual({ status: 'not_sent', tracking: null, sentAt: null });
  expect(await markSent({ id, tracking: '  AB<1>&2  ' }, user(santa))).toEqual({ ok: true });
  const my = (await getExchange({ id }, user(giftee))).myGift;
  expect(my).toEqual({ status: 'on_way', tracking: 'AB<1>&2', sentAt: Date.parse('2026-10-11T12:00:00Z') });
  const out = sent();
  expect(out.length).toBe(1);
  expect(out[0].params.chat_id).toBe(giftee);
  const expected = giftee === 1002
    ? '<b>Office &lt;Santa&gt;</b>\nВаш Тайный Санта отправил подарок. Он уже в пути!\nТрек-номер: <code>AB&lt;1&gt;&amp;2</code>'
    : '<b>Office &lt;Santa&gt;</b>\nYour Secret Santa sent your gift. It\'s on its way!\nTracking: <code>AB&lt;1&gt;&amp;2</code>';
  expect(out[0].params.text).toBe(expected);
  expect(out[0].params.text).not.toContain(`Nick${santa}`);
  const btn = out[0].params.reply_markup.inline_keyboard[0][0];
  expect(btn.web_app.url).toEndWith(`#/x/${id}/gift`);
  expect(btn.text).toBe(giftee === 1002 ? 'Мой подарок' : 'My gift');
  const sv = await getExchange({ id }, user(santa));
  expect(sv.giftee?.tracking).toBe('AB<1>&2');
  expect(sv.giftee?.sentAt).toBe(Date.parse('2026-10-11T12:00:00Z'));
});

test('markSent without tracking omits the tracking line; repeating is silent; a new tracking updates and notifies', async () => {
  const id = await mk(3);
  const { santa, giftee } = await pair(id);
  await markSent({ id, tracking: '   ' }, user(santa));
  expect(sent()[0].params.text).not.toMatch(/Tracking|Трек/);
  expect((await asg(santa)).tracking).toBeNull();
  setNow(Date.parse('2026-10-12T12:00:00Z'));
  await markSent({ id }, user(santa));
  expect(sent().length).toBe(1);
  await markSent({ id, tracking: 'NEW1' }, user(santa));
  expect(sent().length).toBe(2);
  expect(sent()[1].params.text).toContain('<code>NEW1</code>');
  const a = await asg(santa);
  expect(a.tracking).toBe('NEW1');
  expect(a.sentAt).toBe(Date.parse('2026-10-11T12:00:00Z')); // first send time is kept
  await markSent({ id, tracking: 'NEW1' }, user(santa));
  expect(sent().length).toBe(2);
  expect(giftee).toBe(a.gifteeId);
});

test('markSent validates: tracking over 64 chars, non-string, outsiders, wrong status', async () => {
  const id = await mk(3);
  const { santa } = await pair(id);
  expect(await code(() => markSent({ id, tracking: 'x'.repeat(65) }, user(santa)))).toBe('BAD_INPUT');
  expect(await code(() => markSent({ id, tracking: /** @type {any} */ (5) }, user(santa)))).toBe('BAD_INPUT');
  await markSent({ id, tracking: 'x'.repeat(64) }, user(santa));
  expect(await code(() => markSent({ id }, user(999)))).toBe('FORBIDDEN');
  const open = await mk(3, false);
  expect(await code(() => markSent({ id: open }, user(1001)))).toBe('NOT_DRAWN');
  expect(await code(() => markReceived({ id: open }, user(1001)))).toBe('NOT_DRAWN');
  expect(await code(() => markSent({ id: 9999 }, ann))).toBe('NOT_FOUND');
});

test('markReceived notifies the Santa once, anonymously, and is idempotent', async () => {
  const id = await mk(4);
  const { santa, giftee } = await pair(id);
  expect(await markReceived({ id }, user(giftee))).toEqual({ ok: true });
  const out = sent();
  expect(out.length).toBe(1);
  expect(out[0].params.chat_id).toBe(santa);
  expect(out[0].params.text).toBe(santa === 1002
    ? '<b>Office &lt;Santa&gt;</b>\nВаш подарок дошёл до получателя. Отличная работа, Санта!'
    : '<b>Office &lt;Santa&gt;</b>\nYour giftee received your gift. Nice work, Santa!');
  expect(out[0].params.text).not.toContain(`Nick${giftee}`);
  const first = (await asg(santa)).receivedAt;
  setNow(Date.parse('2026-10-13T12:00:00Z'));
  await markReceived({ id }, user(giftee));
  expect(sent().length).toBe(1);
  expect((await asg(santa)).receivedAt).toBe(first);
  expect((await getExchange({ id }, user(giftee))).myGift?.status).toBe('received');
});

test('everyone received: exchange closes and personal data is wiped', async () => {
  const id = await mk(3);
  const other = await mk(3);
  const now = Date.parse('2026-10-11T12:00:00Z');
  const asgs = await db.select().from(assignments).where(eq(assignments.exchangeId, id)).all();
  for (const a of asgs) await db.insert(messages).values({ exchangeId: id, assignmentId: a.id, fromSanta: 1, text: 'hi', createdAt: now }).run();
  const otherA = (await db.select().from(assignments).where(eq(assignments.exchangeId, other)).all())[0];
  await db.insert(messages).values({ exchangeId: other, assignmentId: otherA.id, fromSanta: 1, text: 'keep', createdAt: now }).run();
  for (const a of asgs) await markSent({ id, tracking: 'T' + a.santaId }, user(a.santaId));

  for (const a of asgs.slice(0, 2)) await markReceived({ id }, user(a.gifteeId));
  expect((await loadExchange(id)).status).toBe('drawn');
  setNow(now + 1000);
  await markReceived({ id }, user(asgs[2].gifteeId));

  const ex = await loadExchange(id);
  expect(ex.status).toBe('closed');
  expect(ex.closedAt).toBe(now + 1000);
  for (const m of await db.select().from(members).where(eq(members.exchangeId, id)).all()) {
    expect([m.address, m.wishlistUrl, m.wishes]).toEqual([null, null, null]);
    expect(m.nickname).toBeTruthy();
  }
  for (const a of await db.select().from(assignments).where(eq(assignments.exchangeId, id)).all()) {
    expect(a.tracking).toBeNull();
    expect(a.receivedAt).not.toBeNull();
  }
  expect((await db.select().from(messages).where(eq(messages.exchangeId, id)).all()).length).toBe(0);
  expect((await db.select().from(messages).where(eq(messages.exchangeId, other)).all()).length).toBe(1);
  expect((await loadExchange(other)).status).toBe('drawn');
  expect((await db.select().from(members).where(eq(members.exchangeId, other)).all())[0].address).not.toBeNull();

  const v = await getExchange({ id }, user(asgs[0].santaId));
  expect([v.status, v.giftee, v.myGift]).toEqual(['closed', null, null]);
  expect(v.progress.every((p) => p.gift === 'received')).toBe(true);
  expect(await code(() => markSent({ id }, user(asgs[0].santaId)))).toBe('CLOSED');
  expect(await code(() => markReceived({ id }, user(asgs[0].gifteeId)))).toBe('CLOSED');
});

test('closeExchange complete is safe to call twice and only the winner reports it', async () => {
  const id = await mk(3);
  const ex = await loadExchange(id);
  const res = await Promise.all([closeExchange(ex, 'complete'), closeExchange(ex, 'complete')]);
  expect(res.sort()).toEqual([false, true]);
  expect((await loadExchange(id)).status).toBe('closed');
});

test('the last two giftees marking received at once close the exchange once', async () => {
  const id = await mk(3);
  const asgs = await db.select().from(assignments).where(eq(assignments.exchangeId, id)).all();
  await markReceived({ id }, user(asgs[0].gifteeId));
  await Promise.all([markReceived({ id }, user(asgs[1].gifteeId)), markReceived({ id }, user(asgs[2].gifteeId))]);
  expect((await loadExchange(id)).status).toBe('closed');
  expect(sent().length).toBe(3); // one "received" notice per Santa, nothing doubled by the close
});

test('home: see until the Santa opens the giftee, drawn afterwards', async () => {
  const id = await mk(3);
  const { santa, giftee } = await pair(id);
  const view = async (/** @type {number} */ u) => (await home({}, user(u))).exchanges.find((e) => e.id === id)?.view;
  expect(await view(santa)).toBe('see');
  const g = await getExchange({ id }, user(giftee)); // someone else opening does not mark mine seen
  expect(g.giftee).not.toBeNull();
  expect(await view(santa)).toBe('see');
  await getExchange({ id }, user(santa));
  expect(await view(santa)).toBe('drawn');
  expect((await asg(santa)).seenAt).toBe(Date.parse('2026-10-11T12:00:00Z'));
});

test('drawPending: drawn status without assignments yields empty personal fields', async () => {
  const id = await mk(3, false);
  const open = await getExchange({ id }, ann);
  expect([open.drawPending, open.giftee, open.myGift, open.progress]).toEqual([false, null, null, []]);
  await db.update(exchanges).set({ status: 'drawn' }).where(eq(exchanges.id, id)).run();
  const v = await getExchange({ id }, ann);
  expect([v.drawPending, v.giftee, v.myGift, v.progress]).toEqual([true, null, null, []]);
  await draw({ id }, ann); // the organiser finishes the draw
  const done = await getExchange({ id }, ann);
  expect(done.drawPending).toBe(false);
  expect(done.giftee).not.toBeNull();
  expect(done.progress.length).toBe(3);
});
