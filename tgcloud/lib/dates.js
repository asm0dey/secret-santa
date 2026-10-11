const DAY = 86_400_000;

// A deadline date passes at the end of that day, UTC.
export const deadlineEnd = (d) => Date.parse(`${d}T00:00:00Z`) + DAY;
export const closeAtFor = (d) => deadlineEnd(d) + 30 * DAY;
export const isPast = (d, now) => now >= deadlineEnd(d);

export function isValidFutureDate(d, now) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const ms = Date.parse(`${d}T00:00:00Z`);
  // round-trip rejects impossible dates like 2026-02-30
  return !Number.isNaN(ms) && new Date(ms).toISOString().startsWith(d) && deadlineEnd(d) > now;
}
