import { db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { clock } from '../lib/clock.js';
import { isPast } from '../lib/dates.js';
import { loadExchange, requireOrganiser, requireStatus } from '../lib/access.js';
import { overdueOf } from '../lib/overdue.js';
import { send, esc } from '../lib/notify.js';
import { t } from '../lib/i18n.js';

/**
 * Reminds every overdue Santa who is not blocked. The text names nobody.
 * @param {{ id: number }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ sent: number }>}
 */
export default async function ({ id }, ctx) {
  const me = await enter(ctx);
  const ex = await loadExchange(id);
  requireOrganiser(ex, me.id);
  requireStatus(ex, 'drawn');
  if (!ex.deadline || !isPast(ex.deadline, clock.now())) fail(ERR.NOT_YET);
  let sent = 0;
  for (const o of (await overdueOf(ex)).filter((r) => !r.blocked)) {
    const lang = (await db.select().from(users).where(eq(users.id, o.santaUserId)).get())?.lang ?? 'en';
    if (await send(o.santaUserId, t(lang, 'nudge', { exchange: esc(ex.name), deadline: ex.deadline }),
      [[{ text: t(lang, 'btnOpenGiftee'), app: `#/x/${ex.id}/giftee` }]])) sent++;
  }
  return { sent };
}
