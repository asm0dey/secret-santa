import { send } from '../lib/notify.js';
import { langOf, t } from '../lib/i18n.js';

// The bot is mini-app only: /start (with or without a payload) gets an Open button, everything else is ignored.
/**
 * @param {import('../lib/types.js').BotMessage} message
 * @param {unknown} _ctx
 */
export default async function (message, _ctx) {
  if (!/^\/start(@\w+)?(\s|$)/.test(message.text ?? '')) return;
  const lang = langOf(message.from?.language_code);
  await send(message.chat.id, t(lang, 'start'), [[{ text: t(lang, 'btnOpen'), app: '#/' }]]);
}
