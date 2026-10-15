import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { api, sqlite } from 'sdk';
import { clock } from '../tgcloud/lib/clock.js';
import * as schema from '../tgcloud/schema.js';
import { forgetInstance } from '../tgcloud/lib/config.js';

/** @param {string} s */
const q = (s) => `"${s}"`;

/** @param {any} t */
function createSql(t) {
  const c = getTableConfig(t);
  const cols = c.columns.map((col) =>
    [q(col.name), col.getSQLType(),
      col.primary ? 'PRIMARY KEY' + (/** @type {any} */ (col).autoIncrement ? ' AUTOINCREMENT' : '') : '',
      col.notNull ? 'NOT NULL' : '',
      col.isUnique ? 'UNIQUE' : ''].filter(Boolean).join(' '));
  return [
    `CREATE TABLE ${q(c.name)} (${cols.join(', ')})`,
    ...c.indexes.map(({ config: i }) =>
      `CREATE ${i.unique ? 'UNIQUE ' : ''}INDEX ${q(i.name)} ON ${q(c.name)} (${i.columns.map((x) => q(/** @type {any} */ (x).name)).join(', ')})`),
  ];
}

export function resetDb() {
  for (const t of Object.values(schema)) {
    sqlite.run(`DROP TABLE IF EXISTS ${q(getTableConfig(t).name)}`);
    for (const stmt of createSql(t)) sqlite.run(stmt);
  }
  api.calls.length = 0;
  api.failFor = () => undefined;
  forgetInstance();
  restoreNow();
}

/** @param {{ id: number, start_param?: string } & Partial<import('../tgcloud/lib/types.js').TgUser>} p @returns {import('../tgcloud/lib/types.js').EndpointCtx} */
export const ctxFor = ({ start_param, ...user }) => ({ initData: { user: /** @type {any} */ (user), start_param } });

/** @param {number} ms */
export const setNow = (ms) => { clock.now = () => ms; };
export const restoreNow = () => { clock.now = () => Date.now(); };
