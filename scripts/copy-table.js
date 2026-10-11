// Prints the Russian copy review table (Markdown) to stdout:
//   ~/.bun/bin/bun scripts/copy-table.js > docs/ru-copy-review.md
import { BOT } from '../tgcloud/lib/i18n.js';
import en from '../src/lib/strings/en.js';
import ru from '../src/lib/strings/ru.js';

export const EDITS = [
  {
    "scope": "bot",
    "key": "giftReceived",
    "before": "<b>{exchange}</b>\nВаш получатель получил подарок. Отличная работа, Санта!",
    "after": "<b>{exchange}</b>\nВаш подарок дошёл до получателя. Отличная работа, Санта!",
    "why": "Gender-neutral and more natural than «получатель получил»; also avoids the clumsy repetition."
  },
  {
    "scope": "bot",
    "key": "removed",
    "before": "Вас удалили из обмена «{exchange}».",
    "after": "Вас убрали из обмена «{exchange}».",
    "why": "Consistent with the app, which uses «Убрать» for removing a member."
  },
  {
    "scope": "bot",
    "key": "sorry",
    "before": "<b>Нам очень жаль, {name}</b>\nОбмен «{exchange}» завершён, а ваш подарок так и не пришёл. Тайный Санта не должен так заканчиваться, и вашей вины здесь нет.\n\nМы сообщили организатору, {organiser}. Спасибо, что участвовали. Пусть в следующем году под ёлкой вас ждёт самый лучший подарок.",
    "after": "<b>Нам очень жаль, {name}</b>\nОбмен «{exchange}» завершён, а ваш подарок так и не пришёл. Тайный Санта должен дарить радость, а не разочарование, и вашей вины здесь нет.\n\nМы сообщили организатору, {organiser}. Спасибо, что участвовали. Пусть в следующем году под ёлкой вас ждёт самый лучший подарок.",
    "why": "«Тайный Санта не должен так заканчиваться» was unnatural; now conveys the English «that isn't how Secret Santa should feel»."
  },
  {
    "scope": "bot",
    "key": "closedNoGift",
    "before": "{giftee} так и не получил(а) подарок. Санта — <b>{santa}</b>, он(а) так и не отметил(а) отправку. Вы можете написать {santa} или заблокировать в Тайном Санте, чтобы он(а) больше не мог(ла) создавать обмены и участвовать в них.",
    "after": "Подарок для {giftee} так и не дошёл: Санта — <b>{santa}</b> — не отметил отправку. Вы можете написать {santa} или заблокировать его в Тайном Санте, чтобы он больше не мог создавать обмены и участвовать в них.",
    "why": "Removed unreadable gender slashes (получил(а), он(а), мог(ла)); «заблокировать» had no object; now agrees with the masculine noun «Санта»."
  },
  {
    "scope": "bot",
    "key": "blocked",
    "before": "<b>Вас заблокировали в Тайном Санте</b>\nВ обмене «{exchange}» ваш получатель так и не получил подарок, и отправка не была отмечена. Организатор заблокировал вас, поэтому вы не можете создавать обмены и участвовать в них.\n\nЕсли что-то пошло не так, расскажите, что случилось.",
    "after": "<b>Вас заблокировали в Тайном Санте</b>\nВ обмене «{exchange}» ваш получатель так и не получил подарок, а отправка не была отмечена. Организатор заблокировал вас, поэтому вы не можете создавать обмены и участвовать в них.\n\nЕсли что-то пошло не так, расскажите нам, что случилось.",
    "why": "«и» → «а» (contrast, not addition); added «нам» to match «tell us»."
  },
  {
    "scope": "bot",
    "key": "appeal",
    "before": "<b>{name} обжалует блокировку</b>\n{exchange} · заблокирован(а) {date}\n<blockquote>{text}</blockquote>",
    "after": "<b>{name} обжалует блокировку</b>\n{exchange} · блокировка от {date}\n<blockquote>{text}</blockquote>",
    "why": "Removed gendered «заблокирован(а)» by rephrasing."
  },
  {
    "scope": "bot",
    "key": "errNotYet",
    "before": "Ещё рано: дождитесь, пока пройдёт дедлайн.",
    "after": "Ещё рано: дождитесь, пока пройдёт срок.",
    "why": "«дедлайн» → «срок»: one term for the deadline everywhere (the app already says «срок»)."
  },
  {
    "scope": "app",
    "key": "giftee.hero",
    "before": "Вы Тайный Санта для",
    "after": "Вы — Тайный Санта для",
    "why": "Missing dash."
  },
  {
    "scope": "app",
    "key": "giftee.message",
    "before": "Анонимно написать: {name}",
    "after": "Написать {name} анонимно",
    "why": "More natural word order."
  },
  {
    "scope": "app",
    "key": "giftee.markSent",
    "before": "Отметить отправленным",
    "after": "Отметить как отправленный",
    "why": "Agrees with «подарок» and matches the bot wording «отметьте его как отправленный»."
  },
  {
    "scope": "app",
    "key": "gift.markReceived",
    "before": "Я получил(а) подарок",
    "after": "Подарок получен",
    "why": "Gender-neutral instead of «получил(а)»."
  },
  {
    "scope": "app",
    "key": "progress.overdue",
    "before": "Санта для {giftee} — {santa}, и он(а) не отметил(а) отправку подарка.",
    "after": "Санта {giftee} — {santa}, и отправка подарка не отмечена.",
    "why": "Removed gendered «он(а) не отметил(а)»."
  },
  {
    "scope": "app",
    "key": "progress.blockConfirm",
    "before": "Заблокировать {santa}? Он(а) не сможет создавать обмены и участвовать в них, и будет убран(а) из обменов без жеребьёвки.",
    "after": "Заблокировать {santa}? Этот участник не сможет создавать обмены и участвовать в них, а из обменов, где жеребьёвки ещё не было, будет убран.",
    "why": "Removed gender slashes («Он(а)», «убран(а)»)."
  },
  {
    "scope": "app",
    "key": "progress.notDelivered",
    "before": "Не удалось доставить: возможно, бот заблокирован",
    "after": "Не удалось доставить: возможно, участник заблокировал бота",
    "why": "Original «бот заблокирован» read as if the bot were blocked, the opposite of the English meaning."
  },
  {
    "scope": "app",
    "key": "progress.blocked",
    "before": "{santa} заблокирован(а)",
    "after": "Заблокирован: {santa}",
    "why": "Removed gendered «заблокирован(а)»."
  }
];

