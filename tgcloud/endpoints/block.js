import { enter } from '../lib/session.js';
import { blockSanta } from '../lib/moderation.js';

/**
 * @param {{ id: number, santaUserId: number }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ ok: true }>}
 */
export default async function ({ id, santaUserId }, ctx) {
  const me = await enter(ctx);
  await blockSanta(me.id, id, santaUserId);
  return { ok: true };
}
