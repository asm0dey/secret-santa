import { db } from 'sdk';
import { eq } from 'sdk/db';
import { members, users } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { loadExchange } from '../lib/access.js';
import { displayCode } from '../lib/code.js';
import { BOT_USERNAME } from '../lib/config.js';
import { budgetOf } from '../lib/exchangeFields.js';
import { detailsOf, wishTag } from '../lib/details.js';

export default async function ({ id }, ctx) {
  const user = await enter(ctx);
  const ex = await loadExchange(id);
  const rows = await db.select().from(members).where(eq(members.exchangeId, ex.id)).orderBy(members.id).all();
  const mine = rows.find((m) => m.userId === user.id);
  const isOrganiser = ex.organiserId === user.id;
  if (!mine && !isOrganiser) fail(ERR.FORBIDDEN); // R4: the organiser may look before joining
  const org = await db.select().from(users).where(eq(users.id, ex.organiserId)).get();

  const view = {
    id: ex.id, name: ex.name, code: ex.code, displayCode: displayCode(ex.code),
    inviteLink: `https://t.me/${BOT_USERNAME}?startapp=${ex.code}`,
    status: ex.status, budget: budgetOf(ex), deadline: ex.deadline,
    isOrganiser, organiserName: org?.firstName ?? '',
    // Never address, wishlistUrl or wishes of anyone here.
    members: rows.map((m) => ({
      userId: m.userId, nickname: m.nickname, isMe: m.userId === user.id,
      isOrganiser: m.userId === ex.organiserId, tag: wishTag(m),
    })),
    me: mine ? detailsOf(mine) : null,
  };
  // Tasks 8 and 10 add the drawn-state fields here.
  return view;
}
