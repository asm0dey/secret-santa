import { api, BotApiError } from 'sdk';
import { instance } from './config.js';

// Tests replace hooks.sleep so a 429 does not really wait.
export const hooks = { sleep: (/** @type {number} */ s) => new Promise((r) => setTimeout(r, s * 1000)) };

/** @param {unknown} s */
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** @param {string} appUrl @returns {(b: { text: string, app?: string, url?: string, data?: string }) => object} */
const button = (appUrl) => ({ text, app, url, data }) =>
  app != null ? { text, web_app: { url: appUrl + app } } : url ? { text, url } : { text, callback_data: data };

/** @param {string} method @param {Record<string, any>} params */
async function call(method, params) {
  for (let retried = false; ; retried = true) {
    try {
      await api[method](params);
      return true;
    } catch (e) {
      const wait = e instanceof BotApiError && e.parameters?.retry_after;
      if (!wait || retried) return false;
      await hooks.sleep(wait);
    }
  }
}

/** @param {string} appUrl @param {import('./types.js').Button[][]} [buttons] */
const markup = (appUrl, buttons) => (buttons ? { reply_markup: { inline_keyboard: buttons.map((row) => row.map(button(appUrl))) } } : {});

/** The app URL, or null when the bot lookup fails (then nothing is sent: these helpers never throw). */
const appUrl = () => instance().then((i) => i.appUrl, () => null);

// text/caption must already be final HTML: escape interpolated params with esc().
/** @param {number} userId @param {string} text @param {import('./types.js').Button[][]} [buttons] */
export async function send(userId, text, buttons) {
  const base = await appUrl();
  return base != null && call('sendMessage', { chat_id: userId, text, parse_mode: 'HTML', ...markup(base, buttons) });
}

// photoPath is a file of the Mini App's static site, e.g. '/sorry.jpg'.
/** @param {number} userId @param {string} photoPath @param {string} caption @param {import('./types.js').Button[][]} [buttons] */
export async function sendPhoto(userId, photoPath, caption, buttons) {
  const base = await appUrl();
  return base != null && call('sendPhoto', { chat_id: userId, photo: base + photoPath, caption, parse_mode: 'HTML', ...markup(base, buttons) });
}
