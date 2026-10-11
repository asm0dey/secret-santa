import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { members, users } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { loadExchange, requireOrganiser, requireStatus } from '../lib/access.js';
import { send, esc } from '../lib/notify.js';
import { t } from '../lib/i18n.js';

export default async function ({ id, userId }, ctx) {
  const me = await enter(ctx);
  const ex = await loadExchange(id);
  requireOrganiser(ex, me.id);
  requireStatus(ex, 'open');
  if (userId === ex.organiserId) fail(ERR.FORBIDDEN);
  const m = await db.select().from(members).where(and(eq(members.exchangeId, ex.id), eq(members.userId, userId))).get() ?? fail(ERR.NOT_FOUND);
  await db.delete(members).where(eq(members.id, m.id)).run();
  const u = await db.select().from(users).where(eq(users.id, userId)).get();
  await send(userId, t(u?.lang ?? 'en', 'removed', { exchange: esc(ex.name) }));
  return { ok: true };
}
