import { enter } from '../lib/session.js';
import { submitAppeal } from '../lib/moderation.js';

/**
 * @param {{ blockId: number, text: string, tracking?: string }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ ok: true }>}
 */
export default async function ({ blockId, text, tracking }, ctx) {
  const me = await enter(ctx);
  await submitAppeal(me.id, blockId, text, tracking);
  return { ok: true };
}
