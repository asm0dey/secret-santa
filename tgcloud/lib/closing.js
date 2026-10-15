import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { exchanges, members, assignments, messages, users } from '../schema.js';
import { clock } from './clock.js';
import { loadExchange } from './access.js';
import { send, sendPhoto, esc } from './notify.js';
import { t } from './i18n.js';
import { token as newToken } from './draw.js';

/** Deletes everything personal in an exchange. Idempotent. @param {number} exchangeId */
export async function wipeExchange(exchangeId) {
  await db.update(members).set({ address: null, wishlistUrl: null, wishes: null }).where(eq(members.exchangeId, exchangeId)).run();
  await db.update(assignments).set({ tracking: null }).where(eq(assignments.exchangeId, exchangeId)).run();
  await db.delete(messages).where(eq(messages.exchangeId, exchangeId)).run();
}

// Closes a drawn exchange and deletes everything personal. Safe to call twice (or concurrently): the
// drawn -> closed flip is conditional and only the call that wins it wipes (and, for 'timeout', notifies);
// it returns true for that call.
/** @param {import('./types.js').Exchange} ex @param {'complete' | 'timeout'} reason */
export async function closeExchange(ex, reason) {
  const token = newToken(); // reuses drawToken as the "who flipped it" marker; a closed exchange is never drawn again
  await db.update(exchanges).set({ status: 'closed', closedAt: clock.now(), drawToken: token })
    .where(and(eq(exchanges.id, ex.id), eq(exchanges.status, 'drawn'))).run();
  if ((await loadExchange(ex.id)).drawToken !== token) return false;
  // Names and assignments are read before the wipe; messages go out after it so personal data never waits on the Bot API.
  const report = reason === 'timeout' ? await gather(ex) : null;
  await wipeExchange(ex.id);
  if (report) await report();
  return true;
}

/** @param {number} id @param {import('./types.js').Member[]} rows @param {string} fallback */
const nameIn = (id, rows, fallback) => rows.find((m) => m.userId === id)?.nickname ?? fallback;

/** Reads what the closing messages need, returns the function that sends them. @param {import('./types.js').Exchange} ex */
async function gather(ex) {
  const [asgs, rows] = await Promise.all([
    db.select().from(assignments).where(eq(assignments.exchangeId, ex.id)).orderBy(assignments.id).all(),
    db.select().from(members).where(eq(members.exchangeId, ex.id)).all(),
  ]);
  /** @param {number} id */
  const userOf = (id) => db.select().from(users).where(eq(users.id, id)).get();
  const org = await userOf(ex.organiserId);
  const orgLang = org?.lang ?? 'en';
  const organiser = esc(nameIn(ex.organiserId, rows, org?.firstName ?? ''));
  const exchange = esc(ex.name);
  const missing = asgs.filter((a) => a.receivedAt == null);
  const plan = await Promise.all(missing.map(async (a) => ({
    a, lang: (await userOf(a.gifteeId))?.lang ?? 'en',
    giftee: esc(nameIn(a.gifteeId, rows, '')), santa: nameIn(a.santaId, rows, ''), // santa stays raw: escaped where used in HTML, plain in button text
  })));

  // Organiser first: if the request dies mid-send, the Block / Let it go prompts are the last thing lost.
  return async () => {
    await send(ex.organiserId, t(orgLang, 'closedSummary', { exchange, received: asgs.length - missing.length, total: asgs.length }));
    for (const { a, giftee, santa } of plan) {
      if (a.santaId === ex.organiserId) continue; // their own gift: nothing to block or chase
      if (a.sentAt != null) {
        await send(ex.organiserId, t(orgLang, 'closedLost', { exchange, giftee }));
        continue;
      }
      const text = t(orgLang, 'closedNoGift', { exchange, giftee, santa: esc(santa) });
      const row = [{ text: t(orgLang, 'btnBlock', { santa }), data: `block:${ex.id}:${a.santaId}` }, { text: t(orgLang, 'btnLetGo'), data: `letgo:${ex.id}:${a.santaId}` }];
      // The url button can be refused (privacy settings); then the organiser still gets Block / Let it go.
      if (!(await send(ex.organiserId, text, [row, [{ text: t(orgLang, 'btnMessage', { santa }), url: `tg://user?id=${a.santaId}` }]]))) {
        await send(ex.organiserId, text, [row]);
      }
    }
    for (const { a, lang, giftee } of plan) {
      await sendPhoto(a.gifteeId, '/sorry.jpg', t(lang, 'sorry', { name: giftee, exchange, organiser }));
    }
  };
}
