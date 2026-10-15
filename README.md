# Secret Santa

A Secret Santa gift exchange that lives entirely inside Telegram, as a Mini App on
[Telegram Serverless](https://core.telegram.org/bots/serverless). There is no server to run and no sign-up:
identity comes from Telegram, and the bot sends the notifications.

Live instance: [@secret_santanabot](https://t.me/secret_santanabot)

## What it does

- Anyone creates an exchange (name, budget, "gifts arrive by" date) and shares a code like `K7Q-4MX` or an invite link.
- People join with a nickname, a shipping address and a wishlist, or pick "Surprise me".
- The organiser draws names. Each person sees only their own giftee: nickname, wishes and address.
- Santa and giftee chat anonymously through the app.
- Gifts are tracked from *sent* (with an optional tracking number) to *received*. The exchange closes when everyone has
  their gift, or 30 days after the deadline.
- After the deadline the organiser can nudge Santas who haven't sent anything, message them or block them. Blocked
  people can appeal.
- Addresses, wishes, tracking numbers and chats are deleted when an exchange closes.
- English and Russian. Themes: Auto, Light, Dark, Christmas.

### Privacy by design

Nobody, including the organiser, can see who is whose Santa. The one exception: after the deadline, the organiser
sees the Santas who have neither sent their gift nor marked it as sent. Notifications never contain names or
message text. An address is visible only to its owner and to the person who drew it. All authorisation happens on
the server, based on the user ID that Telegram verifies.

## Stack

- **Backend:** plain JavaScript modules in `tgcloud/` (`endpoints/`, `handlers/`, `lib/`, `schema.js`) on Telegram
  Serverless, with per-bot SQLite through the platform's Drizzle-like `db`. Type-checked with JSDoc and `checkJs`,
  because the platform only accepts JavaScript.
- **Front end:** Svelte 5, Vite, Tailwind 4 and daisyUI 5. It's built to `dist/` and hosted by the platform at
  `https://app<bot id>.tgcloud.ai`.
- **Tests:** `bun test` against a fake `sdk` package (`test/sdk/`): Drizzle over `bun:sqlite`, plus a recording Bot API.

## Run your own instance

You need [Bun](https://bun.sh) and a Telegram account.

1. **Create the bot.** In [@BotFather](https://t.me/BotFather), create a bot and enable Serverless for it.
2. **Make the Mini App the bot's main app.** Go to `/mybots` → your bot → *Bot Settings* → *Configure Mini App* →
   *Enable Mini App*, and set the URL to `https://app<bot id>.tgcloud.ai`. The bot ID is the number before the colon
   in its token. Invite links (`t.me/<bot>?startapp=<code>`) don't work without this.
3. **Install and configure:**
   ```sh
   bun install
   cp .env.example .env.local   # then fill in the privacy policy's data controller and contact
   ```
   The build fails if `VITE_PRIVACY_CONTROLLER` or `VITE_PRIVACY_CONTACT` is missing, so you can't ship someone
   else's details by mistake. Nothing else needs configuring: the backend reads the bot's username and app URL from
   Telegram (`getMe`).
4. **Link and deploy:**
   ```sh
   bunx @tgcloud/cli login          # interactive: paste the bot token
   bun run build
   bunx @tgcloud/cli push           # backend modules + dist/
   bunx @tgcloud/cli migrate --yes  # creates the tables
   bunx @tgcloud/cli status         # should say "Working directory clean"
   ```
5. **Set the privacy policy.** In @BotFather, set the bot's privacy policy URL to
   `https://app<bot id>.tgcloud.ai/#/privacy`.
6. Send `/start` to your bot and tap *Open*.

To update later, run `bun run build && bunx @tgcloud/cli push`. Also run `migrate` whenever `tgcloud/schema.js` changes.

## Develop

```sh
bun run dev          # Vite dev server; outside Telegram the app answers from a mock backend (src/dev/mock.js)
bun test             # backend tests
bun run typecheck    # tsc (checkJs) + svelte-check
```

In the dev server, `?lang=ru` previews Russian, and `?as=member`, `?few` and `?unjoined` switch the mock's scenarios.

The fake SDK follows the real platform's quirks wherever they've been found. For example, interpolating a table
object into `sql` throws, just as it does on the platform. When something works in tests but not in production,
fix the fake as well as the code.

### Platform notes

- There is no cron. Exchanges past their deadline plus 30 days are closed lazily, whenever any endpoint or handler runs.
- The platform doesn't document transactions. The draw is a single batch insert, and unique indexes on
  (exchange, santa) and (exchange, giftee) make a concurrent second draw fail as a whole.
- `tgcloud run <module> '<args>' --ctx '<json5>'` runs a local module in the cloud without deploying it. It's useful
  for checking platform behaviour.

## Docs

The design spec, the implementation plan and the mockups are in [`docs/superpowers/`](docs/superpowers/).

## Licence

[AGPL-3.0](LICENSE). If you run a modified version as a service, you must offer its complete source to that
service's users.
