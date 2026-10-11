import { test, expect } from 'bun:test';
import { ERR } from '../tgcloud/lib/errors.js';
import { resolveTheme } from '../src/lib/theme.js';
import en from '../src/lib/strings/en.js';
import ru from '../src/lib/strings/ru.js';
import { parse, fromStartParam } from '../src/lib/router.js';

test('theme: pref + scheme resolve to a daisyUI theme', () => {
  expect(resolveTheme('auto', 'dark')).toBe('tgdark');
  expect(resolveTheme('auto', 'light')).toBe('tglight');
  expect(resolveTheme('light', 'dark')).toBe('tglight');
  expect(resolveTheme('dark', 'light')).toBe('tgdark');
  expect(resolveTheme('christmas', 'light')).toBe('christmas');
  expect(resolveTheme('christmas', 'dark')).toBe('christmas');
});

test('strings: en and ru have identical keys and placeholders, none empty', () => {
  expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  const slots = (/** @type {string} */ s) => (s.match(/\{\w+\}/g) ?? []).sort();
  for (const [k, v] of Object.entries(en)) {
    expect(v.trim()).not.toBe('');
    expect(/** @type {Record<string, string>} */ (ru)[k].trim()).not.toBe('');
    expect(slots(/** @type {Record<string, string>} */ (ru)[k]), k).toEqual(slots(v));
  }
});

test('strings: every ERR code has a localized message, plus INTERNAL', () => {
  for (const code of [...Object.values(ERR), 'INTERNAL']) {
    expect(en).toHaveProperty([`errors.${code}`]);
    expect(ru).toHaveProperty([`errors.${code}`]);
  }
  expect(en['errors.NOT_FOUND']).toBe('No exchange with this code');
  expect(ru['errors.NOT_FOUND']).toBe('Обмен с таким кодом не найден');
});

test('router: hash parsing', () => {
  expect(parse('#/x/12/chat/santa')).toEqual({ name: 'chat', params: { id: '12', side: 'santa' } });
  expect(parse('#/x/12/chat/giftee')).toEqual({ name: 'chat', params: { id: '12', side: 'giftee' } });
  expect(parse('')).toEqual({ name: 'home', params: {} });
  expect(parse('#/')).toEqual({ name: 'home', params: {} });
  expect(parse('#/new')).toEqual({ name: 'new', params: {} });
  expect(parse('#/join/K7Q4MX')).toEqual({ name: 'join', params: { code: 'K7Q4MX' } });
  expect(parse('#/x/12')).toEqual({ name: 'exchange', params: { id: '12' } });
  expect(parse('#/x/12/gift')).toEqual({ name: 'exchange', params: { id: '12', tab: 'gift' } });
  expect(parse('#/x/12/progress')).toEqual({ name: 'exchange', params: { id: '12', tab: 'progress' } });
  expect(parse('#/x/12/giftee')).toEqual({ name: 'exchange', params: { id: '12', tab: 'giftee' } });
  expect(parse('#/x/12/edit')).toEqual({ name: 'edit', params: { id: '12' } });
  expect(parse('#/x/12/details')).toEqual({ name: 'details', params: { id: '12' } });
  expect(parse('#/blocked')).toEqual({ name: 'blocked', params: {} });
  expect(parse('#/appeal/3')).toEqual({ name: 'appeal', params: { blockId: '3' } });
  expect(parse('#/x/12/chat/nobody')).toEqual({ name: 'home', params: {} });
  expect(parse('#/nonsense')).toEqual({ name: 'home', params: {} });
});

test('router: start param maps to a hash', () => {
  expect(fromStartParam('x12_gift')).toBe('#/x/12/gift');
  expect(fromStartParam('x12')).toBe('#/x/12');
  expect(fromStartParam('x12_chat_santa')).toBe('#/x/12/chat/santa');
  expect(fromStartParam('K7Q-4MX')).toBe('#/join/K7Q4MX');
  expect(fromStartParam('k7q4mx')).toBe('#/join/K7Q4MX');
  expect(fromStartParam('x23456')).toBe('#/x/23456'); // lowercase x + digits is an exchange id, not a code
  expect(fromStartParam('')).toBeNull();
  expect(fromStartParam(null)).toBeNull();
  expect(fromStartParam('garbage!')).toBeNull();
});
