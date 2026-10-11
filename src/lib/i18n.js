import { wa } from './tg.js';
import { langOf, makeT } from '../../tgcloud/lib/i18n.js';
import en from './strings/en.js';
import ru from './strings/ru.js';

// Dev only (no Telegram user): `?lang=ru` previews Russian.
const code = wa()?.initDataUnsafe?.user?.language_code
  ?? (globalThis.location ? new URLSearchParams(location.search).get('lang') : null);

export const lang = langOf(code);

const tr = makeT({ en, ru });

/** @param {string} key @param {Record<string, string | number>} [params] */
export const t = (key, params) => tr(lang, key, params);

/** Localized message for a backend ErrCode (or anything else: INTERNAL). @param {unknown} code */
export const errorText = (code) => {
  const key = `errors.${code}`;
  return t(key in en ? key : 'errors.INTERNAL');
};
