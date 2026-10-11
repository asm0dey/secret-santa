import { db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { loadExchange, requireOrganiser } from '../lib/access.js';
import { overdueOf } from '../lib/overdue.js';
import { send, esc } from '../lib/notify.js';
import { t } from '../lib/i18n.js';

/**
 * The organiser writes to one overdue Santa as themselves (this is not the anonymous chat).
 * @param {{ id: number, santaUserId: number, text: string }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ ok: true, delivered: boolean }>}
 */
export default async function ({ id, santaUserId, text }, ctx) {
  const me = await enter(ctx);
  const ex = await loadExchange(id);
  requireOrganiser(ex, me.id);
  if (!Number.isInteger(santaUserId) || typeof text !== 'string') fail(ERR.BAD_INPUT);
  const body = text.trim();
  if (body.length < 1 || body.length > 1000) fail(ERR.BAD_INPUT);
  if (!(await overdueOf(ex)).some((o) => o.santaUserId === santaUserId)) fail(ERR.FORBIDDEN);

  const lang = (await db.select().from(users).where(eq(users.id, santaUserId)).get())?.lang ?? 'en';
  const organiser = esc(me.firstName);
  const html = t(lang, 'fromOrganiser', { organiser, exchange: esc(ex.name), text: esc(body) });
  const reply = { text: t(lang, 'btnReplyOrganiser', { organiser: me.firstName }), url: `tg://user?id=${ex.organiserId}` };
  // A tg://user button is refused for users with restrictive privacy settings: fall back to the bare message.
  const delivered = (await send(santaUserId, html, [[reply]])) || (await send(santaUserId, html));
  return { ok: true, delivered };
}
