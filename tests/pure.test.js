import { test, expect } from 'bun:test';
import { ALPHABET, newCode, normalizeCode, displayCode } from '../tgcloud/lib/code.js';
import { validateBudget, formatBudget } from '../tgcloud/lib/budget.js';
import { deadlineEnd, closeAtFor, isPast, isValidFutureDate } from '../tgcloud/lib/dates.js';
import { makeT, langOf, t } from '../tgcloud/lib/i18n.js';

const NB = ' ';

test('codes: normalize, generate, display', () => {
  expect(normalizeCode('k7q 4mx')).toBe('K7Q4MX');
  expect(normalizeCode('K7Q-4MX')).toBe('K7Q4MX');
  expect(normalizeCode('O0O0O0')).toBeNull();
  expect(normalizeCode('K7Q4M')).toBeNull();
  expect(normalizeCode('K7Q4MXX')).toBeNull();
  for (let i = 0; i < 200; i++) expect(newCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  expect(newCode(() => 0)).toBe(ALPHABET[0].repeat(6));
  expect(newCode(() => 0.999999)).toBe(/** @type {string} */ (ALPHABET.at(-1)).repeat(6));
  expect(displayCode('ABC234')).toBe('ABC-234');
});

test('formatBudget in both languages', () => {
  const cur = 'RUB';
  /** @type {[any, string, string][]} */
  const cases = [
    [{ kind: 'any' }, 'any budget', 'любой бюджет'],
    [{ kind: 'max', max: 3000, currency: cur }, `up to 3${NB}000 RUB`, `до 3${NB}000 RUB`],
    [{ kind: 'min', min: 1000, currency: cur }, `from 1${NB}000 RUB`, `от 1${NB}000 RUB`],
    [{ kind: 'range', min: 1000, max: 3000, currency: cur }, `1${NB}000–3${NB}000 RUB`, `1${NB}000–3${NB}000 RUB`],
    [{ kind: 'max', max: 500, currency: 'USD' }, 'up to 500 USD', 'до 500 USD'],
    [{ kind: 'min', min: 1234567, currency: 'EUR' }, `from 1${NB}234${NB}567 EUR`, `от 1${NB}234${NB}567 EUR`],
  ];
  for (const [b, en, ru] of cases) {
    expect(formatBudget(b, 'en')).toBe(en);
    expect(formatBudget(b, 'ru')).toBe(ru);
  }
});

test('validateBudget normalizes and rejects bad input', () => {
  expect(validateBudget({ kind: 'any' })).toEqual({ kind: 'any', min: null, max: null, currency: null });
  expect(validateBudget({ kind: 'any', min: 5, max: 9, currency: 'x' })).toEqual({ kind: 'any', min: null, max: null, currency: null });
  expect(validateBudget({ kind: 'max', max: 3000, currency: 'RUB' })).toEqual({ kind: 'max', min: null, max: 3000, currency: 'RUB' });
  expect(validateBudget({ kind: 'min', min: 1000, currency: 'RUB' })).toEqual({ kind: 'min', min: 1000, max: null, currency: 'RUB' });
  expect(validateBudget({ kind: 'range', min: 1000, max: 1000, currency: 'RUB' })).toEqual({ kind: 'range', min: 1000, max: 1000, currency: 'RUB' });
  const bad = [
    { kind: 'range', min: 3000, max: 1000, currency: 'RUB' },
    { kind: 'range', min: 1000, currency: 'RUB' },
    { kind: 'max', max: -5, currency: 'RUB' },
    { kind: 'max', max: 0, currency: 'RUB' },
    { kind: 'max', max: 1.5, currency: 'RUB' },
    { kind: 'max', max: '30', currency: 'RUB' },
    { kind: 'max', currency: 'RUB' },
    { kind: 'min', currency: 'RUB' },
    { kind: 'max', max: 30, currency: 'rub' },
    { kind: 'max', max: 30, currency: 'RU' },
    { kind: 'max', max: 30 },
    { kind: 'nope' },
    null,
  ];
  for (const b of bad) expect(validateBudget(b)).toBeNull();
});

test('dates: deadline is end of day UTC', () => {
  expect(deadlineEnd('2026-12-20')).toBe(Date.parse('2026-12-21T00:00:00Z'));
  expect(closeAtFor('2026-12-20')).toBe(Date.parse('2027-01-20T00:00:00Z'));
  expect(isPast('2026-12-20', Date.parse('2026-12-20T23:59:59Z'))).toBe(false);
  expect(isPast('2026-12-20', Date.parse('2026-12-21T00:00:00Z'))).toBe(true);
  const now = Date.parse('2026-10-11T12:00:00Z');
  expect(isValidFutureDate('2026-10-11', now)).toBe(true);
  expect(isValidFutureDate('2026-10-10', now)).toBe(false);
  expect(isValidFutureDate('2026-02-30', now)).toBe(false);
  expect(isValidFutureDate('2027-1-5', now)).toBe(false);
  expect(isValidFutureDate('garbage', now)).toBe(false);
  expect(isValidFutureDate(undefined, now)).toBe(false);
});

test('i18n: langOf, placeholders, fallback, unknown key', () => {
  expect(langOf('ru-RU')).toBe('ru');
  expect(langOf('ru')).toBe('ru');
  expect(langOf('en-US')).toBe('en');
  expect(langOf('de')).toBe('en');
  expect(langOf(undefined)).toBe('en');
  const tt = makeT({ en: { hi: 'Hi {name}, {name}!', only: 'only en' }, ru: { hi: 'Привет {name}' } });
  expect(tt('en', 'hi', { name: 'Bo' })).toBe('Hi Bo, Bo!');
  expect(tt('ru', 'hi', { name: 'Бо' })).toBe('Привет Бо');
  expect(tt('ru', 'only')).toBe('only en');
  expect(tt('en', 'hi')).toBe('Hi {name}, {name}!');
  expect(() => tt('en', 'nope')).toThrow();
  expect(() => tt('ru', 'nope')).toThrow();
  expect(t('ru', 'start')).toContain('Тайный Санта');
  expect(t('en', 'start')).toContain('Secret Santa');
});
