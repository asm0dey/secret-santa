// Fake `sdk`: Drizzle over in-memory bun:sqlite plus a recording Bot API proxy.
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

export class EndpointError extends Error {
  /** @param {string} description @param {any} [parameters] */
  constructor(description, parameters) {
    super(description);
    this.parameters = parameters;
  }
}
export class BotApiError extends Error {
  /** @param {string} description @param {any} [parameters] */
  constructor(description, parameters) {
    super(description);
    this.parameters = parameters;
  }
}

export const sqlite = new Database(':memory:'); // test-only: used by resetDb
export const db = drizzle(sqlite);

// api.calls records every call; set api.failFor = (method, params) => error|undefined to inject failures.
/** @type {{ calls: { method: string, params: any }[], failFor: (method: string, params: any) => unknown } & Record<string, any>} */
const state = { calls: [], failFor: () => undefined };
export const api = new Proxy(state, {
  get(t, /** @type {string} */ prop) {
    if (prop in t) return t[prop];
    return async (/** @type {any} */ params) => {
      const err = t.failFor(prop, params);
      if (err) throw err instanceof Error ? err : new BotApiError(String(err));
      t.calls.push({ method: prop, params });
      return { message_id: t.calls.length };
    };
  },
  set(t, /** @type {string} */ prop, v) { t[prop] = v; return true; },
});
