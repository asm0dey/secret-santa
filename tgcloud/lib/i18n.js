/** @param {unknown} code @returns {import('./types.js').Lang} */
export const langOf = (code) => (String(code ?? '').toLowerCase().startsWith('ru') ? 'ru' : 'en');

/** @param {Record<string, Record<string, string>>} dict */
export const makeT = (dict) =>
  /** @param {string} lang @param {string} key @param {Record<string, string | number>} [params] */
  (lang, key, params = {}) => {
  const s = dict[lang]?.[key] ?? dict.en[key];
  if (s === undefined) throw new Error(`i18n: unknown key "${key}"`);
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
};

// Bot strings. Later tasks add keys to both languages.
export const BOT = {
  en: {
    start: 'Secret Santa: draw names with friends, right here in Telegram.',
    exchangeCancelled: '"{exchange}" was cancelled by its organiser.',
    removed: 'You were removed from "{exchange}".',
    drawn: '<b>Names are drawn for "{exchange}"</b>\n{organiser} started the draw. Open the app to see who you\'re gifting to. Budget: {budget}.',
    btnSeeRecipient: 'See my recipient',
    giftSent: '<b>{exchange}</b>\nYour Secret Santa sent your gift. It\'s on its way!',
    giftSentTracking: '\nTracking: <code>{tracking}</code>',
    giftReceived: '<b>{exchange}</b>\nYour giftee received your gift. Nice work, Santa!',
    btnMyGift: 'My gift',
  },
  ru: {
    start: 'Тайный Санта: жеребьёвка подарков с друзьями прямо в Telegram.',
    exchangeCancelled: 'Обмен «{exchange}» отменён организатором.',
    removed: 'Вас удалили из обмена «{exchange}».',
    drawn: '<b>Жеребьёвка в обмене «{exchange}» прошла</b>\n{organiser} запустил(а) жеребьёвку. Откройте приложение, чтобы узнать, кому вы дарите подарок. Бюджет: {budget}.',
    btnSeeRecipient: 'Кому я дарю',
    giftSent: '<b>{exchange}</b>\nВаш Тайный Санта отправил подарок. Он уже в пути!',
    giftSentTracking: '\nТрек-номер: <code>{tracking}</code>',
    giftReceived: '<b>{exchange}</b>\nВаш получатель получил подарок. Отличная работа, Санта!',
    btnMyGift: 'Мой подарок',
  },
};

export const t = makeT(BOT);
