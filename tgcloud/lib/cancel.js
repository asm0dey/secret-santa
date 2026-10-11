import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { exchanges, members, users } from '../schema.js';
import { send, esc } from './notify.js';
import { t } from './i18n.js';
import { ERR, fail } from './errors.js';

// Deletes an undrawn exchange and its members, then tells every member except the organiser.
// The exchange row goes first and only while still 'open', so a draw that flipped it wins (ALREADY_DRAWN).
/** @param {import('./types.js').Exchange} ex */
export async function cancelExchange(ex) {
  await db.delete(exchanges).where(and(eq(exchanges.id, ex.id), eq(exchanges.status, 'open'))).run();
  const left = await db.select().from(exchanges).where(eq(exchanges.id, ex.id)).get();
  if (left) fail(left.status === 'closed' ? ERR.CLOSED : ERR.ALREADY_DRAWN);
  const others = (await db.select().from(members).where(eq(members.exchangeId, ex.id)).all())
    .filter((m) => m.userId !== ex.organiserId);
  await db.delete(members).where(eq(members.exchangeId, ex.id)).run();
  for (const m of others) {
    const u = await db.select().from(users).where(eq(users.id, m.userId)).get();
    await send(m.userId, t(u?.lang ?? 'en', 'exchangeCancelled', { exchange: esc(ex.name) }));
  }
}
