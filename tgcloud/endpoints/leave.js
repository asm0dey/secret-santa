import { db } from 'sdk';
import { eq } from 'sdk/db';
import { members } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { loadExchange, requireMember, requireStatus } from '../lib/access.js';

export default async function ({ id }, ctx) {
  const me = await enter(ctx);
  const ex = await loadExchange(id);
  const m = await requireMember(ex, me.id);
  if (ex.organiserId === me.id) fail(ERR.FORBIDDEN);
  requireStatus(ex, 'open');
  await db.delete(members).where(eq(members.id, m.id)).run();
  return { ok: true };
}
