import { inTelegram, wa } from './tg.js';

// Dead code in a production build unless VITE_MOCK=1: the fixtures never ship to real users.
const MOCK = import.meta.env.DEV || import.meta.env.VITE_MOCK === '1';

/**
 * Calls a backend endpoint. Rejects with `{ code }`: the endpoint's ErrCode, or 'INTERNAL'.
 * Outside Telegram (no initData) it answers from the dev mock (dev server, or a build made with VITE_MOCK=1), loaded on demand.
 * @param {string} name
 * @param {Record<string, unknown>} [input]
 * @returns {Promise<any>}
 */
export function call(name, input = {}) {
  if (!inTelegram()) {
    if (!MOCK) return Promise.reject({ code: 'INTERNAL' });
    return import('../dev/mock.js').then(
      (m) => m.mockCall(name, input),
      () => Promise.reject({ code: 'INTERNAL' }),
    );
  }
  return new Promise((resolve, reject) => {
    /** @type {any} */ (wa()).Serverless.call(name, input, (/** @type {any} */ err, /** @type {any} */ result) => {
      if (err) reject({ code: err.parameters?.code ?? 'INTERNAL' });
      else resolve(result);
    });
  });
}
