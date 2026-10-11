import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { loadExchange, requireMember, requireStatus } from '../lib/access.js';
import { removeMemberRow } from '../lib/membership.js';

/**
 * @param {{ id: number }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ ok: true }>}
 */
export default async function ({ id }, ctx) {
  const me = await enter(ctx);
  const ex = await loadExchange(id);
  const m = await requireMember(ex, me.id);
  if (ex.organiserId === me.id) fail(ERR.FORBIDDEN);
  requireStatus(ex, 'open');
  await removeMemberRow(ex.id, m.id);
  return { ok: true };
}
