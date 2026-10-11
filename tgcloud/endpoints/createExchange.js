import { db } from 'sdk';
import { eq } from 'sdk/db';
import { exchanges } from '../schema.js';
import { enter } from '../lib/session.js';
import { ERR, fail } from '../lib/errors.js';
import { clock } from '../lib/clock.js';
import { newCode } from '../lib/code.js';
import { cleanName, budgetColumns, deadlineColumns } from '../lib/exchangeFields.js';

export default async function ({ name, budget, deadline }, ctx) {
  const me = await enter(ctx);
  if (me.blocked) fail(ERR.BLOCKED);
  const row = {
    name: cleanName(name), ...budgetColumns(budget), ...deadlineColumns(deadline),
    organiserId: me.id, status: 'open', createdAt: clock.now(),
  };
  for (let i = 0; ; i++) {
    const code = newCode();
    try {
      await db.insert(exchanges).values({ ...row, code }).run();
    } catch (e) {
      if (i < 4) continue; // unique clash on code
      throw e;
    }
    const { id } = await db.select({ id: exchanges.id }).from(exchanges).where(eq(exchanges.code, code)).get();
    return { id, code };
  }
}
