import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { exchanges, members, assignments, users } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { clock } from '../lib/clock.js';
import { loadExchange, requireOrganiser, requireStatus } from '../lib/access.js';
import { derange } from '../lib/draw.js';
import { formatBudget } from '../lib/budget.js';
import { budgetOf } from '../lib/exchangeFields.js';
import { send, esc } from '../lib/notify.js';
import { t } from '../lib/i18n.js';

const hasAssignments = async (exchangeId) =>
  !!(await db.select({ id: assignments.id }).from(assignments).where(eq(assignments.exchangeId, exchangeId)).get());

const markDrawn = (ex) =>
  db.update(exchanges).set({ status: 'drawn', drawnAt: clock.now() })
    .where(and(eq(exchanges.id, ex.id), eq(exchanges.status, 'open'))).run();

export default async function ({ id }, ctx) {
  const me = await enter(ctx);
  const ex = await loadExchange(id);
  requireOrganiser(ex, me.id);
  requireStatus(ex, 'open');

  // Crash recovery / lost race: assignments are the source of truth.
  if (await hasAssignments(ex.id)) {
    await markDrawn(ex);
    fail(ERR.ALREADY_DRAWN);
  }
  const mems = await db.select().from(members).where(eq(members.exchangeId, ex.id)).all();
  if (mems.length < 3) fail(ERR.TOO_FEW);

  const rows = derange(mems.map((m) => m.userId)).map((p) => ({ exchangeId: ex.id, ...p }));
  try {
    await db.insert(assignments).values(rows).run(); // one statement = atomic; unique indexes reject a concurrent batch
  } catch (e) {
    
    if (await hasAssignments(ex.id)) fail(ERR.ALREADY_DRAWN);
    throw e;
  }
  await markDrawn(ex);

  const organiser = esc(mems.find((m) => m.userId === ex.organiserId)?.nickname ?? me.firstName);
  const exchange = esc(ex.name);
  for (const m of mems) {
    const u = await db.select().from(users).where(eq(users.id, m.userId)).get();
    const lang = u?.lang ?? 'en';
    await send(m.userId, t(lang, 'drawn', { exchange, organiser, budget: formatBudget(budgetOf(ex), lang) }),
      [[{ text: t(lang, 'btnSeeRecipient'), app: `#/x/${ex.id}/giftee` }]]);
  }
  return { ok: true };
}
