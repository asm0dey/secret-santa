import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { members } from '../schema.js';
import { enter } from '../lib/session.js';
import { loadExchange, requireMember, requireStatus } from '../lib/access.js';
import { detailsColumns } from '../lib/details.js';

/**
 * @param {{ id: number, details: import('../lib/types.js').Details }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ ok: true }>}
 */
export default async function ({ id, details }, ctx) {
  const me = await enter(ctx);
  const ex = await loadExchange(id);
  const m = await requireMember(ex, me.id);
  requireStatus(ex, 'open', 'drawn');
  await db.update(members).set(detailsColumns(details)).where(eq(members.id, m.id)).run();
  return { ok: true };
}
