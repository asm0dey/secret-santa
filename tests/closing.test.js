import { test, expect, beforeEach } from 'bun:test';
import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { resetDb, ctxFor, setNow } from '../test/helpers.js';
import { exchanges, members, assignments, messages } from '../tgcloud/schema.js';
import createExchange from '../tgcloud/endpoints/createExchange.js';
import join from '../tgcloud/endpoints/join.js';
import draw from '../tgcloud/endpoints/draw.js';
import home from '../tgcloud/endpoints/home.js';
import { closeExchange } from '../tgcloud/lib/closing.js';
import { loadExchange } from '../tgcloud/lib/access.js';

const T0 = Date.parse('2026-10-11T12:00:00Z');
const BEFORE_CLOSE = Date.parse('2027-01-19T12:00:00Z'); // closeAt is 2027-01-20T00:00Z (deadline end + 30 days)
const AFTER = Date.parse('2027-01-21T00:00:00Z'); // 31 days after the deadline
beforeEach(() => { resetDb(); setNow(T0); });

/** @param {number} id */
const user = (id) => ctxFor({ id, first_name: `First${id}`, language_code: id === 1002 ? 'ru' : 'en' });
const ann = user(1001);
const sent = () => api.calls.filter((c) => c.method === 'sendMessage');
const photos = () => api.calls.filter((c) => c.method === 'sendPhoto');
/** @param {string} nickname @returns {import('../tgcloud/lib/types.js').Details} */
const det = (nickname) => ({ nickname, address: `Home of ${nickname}`, wishMode: 'ideas', wishlistUrl: 'https://w.example/x', wishes: `likes of ${nickname}` });
const poke = () => home({}, user(9999)); // any endpoint runs the sweep via enter()

// Organiser 1001 (not a member unless joinOrg) + Santas 1002..1005.
/** @param {boolean} [joinOrg] */
async function mk(joinOrg = false) {
  const { id, code } = await createExchange({ name: 'Office <Santa>', budget: { kind: 'any' }, deadline: '2026-12-20' }, ann);
  if (joinOrg) await join({ code, details: det('Orga1001') }, ann);
  for (let i = 2; i <= 5; i++) await join({ code, details: det(`Nick${1000 + i}`) }, user(1000 + i));
  await draw({ id }, ann);
  api.calls.length = 0;
  return id;
}
/** @param {number} id */
const asgs = (id) => db.select().from(assignments).where(eq(assignments.exchangeId, id)).orderBy(assignments.id).all();

test('not closed before closeAt', async () => {
  const id = await mk();
  setNow(BEFORE_CLOSE);
  await poke();
  expect((await loadExchange(id)).status).toBe('drawn');
  expect(api.calls.length).toBe(0);
});

test('31 days after the deadline any endpoint closes it, sorrys the giftees, tells the organiser, wipes data', async () => {
  const id = await mk();
  const [a1, a2, a3, a4] = await asgs(id);
  // a1 received; a2 sent but lost; a3 and a4 never sent
  await db.update(assignments).set({ sentAt: 1, receivedAt: 2, tracking: 'T1' }).where(eq(assignments.id, a1.id)).run();
  await db.update(assignments).set({ sentAt: 1, tracking: 'T2' }).where(eq(assignments.id, a2.id)).run();
  await db.insert(messages).values({ exchangeId: id, assignmentId: a3.id, fromSanta: 1, text: 'secret chat', createdAt: 1 }).run();
  setNow(AFTER);
  await poke();

  const ex = await loadExchange(id);
  expect(ex.status).toBe('closed');
  expect(ex.closedAt).toBe(AFTER);
  for (const m of await db.select().from(members).where(eq(members.exchangeId, id)).all())
    expect([m.address, m.wishlistUrl, m.wishes]).toEqual([null, null, null]);
  expect((await asgs(id)).every((a) => a.tracking == null)).toBe(true);
  expect((await db.select().from(messages).all()).length).toBe(0);

  // sorry photos: the 3 giftees without a gift, caption has own nickname, never the Santa's
  const nick = async (/** @type {number} */ uid) => /** @type {string} */ ((await db.select().from(members).where(eq(members.userId, uid)).get())?.nickname);
  expect(photos().length).toBe(3);
  for (const a of [a2, a3, a4]) {
    const p = photos().find((c) => c.params.chat_id === a.gifteeId);
    expect(p?.params.photo).toEndWith('/sorry.jpg');
    expect(p?.params.caption).toContain(await nick(a.gifteeId));
    expect(p?.params.caption).not.toContain(await nick(a.santaId));
    expect(p?.params.caption).toContain('First1001'); // organiser is not a member: Telegram first name
    expect(p?.params.caption).toContain('Office &lt;Santa&gt;');
  }
  expect(photos().some((c) => c.params.chat_id === a1.gifteeId)).toBe(false);
  expect(photos().find((c) => c.params.chat_id === 1002)?.params.caption).toContain('Нам очень жаль'); // recipient's language

  // organiser: summary + 2 not-sent + 1 lost
  const org = sent().filter((c) => c.params.chat_id === 1001);
  expect(org.length).toBe(4);
  expect(org[0].params.text).toContain('1 of 4 gifts arrived');
  const noGift = org.filter((c) => c.params.text.includes('never marked it as sent'));
  expect(noGift.length).toBe(2);
  for (const a of [a3, a4]) {
    const m = noGift.find((c) => c.params.reply_markup.inline_keyboard[0][0].callback_data === `block:${id}:${a.santaId}`);
    expect(m).toBeTruthy();
    const kb = /** @type {any} */ (m).params.reply_markup.inline_keyboard;
    expect(kb[0][1].callback_data).toBe(`letgo:${id}:${a.santaId}`);
    expect(kb[1][0].url).toBe(`tg://user?id=${a.santaId}`);
    expect(m?.params.text).toContain(await nick(a.santaId));
    expect(m?.params.text).toContain(await nick(a.gifteeId));
  }
  const lost = org.filter((c) => c.params.text.includes('never arrived'));
  expect(lost.length).toBe(1);
  expect(lost[0].params.text).toContain(await nick(a2.gifteeId));
  expect(lost[0].params.text).not.toContain(await nick(a2.santaId));
  expect(lost[0].params.reply_markup).toBeUndefined();
  // nobody but the organiser gets a message
  expect(sent().every((c) => c.params.chat_id === 1001)).toBe(true);
});

