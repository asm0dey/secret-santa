import { db } from 'sdk';
import { eq, and, desc, count, sql } from 'sdk/db';
import { exchanges, members, assignments, blocks } from '../schema.js';
import { enter } from '../lib/session.js';

/**
 * @param {{}} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 */
export default async function ({}, ctx) {
  const me = await enter(ctx);
  const mine = await db.select().from(exchanges)
    .where(sql`${exchanges.organiserId} = ${me.id} or ${exchanges.id} in (select ${members.exchangeId} from ${members} where ${members.userId} = ${me.id})`)
    .orderBy(desc(exchanges.createdAt), desc(exchanges.id)).all();

  const list = [];
  for (const ex of mine) {
    const { n } = /** @type {{ n: number }} */ (await db.select({ n: count() }).from(members).where(eq(members.exchangeId, ex.id)).get());
    let view = ex.status === 'open' ? 'waiting' : ex.status === 'closed' ? 'closed' : 'drawn';
    if (view === 'drawn') {
      const a = await db.select().from(assignments)
        .where(and(eq(assignments.exchangeId, ex.id), eq(assignments.santaId, me.id))).get();
      if (a && a.seenAt == null) view = 'see';
    }
    list.push({ id: ex.id, name: ex.name, status: ex.status, view, isOrganiser: ex.organiserId === me.id, memberCount: n });
  }

  const active = (await db.select().from(blocks).where(eq(blocks.userId, me.id)).orderBy(blocks.id).all())
    .filter((b) => b.decision == null || b.decision === 'kept')
    .map((b) => ({ id: b.id, exchangeName: b.exchangeName, createdAt: b.createdAt, appealed: b.appealAt != null, decision: b.decision }));

  return { me: { id: me.id, firstName: me.firstName, lang: me.lang, blocks: active }, exchanges: list };
}
