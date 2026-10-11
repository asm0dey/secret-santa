import { db } from 'sdk';
import { eq } from 'sdk/db';
import { assignments, members, users } from '../schema.js';
import { clock } from './clock.js';
import { isPast } from './dates.js';

/**
 * Santas past the deadline who have neither sent nor had the gift received. Empty unless drawn and past due.
 * Callers must only expose the result to the organiser.
 * @param {import('./types.js').Exchange} ex
 * @returns {Promise<import('./types.js').OverdueRow[]>}
 */
export async function overdueOf(ex) {
  if (ex.status !== 'drawn' || !ex.deadline || !isPast(ex.deadline, clock.now())) return [];
  const [asgs, rows] = await Promise.all([
    db.select().from(assignments).where(eq(assignments.exchangeId, ex.id)).orderBy(assignments.id).all(),
    db.select().from(members).where(eq(members.exchangeId, ex.id)).all(),
  ]);
  /** @param {number} id */
  const who = async (id) => {
    const u = await db.select().from(users).where(eq(users.id, id)).get();
    return { name: rows.find((m) => m.userId === id)?.nickname ?? u?.firstName ?? '', username: u?.username ?? null };
  };
  const out = [];
  for (const a of asgs) {
    if (a.sentAt != null || a.receivedAt != null) continue;
    const [s, g] = [await who(a.santaId), await who(a.gifteeId)];
    out.push({ gifteeUserId: a.gifteeId, gifteeName: g.name, santaUserId: a.santaId, santaName: s.name, santaUsername: s.username });
  }
  return out;
}
