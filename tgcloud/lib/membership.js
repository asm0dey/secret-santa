import { db } from 'sdk';
import { eq, and, sql } from 'sdk/db';
import { exchanges, members } from '../schema.js';
import { ERR, fail } from './errors.js';

export const MAX_MEMBERS = 100;

// Every membership write is ONE statement conditional on the exchange still being open, so it cannot
// land after the draw's open -> drawn flip (the read of ex.status before it may be stale).
const stillOpen = (id) => sql`exists (select 1 from exchanges where id = ${id} and status = 'open')`;

// After a refused write: say why, from a fresh read.
async function refuse(exchangeId) {
  const ex = await db.select().from(exchanges).where(eq(exchanges.id, exchangeId)).get() ?? fail(ERR.NOT_FOUND);
  if (ex.status === 'closed') fail(ERR.CLOSED);
  if (ex.status === 'drawn') fail(ERR.ALREADY_DRAWN);
}

const find = (exchangeId, userId) =>
  db.select().from(members).where(and(eq(members.exchangeId, exchangeId), eq(members.userId, userId))).get();

// cols: validated detailsColumns(). Fails ALREADY_DRAWN / CLOSED / FULL / ALREADY_MEMBER.
export async function addMember(exchangeId, userId, cols, joinedAt) {
  const c = cols;
  try {
    await db.run(sql`insert into members (exchange_id, user_id, nickname, address, wish_mode, wishlist_url, wishes, joined_at)
      select ${exchangeId}, ${userId}, ${c.nickname}, ${c.address}, ${c.wishMode}, ${c.wishlistUrl}, ${c.wishes}, ${joinedAt}
      where ${stillOpen(exchangeId)}
        and (select count(*) from members where exchange_id = ${exchangeId}) < ${MAX_MEMBERS}`);
  } catch (e) {
    if (await find(exchangeId, userId)) fail(ERR.ALREADY_MEMBER); // members_ex_user unique index
    throw e;
  }
  if (await find(exchangeId, userId)) return;
  await refuse(exchangeId);
  fail(ERR.FULL);
}

// Deletes a member row of an open exchange. Fails ALREADY_DRAWN / CLOSED if the exchange left 'open'.
export async function removeMemberRow(exchangeId, memberId) {
  await db.delete(members).where(and(eq(members.id, memberId), stillOpen(exchangeId))).run();
  if (await db.select().from(members).where(eq(members.id, memberId)).get()) await refuse(exchangeId);
}
