import { test, expect, beforeEach } from 'bun:test';
import { api, db, sqlite, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { resetDb, ctxFor, setNow } from '../test/helpers.js';
import { exchanges, members, assignments } from '../tgcloud/schema.js';
import createExchange from '../tgcloud/endpoints/createExchange.js';
import join from '../tgcloud/endpoints/join.js';
import leave from '../tgcloud/endpoints/leave.js';
import removeMember from '../tgcloud/endpoints/removeMember.js';
import deleteExchange from '../tgcloud/endpoints/deleteExchange.js';
import draw from '../tgcloud/endpoints/draw.js';

beforeEach(() => { resetDb(); setNow(Date.parse('2026-10-11T12:00:00Z')); });

const user = (id, name) => ctxFor({ id, first_name: name, language_code: 'en' });
const ann = user(1, 'Ann');
const det = (nickname) => ({ nickname, address: '1 Street', wishMode: 'surprise' });
const code = async (fn) => { try { await fn(); } catch (e) { expect(e).toBeInstanceOf(EndpointError); return e.parameters.code; } };
const sent = () => api.calls.filter((c) => c.method === 'sendMessage');

async function mk(n) {
  const { id, code: c } = await createExchange({ name: 'Gifts', budget: { kind: 'any' }, deadline: '2026-12-20' }, ann);
  await join({ code: c, details: det('Annie') }, ann);
  for (let i = 2; i <= n; i++) await join({ code: c, details: det(`Nick${i}`) }, user(i, `Name${i}`));
  return { id, c };
}

// Runs `act` synchronously right before the next db[method] call: a rival draw lands exactly between an
// endpoint's read and its write (flip to drawn + a full cyclic pairing of the current members).
// `table` narrows it to the first call on that table (enter() also updates users, etc.).
function rivalDrawBefore(method, id, table) {
  const orig = db[method];
  db[method] = (...a) => {
    if (table && a[0] !== table) return orig.apply(db, a);
    db[method] = orig;
    const us = sqlite.query('select user_id u from members where exchange_id = ?').all(id).map((r) => r.u);
    sqlite.run("update exchanges set status = 'drawn', draw_token = 'rival' where id = ?", [id]);
    us.forEach((s, i) => sqlite.run('insert into assignments (exchange_id, santa_id, giftee_id) values (?, ?, ?)', [id, s, us[(i + 1) % us.length]]));
    return orig.apply(db, a);
  };
}

async function expectConsistent(id) {
  const ms = (await db.select().from(members).where(eq(members.exchangeId, id)).all()).map((m) => m.userId).sort();
  const as = await db.select().from(assignments).where(eq(assignments.exchangeId, id)).all();
  expect(as.map((a) => a.santaId).sort()).toEqual(ms);
  expect(as.map((a) => a.gifteeId).sort()).toEqual(ms);
  expect(as.every((a) => a.santaId !== a.gifteeId)).toBe(true);
}

test('leave after a rival draw landed between read and write is refused; pairing stays consistent', async () => {
  const { id } = await mk(4);
  rivalDrawBefore('delete', id, members);
  expect(await code(() => leave({ id }, user(3, 'Name3')))).toBe('ALREADY_DRAWN');
  await expectConsistent(id);
});

test('removeMember in that window is refused and the member is not messaged', async () => {
  const { id } = await mk(4);
  rivalDrawBefore('delete', id, members);
  expect(await code(() => removeMember({ id, userId: 3 }, ann))).toBe('ALREADY_DRAWN');
  expect(sent().length).toBe(0);
  await expectConsistent(id);
});

test('join in that window is refused: no member without an assignment', async () => {
  const { id, c } = await mk(3);
  rivalDrawBefore('run', id);
  expect(await code(() => join({ code: c, details: det('Late') }, user(9, 'Late')))).toBe('ALREADY_DRAWN');
  await expectConsistent(id);
});

test('deleteExchange in that window is refused: nothing deleted, nobody told it was cancelled', async () => {
  const { id } = await mk(4);
  rivalDrawBefore('delete', id, exchanges);
  expect(await code(() => deleteExchange({ id }, ann))).toBe('ALREADY_DRAWN');
  expect(await db.select().from(exchanges).where(eq(exchanges.id, id)).get()).toBeTruthy();
  expect(sent().length).toBe(0);
  await expectConsistent(id);
});

test('the flip is conditional: a rival that already flipped wins, we write and send nothing', async () => {
  const { id } = await mk(4);
  const orig = db.update;
  db.update = (...a) => { // rival flips between our read and our flip (no assignments yet)
    if (a[0] !== exchanges) return orig.apply(db, a);
    db.update = orig;
    sqlite.run("update exchanges set status = 'drawn', draw_token = 'rival' where id = ?", [id]);
    return orig.apply(db, a);
  };
  expect(await code(() => draw({ id }, ann))).toBe('ALREADY_DRAWN');
  expect(await db.select().from(assignments).all()).toEqual([]);
  expect(sent().length).toBe(0);
});

test('crash after the flip, before the batch insert: the next draw completes and notifies exactly once', async () => {
  const { id } = await mk(5);
  const orig = db.insert;
  db.insert = (...a) => { if (a[0] !== assignments) return orig.apply(db, a); db.insert = orig; throw new Error('boom'); };
  await expect(draw({ id }, ann)).rejects.toThrow('boom');
  expect((await db.select().from(exchanges).where(eq(exchanges.id, id)).get()).status).toBe('drawn');
  expect(await db.select().from(assignments).all()).toEqual([]);
  expect(sent().length).toBe(0);
  expect(await code(() => draw({ id }, user(2, 'Name2')))).toBe('FORBIDDEN');

  expect(await draw({ id }, ann)).toEqual({ ok: true });
  expect(sent().map((m) => m.params.chat_id).sort()).toEqual([1, 2, 3, 4, 5]);
  await expectConsistent(id);
  expect(await code(() => draw({ id }, ann))).toBe('ALREADY_DRAWN');
  expect(sent().length).toBe(5);
});

test('members dropping below 3 between count and flip leaves the exchange open (TOO_FEW)', async () => {
  const { id } = await mk(3);
  const orig = db.update;
  db.update = (...a) => { if (a[0] !== exchanges) return orig.apply(db, a); db.update = orig; sqlite.run('delete from members where exchange_id = ? and user_id = 3', [id]); return orig.apply(db, a); };
  expect(await code(() => draw({ id }, ann))).toBe('TOO_FEW');
  expect((await db.select().from(exchanges).where(eq(exchanges.id, id)).get()).status).toBe('open');
  expect(sent().length).toBe(0);
});

test('join/leave/remove/delete still work before the draw', async () => {
  const { id, c } = await mk(4);
  await leave({ id }, user(4, 'Name4'));
  await removeMember({ id, userId: 3 }, ann);
  await join({ code: c, details: det('Back') }, user(3, 'Name3'));
  expect((await db.select().from(members).where(eq(members.exchangeId, id)).all()).length).toBe(3);
  await deleteExchange({ id }, ann);
  expect(await db.select().from(exchanges).all()).toEqual([]);
  expect(await db.select().from(members).all()).toEqual([]);
});
