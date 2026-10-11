import { db } from 'sdk';
import { eq, and, sql } from 'sdk/db';
import { exchanges, members, assignments, users } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { clock } from '../lib/clock.js';
import { loadExchange, requireOrganiser } from '../lib/access.js';
import { derange } from '../lib/draw.js';
import { formatBudget } from '../lib/budget.js';
import { budgetOf } from '../lib/exchangeFields.js';
import { send, esc } from '../lib/notify.js';
import { t } from '../lib/i18n.js';

/** @param {number} exchangeId */
const hasAssignments = async (exchangeId) =>
  !!(await db.select({ id: assignments.id }).from(assignments).where(eq(assignments.exchangeId, exchangeId)).get());

// Step 1: win the open -> drawn flip (also fails TOO_FEW atomically: the member count is part of the condition).
/** @param {import('../lib/types.js').Exchange} ex */
async function flip(ex) {
  const token = crypto.randomUUID();
  await db.update(exchanges).set({ status: 'drawn', drawnAt: clock.now(), drawToken: token })
    .where(and(
      eq(exchanges.id, ex.id), eq(exchanges.status, 'open'),
      sql`(select count(*) from members where exchange_id = ${ex.id}) >= 3`,
    )).run();
  const now = await loadExchange(ex.id);
  if (now.drawToken === token) return;
  fail(now.status === 'open' ? ERR.TOO_FEW : ERR.ALREADY_DRAWN);
}

/**
 * @param {{ id: number }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ ok: true }>}
 */
export default async function ({ id }, ctx) {
  const me = await enter(ctx);
  const ex = await loadExchange(id);
  requireOrganiser(ex, me.id);
  if (ex.status === 'closed') fail(ERR.CLOSED);
  // 'drawn' without assignments = a crash between flip and insert: this call finishes the job.
  if (ex.status === 'drawn') {
    if (await hasAssignments(ex.id)) fail(ERR.ALREADY_DRAWN);
  } else {
    await flip(ex);
  }

  // Members are frozen once the exchange is 'drawn', so reading them now is safe.
  const mems = await db.select().from(members).where(eq(members.exchangeId, ex.id)).all();
  const rows = derange(mems.map((m) => m.userId)).map((p) => ({ exchangeId: ex.id, ...p }));
  try {
    await db.insert(assignments).values(rows).run(); // one statement = atomic; unique indexes reject a second batch
  } catch (e) {
    if (await hasAssignments(ex.id)) fail(ERR.ALREADY_DRAWN); // another recovery won
    throw e;
  }

  // Only the request whose insert succeeded gets here: notifications go out once.
  const langs = new Map((await db.select().from(users)
    .where(sql`${users.id} in (select user_id from members where exchange_id = ${ex.id})`).all()).map((u) => [u.id, /** @type {import('../lib/types.js').Lang} */ (u.lang)]));
  const organiser = esc(mems.find((m) => m.userId === ex.organiserId)?.nickname ?? me.firstName);
  const exchange = esc(ex.name);
  for (const m of mems) {
    const lang = langs.get(m.userId) ?? 'en';
    await send(m.userId, t(lang, 'drawn', { exchange, organiser, budget: formatBudget(budgetOf(ex), lang) }),
      [[{ text: t(lang, 'btnSeeRecipient'), app: `#/x/${ex.id}/giftee` }]]);
  }
  return { ok: true };
}