/** @param {unknown} [s] */
const cell = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
// bot strings carry real HTML tags: escape & too, so "&lt;" in text and "<b>" both show literally.

const PLURAL = ['one', 'few', 'many', 'other'];
/** @param {string} x @param {string} y */
const byKey = (x, y) => {
  const [bx, px = ''] = x.split(/\.(?=one$|few$|many$|other$)/), [by, py = ''] = y.split(/\.(?=one$|few$|many$|other$)/);
  return bx === by ? PLURAL.indexOf(px) - PLURAL.indexOf(py) : bx < by ? -1 : 1;
};

/** @param {Record<string,string>} a @param {Record<string,string>} b */
export const rows = (a, b) =>
  Object.keys(a).sort(byKey).map((k) => `| ${cell(k)} | ${cell(a[k])} | ${cell(b[k])} | |`);

const HEAD = '| Key | English | Russian | Notes |\n| --- | --- | --- | --- |';

export const buildTable = () => {
  const edits = EDITS.map((e) => `| ${cell(e.scope === 'bot' ? 'Bot' : 'App')} \`${cell(e.key)}\` | ${cell(e.before)} | ${cell(e.after)} | ${cell(e.why)} |`);
  return [
    '# Russian copy for review',
    '',
    'Every user-facing string in the Secret Santa bot and Mini App, English next to Russian. To comment, edit the Russian column or add a note under Notes. Keep `{placeholders}` exactly as they are. In the bot section, `<b>`, `<code>` and `<blockquote>` are Telegram HTML formatting and are shown as plain text here. `.one/.few/.many/.other` rows are plural forms (1 / 2-4 / 5-20 / fractions).',
    '',
    '## Bot messages',
    '',
    HEAD,
    ...rows(BOT.en, BOT.ru),
    '',
    '## App',
    '',
    HEAD,
    ...rows(en, ru),
    '',
    '## Changes made by the editor',
    '',
    'These Russian strings were corrected before this review (the table above already shows the new text). English was not touched.',
    '',
    '| Key | Before | After | Why |',
    '| --- | --- | --- | --- |',
    ...edits,
    '',
  ].join('\n');
};

if (import.meta.main) process.stdout.write(buildTable());
