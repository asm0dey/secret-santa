import { test, expect } from 'bun:test';
import { api, BotApiError } from 'sdk';
import { resetDb, setNow, ctxFor } from '../test/helpers.js';
import { clock } from '../tgcloud/lib/clock.js';
import { fail } from '../tgcloud/lib/errors.js';

test('fake api records calls, can fail, and resetDb clears it', async () => {
  resetDb();
  expect(await api.sendMessage({ chat_id: 1 })).toEqual({ message_id: 1 });
  expect(api.calls).toEqual([{ method: 'sendMessage', params: { chat_id: 1 } }]);
  api.failFor = (m) => (m === 'sendMessage' ? new BotApiError('blocked') : undefined);
  await expect(api.sendMessage({ chat_id: 2 })).rejects.toBeInstanceOf(BotApiError);
  resetDb();
  expect(api.calls).toEqual([]);
  await api.sendMessage({ chat_id: 3 }); // failFor reset too
});

test('setNow overrides the clock until resetDb', () => {
  setNow(42);
  expect(clock.now()).toBe(42);
  resetDb();
  expect(clock.now()).toBeGreaterThan(1e12);
});

test('ctxFor and fail', () => {
  expect(ctxFor({ id: 1, start_param: 'ABC' })).toEqual(/** @type {any} */ ({ initData: { user: { id: 1 }, start_param: 'ABC' } }));
  try { fail('FULL'); } catch (/** @type {any} */ e) { expect(e.parameters).toEqual({ code: 'FULL' }); expect(e.message).toBe('FULL'); }
});
