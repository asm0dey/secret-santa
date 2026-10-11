import { test, expect, beforeEach } from 'bun:test';
import { api, db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { resetDb, ctxFor, setNow } from '../test/helpers.js';
import { exchanges, members, blocks } from '../tgcloud/schema.js';
import createExchange from '../tgcloud/endpoints/createExchange.js';
import findByCode from '../tgcloud/endpoints/findByCode.js';
import join from '../tgcloud/endpoints/join.js';
import updateMyDetails from '../tgcloud/endpoints/updateMyDetails.js';
import leave from '../tgcloud/endpoints/leave.js';
import removeMember from '../tgcloud/endpoints/removeMember.js';
import getExchange from '../tgcloud/endpoints/getExchange.js';

beforeEach(() => { resetDb(); setNow(Date.parse('2026-10-11T12:00:00Z')); });

/** @param {number} id @param {string} name @param {string} [lang] */
const user = (id, name, lang = 'en') => ctxFor({ id, first_name: name, language_code: lang });
const ann = user(1, 'Ann'), bob = user(2, 'Bob', 'ru'), cat = user(3, 'Cat');
/** @param {() => unknown} fn */
const code = async (fn) => { try { await fn(); } catch (/** @type {any} */ e) { expect(e).toBeInstanceOf(EndpointError); return e.parameters.code; } };
/** @type {import('../tgcloud/lib/types.js').Details} */
const ideas = { nickname: 'Bobby', address: '12 Secret Street, Hidden City', wishMode: 'ideas', wishlistUrl: 'https://wish.example/bob', wishes: 'likes tea, hates socks' };
/** @type {import('../tgcloud/lib/types.js').Details} */
const surprise = { nickname: 'Cathy', address: '99 Mystery Road', wishMode: 'surprise', wishlistUrl: 'https://ignored.example', wishes: 'ignored' };

async function mk() {
  const { id, code: c } = await createExchange({ name: 'Office <Santa>', budget: { kind: 'max', max: 50, currency: 'EUR' }, deadline: '2026-12-20' }, ann);
  return { id, c };
}
/** @param {number} id @param {string} status */
const setStatus = (id, status) => db.update(exchanges).set({ status }).where(eq(exchanges.id, id)).run();

test('join accepts a messy code, stores details; surprise nulls the wish fields', async () => {
  const { id, c } = await mk();
  expect(await join({ code: ` ${c.slice(0, 3).toLowerCase()} - ${c.slice(3).toLowerCase()} `, details: ideas }, bob)).toEqual({ id });
  expect(await join({ code: c, details: surprise }, cat)).toEqual({ id });
  const rows = await db.select().from(members).orderBy(members.id).all();
  expect(rows[0]).toMatchObject({ exchangeId: id, userId: 2, ...ideas });
  expect(rows[1]).toMatchObject({ userId: 3, wishMode: 'surprise', wishlistUrl: null, wishes: null });
});

test('join errors: unknown code, repeat, blocked, bad details', async () => {
  const { id, c } = await mk();
  for (const bad of ['NOPE', 'AAAAAA', null, undefined, '0O1IL1']) expect(await code(() => join({ code: bad, details: ideas }, bob))).toBe('NOT_FOUND');
  await join({ code: c, details: ideas }, bob);
  expect(await code(() => join({ code: c, details: ideas }, bob))).toBe('ALREADY_MEMBER');
  /** @type {any[]} */ // invalid on purpose
  const bads = [
    undefined, { ...ideas, nickname: '' }, { ...ideas, nickname: '   ' }, { ...ideas, nickname: 'x'.repeat(41) },
    { ...ideas, address: '' }, { ...ideas, address: 'x'.repeat(501) }, { ...ideas, wishMode: 'other' },
    { ...ideas, wishlistUrl: 'ftp://x' }, { ...ideas, wishlistUrl: 'javascript:alert(1)' },
    { ...ideas, wishlistUrl: 'https://' + 'x'.repeat(500) }, { ...ideas, wishes: 'x'.repeat(1001) }, { ...ideas, nickname: 5 },
  ];
  for (const d of bads) expect(await code(() => join({ code: c, details: d }, cat))).toBe('BAD_INPUT');
  await join({ code: c, details: { ...ideas, nickname: 'x'.repeat(40), address: 'a'.repeat(500), wishlistUrl: '', wishes: 'w'.repeat(1000) } }, cat);
  expect((await db.select().from(members).where(eq(members.userId, 3)).get())?.wishlistUrl).toBeNull();
  await db.insert(blocks).values({ userId: 4, organiserId: 1, exchangeId: 1, exchangeName: 'E', createdAt: 1 }).run();
  expect(await code(() => join({ code: c, details: ideas }, user(4, 'Dan')))).toBe('BLOCKED');
  expect((await db.select().from(members).all()).length).toBe(2);
  expect(id).toBeGreaterThan(0);
});

test('101st join is FULL', async () => {
  const { id, c } = await mk();
  for (let i = 0; i < 100; i++) await db.insert(members).values({ exchangeId: id, userId: 1000 + i, nickname: 'n', joinedAt: 1 }).run();
  expect(await code(() => join({ code: c, details: ideas }, bob))).toBe('FULL');
  await db.delete(members).where(eq(members.userId, 1000)).run();
  await join({ code: c, details: ideas }, bob);
});

test('join after draw or close is refused', async () => {
  const { id, c } = await mk();
  await setStatus(id, 'drawn');
  expect(await code(() => join({ code: c, details: ideas }, bob))).toBe('ALREADY_DRAWN');
  await setStatus(id, 'closed');
  expect(await code(() => join({ code: c, details: ideas }, bob))).toBe('CLOSED');
});

test('findByCode returns the preview and isMember', async () => {
  const { id, c } = await mk();
  await join({ code: c, details: ideas }, bob);
  const want = { id, name: 'Office <Santa>', status: 'open', budget: { kind: /** @type {'max'} */ ('max'), min: null, max: 50, currency: 'EUR' }, deadline: '2026-12-20', organiserName: 'Ann', memberCount: 1 };
  expect(await findByCode({ code: c.toLowerCase() }, bob)).toEqual({ ...want, isMember: true });
  expect(await findByCode({ code: c }, cat)).toEqual({ ...want, isMember: false });
  expect(await code(() => findByCode({ code: 'zzz' }, cat))).toBe('NOT_FOUND');
  expect(await code(() => findByCode({ code: 'AAAAAA' }, cat))).toBe('NOT_FOUND');
});

test('updateMyDetails: member only, open and drawn, not closed', async () => {
  const { id, c } = await mk();
  expect(await code(() => updateMyDetails({ id, details: ideas }, bob))).toBe('FORBIDDEN');
  await join({ code: c, details: ideas }, bob);
  /** @type {import('../tgcloud/lib/types.js').Details} */
  const next = { ...ideas, nickname: 'Robert', wishMode: 'surprise' };
  expect(await updateMyDetails({ id, details: next }, bob)).toEqual({ ok: true });
  expect(await db.select().from(members).get()).toMatchObject({ nickname: 'Robert', wishMode: 'surprise', wishlistUrl: null, wishes: null, address: ideas.address });
  expect(await code(() => updateMyDetails({ id, details: { ...next, nickname: '' } }, bob))).toBe('BAD_INPUT');
  await setStatus(id, 'drawn');
  await updateMyDetails({ id, details: ideas }, bob);
  expect((await db.select().from(members).get())?.nickname).toBe('Bobby');
  await setStatus(id, 'closed');
  expect(await code(() => updateMyDetails({ id, details: ideas }, bob))).toBe('CLOSED');
  expect(await code(() => updateMyDetails({ id: 999, details: ideas }, bob))).toBe('NOT_FOUND');
});

test('leave: organiser cannot, member can before the draw, not after', async () => {
  const { id, c } = await mk();
  await join({ code: c, details: ideas }, ann);
  await join({ code: c, details: ideas }, bob);
  expect(await code(() => leave({ id }, ann))).toBe('FORBIDDEN');
  expect(await code(() => leave({ id }, cat))).toBe('FORBIDDEN');
  expect(await leave({ id }, bob)).toEqual({ ok: true });
  expect((await db.select().from(members).all()).map((m) => m.userId)).toEqual([1]);
  await join({ code: c, details: ideas }, bob);
  await setStatus(id, 'drawn');
  expect(await code(() => leave({ id }, bob))).toBe('ALREADY_DRAWN');
  expect((await db.select().from(members).all()).length).toBe(2);
});

test('removeMember: organiser only, open only, not themself; notifies in the removed user\'s language', async () => {
  const { id, c } = await mk();
  await join({ code: c, details: ideas }, ann);
  await join({ code: c, details: ideas }, bob);
  expect(await code(() => removeMember({ id, userId: 1 }, bob))).toBe('FORBIDDEN');
  expect(await code(() => removeMember({ id, userId: 2 }, bob))).toBe('FORBIDDEN');
  expect(await code(() => removeMember({ id, userId: 1 }, ann))).toBe('FORBIDDEN');
  expect(await code(() => removeMember({ id, userId: 77 }, ann))).toBe('NOT_FOUND');
  api.calls.length = 0;
  expect(await removeMember({ id, userId: 2 }, ann)).toEqual({ ok: true });
  expect((await db.select().from(members).all()).map((m) => m.userId)).toEqual([1]);
  expect(api.calls.length).toBe(1);
  expect(api.calls[0].params).toMatchObject({ chat_id: 2, text: 'Вас удалили из обмена «Office &lt;Santa&gt;».' });
  await join({ code: c, details: ideas }, bob);
  await setStatus(id, 'drawn');
  expect(await code(() => removeMember({ id, userId: 2 }, ann))).toBe('ALREADY_DRAWN');
});

test('getExchange: pre-draw shape, tags, and nothing private about others', async () => {
  const { id, c } = await mk();
  await join({ code: c, details: ideas }, bob);
  await join({ code: c, details: surprise }, cat);
  await join({ code: c, details: { ...ideas, nickname: 'Ann N', address: '1 Org Lane', wishlistUrl: '', wishes: '' } }, ann);

  const asBob = await getExchange({ id }, bob);
  expect(asBob).toMatchObject({
    id, name: 'Office <Santa>', code: c, displayCode: `${c.slice(0, 3)}-${c.slice(3)}`,
    inviteLink: `https://t.me/secret_santa_bot?startapp=${c}`, status: 'open',
    budget: { kind: 'max', min: null, max: 50, currency: 'EUR' }, deadline: '2026-12-20',
    isOrganiser: false, organiserName: 'Ann', me: ideas,
  });
  expect(asBob.members).toEqual([
    { userId: 2, nickname: 'Bobby', isMe: true, isOrganiser: false, tag: 'wishlist' },
    { userId: 3, nickname: 'Cathy', isMe: false, isOrganiser: false, tag: 'surprise' },
    { userId: 1, nickname: 'Ann N', isMe: false, isOrganiser: true, tag: null },
  ]);
  const json = JSON.stringify(asBob);
  for (const secret of [surprise.address, '1 Org Lane']) expect(json.includes(secret)).toBe(false);
  const asCat = JSON.stringify(await getExchange({ id }, cat));
  for (const secret of [ideas.address, String(ideas.wishlistUrl), 'hates socks']) expect(asCat.includes(secret)).toBe(false);
  expect((await getExchange({ id }, ann)).isOrganiser).toBe(true);
});

test('getExchange: non-member FORBIDDEN; organiser who has not joined gets me: null; unknown id NOT_FOUND', async () => {
  const { id, c } = await mk();
  expect(await code(() => getExchange({ id }, bob))).toBe('FORBIDDEN');
  expect(await code(() => getExchange({ id: 999 }, bob))).toBe('NOT_FOUND');
  const org = await getExchange({ id }, ann);
  expect(org.me).toBeNull();
  expect(org.members).toEqual([]);
  await join({ code: c, details: ideas }, bob);
  await leave({ id }, bob);
  expect(await code(() => getExchange({ id }, bob))).toBe('FORBIDDEN');
});
