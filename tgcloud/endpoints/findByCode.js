import { db } from 'sdk';
import { eq, and, count } from 'sdk/db';
import { exchanges, members, users } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { normalizeCode } from '../lib/code.js';
import { budgetOf } from '../lib/exchangeFields.js';

export default async function ({ code }, ctx) {
  const me = await enter(ctx);
  const c = normalizeCode(code) ?? fail(ERR.NOT_FOUND);
  const ex = await db.select().from(exchanges).where(eq(exchanges.code, c)).get() ?? fail(ERR.NOT_FOUND);
  const org = await db.select().from(users).where(eq(users.id, ex.organiserId)).get();
  const { n } = await db.select({ n: count() }).from(members).where(eq(members.exchangeId, ex.id)).get();
  const mine = await db.select().from(members).where(and(eq(members.exchangeId, ex.id), eq(members.userId, me.id))).get();
  return {
    id: ex.id, name: ex.name, status: ex.status, budget: budgetOf(ex), deadline: ex.deadline,
    organiserName: org?.firstName ?? '', memberCount: n, isMember: !!mine,
  };
}
