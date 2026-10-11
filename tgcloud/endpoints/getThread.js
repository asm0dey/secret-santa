import { db } from 'sdk';
import { eq, and, asc } from 'sdk/db';
import { members, messages } from '../schema.js';
import { enter } from '../lib/session.js';
import { openThread } from '../lib/thread.js';

/**
 * @param {{ id: number, side: 'giftee' | 'santa' }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ title: string | null, exchangeName: string, messages: { mine: boolean, text: string | null, at: number | null }[] }>}
 */
export default async function ({ id, side }, ctx) {
  const me = await enter(ctx);
  const { ex, a } = await openThread(id, side, me.id);
  const rows = await db.select().from(messages).where(eq(messages.assignmentId, a.id))
    .orderBy(asc(messages.createdAt), asc(messages.id)).all();
  // Santa side only: the giftee's nickname. The giftee side gets null, never anything about the Santa.
  const title = side === 'giftee'
    ? ((await db.select().from(members).where(and(eq(members.exchangeId, ex.id), eq(members.userId, a.gifteeId))).get())?.nickname ?? null)
    : null;
  return {
    title,
    exchangeName: ex.name,
    messages: rows.map((m) => ({ mine: (m.fromSanta === 1) === (side === 'giftee'), text: m.text, at: m.createdAt })),
  };
}
