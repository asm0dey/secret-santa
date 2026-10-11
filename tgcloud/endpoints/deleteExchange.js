import { enter } from '../lib/session.js';
import { loadExchange, requireOrganiser, requireStatus } from '../lib/access.js';
import { cancelExchange } from '../lib/cancel.js';

/**
 * @param {{ id: number }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ ok: true }>}
 */
export default async function ({ id }, ctx) {
  const me = await enter(ctx);
  const ex = await loadExchange(id);
  requireOrganiser(ex, me.id);
  requireStatus(ex, 'open');
  await cancelExchange(ex);
  return { ok: true };
}
