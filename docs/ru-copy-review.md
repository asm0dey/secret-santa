# Russian copy for review

Every user-facing string in the Secret Santa bot and Mini App, English next to Russian. To comment, edit the Russian column or add a note under Notes. Keep `{placeholders}` exactly as they are. In the bot section, `<b>`, `<code>` and `<blockquote>` are Telegram HTML formatting and are shown as plain text here. `.one/.few/.many/.other` rows are plural forms (1 / 2-4 / 5-20 / fractions).

## Bot messages

| Key | English | Russian | Notes |
| --- | --- | --- | --- |
| appeal | &lt;b&gt;{name} appealed their block&lt;/b&gt;<br>{exchange} · blocked {date}<br>&lt;blockquote&gt;{text}&lt;/blockquote&gt; | &lt;b&gt;{name} обжалует блокировку&lt;/b&gt;<br>{exchange} · блокировка от {date}<br>&lt;blockquote&gt;{text}&lt;/blockquote&gt; | |
| appealKept | The organiser of "{exchange}" reviewed your appeal and kept the block. | Организатор обмена «{exchange}» рассмотрел вашу жалобу и оставил блокировку. | |
| appealTracking | <br>Tracking: &lt;code&gt;{tracking}&lt;/code&gt; | <br>Трек-номер: &lt;code&gt;{tracking}&lt;/code&gt; | |
| appealUnblocked | Good news: the organiser of "{exchange}" lifted your block. | Хорошие новости: организатор обмена «{exchange}» снял блокировку. | |
| blocked | &lt;b&gt;You've been blocked from Secret Santa&lt;/b&gt;<br>In "{exchange}", your giftee never received a gift and it was never marked as sent. The organiser has blocked you, so you can't create or join exchanges.<br><br>If something went wrong, tell us what happened. | &lt;b&gt;Вас заблокировали в Тайном Санте&lt;/b&gt;<br>В обмене «{exchange}» ваш получатель так и не получил подарок, а отправка не была отмечена. Организатор заблокировал вас, поэтому вы не можете создавать обмены и участвовать в них.<br><br>Если что-то пошло не так, расскажите нам, что случилось. | |
| btnAppeal | Appeal | Обжаловать | |
| btnBlock | Block {santa} | Заблокировать {santa} | |
| btnKeep | Keep blocked | Оставить блокировку | |
| btnLetGo | Let it go | Оставить как есть | |
| btnMessage | Message {santa} | Написать {santa} | |
| btnMyGift | My gift | Мой подарок | |
| btnOpen | Open | Открыть | |
| btnOpenChat | Open chat | Открыть чат | |
| btnOpenGiftee | Open my giftee | Кому я дарю | |
| btnReplyOrganiser | Reply to {organiser} | Ответить {organiser} | |
| btnSeeRecipient | See my recipient | Кому я дарю | |
| btnUnblock | Unblock | Разблокировать | |
| closedLost | {giftee}'s gift was marked as sent but never arrived. It may have been lost in the post. | Подарок для {giftee} был отправлен, но так и не дошёл. Возможно, он потерялся на почте. | |
| closedNoGift | {giftee} never received a gift. Their Santa was &lt;b&gt;{santa}&lt;/b&gt;, who never marked it as sent. You can message {santa}, or block them from Secret Santa so they can't create or join exchanges again. | Подарок для {giftee} так и не дошёл: Санта — &lt;b&gt;{santa}&lt;/b&gt; — не отметил отправку. Вы можете написать {santa} или заблокировать его в Тайном Санте, чтобы он больше не мог создавать обмены и участвовать в них. | |
| closedSummary | &lt;b&gt;"{exchange}" has closed&lt;/b&gt;<br>{received} of {total} gifts arrived. | &lt;b&gt;Обмен «{exchange}» завершён&lt;/b&gt;<br>Дошло подарков: {received} из {total}. | |
| done | Done | Готово | |
| drawn | &lt;b&gt;Names are drawn for "{exchange}"&lt;/b&gt;<br>{organiser} started the draw. Open the app to see who you're gifting to. Budget: {budget}. | &lt;b&gt;Жеребьёвка в обмене «{exchange}» прошла&lt;/b&gt;<br>{organiser} запустил(а) жеребьёвку. Откройте приложение, чтобы узнать, кому вы дарите подарок. Бюджет: {budget}. | |
| errForbidden | Not allowed. | Недоступно. | |
| errGeneric | Something went wrong. | Что-то пошло не так. | |
| errNotFound | Not found. | Не найдено. | |
| errNotYet | Not yet: wait until the deadline has passed. | Ещё рано: дождитесь, пока пройдёт срок. | |
| exchangeCancelled | "{exchange}" was cancelled by its organiser. | Обмен «{exchange}» отменён организатором. | |
| fromOrganiser | &lt;b&gt;Message from {organiser}, organiser of "{exchange}"&lt;/b&gt;<br>{text} | &lt;b&gt;Сообщение от {organiser}, организатора обмена «{exchange}»&lt;/b&gt;<br>{text} | |
| giftReceived | &lt;b&gt;{exchange}&lt;/b&gt;<br>Your giftee received your gift. Nice work, Santa! | &lt;b&gt;{exchange}&lt;/b&gt;<br>Ваш подарок дошёл до получателя. Отличная работа, Санта! | |
| giftSent | &lt;b&gt;{exchange}&lt;/b&gt;<br>Your Secret Santa sent your gift. It's on its way! | &lt;b&gt;{exchange}&lt;/b&gt;<br>Ваш Тайный Санта отправил подарок. Он уже в пути! | |
| giftSentTracking | <br>Tracking: &lt;code&gt;{tracking}&lt;/code&gt; | <br>Трек-номер: &lt;code&gt;{tracking}&lt;/code&gt; | |
| newFromGiftee | &lt;b&gt;{exchange}&lt;/b&gt;<br>Your giftee replied to you. | &lt;b&gt;{exchange}&lt;/b&gt;<br>Ваш получатель ответил вам. | |
| newFromSanta | &lt;b&gt;{exchange}&lt;/b&gt;<br>Your Secret Santa sent you a message. | &lt;b&gt;{exchange}&lt;/b&gt;<br>Тайный Санта прислал вам сообщение. | |
| nudge | &lt;b&gt;{exchange}&lt;/b&gt;<br>Reminder: gifts were due by {deadline}, and your giftee hasn't received theirs yet. If it's on the way, mark it as sent or tell them in the anonymous chat. | &lt;b&gt;{exchange}&lt;/b&gt;<br>Напоминание: подарки нужно было отправить до {deadline}, а ваш получатель ещё ничего не получил. Если подарок в пути, отметьте его как отправленный или напишите получателю в анонимном чате. | |
| removed | You were removed from "{exchange}". | Вас убрали из обмена «{exchange}». | |
| sorry | &lt;b&gt;We're so sorry, {name}&lt;/b&gt;<br>"{exchange}" has closed, and your gift never made it to you. That isn't how Secret Santa should feel, and it's not your fault.<br><br>We've let {organiser}, the organiser, know. Thank you for being part of it. We hope next year brings you the best gift under the tree. | &lt;b&gt;Нам очень жаль, {name}&lt;/b&gt;<br>Обмен «{exchange}» завершён, а ваш подарок так и не пришёл. Тайный Санта должен дарить радость, а не разочарование, и вашей вины здесь нет.<br><br>Мы сообщили организатору, {organiser}. Спасибо, что участвовали. Пусть в следующем году под ёлкой вас ждёт самый лучший подарок. | |
| start | Secret Santa: draw names with friends, right here in Telegram. | Тайный Санта: жеребьёвка подарков с друзьями прямо в Telegram. | |

