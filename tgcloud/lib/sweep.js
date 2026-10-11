import { db } from 'sdk';
import { eq, and, sql } from 'sdk/db';
import { exchanges, members } from '../schema.js';
import { closeExchange, wipeExchange } from './closing.js';

const RECENT = 7 * 86_400_000; // pass (b) heals a crash mid-close or a write racing it; a week covers a crash followed by an idle bot

// Piggybacks on every endpoint call (see session.enter). Never throws: one bad exchange must not break everyone's requests.
/** @param {number} now */
export async function sweep(now) {
  try {
    // One per call, oldest first: keeps the latency off the unrelated caller.
    const due = await db.select().from(exchanges)
      .where(and(eq(exchanges.status, 'drawn'), sql`${exchanges.closeAt} <= ${now}`)).orderBy(exchanges.closeAt).limit(1).all();
    for (const ex of due) {
      try { await closeExchange(ex, 'timeout'); } catch (e) { console.error('sweep: close failed', ex.id, e); }
    }
    // Heal a crash between the close flip and the wipe, or a write that raced the close (recently closed only; the flip stamps closedAt). Silent.
    const dirty = await db.select().from(exchanges).where(sql`${exchanges.status} = 'closed' and ${exchanges.closedAt} > ${now - RECENT} and (
      exists (select 1 from members where exchange_id = ${exchanges.id} and (address is not null or wishlist_url is not null or wishes is not null))
      or exists (select 1 from assignments where exchange_id = ${exchanges.id} and tracking is not null)
      or exists (select 1 from messages where exchange_id = ${exchanges.id}))`).limit(5).all();
    for (const ex of dirty) {
      try { await wipeExchange(ex.id); } catch (e) { console.error('sweep: wipe failed', ex.id, e); }
    }
    // Member rows left by a crash inside cancelExchange (its exchange row goes first), a few per call.
    // ponytail: anti-join scans members on every call; fine at this bot's size, move to a periodic pass if members grows large.
    await db.delete(members).where(sql`${members.id} in (select id from members where exchange_id not in (select id from exchanges) limit 20)`).run();
  } catch (e) {
    console.error('sweep failed', e);
  }
}
