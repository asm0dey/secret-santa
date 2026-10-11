import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { exchanges } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { loadExchange, requireOrganiser, requireStatus } from '../lib/access.js';
import { cleanName, budgetColumns, deadlineColumns } from '../lib/exchangeFields.js';

/**
 * @param {{ id: number, name?: unknown, budget?: unknown, deadline?: unknown }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ ok: true }>}
 */
export default async function ({ id, name, budget, deadline }, ctx) {
  const me = await enter(ctx);
  const ex = await loadExchange(id);
  requireOrganiser(ex, me.id);
  requireStatus(ex, 'open', 'drawn');
  if (ex.status === 'drawn' && (name !== undefined || budget !== undefined)) fail(ERR.ALREADY_DRAWN);
  const set = {
    ...(name !== undefined && { name: cleanName(name) }),
    ...(budget !== undefined && budgetColumns(budget)),
    ...(deadline !== undefined && deadlineColumns(deadline)),
  };
  if (!Object.keys(set).length) return { ok: true };
  // Name/budget close at the draw, and the status read above may be stale: make the write itself conditional.
  const closesAtDraw = name !== undefined || budget !== undefined;
  await db.update(exchanges).set(set)
    .where(closesAtDraw ? and(eq(exchanges.id, id), eq(exchanges.status, 'open')) : eq(exchanges.id, id)).run();
  if (closesAtDraw) requireStatus(await loadExchange(id), 'open'); // refused: say why (ALREADY_DRAWN / CLOSED)
  return { ok: true };
}