## App

| Key | English | Russian | Notes |
| --- | --- | --- | --- |
| app.title | Secret Santa | Тайный Санта | |
| appeal.blockedInfo | Blocked by the organiser of "{exchange}" on {date}. | Организатор обмена «{exchange}» заблокировал вас {date}. | |
| appeal.hint | You can send one appeal per block. We'll message you with the answer. | На каждую блокировку можно отправить одну жалобу. Ответ придёт в сообщении. | |
| appeal.submit | Send appeal | Отправить жалобу | |
| appeal.text | What happened? | Что произошло? | |
| appeal.title | Appeal your block | Жалоба на блокировку | |
| appeal.tracking | Tracking number | Трек-номер | |
| blocked.appeal | Appeal | Обжаловать | |
| blocked.appealSent | Appeal sent, waiting for the organiser | Жалоба отправлена, ждём ответа организатора | |
| blocked.explain | In "{exchange}", a gift was never marked as sent. The organiser blocked you on {date}, so you cannot create or join exchanges. | В обмене «{exchange}» отправка подарка так и не была отмечена. Организатор заблокировал вас {date}, поэтому вы не можете создавать обмены и участвовать в них. | |
| blocked.explainNoName | A gift was never marked as sent in one of your exchanges. The organiser blocked you on {date}, so you cannot create or join exchanges. | В одном из ваших обменов отправка подарка так и не была отмечена. Организатор заблокировал вас {date}, поэтому вы не можете создавать обмены и участвовать в них. | |
| blocked.kept | The organiser reviewed your appeal and kept the block. | Организатор рассмотрел жалобу и оставил блокировку. | |
| blocked.title | You have been blocked | Вас заблокировали | |
| chat.empty | No messages yet. Say hello, they will not know who you are. | Сообщений пока нет. Поздоровайтесь: собеседник не узнает, кто вы. | |
| chat.hintGiftee | {exchange} · {name} will not know who you are | {exchange} · {name} не узнает, кто вы | |
| chat.hintSanta | {exchange} · Your Santa's name stays hidden | {exchange} · Имя вашего Санты остаётся скрытым | |
| chat.placeholder | Write a message | Напишите сообщение | |
| chat.santa | Your Secret Santa | Ваш Тайный Санта | |
| common.back | Back | Назад | |
| common.cancel | Cancel | Отмена | |
| common.close | Close | Закрыть | |
| common.confirm | Confirm | Подтвердить | |
| common.copied | Copied | Скопировано | |
| common.copy | Copy | Копировать | |
| common.creator | creator | организатор | |
| common.delete | Delete | Удалить | |
| common.loading | Loading… | Загрузка… | |
| common.more | More | Ещё | |
| common.openProfile | Open profile | Открыть профиль | |
| common.optional | optional | необязательно | |
| common.remove | Remove | Убрать | |
| common.required | Please fill this in | Заполните это поле | |
| common.retry | Try again | Повторить | |
| common.save | Save | Сохранить | |
| common.send | Send | Отправить | |
| common.you | you | вы | |
| create.amountInvalid | Enter a whole number above zero | Введите целое число больше нуля | |
| create.budget | Budget | Бюджет | |
| create.budget.amount | Amount | Сумма | |
| create.budget.any | Any | Любой | |
| create.budget.max | Up to | До | |
| create.budget.maxAmount | To | До | |
| create.budget.min | At least | От | |
| create.budget.minAmount | From | От | |
| create.budget.range | Range | Диапазон | |
| create.currency | Currency | Валюта | |
| create.deadline | Gifts arrive by | Подарки должны прийти до | |
| create.deadlineHint | The deadline passes at the end of that day (UTC). | Срок истекает в конце этого дня (UTC). | |
| create.deadlineOnly | The name and budget are fixed after the draw. You can still move the deadline. | Название и бюджет после жеребьёвки не меняются. Срок можно перенести. | |
| create.deadlinePast | The deadline has passed. Choose a new date. | Срок уже прошёл. Выберите новую дату. | |
| create.editTitle | Edit exchange | Изменить обмен | |
| create.name | Exchange name | Название обмена | |
| create.namePlaceholder | Office Secret Santa | Тайный Санта в офисе | |
| create.rangeInvalid | The minimum must not exceed the maximum | Минимум не должен быть больше максимума | |
| create.submit | Create exchange | Создать обмен | |
| create.title | New exchange | Новый обмен | |
| errors.ALREADY_DRAWN | Names are already drawn | Жеребьёвка уже прошла | |
| errors.ALREADY_MEMBER | You have already joined this exchange | Вы уже участвуете в этом обмене | |
| errors.BAD_INPUT | Please check what you entered | Проверьте введённые данные | |
| errors.BLOCKED | You have been blocked from Secret Santa | Вас заблокировали в Тайном Санте | |
| errors.CLOSED | This exchange has closed | Этот обмен завершён | |
| errors.EXCHANGE_GONE | This exchange no longer exists | Этого обмена больше нет | |
| errors.FORBIDDEN | You are not allowed to do that | Это действие вам недоступно | |
| errors.FULL | This exchange is full | В этом обмене больше нет мест | |
| errors.INTERNAL | Something went wrong. Please try again | Что-то пошло не так. Попробуйте ещё раз | |
| errors.NOT_DRAWN | Names are not drawn yet | Жеребьёвка ещё не прошла | |
| errors.NOT_FOUND | No exchange with this code | Обмен с таким кодом не найден | |
| errors.NOT_YET | Not yet: wait until the deadline has passed | Ещё рано: дождитесь, пока пройдёт срок | |
| errors.TOO_FEW | You need at least 3 people to draw names | Для жеребьёвки нужно минимум 3 человека | |
| exchange.closed | This exchange has closed | Этот обмен завершён | |
| exchange.code | Invite code | Код приглашения | |
| exchange.delete | Delete exchange | Удалить обмен | |
| exchange.deleteConfirm | Delete "{name}"? Everyone who joined will be told it was cancelled. | Удалить «{name}»? Все участники получат уведомление об отмене. | |
| exchange.draw | Start the draw | Начать жеребьёвку | |
| exchange.drawConfirm | Draw names now? Nobody can join or leave afterwards. | Провести жеребьёвку? После неё никто не сможет войти или выйти. | |
| exchange.drawConfirmYes | Yes, draw | Да, провести | |
| exchange.drawNeedMore | You need at least 3 people to draw names. | Для жеребьёвки нужно минимум 3 человека. | |
| exchange.drawing | Names are being drawn… | Идёт жеребьёвка… | |
| exchange.editExchange | Edit exchange | Изменить обмен | |
| exchange.editMine | Edit my details | Изменить мои данные | |
| exchange.finishDraw | Finish the draw | Завершить жеребьёвку | |
| exchange.finishDrawHint | The draw was interrupted. Finish it so everyone gets their giftee. | Жеребьёвка прервалась. Завершите её, чтобы каждый узнал, кому дарит подарок. | |
| exchange.joinOwn | Join your exchange | Присоединиться к своему обмену | |
| exchange.leave | Leave exchange | Выйти из обмена | |
| exchange.leaveConfirm | Leave "{name}"? You can join again with the code. | Выйти из «{name}»? Вернуться можно по коду. | |
| exchange.removeConfirm | Remove {name} from the exchange? | Убрать {name} из обмена? | |
| exchange.removeMember | Remove {name} | Убрать {name} | |
| exchange.share | Share link | Поделиться ссылкой | |
| exchange.shareText | Join my Secret Santa "{name}" | Присоединяйтесь к моему Тайному Санте «{name}» | |
| exchange.summary.one | {count} person joined · {budget} · gifts by {date} | Присоединился {count} участник · {budget} · подарки до {date} | |
| exchange.summary.few | {count} people joined · {budget} · gifts by {date} | Присоединились {count} участника · {budget} · подарки до {date} | |
| exchange.summary.many | {count} people joined · {budget} · gifts by {date} | Присоединились {count} участников · {budget} · подарки до {date} | |
| exchange.summary.other | {count} people joined · {budget} · gifts by {date} | Присоединились {count} участника · {budget} · подарки до {date} | |
| exchange.tag.surprise | surprise me | удивите меня | |
| exchange.tag.wishlist | wishlist ✓ | вишлист ✓ | |
| exchange.waitingFor | Waiting for {organiser} to start the draw | Ждём, пока {organiser} начнёт жеребьёвку | |
| gift.detailsHint | Your Santa sees your address, wishlist, and likes and dislikes. | Ваш Санта видит ваш адрес, вишлист и то, что вам нравится и не нравится. | |
| gift.detailsTitle | Your details | Ваши данные | |
| gift.dueBy | due by {date} | срок: {date} | |
| gift.editMine | Edit my details | Изменить мои данные | |
| gift.from | From your Secret Santa | От вашего Тайного Санты | |
| gift.markReceived | I received my gift | Подарок получен | |
| gift.messageSanta | Message my Santa | Написать моему Санте | |
| gift.notSent | Not sent yet | Пока не отправлен | |
| gift.onWay | On its way | В пути | |
| gift.received | Received | Получен | |
| gift.receivedConfirm | Mark your gift as received? Your Santa will be told. | Отметить подарок полученным? Ваш Санта получит уведомление. | |
| giftee.address | Send the gift to | Куда отправить подарок | |
| giftee.hero | You are Secret Santa for | Вы — Тайный Санта для | |
| giftee.likes | Likes and dislikes | Что нравится и что не нравится | |
| giftee.markSent | Mark as sent | Отметить как отправленный | |
| giftee.message | Message {name} anonymously | Написать {name} анонимно | |
| giftee.noWishlist | No wishlist yet | Вишлиста пока нет | |
| giftee.sendBy | send by {date} | отправить до {date} | |
| giftee.sent | Sent {date} | Отправлено {date} | |
| giftee.shipping | Shipping | Отправка | |
| giftee.surprise | {name} says: surprise me | {name} просит: удивите меня | |
| giftee.surpriseHint | No wishlist this time. Anything within the budget works. | В этот раз без вишлиста. Подойдёт любой подарок в рамках бюджета. | |
| giftee.tracking | Tracking number | Трек-номер | |
| giftee.trackingHint | {name} sees it and can follow the parcel | {name} увидит его и сможет следить за посылкой | |
| giftee.updateTracking | Update tracking | Обновить трек-номер | |
| giftee.wishlist | Wishlist | Вишлист | |
| home.codePlaceholder | XXX-XXX | XXX-XXX | |
| home.create | Create an exchange | Создать обмен | |
| home.empty | Secret Santa lets you draw names with friends, right here in Telegram. Create an exchange and share its code, or join one with a code from a friend. | Тайный Санта — жеребьёвка подарков с друзьями прямо в Telegram. Создайте обмен и поделитесь кодом или присоединитесь по коду друга. | |
| home.haveCode | Have a code? | Есть код? | |
| home.join | Join | Присоединиться | |
| home.members.one | {count} person | {count} участник | |
| home.members.few | {count} people | {count} участника | |
| home.members.many | {count} people | {count} участников | |
| home.members.other | {count} people | {count} участника | |
| home.status.closed | Closed | Завершён | |
| home.status.drawn | Drawn | Жеребьёвка прошла | |
| home.status.see | See recipient | Узнать, кому дарить | |
| home.status.waiting | Waiting | Ожидание | |
| home.title | My exchanges | Мои обмены | |
| join.address | Shipping address | Адрес доставки | |
| join.addressHint | Only the person who draws you will see this address. | Этот адрес увидит только тот, кто будет вам дарить. | |
| join.editTitle | My details | Мои данные | |
| join.nickname | Nickname your Santa will see | Имя, которое увидит ваш Санта | |
| join.save | Save details | Сохранить данные | |
| join.saved | Saved | Сохранено | |
| join.submit | Join | Присоединиться | |
| join.summary.one | {organiser} is organising · {count} person joined | Организатор: {organiser} · присоединился {count} участник | |
| join.summary.few | {organiser} is organising · {count} people joined | Организатор: {organiser} · присоединились {count} участника | |
| join.summary.many | {organiser} is organising · {count} people joined | Организатор: {organiser} · присоединились {count} участников | |
| join.summary.other | {organiser} is organising · {count} people joined | Организатор: {organiser} · присоединились {count} участника | |
| join.title | Join exchange | Присоединиться | |
| join.wishMode | Gift ideas | Идеи для подарка | |
| join.wishMode.ideas | I have ideas | Есть идеи | |
| join.wishMode.surprise | Surprise me | Удивите меня | |
| join.wishes | Likes and dislikes | Что нравится и что не нравится | |
| join.wishlist | Wishlist link | Ссылка на вишлист | |
| join.wishlistInvalid | The link must start with http:// or https:// | Ссылка должна начинаться с http:// или https:// | |
| join.writeAccessHint | Next, Telegram will ask if the bot may message you. That is how we tell you when names are drawn and gifts are on their way. | Дальше Telegram спросит, можно ли боту писать вам. Так мы сообщим, когда пройдёт жеребьёвка и когда подарок отправят. | |
| progress.block | Block {santa} | Заблокировать {santa} | |
| progress.blockConfirm | Block {santa}? They will not be able to create or join exchanges, and will be removed from exchanges that are not drawn yet. | Заблокировать {santa}? Этот участник не сможет создавать обмены и участвовать в них, а из обменов, где жеребьёвки ещё не было, будет убран. | |
| progress.blocked | {santa} is blocked | Заблокирован: {santa} | |
| progress.composePlaceholder | Write your message | Напишите сообщение | |
| progress.composeTitle | Message {santa} | Сообщение для {santa} | |
| progress.counts | Received: {received} · On its way: {onWay} · Not sent: {notSent} | Получено: {received} · В пути: {onWay} · Не отправлено: {notSent} | |
| progress.deadline | Gifts due by {date} | Подарки до {date} | |
| progress.deadlinePassed.one | The deadline passed {count} day ago | Срок истёк {count} день назад | |
| progress.deadlinePassed.few | The deadline passed {count} days ago | Срок истёк {count} дня назад | |
| progress.deadlinePassed.many | The deadline passed {count} days ago | Срок истёк {count} дней назад | |
| progress.deadlinePassed.other | The deadline passed {count} days ago | Срок истёк {count} дня назад | |
| progress.deadlineToday | The deadline passed today | Срок истёк сегодня | |
| progress.dueWas | Gifts were due by {date} | Подарки нужно было отправить до {date} | |
| progress.message | Message {santa} | Написать {santa} | |
| progress.messageSent | Message sent to {santa} | Сообщение для {santa} отправлено | |
| progress.moveDeadline | Move the deadline | Перенести срок | |
| progress.notDelivered | Couldn't deliver — they may have blocked the bot | Не удалось доставить: возможно, участник заблокировал бота | |
| progress.notSent | not sent | не отправлен | |
| progress.nudge | Nudge | Напомнить | |
| progress.nudged.one | Reminder sent to {count} Santa | Напоминание отправлено {count} Санте | |
| progress.nudged.few | Reminder sent to {count} Santas | Напоминание отправлено {count} Сантам | |
| progress.nudged.many | Reminder sent to {count} Santas | Напоминание отправлено {count} Сантам | |
| progress.nudged.other | Reminder sent to {count} Santas | Напоминание отправлено {count} Сантам | |
| progress.onWay | on its way | в пути | |
| progress.onlyYou | Only you see this | Это видите только вы | |
| progress.overdue | {giftee}'s Santa is {santa} and hasn't marked the gift as sent. | Санта {giftee} — {santa}, и отправка подарка не отмечена. | |
| progress.received | received | получен | |
| progress.title | Who has received a gift | Кто получил подарок | |
| tabs.gift | My gift | Подарок | |
| tabs.giftee | My giftee | Кому дарю | |
| tabs.progress | Progress | Прогресс | |
| theme.auto | Auto | Авто | |
| theme.christmas | Christmas | Рождество | |
| theme.dark | Dark | Тёмная | |
| theme.label | Theme | Тема | |
| theme.light | Light | Светлая | |

