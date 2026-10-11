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
    newFromSanta: '<b>{exchange}</b>\nYour Secret Santa sent you a message.',
    newFromGiftee: '<b>{exchange}</b>\nYour giftee replied to you.',
    btnOpenChat: 'Open chat',
    nudge: '<b>{exchange}</b>\nReminder: gifts were due by {deadline}, and your giftee hasn\'t received theirs yet. If it\'s on the way, mark it as sent or tell them in the anonymous chat.',
    fromOrganiser: '<b>Message from {organiser}, organiser of "{exchange}"</b>\n{text}',
    btnReplyOrganiser: 'Reply to {organiser}',
    btnOpenGiftee: 'Open my giftee',
    sorry: '<b>We\'re so sorry, {name}</b>\n"{exchange}" has closed, and your gift never made it to you. That isn\'t how Secret Santa should feel, and it\'s not your fault.\n\nWe\'ve let {organiser}, the organiser, know. Thank you for being part of it. We hope next year brings you the best gift under the tree.',
    closedSummary: '<b>"{exchange}" has closed</b>\n{received} of {total} gifts arrived.',
    closedNoGift: '{giftee} never received a gift. Their Santa was <b>{santa}</b>, who never marked it as sent. You can message {santa}, or block them from Secret Santa so they can\'t create or join exchanges again.',
    closedLost: '{giftee}\'s gift was marked as sent but never arrived. It may have been lost in the post.',
    btnBlock: 'Block {santa}',
    btnLetGo: 'Let it go',
    btnMessage: 'Message {santa}',
    blocked: '<b>You\'ve been blocked from Secret Santa</b>\nIn "{exchange}", your giftee never received a gift and it was never marked as sent. The organiser has blocked you, so you can\'t create or join exchanges.\n\nIf something went wrong, tell us what happened.',
    btnAppeal: 'Appeal',
    appeal: '<b>{name} appealed their block</b>\n{exchange} · blocked {date}\n<blockquote>{text}</blockquote>',
    appealTracking: '\nTracking: <code>{tracking}</code>',
    btnUnblock: 'Unblock',
    btnKeep: 'Keep blocked',
    appealUnblocked: 'Good news: the organiser of "{exchange}" lifted your block.',
    appealKept: 'The organiser of "{exchange}" reviewed your appeal and kept the block.',
    btnOpen: 'Open',
    done: 'Done',
    errForbidden: 'Not allowed.',
    errNotFound: 'Not found.',
    errNotYet: 'Not yet: wait until the deadline has passed.',
    errGeneric: 'Something went wrong.',
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
    newFromSanta: '<b>{exchange}</b>\nТайный Санта прислал вам сообщение.',
    newFromGiftee: '<b>{exchange}</b>\nВаш получатель ответил вам.',
    btnOpenChat: 'Открыть чат',
    nudge: '<b>{exchange}</b>\nНапоминание: подарки нужно было отправить до {deadline}, а ваш получатель ещё ничего не получил. Если подарок в пути, отметьте его как отправленный или напишите получателю в анонимном чате.',
    fromOrganiser: '<b>Сообщение от {organiser}, организатора обмена «{exchange}»</b>\n{text}',
    btnReplyOrganiser: 'Ответить {organiser}',
    btnOpenGiftee: 'Кому я дарю',
    sorry: '<b>Нам очень жаль, {name}</b>\nОбмен «{exchange}» завершён, а ваш подарок так и не пришёл. Тайный Санта не должен так заканчиваться, и вашей вины здесь нет.\n\nМы сообщили организатору, {organiser}. Спасибо, что участвовали. Пусть в следующем году под ёлкой вас ждёт самый лучший подарок.',
    closedSummary: '<b>Обмен «{exchange}» завершён</b>\nДошло подарков: {received} из {total}.',
    closedNoGift: '{giftee} так и не получил(а) подарок. Санта — <b>{santa}</b>, он(а) так и не отметил(а) отправку. Вы можете написать {santa} или заблокировать в Тайном Санте, чтобы он(а) больше не мог(ла) создавать обмены и участвовать в них.',
    closedLost: 'Подарок для {giftee} был отправлен, но так и не дошёл. Возможно, он потерялся на почте.',
    btnBlock: 'Заблокировать {santa}',
    btnLetGo: 'Оставить как есть',
    btnMessage: 'Написать {santa}',
    blocked: '<b>Вас заблокировали в Тайном Санте</b>\nВ обмене «{exchange}» ваш получатель так и не получил подарок, и отправка не была отмечена. Организатор заблокировал вас, поэтому вы не можете создавать обмены и участвовать в них.\n\nЕсли что-то пошло не так, расскажите, что случилось.',
    btnAppeal: 'Обжаловать',
    appeal: '<b>{name} обжалует блокировку</b>\n{exchange} · заблокирован(а) {date}\n<blockquote>{text}</blockquote>',
    appealTracking: '\nТрек-номер: <code>{tracking}</code>',
    btnUnblock: 'Разблокировать',
    btnKeep: 'Оставить блокировку',
    appealUnblocked: 'Хорошие новости: организатор обмена «{exchange}» снял блокировку.',
    appealKept: 'Организатор обмена «{exchange}» рассмотрел вашу жалобу и оставил блокировку.',
    btnOpen: 'Открыть',
    done: 'Готово',
    errForbidden: 'Недоступно.',
    errNotFound: 'Не найдено.',
    errNotYet: 'Ещё рано: дождитесь, пока пройдёт дедлайн.',
    errGeneric: 'Что-то пошло не так.',
  },
};

export const t = makeT(BOT);
