# Secret Santa — Telegram Mini App design

Date: 2026-10-11
Mockups: `2026-10-11-secret-santa-mockups.html` (same folder), also at https://claude.ai/artifact/R16R5rfgLA7psLoxcHAu2g. Screen numbers below refer to the mockups.

## Intent

A public Secret Santa service that lives entirely inside Telegram. Anyone can start a gift exchange, share a code, and let anyone with that code join. When the organiser is ready, names are drawn; each person learns who they gift to, where to send it, and what that person would like. Santa and giftee talk anonymously through the bot. Gifts are tracked from "sent" to "received"; Santas who don't deliver can be nudged, contacted and blocked, with a right to appeal.

Why Telegram-only: everyone already has it, identity comes for free (no sign-up), and the bot can notify people. Why serverless: nothing to run or pay for; it runs on Telegram Serverless.

## Goals

- Create an exchange in under a minute, share it as a code or link.
- Join with a nickname, shipping address and optional wishes, or "Surprise me".
- Organiser draws names; everyone is notified and sees only their own giftee.
- Anonymous two-way messaging between each Santa and their giftee.
- Gift tracking: sent (with optional tracking number) → received; exchange closes when all received.
- Deadline with accountability: nudges, organiser contact, blocking, appeals.
- Home screen of all my exchanges. Themes: Auto, Light, Dark, Christmas, per person. English and Russian.

## Non-goals

- No chat-command UI. The bot only sends notifications and answers `/start` with an "Open" button. It is "mini app only".
- No payments, gift purchasing or carrier tracking lookups (tracking number is just text).
- No exclusions ("don't pair spouses"), no re-draw, no multiple rounds.
- No global admin panel. Moderation is per organiser (blocks and appeals).
- No web version outside Telegram.

## Anti-goals (failure even if it works)

- **A pairing leaks.** Nobody, including the organiser, sees who is whose Santa — with one deliberate exception below. The giftee never learns their Santa: not through chat, notifications, API responses, or UI. Notifications never name the giftee or include message text ("Your giftee replied", never "Masha replied").
- **Addresses leak.** An address is visible only to its owner and to the person who drew it. Never in the waiting room, progress list, or any other member's API response.
- Someone draws themselves.
- **Broken pairing.** In every drawn exchange, every member is Santa to exactly one giftee and giftee of exactly one Santa, always. Enforced three ways: the draw produces a permutation of the members (checked before saving); the database has unique constraints on (exchange, santa) and (exchange, giftee); and nothing after the draw can add, remove or reassign a member (no leaving, removing, block-removal or re-draw once drawn). A test asserts this for every exchange size from 3 to 100.
- Good-faith Santas get punished: a Santa who marked their gift as sent is never revealed or offered for blocking.

**The one deliberate exception:** after the deadline passes, the organiser (only) sees the identity of Santas whose giftee hasn't received a gift **and** who haven't marked it as sent.

## Constraints