test('organiser who joined is named by their nickname', async () => {
  const id = await mk(true);
  setNow(AFTER);
  await poke();
  expect(photos().length).toBe(5);
  expect(photos().every((c) => c.params.caption.includes('Orga1001'))).toBe(true);
  expect((await loadExchange(id)).status).toBe('closed');
});

test('if the url button is rejected the organiser message is resent without it', async () => {
  const id = await mk();
  api.failFor = (_m, p) => (p.reply_markup?.inline_keyboard?.some((/** @type {any[]} */ r) => r.some((b) => b.url)) ? 'BUTTON_USER_PRIVACY_RESTRICTED' : undefined);
  setNow(AFTER);
  await poke();
  const noGift = sent().filter((c) => c.params.text.includes('never marked it as sent'));
  expect(noGift.length).toBe(4);
  for (const c of noGift) {
    expect(c.params.reply_markup.inline_keyboard.length).toBe(1);
    expect(c.params.reply_markup.inline_keyboard[0].map((/** @type {any} */ b) => b.callback_data.split(':')[0])).toEqual(['block', 'letgo']);
  }
  expect((await loadExchange(id)).status).toBe('closed');
});

test('closing twice sends the messages once', async () => {
  const id = await mk();
  const ex = await loadExchange(id);
  const rs = await Promise.all([closeExchange(ex, 'timeout'), closeExchange(ex, 'timeout')]);
  expect(rs.filter(Boolean).length).toBe(1);
  expect(photos().length).toBe(4);
  await closeExchange(ex, 'timeout');
  expect(photos().length).toBe(4);
});

test("'complete' sends nothing", async () => {
  const id = await mk();
  await closeExchange(await loadExchange(id), 'complete');
  expect(api.calls.length).toBe(0);
});

/** @param {number} i @param {string} status */
const raw = async (i, status) => {
  await db.insert(exchanges).values({ code: `C${i}`, name: `E${i}`, organiserId: 1001, status, deadline: '2026-12-20', closeAt: Date.parse('2027-01-20T00:00:00Z') }).run();
  return /** @type {number} */ ((await db.select().from(exchanges).where(eq(exchanges.code, `C${i}`)).get())?.id);
};

test('one exchange closes per call, oldest first', async () => {
  const late = await raw(1, 'drawn');
  const early = await raw(2, 'drawn');
  await db.update(exchanges).set({ closeAt: Date.parse('2027-01-10T00:00:00Z') }).where(eq(exchanges.id, early)).run();
  setNow(AFTER);
  await poke();
  expect((await loadExchange(early)).status).toBe('closed');
  expect((await loadExchange(late)).status).toBe('drawn');
  await poke();
  expect((await loadExchange(late)).status).toBe('closed');
});

test('organiser messages are sent before the giftees\' sorry photos', async () => {
  await mk();
  setNow(AFTER);
  await poke();
  const first = api.calls.findIndex((c) => c.method === 'sendPhoto');
  const lastMsg = api.calls.map((c) => c.method).lastIndexOf('sendMessage');
  expect(first).toBeGreaterThan(lastMsg);
});

/** @param {number} closedAt */
async function leftovers(closedAt) {
  const id = await raw(1, 'closed');
  await db.update(exchanges).set({ closedAt }).where(eq(exchanges.id, id)).run();
  await db.insert(members).values({ exchangeId: id, userId: 5, nickname: 'N', address: 'late write', joinedAt: 1 }).run();
  await db.insert(assignments).values({ exchangeId: id, santaId: 5, gifteeId: 6, tracking: 'LATE' }).run();
  await db.insert(messages).values({ exchangeId: id, assignmentId: 1, fromSanta: 1, text: 'x', createdAt: 1 }).run();
}

test('a recently closed exchange that still holds personal data is wiped again, silently', async () => {
  await leftovers(T0 - 3_600_000);
  await poke();
  expect((await db.select().from(members).get())?.address).toBeNull();
  expect((await db.select().from(assignments).get())?.tracking).toBeNull();
  expect((await db.select().from(messages).all()).length).toBe(0);
  expect(api.calls.length).toBe(0);
});

test('a closed exchange older than a day is not re-wiped', async () => {
  await leftovers(T0 - 2 * 86_400_000);
  await poke();
  expect((await db.select().from(members).get())?.address).toBe('late write');
  expect((await db.select().from(messages).all()).length).toBe(1);
});
