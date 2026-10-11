import { db } from 'sdk';
import { eq } from 'sdk/db';
import { exchanges } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { loadExchange, requireOrganiser, requireStatus } from '../lib/access.js';
import { cleanName, budgetColumns, deadlineColumns } from '../lib/exchangeFields.js';

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
  if (Object.keys(set).length) await db.update(exchanges).set(set).where(eq(exchanges.id, id)).run();
  return { ok: true };
}
