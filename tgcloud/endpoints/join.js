import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { exchanges, members } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { clock } from '../lib/clock.js';
import { normalizeCode } from '../lib/code.js';
import { requireStatus } from '../lib/access.js';
import { detailsColumns } from '../lib/details.js';
import { addMember } from '../lib/membership.js';

/**
 * @param {{ code: unknown, details: import('../lib/types.js').Details, consent: unknown }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ id: number }>}
 */
export default async function ({ code, details, consent }, ctx) {
  if (consent !== true) fail(ERR.BAD_INPUT); // privacy policy accepted; joinedAt doubles as the consent time
  const me = await enter(ctx);
  if (me.blocked) fail(ERR.BLOCKED);
  const c = normalizeCode(code) ?? fail(ERR.NOT_FOUND);
  const ex = await db.select().from(exchanges).where(eq(exchanges.code, c)).get() ?? fail(ERR.NOT_FOUND);
  requireStatus(ex, 'open');
  const already = await db.select().from(members).where(and(eq(members.exchangeId, ex.id), eq(members.userId, me.id))).get();
  if (already) fail(ERR.ALREADY_MEMBER);
  const cols = detailsColumns(details);
  await addMember(ex.id, me.id, cols, clock.now());
  return { id: ex.id };
}
