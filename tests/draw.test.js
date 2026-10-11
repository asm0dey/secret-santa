import { test, expect } from 'bun:test';
import { derange } from '../tgcloud/lib/draw.js';

test('every member gives once and receives once, never to self, n=3..100', () => {
  for (let n = 3; n <= 100; n++) {
    const ids = Array.from({ length: n }, (_, i) => 1000 + i);
    const pairs = derange(ids);
    expect(pairs.length).toBe(n);
    expect(new Set(pairs.map(p => p.santaId))).toEqual(new Set(ids));
    expect(new Set(pairs.map(p => p.gifteeId))).toEqual(new Set(ids));
    expect(pairs.every(p => p.santaId !== p.gifteeId)).toBe(true);
  }
});

test('mutual pairs are possible (not always one cycle)', () => {
  let mutual = false;
  for (let i = 0; i < 2000 && !mutual; i++) {
    const g = new Map(derange([1, 2, 3, 4]).map(p => [p.santaId, p.gifteeId]));
    mutual = [1, 2, 3, 4].some(a => g.get(g.get(a)) === a);
  }
  expect(mutual).toBe(true);
});

test('uses the injected rand and does not mutate input', () => {
  const ids = [1, 2, 3];
  let k = 0, x = 12345;
  const lcg = () => { k++; x = (x * 1664525 + 1013904223) % 2 ** 32; return x / 2 ** 32; };
  const pairs = derange(ids, lcg);
  expect(ids).toEqual([1, 2, 3]);
  expect(pairs.every(p => p.santaId !== p.gifteeId)).toBe(true);
  expect(k).toBeGreaterThan(0);
});

test('fewer than 3 throws', () => expect(() => derange([1, 2])).toThrow('TOO_FEW'));
