import { db } from 'sdk';
import { eq } from 'sdk/db';
import { clock } from '../lib/clock.js';
import { giftStatus } from '../lib/giftStatus.js';
import { members, users, assignments } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { loadExchange } from '../lib/access.js';
import { displayCode } from '../lib/code.js';
import { instance } from '../lib/config.js';
import { budgetOf } from '../lib/exchangeFields.js';
import { overdueOf } from '../lib/overdue.js';
import { detailsOf, wishTag } from '../lib/details.js';

/**
 * @param {{ id: number }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<import('../lib/types.js').ExchangeView>}
 */
export default async function ({ id }, ctx) {
  const user = await enter(ctx);
  const ex = await loadExchange(id);
  const rows = await db.select().from(members).where(eq(members.exchangeId, ex.id)).orderBy(members.id).all();
  const mine = rows.find((m) => m.userId === user.id);
  const isOrganiser = ex.organiserId === user.id;
  if (!mine && !isOrganiser) fail(ERR.FORBIDDEN); // R4: the organiser may look before joining
  const org = await db.select().from(users).where(eq(users.id, ex.organiserId)).get();

  const asgs = ex.status === 'open' ? [] : await db.select().from(assignments).where(eq(assignments.exchangeId, ex.id)).all();
  const asSanta = asgs.find((a) => a.santaId === user.id);
  const asGiftee = asgs.find((a) => a.gifteeId === user.id);
  const live = ex.status === 'drawn'; // closed exchanges keep no personal data
  const target = live && asSanta ? rows.find((m) => m.userId === asSanta.gifteeId) : undefined;
  if (live && asSanta && asSanta.seenAt == null) {
    await db.update(assignments).set({ seenAt: clock.now() }).where(eq(assignments.id, asSanta.id)).run();
  }

  return {
    id: ex.id, name: ex.name, code: ex.code, displayCode: displayCode(ex.code),
    inviteLink: `https://t.me/${(await instance()).botUsername}?startapp=${ex.code}`,
    status: ex.status, budget: budgetOf(ex), deadline: ex.deadline,
    isOrganiser, organiserName: org?.firstName ?? '',
    // Never address, wishlistUrl or wishes of anyone here.
    members: rows.map((m) => ({
      userId: m.userId, nickname: m.nickname, isMe: m.userId === user.id,
      isOrganiser: m.userId === ex.organiserId, tag: wishTag(m),
    })),
    me: mine ? detailsOf(mine) : null,
    drawPending: ex.status === 'drawn' && asgs.length === 0,
    // Only the Santa gets the giftee's private details, and the giftee never gets anything naming the Santa.
    giftee: target && asSanta ? { ...detailsOf(target), sentAt: asSanta.sentAt, tracking: asSanta.tracking } : null,
    myGift: live && asGiftee ? { status: giftStatus(asGiftee), tracking: asGiftee.tracking, sentAt: asGiftee.sentAt } : null,
    progress: rows.flatMap((m) => {
      const a = asgs.find((x) => x.gifteeId === m.userId);
      return a ? [{ userId: m.userId, nickname: m.nickname, gift: giftStatus(a) }] : [];
    }),
    // Names the late Santas: the organiser alone ever gets them.
    overdue: isOrganiser ? await overdueOf(ex) : [],
  };
}