## Changes made by the editor

These Russian strings were corrected before this review (the table above already shows the new text). English was not touched.

| Key | Before | After | Why |
| --- | --- | --- | --- |
| Bot `giftReceived` | &lt;b&gt;{exchange}&lt;/b&gt;<br>Ваш получатель получил подарок. Отличная работа, Санта! | &lt;b&gt;{exchange}&lt;/b&gt;<br>Ваш подарок дошёл до получателя. Отличная работа, Санта! | Gender-neutral and more natural than «получатель получил»; also avoids the clumsy repetition. |
| Bot `removed` | Вас удалили из обмена «{exchange}». | Вас убрали из обмена «{exchange}». | Consistent with the app, which uses «Убрать» for removing a member. |
| Bot `sorry` | &lt;b&gt;Нам очень жаль, {name}&lt;/b&gt;<br>Обмен «{exchange}» завершён, а ваш подарок так и не пришёл. Тайный Санта не должен так заканчиваться, и вашей вины здесь нет.<br><br>Мы сообщили организатору, {organiser}. Спасибо, что участвовали. Пусть в следующем году под ёлкой вас ждёт самый лучший подарок. | &lt;b&gt;Нам очень жаль, {name}&lt;/b&gt;<br>Обмен «{exchange}» завершён, а ваш подарок так и не пришёл. Тайный Санта должен дарить радость, а не разочарование, и вашей вины здесь нет.<br><br>Мы сообщили организатору, {organiser}. Спасибо, что участвовали. Пусть в следующем году под ёлкой вас ждёт самый лучший подарок. | «Тайный Санта не должен так заканчиваться» was unnatural; now conveys the English «that isn't how Secret Santa should feel». |
| Bot `closedNoGift` | {giftee} так и не получил(а) подарок. Санта — &lt;b&gt;{santa}&lt;/b&gt;, он(а) так и не отметил(а) отправку. Вы можете написать {santa} или заблокировать в Тайном Санте, чтобы он(а) больше не мог(ла) создавать обмены и участвовать в них. | Подарок для {giftee} так и не дошёл: Санта — &lt;b&gt;{santa}&lt;/b&gt; — не отметил отправку. Вы можете написать {santa} или заблокировать его в Тайном Санте, чтобы он больше не мог создавать обмены и участвовать в них. | Removed unreadable gender slashes (получил(а), он(а), мог(ла)); «заблокировать» had no object; now agrees with the masculine noun «Санта». |
| Bot `blocked` | &lt;b&gt;Вас заблокировали в Тайном Санте&lt;/b&gt;<br>В обмене «{exchange}» ваш получатель так и не получил подарок, и отправка не была отмечена. Организатор заблокировал вас, поэтому вы не можете создавать обмены и участвовать в них.<br><br>Если что-то пошло не так, расскажите, что случилось. | &lt;b&gt;Вас заблокировали в Тайном Санте&lt;/b&gt;<br>В обмене «{exchange}» ваш получатель так и не получил подарок, а отправка не была отмечена. Организатор заблокировал вас, поэтому вы не можете создавать обмены и участвовать в них.<br><br>Если что-то пошло не так, расскажите нам, что случилось. | «и» → «а» (contrast, not addition); added «нам» to match «tell us». |
| Bot `appeal` | &lt;b&gt;{name} обжалует блокировку&lt;/b&gt;<br>{exchange} · заблокирован(а) {date}<br>&lt;blockquote&gt;{text}&lt;/blockquote&gt; | &lt;b&gt;{name} обжалует блокировку&lt;/b&gt;<br>{exchange} · блокировка от {date}<br>&lt;blockquote&gt;{text}&lt;/blockquote&gt; | Removed gendered «заблокирован(а)» by rephrasing. |
| Bot `errNotYet` | Ещё рано: дождитесь, пока пройдёт дедлайн. | Ещё рано: дождитесь, пока пройдёт срок. | «дедлайн» → «срок»: one term for the deadline everywhere (the app already says «срок»). |
| App `giftee.hero` | Вы Тайный Санта для | Вы — Тайный Санта для | Missing dash. |
| App `giftee.message` | Анонимно написать: {name} | Написать {name} анонимно | More natural word order. |
| App `giftee.markSent` | Отметить отправленным | Отметить как отправленный | Agrees with «подарок» and matches the bot wording «отметьте его как отправленный». |
| App `gift.markReceived` | Я получил(а) подарок | Подарок получен | Gender-neutral instead of «получил(а)». |
| App `progress.overdue` | Санта для {giftee} — {santa}, и он(а) не отметил(а) отправку подарка. | Санта {giftee} — {santa}, и отправка подарка не отмечена. | Removed gendered «он(а) не отметил(а)». |
| App `progress.blockConfirm` | Заблокировать {santa}? Он(а) не сможет создавать обмены и участвовать в них, и будет убран(а) из обменов без жеребьёвки. | Заблокировать {santa}? Этот участник не сможет создавать обмены и участвовать в них, а из обменов, где жеребьёвки ещё не было, будет убран. | Removed gender slashes («Он(а)», «убран(а)»). |
| App `progress.notDelivered` | Не удалось доставить: возможно, бот заблокирован | Не удалось доставить: возможно, участник заблокировал бота | Original «бот заблокирован» read as if the bot were blocked, the opposite of the English meaning. |
| App `progress.blocked` | {santa} заблокирован(а) | Заблокирован: {santa} | Removed gendered «заблокирован(а)». |
