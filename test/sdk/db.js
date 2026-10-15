// Fake `sdk/db`: the Drizzle subset the platform documents.
import { sql as dsql, Table } from 'drizzle-orm';
export { sqliteTable as table, integer, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export { eq, and, desc, asc, count } from 'drizzle-orm';

/** Like Drizzle's `sql`, but rejects a table interpolated into the template, as the platform does ("db: unsupported value type: object"). */
export const sql = Object.assign(
  /** @type {typeof dsql} */ ((strings, ...params) => {
    if (params.some((p) => p instanceof Table)) throw new TypeError('db: unsupported value type: object');
    return dsql(strings, ...params);
  }),
  dsql,
);
