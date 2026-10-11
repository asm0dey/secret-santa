import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { exchanges, members } from '../schema.js';
import { ERR, fail } from './errors.js';

/** @typedef {import('./types.js').Exchange} Exchange */

/** @param {number} id */
export async function loadExchange(id) {
  const ex = await db.select().from(exchanges).where(eq(exchanges.id, id)).get();
  return ex ?? fail(ERR.NOT_FOUND);
}

/** @param {Exchange} ex @param {number} userId */
export async function requireMember(ex, userId) {
  const m = await db.select().from(members)
    .where(and(eq(members.exchangeId, ex.id), eq(members.userId, userId))).get();
  return m ?? fail(ERR.FORBIDDEN);
}

/** @param {Exchange} ex @param {number} userId */
export function requireOrganiser(ex, userId) {
  if (ex.organiserId !== userId) fail(ERR.FORBIDDEN);
}

/** @param {Exchange} ex @param {...string} statuses */
export function requireStatus(ex, ...statuses) {
  if (statuses.includes(ex.status ?? '')) return;
  if (ex.status === 'closed') fail(ERR.CLOSED);
  fail(ex.status === 'drawn' ? ERR.ALREADY_DRAWN : ERR.NOT_DRAWN);
}
