import { test, expect, beforeEach } from 'bun:test';
import { api, db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { resetDb, ctxFor, setNow } from '../test/helpers.js';
import { exchanges, assignments } from '../tgcloud/schema.js';
import createExchange from '../tgcloud/endpoints/createExchange.js';
import join from '../tgcloud/endpoints/join.js';
import draw from '../tgcloud/endpoints/draw.js';

beforeEach(() => { resetDb(); setNow(Date.parse('2026-10-11T12:00:00Z')); });

/** @param {number} id @param {string} name @param {string} [lang] */
const user = (id, name, lang = 'en') => ctxFor({ id, first_name: name, language_code: lang });
const ann = user(1, 'Ann');
/** @param {() => unknown} fn */
const code = async (fn) => { try { await fn(); } catch (/** @type {any} */ e) { expect(e).toBeInstanceOf(EndpointError); return e.parameters.code; } };
/** @param {string} nickname @returns {import("../tgcloud/lib/types.js").Details} */
const det = (nickname) => ({ nickname, address: '1 Street', wishMode: 'surprise' });

// Organiser Ann (nickname Annie) joins as member 1 unless organiserJoins is false; users 2..n join too.
/** @param {number} n @param {boolean} [organiserJoins] */
async function mk(n, organiserJoins = true) {
  const { id, code: c } = await createExchange({ name: 'Office <Santa>', budget: { kind: 'max', max: 50, currency: 'EUR' }, deadline: '2026-12-20' }, ann);
  if (organiserJoins) await join({ code: c, details: det('Annie') }, ann);
  for (let i = 2; i <= n; i++) await join({ code: c, details: det(`Nick${i}`) }, user(i, `Name${i}`, i === 2 ? 'ru' : 'en'));
  return id;
}
const rows = () => db.select().from(assignments).all();
/** @param {number} id */
const status = async (id) => (await db.select().from(exchanges).where(eq(exchanges.id, id)).get())?.status;
const sent = () => api.calls.filter((c) => c.method === 'sendMessage');

test('draw: a valid pairing, status drawn, one private message per member', async () => {
  const id = await mk(5);
  expect(await draw({ id }, ann)).toEqual({ ok: true });
  const a = await rows();
  expect(a.length).toBe(5);
  expect(a.every((r) => r.exchangeId === id && r.santaId !== r.gifteeId)).toBe(true);
  expect(new Set(a.map((r) => r.santaId)).size).toBe(5);
  expect(new Set(a.map((r) => r.gifteeId)).size).toBe(5);
  expect(await status(id)).toBe('drawn');
  expect((await db.select().from(exchanges).where(eq(exchanges.id, id)).get())?.drawnAt).toBe(Date.parse('2026-10-11T12:00:00Z'));

  const msgs = sent();
  expect(msgs.map((m) => m.params.chat_id).sort()).toEqual([1, 2, 3, 4, 5]);
  for (const { params: p } of msgs) {
    expect(p.text).toContain('Office &lt;Santa&gt;');
    for (const other of ['Nick2', 'Nick3', 'Nick4', 'Nick5', 'Name2', 'Name3', 'Name4', 'Name5']) expect(p.text).not.toContain(other);
    expect(p.reply_markup.inline_keyboard[0][0].web_app.url).toEndWith(`#/x/${id}/giftee`);
  }
  const en = msgs.find((m) => m.params.chat_id === 3)?.params;
  expect(en.text).toBe('<b>Names are drawn for "Office &lt;Santa&gt;"</b>\nAnnie started the draw. Open the app to see who you\'re gifting to. Budget: up to 50 EUR.');
  expect(en.reply_markup.inline_keyboard[0][0].text).toBe('See my recipient');
  const ru = msgs.find((m) => m.params.chat_id === 2)?.params;
  expect(ru.text).toBe('<b>Жеребьёвка в обмене «Office &lt;Santa&gt;» прошла</b>\nAnnie запустил(а) жеребьёвку. Откройте приложение, чтобы узнать, кому вы дарите подарок. Бюджет: до 50 EUR.');
  expect(ru.reply_markup.inline_keyboard[0][0].text).toBe('Кому я дарю');
});

test('second draw is ALREADY_DRAWN and notifies nobody again', async () => {
  const id = await mk(5);
  await draw({ id }, ann);
  expect(await code(() => draw({ id }, ann))).toBe('ALREADY_DRAWN');
  expect(sent().length).toBe(5);
  expect((await rows()).length).toBe(5);
});

test('concurrent draws: one success, one ALREADY_DRAWN, 5 assignments, 5 messages', async () => {
  const id = await mk(5);
  const res = await Promise.all([draw({ id }, ann).then(() => 'ok', (/** @type {any} */ e) => e.parameters.code), draw({ id }, ann).then(() => 'ok', (/** @type {any} */ e) => e.parameters.code)]);
  expect(res.sort()).toEqual(['ALREADY_DRAWN', 'ok']);
  expect((await rows()).length).toBe(5);
  expect(sent().length).toBe(5);
});

test('lost race at the batch insert (unique index) is ALREADY_DRAWN with no notifications', async () => {
  const id = await mk(3);
  const d = /** @type {any} */ (db); // monkeypatching the fake db
  const real = d.insert;
  // another invocation commits its batch just before ours
  d.insert = (/** @type {any} */ t) => ({ values: (/** @type {any[]} */ v) => ({ run: async () => {
    d.insert = real;
    await real.call(db, t).values(v.map((x, i) => ({ exchangeId: id, santaId: x.santaId, gifteeId: v[(i + 1) % v.length].santaId }))).run();
    return real.call(db, t).values(v).run();
  } }) });
  try { expect(await code(() => draw({ id }, ann))).toBe('ALREADY_DRAWN'); } finally { d.insert = real; }
  expect(sent().length).toBe(0);
  expect((await rows()).length).toBe(3);
});

test('crash recovery: assignments exist, status still open -> fixed up, nothing sent', async () => {
  const id = await mk(3);
  await db.insert(assignments).values([[1, 2], [2, 3], [3, 1]].map(([s, g]) => ({ exchangeId: id, santaId: s, gifteeId: g }))).run();
  expect(await status(id)).toBe('open');
  expect(await code(() => draw({ id }, ann))).toBe('ALREADY_DRAWN');
  expect(await status(id)).toBe('drawn');
  expect(sent().length).toBe(0);
  expect((await rows()).length).toBe(3);
});

test('organiser who never joined: message names them by Telegram first name and they get none', async () => {
  const id = await mk(4, false);
  await draw({ id }, ann);
  expect(sent().map((m) => m.params.chat_id).sort()).toEqual([2, 3, 4]);
  expect(sent().find((m) => m.params.chat_id === 3)?.params.text).toContain('Ann started the draw');
  for (const { params: p } of sent()) for (const nick of ['Nick2', 'Nick3', 'Nick4']) expect(p.text).not.toContain(nick);
});

test('fewer than 3 members is TOO_FEW', async () => {
  const id = await mk(2);
  expect(await code(() => draw({ id }, ann))).toBe('TOO_FEW');
  expect((await rows()).length).toBe(0);
  expect(await status(id)).toBe('open');
});

test('only the organiser may draw', async () => {
  const id = await mk(4);
  expect(await code(() => draw({ id }, user(2, 'Name2')))).toBe('FORBIDDEN');
  expect(await code(() => draw({ id }, user(9, 'Stranger')))).toBe('FORBIDDEN');
  expect(await code(() => draw({ id: 999 }, ann))).toBe('NOT_FOUND');
  expect((await rows()).length).toBe(0);
});

test('closed exchange cannot be drawn', async () => {
  const id = await mk(3);
  await db.update(exchanges).set({ status: 'closed' }).where(eq(exchanges.id, id)).run();
  expect(await code(() => draw({ id }, ann))).toBe('CLOSED');
});
