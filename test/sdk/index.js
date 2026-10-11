// Fake `sdk`: Drizzle over in-memory bun:sqlite plus a recording Bot API proxy.
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

export class EndpointError extends Error {
  constructor(description, parameters) {
    super(description);
    this.parameters = parameters;
  }
}
export class BotApiError extends Error {
  constructor(description, parameters) {
    super(description);
    this.parameters = parameters;
  }
}

export const sqlite = new Database(':memory:'); // test-only: used by resetDb
export const db = drizzle(sqlite);

// api.calls records every call; set api.failFor = (method, params) => error|undefined to inject failures.
const state = { calls: [], failFor: () => undefined };
export const api = new Proxy(state, {
  get(t, prop) {
    if (prop in t) return t[prop];
    return async (params) => {
      const err = t.failFor(prop, params);
      if (err) throw err instanceof Error ? err : new BotApiError(String(err));
      t.calls.push({ method: prop, params });
      return { message_id: t.calls.length };
    };
  },
  set(t, prop, v) { t[prop] = v; return true; },
});
