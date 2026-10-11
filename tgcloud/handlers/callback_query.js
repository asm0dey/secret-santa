import { api, db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { blockSanta, decideAppeal } from '../lib/moderation.js';
import { langOf, t } from '../lib/i18n.js';

const ERROR_TEXT = /** @type {Record<string, string>} */ ({ FORBIDDEN: 'errForbidden', NOT_FOUND: 'errNotFound', NOT_YET: 'errNotYet' });

// Ids are plain decimal integers, nothing else.
/** @param {string} s */
const int = (s) => (/^\d{1,16}$/.test(s) && Number.isSafeInteger(Number(s)) ? Number(s) : NaN);

// block:<exId>:<santaId> | letgo:<exId>:<santaId> | appeal:<blockId>:unblock|keep. Acts as query.from.id.
/** @param {string | undefined} data @param {number} userId */
async function run(data, userId) {
  const [kind, a, b, ...rest] = String(data ?? '').split(':');
  if (rest.length || Number.isNaN(int(a))) throw new EndpointError('BAD_INPUT', { code: 'BAD_INPUT' });
  if (kind === 'block' && !Number.isNaN(int(b))) return blockSanta(userId, int(a), int(b));
  if (kind === 'letgo' && !Number.isNaN(int(b))) return;
  if (kind === 'appeal' && (b === 'unblock' || b === 'keep')) return decideAppeal(userId, int(a), b);
  throw new EndpointError('BAD_INPUT', { code: 'BAD_INPUT' });
}

/**
 * @param {import('../lib/types.js').CallbackQuery} query
 * @param {unknown} _ctx
 */
export default async function (query, _ctx) {
  // The stored language if we can read it; the query is answered either way.
  /** @type {string} */
  let lang = langOf(query.from.language_code);
  try { lang = (await db.select().from(users).where(eq(users.id, query.from.id)).get())?.lang ?? lang; } catch (e) { console.error('callback_query: user lookup failed', e); }
  let ok = false;
  let text = t(lang, 'done');
  try {
    await run(query.data, query.from.id);
    ok = true;
  } catch (e) {
    if (!(e instanceof EndpointError)) console.error('callback_query failed', e);
    text = t(lang, ERROR_TEXT[e instanceof EndpointError ? e.parameters?.code : ''] ?? 'errGeneric');
  }
  try { await api.answerCallbackQuery({ callback_query_id: query.id, text }); } catch (e) { console.error('answerCallbackQuery failed', e); }
  if (ok && query.message) {
    try {
      await api.editMessageReplyMarkup({ chat_id: query.message.chat.id, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } });
    } catch { /* already gone or unchanged */ }
  }
}
