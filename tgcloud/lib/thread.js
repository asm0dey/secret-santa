import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { assignments } from '../schema.js';
import { ERR, fail } from './errors.js';
import { loadExchange, requireMember, requireStatus } from './access.js';

/**
 * Resolves the caller's own pair for a chat side: 'giftee' = I am the Santa, 'santa' = I am the giftee.
 * The assignment always comes from the caller's own row; nothing from input picks it.
 * @param {number} id exchange id
 * @param {unknown} side
 * @param {number} userId
 */
export async function openThread(id, side, userId) {
  if (side !== 'giftee' && side !== 'santa') fail(ERR.BAD_INPUT);
  const ex = await loadExchange(id);
  await requireMember(ex, userId);
  requireStatus(ex, 'drawn');
  const a = await db.select().from(assignments)
    .where(and(eq(assignments.exchangeId, ex.id), eq(side === 'giftee' ? assignments.santaId : assignments.gifteeId, userId))).get();
  if (!a) fail(ERR.NOT_DRAWN);
  return { ex, a, side };
}