- **Platform: Telegram Serverless** (https://core.telegram.org/bots/serverless). Backend is plain JS under `tgcloud/` (`handlers/`, `endpoints/`, `lib/`, `schema.js`), deployed with the `tgcloud` CLI. No npm packages, no filesystem, network only via SDK `fetch`. Per-bot SQLite via a Drizzle-like `db`; **no foreign keys; no documented transactions; no cron/scheduler; no documented time limits or randomness source**. Mini App static files hosted at `https://app<app_id>.tgcloud.ai/` (`tgcloud.jsonc`: `"source": "dist", "spa": true`); `/api/` is reserved.
- Mini App calls the backend with `Telegram.WebApp.Serverless.call(name, input, cb)`; init data is platform-verified (`ctx.initData`). **All authorization is server-side from `ctx.initData.user.id`.**
- **Front-end: Svelte 5 + Vite (SPA), Tailwind + daisyUI.**
- The bot can message only users who allowed it: call `Telegram.WebApp.requestWriteAccess()` after Join (users who pressed `/start` are already reachable).
- Bot messages can't be styled: text with Telegram formatting, an optional picture/animation with caption, and inline buttons. They render in the reader's Telegram theme.

## Decided by the user

**Exchanges and joining**
1. Public-by-code: anyone creates an exchange, gets a short code (e.g. `K7Q-4MX`) and invite link; anyone with either can join.
2. Minimum **3** members to draw. (Known trade-off: in a group of exactly 3, each person can deduce their Santa.)
3. Join form: nickname (prefilled from Telegram first name), shipping address (one free-text box), then **"I have ideas" / "Surprise me"**. With ideas: wishlist link (optional) and free-text likes and dislikes (optional). The Santa sees the text exactly as typed. "Surprise me" shows the Santa a "Surprise me" card (5b); both empty without "Surprise me" shows "No wishlist yet".
4. Members edit their own details any time (before and after the draw).
5. Members other than the organiser can **leave until the draw** (with confirmation). After the draw there is no leaving.

**Organiser**
6. Creates with: name, **budget**, currency, and **"gifts arrive by" deadline**.
7. **Budget** is a switch: **Any / Up to / At least / Range**, showing only the amount boxes that kind needs, plus currency picked by the organiser. Displays as "any budget", "up to 3 000 RUB", "from 1 000 RUB", "1 000–3 000 RUB".
8. Organiser can edit name, budget and deadline **until the draw**, and **move the deadline after it**.
9. Organiser starts the draw manually.

**After the draw**
10. Bot messages everyone when names are drawn ("See my recipient" button, no names).
11. Exchange screen has three tabs (5, 5c, 7):
    - **My giftee:** nickname, budget, deadline, wishlist, likes/dislikes, address (copy), "Message <giftee> anonymously", and **Shipping**: optional tracking number + "Mark as sent". Marking sent notifies the giftee anonymously.
    - **My gift:** status of my own incoming gift (Not sent yet / On its way + tracking number, copyable), "Message my Santa", **"I received my gift"** (notifies my Santa anonymously), link to edit my details.
    - **Progress:** everyone sees each member's gift status: not sent / on its way / received.
12. **Anonymous chat, both ways:** one thread per Santa→giftee pair. Giftee sees "Your Secret Santa"; Santa sees the giftee's nickname. New-message notices via bot ("Open chat" button), never containing text or names.
13. **Deadline passed:** in Progress, the organiser sees "Only you see this: <giftee>'s Santa is <name>, hasn't marked the gift as sent", with **Nudge**, **Message <name>** (direct Telegram link, works without a username) and **Block <name>**. Nudges go to Santas who haven't marked sent; the nudge comes from the bot, never naming the organiser.

**Closing**
14. Exchange **closes** when everyone has marked "I received my gift", or automatically **30 days after the deadline**. Closed exchanges show as "Closed" on home.
15. **Addresses, wishes and chats are deleted at closing.**
16. If a gift never arrived at closing: the giftee gets a kind **"We're so sorry"** message (picture + caption, screen 8); the organiser is told and, if that Santa never marked it as sent, sees who it was with Message / Block / Let it go (8b).

**Blocking and appeals**
17. A **block** is by an organiser, against a Santa who didn't mark their gift as sent; it stops that person from creating or joining exchanges anywhere in the bot, and **removes them from every exchange they're in that hasn't been drawn yet**. Exchanges already drawn keep them, so no one's pairing breaks.
18. The blocked person **is told** (screen 9) why and by which exchange, with an **Appeal** button; opening the app while blocked shows the same explanation instead of home.
19. **Appeals go to the organiser who blocked** (9c): explanation text + optional tracking number; organiser picks Unblock / Keep blocked; the appellant is told the result.

**Everything else**
20. **Home ("My exchanges")** lists exchanges I created or joined: Waiting / See recipient (drawn, not yet viewed) / Drawn / Closed. Join-by-code box and "Create an exchange". Empty state: short intro.
21. **Themes:** Auto (default, follows Telegram light/dark), Light, Dark (Telegram colours), Christmas (pine, cranberry, gold, snow, garland). **Per person**, switcher on the home screen. Not per exchange.
22. **Languages:** English and Russian, for the app and bot messages. Russian if the user's Telegram language is `ru`, otherwise English. Structured so more languages can be added.
23. **Stack:** Telegram Serverless + Svelte + daisyUI.

## My calls (not discussed; builder may revisit)

- **Project location:** `~/bots/secret-santa`, its own git repo.
- **Draw:** uniform random derangement (shuffle and retry until nobody has themselves), so mutual pairs are possible and Santas are harder to guess. Use `crypto.getRandomValues` if the runtime has it, else `Math.random`.
- **Draw is one-shot:** flip status `open → drawn` with a conditional update (`WHERE status = 'open'`); only the request that wins writes assignments and sends notifications. Joining, leaving, removing and budget edits are closed after that.
- **Organiser's extra powers before the draw:** remove a member, delete the exchange (⋯ menu, with confirmation). The organiser can't leave their own exchange.
- **Blocking side effects:** exchanges the blocked person **created** that aren't drawn yet are deleted, and their members are told the exchange was cancelled. Unblocking doesn't restore removed memberships. Several organisers may block the same person; each block has its own appeal, and the person is free only when every block is lifted. One appeal per block.
- **Blocked users' data:** keep only what's needed to enforce the block and show the appeal (user id, exchange name, dates, appeal text) after the exchange's other data is deleted.
- **Auto-close without cron:** checked lazily: whenever any endpoint or handler runs, close exchanges whose deadline + 30 days has passed (bounded batch per invocation), then send the closing messages. Messages may arrive late if the bot is idle.
- **Deadline semantics:** a date; passes at end of that day in UTC. Deadline must be in the future when set.
- **Direct "Message <name>" link:** `tg://user?id=<id>` / Telegram's open-profile mechanism; Telegram privacy settings may block it. If it can't work, fall back to a message relayed by the bot to that Santa (not anonymous, from "the organiser of <exchange>").
- **Code format:** 6 characters from an unambiguous alphabet (no 0/O/1/I/L), shown `XXX-XXX`, case-insensitive input. Invite link `https://t.me/<bot>?startapp=<code>` opens straight into Join.
- **Currency list:** `Intl.supportedValuesOf('currency')`; store the ISO code; amounts are integers.
- **Theme storage:** Telegram `CloudStorage` (per user, syncs across devices), default Auto.
- **"See recipient" vs "Drawn" on home:** "See recipient" until the person first opens their giftee tab.
- **Notification failures** (blocked bot, no write access): skip that user and carry on; respect `retry_after` on 429. Cap exchanges at 100 members so a draw's notifications fit one invocation.
- **Closing picture (screen 8):** one static illustration, same for every user, shipped as an asset; the mockup's fox is a placeholder.
- **Russian copy:** written by the builder alongside English; reviewed by the user before release.

## Left to the builder

- Database schema and indexes; endpoint list and shapes; error messages.
- Svelte component structure, routing (hash or state), refresh strategy (poll on open / visibility change).
- daisyUI theme definitions (Light/Dark from Telegram `themeParams`, Christmas from mockups).
- How deep links from bot buttons carry the target screen (`start_param` / URL).
- Local dev and testing; verifying the platform unknowns listed under Constraints.
