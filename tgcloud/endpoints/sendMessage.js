import { db } from 'sdk';
import { eq } from 'sdk/db';
import { messages, users } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { clock } from '../lib/clock.js';
import { openThread } from '../lib/thread.js';
import { send, esc } from '../lib/notify.js';
import { t } from '../lib/i18n.js';

/**
 * @param {{ id: number, side: 'giftee' | 'santa', text: string }} input
 * @param {import('../lib/types.js').EndpointCtx} ctx
 * @returns {Promise<{ ok: true }>}
 */
export default async function ({ id, side, text }, ctx) {
  const me = await enter(ctx);
  const { ex, a } = await openThread(id, side, me.id);
  if (typeof text !== 'string') fail(ERR.BAD_INPUT);
  const body = text.trim();
  if (body.length < 1 || body.length > 2000) fail(ERR.BAD_INPUT);

  const fromSanta = side === 'giftee';
  await db.insert(messages).values({ exchangeId: ex.id, assignmentId: a.id, fromSanta: fromSanta ? 1 : 0, text: body, createdAt: clock.now() }).run();

  // The notice carries neither names nor the text: only that something arrived.
  const to = fromSanta ? a.gifteeId : a.santaId;
  const lang = (await db.select().from(users).where(eq(users.id, to)).get())?.lang ?? 'en';
  await send(to, t(lang, fromSanta ? 'newFromSanta' : 'newFromGiftee', { exchange: esc(ex.name) }),
    [[{ text: t(lang, 'btnOpenChat'), app: `#/x/${ex.id}/chat/${fromSanta ? 'santa' : 'giftee'}` }]]);
  return { ok: true };
}
