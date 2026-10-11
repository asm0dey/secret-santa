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
    drawn: '<b>Names are drawn for "{exchange}"</b>\n{organiser} started the draw. Open the app to see who you\'re gifting to. Budget: {budget}.',
    btnSeeRecipient: 'See my recipient',
  },
  ru: {
    start: 'Тайный Санта: жеребьёвка подарков с друзьями прямо в Telegram.',
    exchangeCancelled: 'Обмен «{exchange}» отменён организатором.',
    removed: 'Вас удалили из обмена «{exchange}».',
    drawn: '<b>Жеребьёвка в обмене «{exchange}» прошла</b>\n{organiser} запустил(а) жеребьёвку. Откройте приложение, чтобы узнать, кому вы дарите подарок. Бюджет: {budget}.',
    btnSeeRecipient: 'Кому я дарю',
  },
};

export const t = makeT(BOT);
