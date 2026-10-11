// Uniform float in [0, 1); crypto-backed when available. Shared with code.js.
export const defaultRand = () =>
  globalThis.crypto?.getRandomValues
    ? crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
    : Math.random();

// Random derangement: shuffle, retry while anyone draws themselves (~e tries).
export function derange(ids, rand = defaultRand) {
  if (ids.length < 3) throw new Error('TOO_FEW');
  for (;;) {
    const s = ids.slice();
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    if (ids.every((id, i) => id !== s[i])) return ids.map((santaId, i) => ({ santaId, gifteeId: s[i] }));
  }
}
