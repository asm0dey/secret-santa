import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { exchanges, members, assignments, messages } from '../schema.js';
import { clock } from './clock.js';
import { loadExchange } from './access.js';

// Closes a drawn exchange and deletes everything personal. Safe to call twice (or concurrently): the
// drawn -> closed flip is conditional and only the call that wins it wipes; it returns true for that call.
// Task 11 adds the 'timeout' reason.
/** @param {import('./types.js').Exchange} ex @param {'complete'} reason */
export async function closeExchange(ex, reason) {
  const token = crypto.randomUUID(); // reuses drawToken as the "who flipped it" marker; a closed exchange is never drawn again
  await db.update(exchanges).set({ status: 'closed', closedAt: clock.now(), drawToken: token })
    .where(and(eq(exchanges.id, ex.id), eq(exchanges.status, 'drawn'))).run();
  if ((await loadExchange(ex.id)).drawToken !== token) return false;
  await db.update(members).set({ address: null, wishlistUrl: null, wishes: null }).where(eq(members.exchangeId, ex.id)).run();
  await db.update(assignments).set({ tracking: null }).where(eq(assignments.exchangeId, ex.id)).run();
  await db.delete(messages).where(eq(messages.exchangeId, ex.id)).run();
  return true;
}
