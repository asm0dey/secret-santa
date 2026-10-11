import { lang } from './i18n.js';

// "20 Dec" / "20 дек." everywhere. English uses en-GB for the day-first order.
const loc = lang === 'ru' ? 'ru' : 'en-GB';
const opts = /** @type {const} */ ({ day: 'numeric', month: 'short' });
const utcDay = new Intl.DateTimeFormat(loc, { ...opts, timeZone: 'UTC' });
const localDay = new Intl.DateTimeFormat(loc, opts);
const clock = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit' });

// A non-breaking space keeps "20 Dec" on one line.
/** @param {string} s */
const nb = (s) => s.replace(' ', '\u00a0');

/** A deadline (`YYYY-MM-DD`, a calendar date in UTC) or a timestamp (shown in the viewer's own day). @param {string | number} d */
export const shortDate = (d) => nb(typeof d === 'string' ? utcDay.format(Date.parse(`${d}T00:00:00Z`)) : localDay.format(d));

/** Chat time: just the time today, with the day before that. @param {number} ms @param {number} [now] */
export function stamp(ms, now = Date.now()) {
  const time = clock.format(ms);
  return localDay.format(ms) === localDay.format(now) ? time : `${nb(localDay.format(ms))} ${time}`;
}
