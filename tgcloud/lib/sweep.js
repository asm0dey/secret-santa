import { db } from 'sdk';
import { eq, and, sql } from 'sdk/db';
import { exchanges } from '../schema.js';
import { closeExchange, wipeExchange } from './closing.js';

const RECENT = 86_400_000; // pass (b) only heals a crash mid-close or a write racing it: seconds, not history

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
  } catch (e) {
    console.error('sweep failed', e);
  }
}
