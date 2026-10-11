import { test, expect, beforeEach, spyOn } from 'bun:test';
import { api, db, sqlite, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { resetDb, ctxFor, setNow } from '../test/helpers.js';
import { exchanges, members, assignments, blocks } from '../tgcloud/schema.js';
import { closeAtFor } from '../tgcloud/lib/dates.js';
import createExchange from '../tgcloud/endpoints/createExchange.js';
import updateExchange from '../tgcloud/endpoints/updateExchange.js';
import deleteExchange from '../tgcloud/endpoints/deleteExchange.js';
import home from '../tgcloud/endpoints/home.js';

const NOW = Date.parse('2026-10-11T12:00:00Z');
beforeEach(() => { resetDb(); setNow(NOW); });

const ann = ctxFor({ id: 1, first_name: 'Ann', language_code: 'en' });
const bob = ctxFor({ id: 2, first_name: 'Bob', language_code: 'ru' });
const cat = ctxFor({ id: 3, first_name: 'Cat', language_code: 'en' });
const input = { name: 'Office <Santa>', budget: { kind: 'max', max: 50, currency: 'EUR' }, deadline: '2026-12-20' };

/** @param {() => unknown} fn */
const code = async (fn) => { try { await fn(); } catch (/** @type {any} */ e) { expect(e).toBeInstanceOf(EndpointError); return e.parameters.code; } };
/** @param {number} exchangeId @param {number} userId */
const join = (exchangeId, userId) => db.insert(members).values({ exchangeId, userId, nickname: 'n', joinedAt: 1 }).run();

test('create returns a 6-char code, sets fields, appears in home as waiting organiser', async () => {
  const { id, code: c } = await createExchange(input, ann);
  expect(c).toMatch(/^[A-Z2-9]{6}$/);
  const ex = await db.select().from(exchanges).where(eq(exchanges.id, id)).get();
  expect(ex).toMatchObject({
    code: c, name: 'Office <Santa>', organiserId: 1, status: 'open', createdAt: NOW,
    budgetKind: 'max', budgetMin: null, budgetMax: 50, currency: 'EUR',
    deadline: '2026-12-20', closeAt: closeAtFor('2026-12-20'),
  });
  expect(await db.select().from(members).all()).toEqual([]);
  const h = await home({}, ann);
  expect(h.me).toEqual({ id: 1, firstName: 'Ann', lang: 'en', blocks: [] });
  expect(h.exchanges).toEqual([{ id, name: 'Office <Santa>', status: 'open', view: 'waiting', isOrganiser: true, memberCount: 0 }]);
});

test('create rejects bad input and writes nothing', async () => {
  const bad = [
    { ...input, deadline: '2026-10-10' },
    { ...input, budget: { kind: 'range', min: 90, max: 10, currency: 'EUR' } },
    { ...input, name: '   ' }, { ...input, name: 'x'.repeat(61) }, { ...input, name: 5 },
  ];
  for (const b of bad) expect(await code(() => createExchange(b, ann))).toBe('BAD_INPUT');
  expect(await db.select().from(exchanges).all()).toEqual([]);
  await createExchange({ ...input, name: 'x'.repeat(60) }, ann);
});

test('create is BLOCKED for a blocked user', async () => {
  await db.insert(blocks).values({ userId: 1, organiserId: 9, exchangeName: 'E', createdAt: 1 }).run();
  expect(await code(() => createExchange(input, ann))).toBe('BLOCKED');
  expect(await db.select().from(exchanges).all()).toEqual([]);
});

test('create retries on a code clash', async () => {
  await db.insert(exchanges).values({ code: 'AAAAAA', name: 'old', organiserId: 9, status: 'open' }).run();
  const real = crypto.getRandomValues.bind(crypto);
  let n = 0;
  const spy = spyOn(crypto, 'getRandomValues').mockImplementation((/** @type {any} */ arr) => (n++ < 6 ? (arr[0] = 0, arr) : real(arr)));
  try {
    const { code: c } = await createExchange(input, ann);
    expect(c).not.toBe('AAAAAA');
    expect(n).toBeGreaterThan(6);
  } finally { spy.mockRestore(); }
});

test('update: only organiser; open edits anything and recomputes closeAt', async () => {
  const { id } = await createExchange(input, ann);
  expect(await code(() => updateExchange({ id, name: 'Z' }, bob))).toBe('FORBIDDEN');
  expect(await code(() => updateExchange({ id: 99, name: 'Z' }, ann))).toBe('NOT_FOUND');
  expect(await code(() => updateExchange({ id, name: '' }, ann))).toBe('BAD_INPUT');
  expect(await code(() => updateExchange({ id, deadline: '2020-01-01' }, ann))).toBe('BAD_INPUT');
  expect(await code(() => updateExchange({ id, budget: { kind: 'max', currency: 'EUR' } }, ann))).toBe('BAD_INPUT');
  expect(await updateExchange({
    id, name: ' New ', budget: { kind: 'range', min: 10, max: 30, currency: 'USD' }, deadline: '2027-01-05',
  }, ann)).toEqual({ ok: true });
  expect(await db.select().from(exchanges).get()).toMatchObject({
    name: 'New', budgetKind: 'range', budgetMin: 10, budgetMax: 30, currency: 'USD',
    deadline: '2027-01-05', closeAt: closeAtFor('2027-01-05'),
  });
  await updateExchange({ id, budget: { kind: 'any' } }, ann);
  expect(await db.select().from(exchanges).get()).toMatchObject({ name: 'New', budgetKind: 'any', budgetMin: null, budgetMax: null, currency: null });
});

test('update after the draw: only the deadline; closed: CLOSED', async () => {
  const { id } = await createExchange(input, ann);
  await db.update(exchanges).set({ status: 'drawn' }).where(eq(exchanges.id, id)).run();
  expect(await code(() => updateExchange({ id, budget: { kind: 'any' } }, ann))).toBe('ALREADY_DRAWN');
  expect(await code(() => updateExchange({ id, name: 'N' }, ann))).toBe('ALREADY_DRAWN');
  expect(await code(() => updateExchange({ id, name: 'N', deadline: '2027-02-01' }, ann))).toBe('ALREADY_DRAWN');
  expect((await db.select().from(exchanges).get())?.deadline).toBe('2026-12-20');
  expect(await updateExchange({ id, deadline: '2027-02-01' }, ann)).toEqual({ ok: true });
  expect(await db.select().from(exchanges).get()).toMatchObject({ deadline: '2027-02-01', closeAt: closeAtFor('2027-02-01'), name: 'Office <Santa>' });
  await db.update(exchanges).set({ status: 'closed' }).where(eq(exchanges.id, id)).run();
  expect(await code(() => updateExchange({ id, deadline: '2027-03-01' }, ann))).toBe('CLOSED');
});

test('name/budget edits are conditional on open: a draw/close landing after the status read refuses them', async () => {
  for (const [status, err] of [['drawn', 'ALREADY_DRAWN'], ['closed', 'CLOSED']]) {
    for (const patch of [{ name: 'New' }, { budget: { kind: 'any' } }]) {
      resetDb(); setNow(NOW);
      const { id } = await createExchange(input, ann);
      const d = /** @type {any} */ (db); // monkeypatching the fake db
      const orig = d.update;
      // the status flips between updateExchange's read and its write
      d.update = (/** @type {any[]} */ ...a) => {
        if (a[0] !== exchanges) return orig.apply(db, a);
        d.update = orig;
        sqlite.run('update exchanges set status = ? where id = ?', [status, id]);
        return orig.apply(db, a);
      };
      try { expect(await code(() => updateExchange({ id, ...patch }, ann))).toBe(err); } finally { d.update = orig; }
      expect(await db.select().from(exchanges).get()).toMatchObject({ name: 'Office <Santa>', budgetKind: 'max', budgetMax: 50, status });
    }
  }
});

test('delete: organiser only, open only; notifies members (not organiser) in their language, escaped', async () => {
  const { id } = await createExchange(input, ann);
  await join(id, 1); await join(id, 2); await join(id, 3);
  await home({}, bob); await home({}, cat); // enter() creates their user rows (with lang)
  expect(await code(() => deleteExchange({ id }, bob))).toBe('FORBIDDEN');
  await db.update(exchanges).set({ status: 'drawn' }).where(eq(exchanges.id, id)).run();
  expect(await code(() => deleteExchange({ id }, ann))).toBe('ALREADY_DRAWN');
  await db.update(exchanges).set({ status: 'open' }).where(eq(exchanges.id, id)).run();
  api.calls.length = 0;

  expect(await deleteExchange({ id }, ann)).toEqual({ ok: true });
  expect(await db.select().from(exchanges).all()).toEqual([]);
  expect(await db.select().from(members).all()).toEqual([]);
  const sent = api.calls.map((c) => [c.method, c.params.chat_id, c.params.text]).sort((a, b) => a[1] - b[1]);
  expect(sent).toEqual([
    ['sendMessage', 2, 'Обмен «Office &lt;Santa&gt;» отменён организатором.'],
    ['sendMessage', 3, '"Office &lt;Santa&gt;" was cancelled by its organiser.'],
  ]);
  expect(api.calls.every((c) => c.params.parse_mode === 'HTML')).toBe(true);
});

test('home: lists my exchanges newest first with views, counts and active blocks', async () => {
  setNow(NOW - 3000); const a = (await createExchange({ ...input, name: 'A' }, bob)).id;
  setNow(NOW - 2000); const b = (await createExchange({ ...input, name: 'B' }, cat)).id;
  setNow(NOW - 1000); const c = (await createExchange({ ...input, name: 'C' }, ann)).id;
  setNow(NOW);
  await createExchange({ ...input, name: 'Not mine' }, cat);
  await join(a, 1); await join(a, 2); await join(a, 3);
  await join(b, 1); await join(b, 3);
  await db.update(exchanges).set({ status: 'drawn' }).where(eq(exchanges.id, a)).run();
  await db.insert(assignments).values({ exchangeId: a, santaId: 1, gifteeId: 2, seenAt: null }).run();
  await db.update(exchanges).set({ status: 'closed' }).where(eq(exchanges.id, b)).run();
  await db.insert(blocks).values([
    { userId: 1, organiserId: 5, exchangeName: 'Old', createdAt: 5, decision: 'unblocked' },
    { userId: 1, organiserId: 6, exchangeName: 'Bad', createdAt: 7, appealAt: 8 },
    { userId: 1, organiserId: 6, exchangeName: 'Kept', createdAt: 9, appealAt: 10, decision: 'kept' },
    { userId: 2, organiserId: 6, exchangeName: 'Other', createdAt: 9 },
  ]).run();

  let h = await home({}, ann);
  expect(h.me.blocks).toEqual([
    { id: 2, exchangeName: 'Bad', createdAt: 7, appealed: true, decision: null },
    { id: 3, exchangeName: 'Kept', createdAt: 9, appealed: true, decision: 'kept' },
  ]);
  expect(h.exchanges).toEqual([
    { id: c, name: 'C', status: 'open', view: 'waiting', isOrganiser: true, memberCount: 0 },
    { id: b, name: 'B', status: 'closed', view: 'closed', isOrganiser: false, memberCount: 2 },
    { id: a, name: 'A', status: 'drawn', view: 'see', isOrganiser: false, memberCount: 3 },
  ]);
  await db.update(assignments).set({ seenAt: 5 }).run();
  h = await home({}, ann);
  expect(h.exchanges[2].view).toBe('drawn');
});
