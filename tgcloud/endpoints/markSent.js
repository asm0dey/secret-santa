import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { assignments, users } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { clock } from '../lib/clock.js';
import { loadExchange, requireMember, requireStatus } from '../lib/access.js';
import { send, esc } from '../lib/notify.js';
import { t } from '../lib/i18n.js';

/**
 * @param {{ id: number, tracking?: string | null }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ ok: true }>}
 */
export default async function ({ id, tracking }, ctx) {
  const me = await enter(ctx);
  const ex = await loadExchange(id);
  await requireMember(ex, me.id);
  requireStatus(ex, 'drawn');
  if (tracking != null && typeof tracking !== 'string') fail(ERR.BAD_INPUT);
  const track = tracking?.trim() || null;
  if (track && track.length > 64) fail(ERR.BAD_INPUT);
  const a = await db.select().from(assignments)
    .where(and(eq(assignments.exchangeId, ex.id), eq(assignments.santaId, me.id))).get();
  if (!a) fail(ERR.NOT_DRAWN);

  // Re-sending is fine: sentAt keeps the first time, a changed tracking is stored and the giftee told again.
  const changed = a.sentAt == null || (track != null && track !== a.tracking);
  await db.update(assignments).set({ sentAt: a.sentAt ?? clock.now(), tracking: track ?? a.tracking }).where(eq(assignments.id, a.id)).run();
  if (changed && a.receivedAt == null) {
    const lang = (await db.select().from(users).where(eq(users.id, a.gifteeId)).get())?.lang ?? 'en';
    const shown = track ?? a.tracking;
    await send(a.gifteeId,
      t(lang, 'giftSent', { exchange: esc(ex.name) }) + (shown ? t(lang, 'giftSentTracking', { tracking: esc(shown) }) : ''),
      [[{ text: t(lang, 'btnMyGift'), app: `#/x/${ex.id}/gift` }]]);
  }
  return { ok: true };
}
