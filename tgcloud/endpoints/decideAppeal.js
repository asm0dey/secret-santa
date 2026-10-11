import { enter } from '../lib/session.js';
import { decideAppeal } from '../lib/moderation.js';

/**
 * @param {{ blockId: number, decision: 'unblock' | 'keep' }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ ok: true }>}
 */
export default async function ({ blockId, decision }, ctx) {
  const me = await enter(ctx);
  await decideAppeal(me.id, blockId, decision);
  return { ok: true };
}
