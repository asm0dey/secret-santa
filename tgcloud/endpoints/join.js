import { db } from 'sdk';
import { eq, and, count } from 'sdk/db';
import { exchanges, members } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { clock } from '../lib/clock.js';
import { normalizeCode } from '../lib/code.js';
import { requireStatus } from '../lib/access.js';
import { detailsColumns } from '../lib/details.js';

export const MAX_MEMBERS = 100;

export default async function ({ code, details }, ctx) {
  const me = await enter(ctx);
  if (me.blocked) fail(ERR.BLOCKED);
  const c = normalizeCode(code) ?? fail(ERR.NOT_FOUND);
  const ex = await db.select().from(exchanges).where(eq(exchanges.code, c)).get() ?? fail(ERR.NOT_FOUND);
  requireStatus(ex, 'open');
  const already = await db.select().from(members).where(and(eq(members.exchangeId, ex.id), eq(members.userId, me.id))).get();
  if (already) fail(ERR.ALREADY_MEMBER);
  const cols = detailsColumns(details);
  const { n } = await db.select({ n: count() }).from(members).where(eq(members.exchangeId, ex.id)).get();
  if (n >= MAX_MEMBERS) fail(ERR.FULL);
  // ponytail: concurrent joins at 99 members could overshoot 100; invocations are serial per DB in practice.
  await db.insert(members).values({ exchangeId: ex.id, userId: me.id, ...cols, joinedAt: clock.now() }).run();
  return { id: ex.id };
}
