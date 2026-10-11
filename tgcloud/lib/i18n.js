export const langOf = (code) => (String(code ?? '').toLowerCase().startsWith('ru') ? 'ru' : 'en');

export const makeT = (dict) => (lang, key, params = {}) => {
  const s = dict[lang]?.[key] ?? dict.en[key];
  if (s === undefined) throw new Error(`i18n: unknown key "${key}"`);
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
};

// Bot strings. Later tasks add keys to both languages.
export const BOT = {
  en: {
    start: 'Secret Santa: draw names with friends, right here in Telegram.',
    exchangeCancelled: '"{exchange}" was cancelled by its organiser.',
    removed: 'You were removed from "{exchange}".',
  },
  ru: {
    start: 'Тайный Санта: жеребьёвка подарков с друзьями прямо в Telegram.',
    exchangeCancelled: 'Обмен «{exchange}» отменён организатором.',
    removed: 'Вас удалили из обмена «{exchange}».',
  },
};

export const t = makeT(BOT);
