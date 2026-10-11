import { defaultRand } from './draw.js';

// No 0/O/1/I/L: never ambiguous, so normalizeCode never has to guess.
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** @param {() => number} [rand] */
export const newCode = (rand = defaultRand) =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join('');

/** @param {unknown} input @returns {string | null} */
export function normalizeCode(input) {
  const c = String(input ?? '').replace(/[\s-]/g, '').toUpperCase();
  return c.length === 6 && [...c].every(ch => ALPHABET.includes(ch)) ? c : null;
}

/** @param {string} c */
export const displayCode = (c) => `${c.slice(0, 3)}-${c.slice(3)}`;
