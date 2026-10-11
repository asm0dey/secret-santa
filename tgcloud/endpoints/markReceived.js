import { db } from 'sdk';
import { eq, and, sql, count } from 'sdk/db';
import { assignments, users } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { clock } from '../lib/clock.js';
import { loadExchange, requireMember, requireStatus } from '../lib/access.js';
import { send, esc } from '../lib/notify.js';
import { t } from '../lib/i18n.js';
import { closeExchange } from '../lib/closing.js';

/**
 * @param {{ id: number }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ ok: true }>}
 */
export default async function ({ id }, ctx) {
  const me = await enter(ctx);
  const ex = await loadExchange(id);
  await requireMember(ex, me.id);
  requireStatus(ex, 'drawn');
  const a = await db.select().from(assignments)
    .where(and(eq(assignments.exchangeId, ex.id), eq(assignments.gifteeId, me.id))).get();
  if (!a) fail(ERR.NOT_DRAWN);

  if (a.receivedAt == null) {
    await db.update(assignments).set({ receivedAt: clock.now() }).where(eq(assignments.id, a.id)).run();
    const lang = (await db.select().from(users).where(eq(users.id, a.santaId)).get())?.lang ?? 'en';
    await send(a.santaId, t(lang, 'giftReceived', { exchange: esc(ex.name) }));
  }
  // Checked on every call, so a retry also finishes a close that crashed half way.
  const { n } = /** @type {{ n: number }} */ (await db.select({ n: count() }).from(assignments)
    .where(and(eq(assignments.exchangeId, ex.id), sql`${assignments.receivedAt} is null`)).get());
  if (n === 0) await closeExchange(ex, 'complete');
  return { ok: true };
}
