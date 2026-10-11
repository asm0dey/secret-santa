import { api, BotApiError } from 'sdk';
import { APP_URL } from './config.js';

// Tests replace hooks.sleep so a 429 does not really wait.
export const hooks = { sleep: (s) => new Promise((r) => setTimeout(r, s * 1000)) };

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const button = ({ text, app, url, data }) =>
  app != null ? { text, web_app: { url: APP_URL + app } } : url ? { text, url } : { text, callback_data: data };

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

const markup = (buttons) => (buttons ? { reply_markup: { inline_keyboard: buttons.map((row) => row.map(button)) } } : {});

// text/caption must already be final HTML: escape interpolated params with esc().
export const send = (userId, text, buttons) =>
  call('sendMessage', { chat_id: userId, text, parse_mode: 'HTML', ...markup(buttons) });

export const sendPhoto = (userId, photoUrl, caption, buttons) =>
  call('sendPhoto', { chat_id: userId, photo: photoUrl, caption, parse_mode: 'HTML', ...markup(buttons) });
