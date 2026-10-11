import { db } from 'sdk';
import { eq } from 'sdk/db';
import { users, blocks } from '../schema.js';
import { clock } from './clock.js';
import { langOf } from './i18n.js';
import { sweep } from './sweep.js';

export async function enter(ctx) {
  const u = ctx.initData.user;
  const prev = await db.select().from(users).where(eq(users.id, u.id)).get();
  const canMessage = u.allows_write_to_pm == null ? (prev?.canMessage ?? null) : u.allows_write_to_pm ? 1 : 0;
  const row = { firstName: u.first_name, username: u.username ?? null, lang: langOf(u.language_code), canMessage };
  if (prev) await db.update(users).set(row).where(eq(users.id, u.id)).run();
  else await db.insert(users).values({ id: u.id, ...row, createdAt: clock.now() }).run();

  await sweep(clock.now());

  const active = await db.select().from(blocks)
    .where(eq(blocks.userId, u.id)).all();
  const blocked = active.some((b) => b.decision == null || b.decision === 'kept');
  return { id: u.id, firstName: row.firstName, username: row.username, lang: row.lang, canMessage: canMessage == null ? null : !!canMessage, blocked };
}
