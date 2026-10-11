import { test, expect } from 'bun:test';
import { db } from 'sdk';
import { resetDb } from '../test/helpers.js';
import { assignments, members, exchanges } from '../tgcloud/schema.js';

test('tables exist and pairing uniqueness is enforced', async () => {
  resetDb();
  await db.insert(assignments).values({ exchangeId: 1, santaId: 10, gifteeId: 20 }).run();
  await expect(async () => { await db.insert(assignments).values({ exchangeId: 1, santaId: 10, gifteeId: 30 }).run(); }).toThrow();
  await expect(async () => { await db.insert(assignments).values({ exchangeId: 1, santaId: 40, gifteeId: 20 }).run(); }).toThrow();
  await db.insert(assignments).values({ exchangeId: 2, santaId: 10, gifteeId: 20 }).run(); // other exchange ok
});

test('one membership per user per exchange', async () => {
  resetDb();
  await db.insert(members).values({ exchangeId: 1, userId: 5 }).run();
  await expect(async () => { await db.insert(members).values({ exchangeId: 1, userId: 5 }).run(); }).toThrow();
  await db.insert(members).values({ exchangeId: 2, userId: 5 }).run();
});

test('exchange code is unique', async () => {
  resetDb();
  const row = { code: 'ABC234', name: 'x', organiserId: 1 };
  await db.insert(exchanges).values(row).run();
  await expect(async () => { await db.insert(exchanges).values(row).run(); }).toThrow();
});
