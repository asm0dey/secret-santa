import { db } from 'sdk';
import { eq } from 'sdk/db';
import { exchanges, members, users } from '../schema.js';
import { send, esc } from './notify.js';
import { t } from './i18n.js';

// Deletes an undrawn exchange and its members, then tells every member except the organiser.
export async function cancelExchange(ex) {
  const others = (await db.select().from(members).where(eq(members.exchangeId, ex.id)).all())
    .filter((m) => m.userId !== ex.organiserId);
  await db.delete(members).where(eq(members.exchangeId, ex.id)).run();
  await db.delete(exchanges).where(eq(exchanges.id, ex.id)).run();
  for (const m of others) {
    const u = await db.select().from(users).where(eq(users.id, m.userId)).get();
    await send(m.userId, t(u?.lang ?? 'en', 'exchangeCancelled', { exchange: esc(ex.name) }));
  }
}
