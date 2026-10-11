// Fake `sdk/db`: the Drizzle subset the platform documents.
export { sqliteTable as table, integer, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export { eq, and, desc, asc, count, sql } from 'drizzle-orm';
