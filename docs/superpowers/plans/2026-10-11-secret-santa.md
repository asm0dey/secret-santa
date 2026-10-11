# Secret Santa Mini App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Telegram Mini App + bot for public Secret Santa exchanges (create by code, join, draw, anonymous chat, gift tracking, deadlines, blocking with appeals), running on Telegram Serverless.

**Architecture:** Backend is plain JS modules in `tgcloud/` (endpoints the Mini App calls, update handlers, shared `lib/`, `schema.js`) deployed with the `tgcloud` CLI. Front-end is a Svelte 5 SPA (Vite, Tailwind 4, daisyUI 5) built to `dist/` and hosted by the platform. Backend logic is tested locally with `bun test` against a fake `sdk` package (Drizzle over `bun:sqlite`) that mimics the platform SDK.

**Tech Stack:** Telegram Serverless (`@tgcloud/cli`), Bun (package manager + test runner; `~/.bun/bin/bun`, no npm on this machine), Drizzle ORM (tests only), Svelte 5, Vite, Tailwind CSS 4, daisyUI 5.

**Spec:** `docs/superpowers/specs/2026-10-11-secret-santa-design.md` (mockups: `docs/superpowers/specs/2026-10-11-secret-santa-mockups.html`). Screen numbers (1, 2, 4a, 5c, 8b …) refer to the mockups.

## Global Constraints

- Backend code under `tgcloud/` only imports `sdk`, `sdk/db` and relative project modules; relative imports end in `.js`; no npm packages; `handlers/` and `endpoints/` are flat (subfolders only in `lib/`).
- Query builder subset only: `select/insert/update/delete`, `.where/.orderBy/.limit`, `.get()/.all()/.run()`, operators `eq, and, desc, asc, count, sql`. Anything else (`or`, `inArray`, `isNull`, `lt`, `.returning()`, transactions) via `` sql`…` `` or not at all — the platform documents nothing more.
- Schema uses only `integer` and `text` columns (no `json`/`boolean` modes), no SQL defaults, no foreign keys.
- Every endpoint authorizes from `ctx.initData.user.id`; never trust user ids from input except as targets that are then checked.
- Endpoint errors: `throw new EndpointError(code, { code })` with codes from `lib/errors.js` only.
- Minimum **3** members to draw; maximum **100** members per exchange.
- Pairing invariant: in a drawn exchange every member is Santa of exactly one giftee and giftee of exactly one Santa; nothing changes membership or assignments after the draw.
- Bot notifications never contain a giftee's/Santa's name or chat text, except: organiser's overdue/closing messages name the not-sent Santa; appeal messages to the organiser name the appellant.
- Languages: `ru` if Telegram `language_code` starts with `ru`, else `en`; every user-visible string (app + bot) exists in both.
- Deadline is a `YYYY-MM-DD` date; it passes at the end of that day UTC (`Date.parse(d + 'T00:00:00Z') + 86_400_000`); auto-close 30 days after that.
- Type checking: JSDoc + `checkJs`; `bun run typecheck` exits 0 before every commit from Task 7b on (front-end: `svelte-check`, added in Task 13).
- Themes: `auto` (default) | `light` | `dark` | `christmas`, per user, stored in Telegram `CloudStorage` key `theme`.
- Invite link: `https://t.me/<BOT_USERNAME>?startapp=<CODE>`; code is 6 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, displayed `XXX-XXX`.

## Review Focus

1. Two "Start the draw" taps at once (double tap, two devices) → exactly one draw happens, the second request gets `ALREADY_DRAWN`, notifications go out once. (Task 7)
2. A member edits their address after the draw → their Santa's next `getExchange` shows the new address. (Task 8)
3. A blocked user opens an invite link → join is refused server-side with `BLOCKED` and the app shows the blocked screen, not a broken join form. (Tasks 12, 16)
4. Organiser sets a deadline in the past, or a range with min > max, or negative amounts → `BAD_INPUT`, nothing saved. (Task 5)
5. Code typed as `k7q 4mx` or `K7Q-4MX` → normalises and finds the exchange; a code with characters that never appear in codes (`0`, `O`, `1`…) or an unknown code → `NOT_FOUND`, shown as "No exchange with this code". (Tasks 3, 6)

---

## File Structure

```
package.json                 bun scripts: dev, build, test, deploy; devDeps incl. "sdk": "file:./test/sdk"
tgcloud.jsonc                static hosting: dist, spa
index.html, vite.config.js
public/sorry.png             closing illustration (from public/sorry.svg)
test/sdk/                    fake platform SDK (package "sdk"): index.js, db.js, package.json
test/helpers.js              resetDb(), ctxFor(user), seed helpers, api call log access
tgcloud/schema.js            tables
tgcloud/lib/
  errors.js                  error codes + fail()
  clock.js                   clock.now() (overridable in tests)
  config.js                  APP_URL, BOT_USERNAME
  draw.js                    derangement (pure)
  code.js                    invite codes (pure + uniqueness)
  budget.js                  validate/format budget (pure; also imported by the app)
  dates.js                   deadline helpers (pure; also imported by the app)
  i18n.js                    makeT() + bot strings en/ru
  session.js                 enter(ctx): upsert user, sweep, return me
  access.js                  loadExchange, requireMember, requireOrganiser
  notify.js                  send(), sendPhoto(); swallow per-user failures
  closing.js                 closeExchange()
  sweep.js                   sweep(now)
  moderation.js              blockSanta(), submitAppeal(), decideAppeal()
tgcloud/endpoints/           one file per endpoint (see tasks)
tgcloud/handlers/            message.js, callback_query.js
src/main.js, src/App.svelte, src/app.css
src/lib/                     api.js, tg.js, theme.js, i18n.js, strings/en.js, strings/ru.js, router.js
src/dev/mock.js              fixture backend when not inside Telegram
src/screens/                 Home, ExchangeForm, DetailsForm, Exchange, GifteeTab, GiftTab, ProgressTab, Chat, Blocked, Appeal
tests/                       *.test.js (bun test)
```

## Data model (`tgcloud/schema.js`)

All ids `integer`; times are epoch ms `integer`; nullable unless noted.

- `users`: `id` (Telegram id, pk), `firstName` (notNull), `username`, `lang` (notNull), `canMessage` (0/1), `createdAt`.
- `exchanges`: `id` (pk autoincrement), `code` (unique, notNull), `name` (notNull), `organiserId` (notNull), `budgetKind` (`any|max|min|range`), `budgetMin`, `budgetMax`, `currency`, `deadline` (text `YYYY-MM-DD`), `closeAt` (deadline end + 30d), `status` (`open|drawn|closed`), `drawnAt`, `closedAt`, `createdAt`.
- `members`: `id` pk, `exchangeId`, `userId`, `nickname`, `address`, `wishMode` (`ideas|surprise`), `wishlistUrl`, `wishes`, `joinedAt`; uniqueIndex `members_ex_user` (exchangeId, userId).
- `assignments`: `id` pk, `exchangeId`, `santaId`, `gifteeId`, `seenAt`, `sentAt`, `tracking`, `receivedAt`; uniqueIndex `asg_ex_santa` (exchangeId, santaId); uniqueIndex `asg_ex_giftee` (exchangeId, gifteeId).
- `messages`: `id` pk, `exchangeId`, `assignmentId`, `fromSanta` (0/1), `text`, `createdAt`; index on assignmentId.
- `blocks`: `id` pk, `userId`, `organiserId`, `exchangeId`, `exchangeName`, `createdAt`, `appealText`, `appealTracking`, `appealAt`, `decision` (`unblocked|kept`), `decidedAt`. Active block = `decision IS NULL OR decision = 'kept'`.

---

### Task 1: Project skeleton, fake SDK, schema

**Files:**
- Create: `package.json`, `.gitignore` (`node_modules`, `dist`, `.tgcloud`), `test/sdk/package.json`, `test/sdk/index.js`, `test/sdk/db.js`, `test/helpers.js`, `tgcloud/schema.js`, `tgcloud/lib/errors.js`, `tgcloud/lib/clock.js`, `tgcloud/lib/config.js`
- Test: `tests/schema.test.js`

**Interfaces:**
- Produces:
  - `sdk` (fake): `db` (drizzle over in-memory `bun:sqlite`), `api` (Proxy: any `api.method(params)` pushes `{ method, params }` to `api.calls` and returns `{ message_id: api.calls.length }`; if `api.failFor(method, params)` returns an error it throws a `BotApiError`), `EndpointError(description, parameters)` with `.parameters`, `BotApiError`.
  - `sdk/db` (fake): `table` (= `sqliteTable`), `integer`, `text`, `index`, `uniqueIndex`, `eq`, `and`, `desc`, `asc`, `count`, `sql`.
  - `test/helpers.js`: `resetDb(): void` (drop + create every table exported by `tgcloud/schema.js` from `getTableConfig`, incl. unique indexes; clears `api.calls`), `ctxFor(user: {id, first_name?, username?, language_code?, start_param?}) → { initData: { user, start_param } }`, `setNow(ms)`.
  - `lib/errors.js`: `ERR = { NOT_FOUND, FORBIDDEN, BLOCKED, BAD_INPUT, ALREADY_MEMBER, FULL, TOO_FEW, ALREADY_DRAWN, NOT_DRAWN, CLOSED, NOT_YET }` (values = names), `fail(code) → never`.
  - `lib/clock.js`: `clock = { now: () => Date.now() }`.
  - `lib/config.js`: `APP_URL`, `BOT_USERNAME` (placeholders, filled in Task 18).

- [ ] **Step 1:** `bun init` is not needed — write `package.json` (`"type": "module"`, scripts `test: "bun test"`), add `drizzle-orm` and `"sdk": "file:./test/sdk"` as devDependencies, run `~/.bun/bin/bun install`. Expected: installs, `node_modules/sdk` symlinked.
- [ ] **Step 2: Write the failing test** `tests/schema.test.js`:

```js
test('tables exist and pairing uniqueness is enforced', async () => {
  resetDb();
  await db.insert(assignments).values({ exchangeId: 1, santaId: 10, gifteeId: 20 }).run();
  expect(() => db.insert(assignments).values({ exchangeId: 1, santaId: 10, gifteeId: 30 }).run()).toThrow();
  expect(() => db.insert(assignments).values({ exchangeId: 1, santaId: 40, gifteeId: 20 }).run()).toThrow();
  await db.insert(assignments).values({ exchangeId: 2, santaId: 10, gifteeId: 20 }).run(); // other exchange ok
});
test('one membership per user per exchange', ...) // members_ex_user throws on duplicate
```
- [ ] **Step 3:** Run `bun test tests/schema.test.js` → FAIL (modules missing).
- [ ] **Step 4:** Implement the fake SDK, helpers, `schema.js` per the Data model, `errors.js`, `clock.js`, `config.js`.
- [ ] **Step 5:** Run `bun test` → PASS.
- [ ] **Step 6:** Commit `feat: project skeleton, fake sdk, schema`.

### Task 2: Draw algorithm

**Files:** Create `tgcloud/lib/draw.js`; Test `tests/draw.test.js`

**Interfaces:**
- Produces: `derange(ids: number[], rand?: () => number) → Array<{ santaId, gifteeId }>`; throws `Error('TOO_FEW')` for fewer than 3 ids. `rand` defaults to a `crypto.getRandomValues`-based float if `globalThis.crypto?.getRandomValues` exists, else `Math.random`.

- [ ] **Step 1: Write the failing test:**

```js
test('every member gives once and receives once, never to self, n=3..100', () => {
  for (let n = 3; n <= 100; n++) {
    const ids = Array.from({ length: n }, (_, i) => 1000 + i);
    const pairs = derange(ids);
    expect(pairs.length).toBe(n);
    expect(new Set(pairs.map(p => p.santaId))).toEqual(new Set(ids));
    expect(new Set(pairs.map(p => p.gifteeId))).toEqual(new Set(ids));
    expect(pairs.every(p => p.santaId !== p.gifteeId)).toBe(true);
  }
});
test('mutual pairs are possible (not always one cycle)', () => { /* 2000 draws of n=4: at least one has a->b and b->a */ });
test('fewer than 3 throws', () => expect(() => derange([1, 2])).toThrow('TOO_FEW'));
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: Fisher–Yates shuffle a copy, pair `ids[i] → shuffled[i]`, retry while any fixed point (expected ~e tries).
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat: derangement draw`.

### Task 3: Pure helpers — codes, budget, dates, i18n

**Files:** Create `tgcloud/lib/code.js`, `tgcloud/lib/budget.js`, `tgcloud/lib/dates.js`, `tgcloud/lib/i18n.js`; Test `tests/pure.test.js`

**Interfaces:**
- `code.js`: `ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'`, `newCode(rand?) → string` (6 chars from ALPHABET), `normalizeCode(input: string) → string|null` (strip spaces and dashes, uppercase; `null` unless exactly 6 chars all in ALPHABET — `0/O/1/I/L` never occur in real codes, so no guessing), `displayCode('ABC234') → 'ABC-234'`.
- `budget.js`: `validateBudget({kind, min, max, currency}) → normalized | null` (kind ∈ any|max|min|range; amounts positive integers; `max` needs max, `min` needs min, `range` needs both with min ≤ max; currency 3 uppercase letters unless kind `any`); `formatBudget(b, lang) → string` — en: `any budget`, `up to 3 000 RUB`, `from 1 000 RUB`, `1 000–3 000 RUB`; ru: `любой бюджет`, `до 3 000 RUB`, `от 1 000 RUB`, `1 000–3 000 RUB`. Thousands separator is a non-breaking space (` `) in both.
- `dates.js`: `deadlineEnd(d) → ms`, `closeAtFor(d) → deadlineEnd(d) + 30*86_400_000`, `isPast(d, now) → now >= deadlineEnd(d)`, `isValidFutureDate(d, now) → boolean` (`/^\d{4}-\d{2}-\d{2}$/`, real date, `deadlineEnd(d) > now`).
- `i18n.js`: `langOf(code?: string) → 'ru'|'en'`, `makeT(dict) → (lang, key, params?) → string` (`{name}` placeholders; falls back to `en`; throws on unknown key), `t` = `makeT(BOT)` with bot keys listed in Task 7–12 copy blocks.

- [ ] **Step 1: Write failing tests** for: `normalizeCode('k7q 4mx') === 'K7Q4MX'`, `normalizeCode('K7Q-4MX') === 'K7Q4MX'`, `normalizeCode('O0O0O0') === null`, `newCode()` matches `/^[A-HJKMNP-Z2-9]{6}$/`; each budget kind formats as above in both languages; `validateBudget({kind:'range',min:3000,max:1000,currency:'RUB'}) === null`; negative / non-integer → null; `isPast('2026-12-20', Date.parse('2026-12-20T23:59:59Z')) === false` and `… '2026-12-21T00:00:00Z' === true`; `langOf('ru-RU') === 'ru'`, `langOf(undefined) === 'en'`; `t('ru', 'missingKeyInRu')` falls back to en.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat: codes, budget, dates, i18n helpers`.

### Task 4: Session, access control, notify

**Files:** Create `tgcloud/lib/session.js`, `tgcloud/lib/access.js`, `tgcloud/lib/notify.js`, `tgcloud/lib/sweep.js` (stub: `export async function sweep(now) {}` — real in Task 11); Test `tests/session.test.js`

**Interfaces:**
- `enter(ctx) → me` where `me = { id, firstName, username, lang, canMessage, blocked: boolean }`: upserts `users` from `ctx.initData.user` (firstName, username, lang via `langOf`, `canMessage` from `allows_write_to_pm` when present, keep previous otherwise), runs `await sweep(clock.now())`, computes `blocked` (any active block).
- `access.js`: `loadExchange(id) → row` (`NOT_FOUND`), `requireMember(ex, userId) → member` (`FORBIDDEN`), `requireOrganiser(ex, userId)` (`FORBIDDEN`), `requireStatus(ex, ...statuses)` (`ALREADY_DRAWN` if drawn when open required, `NOT_DRAWN` if open when drawn required, `CLOSED` if closed).
- `notify.js`: `send(userId, text, buttons?) → boolean`, `sendPhoto(userId, photoUrl, caption, buttons?) → boolean`. `buttons` = rows of `{ text, app?: '#/route' }` (→ `web_app: { url: APP_URL + route }`), `{ text, url }`, or `{ text, data }` (callback). Uses `parse_mode: 'HTML'`; escapes interpolated user text; swallows `BotApiError` (returns false) and on 429 waits `retry_after` once then retries once. Never throws.

- [ ] **Step 1: Failing tests:** `enter` creates then updates a user (name change persists); `lang` is `ru` for `language_code: 'ru'`; `requireOrganiser` throws `FORBIDDEN` for a member; `send` returns false and does not throw when `api.failFor` returns a 403 error; `send` HTML-escapes `<b>` in params; a web_app button gets `APP_URL + '#/x/5'`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat: session, access, notify`.

### Task 5: Create, edit, delete exchange; home

**Files:** Create `tgcloud/endpoints/createExchange.js`, `updateExchange.js`, `deleteExchange.js`, `home.js`; Test `tests/exchange.test.js`

**Interfaces:**
- `createExchange({ name, budget, deadline }) → { id, code }`: `BLOCKED` if me.blocked; `BAD_INPUT` if name empty/ >60 chars, `validateBudget` null, or `!isValidFutureDate`. Retries `newCode()` on unique clash (max 5). Sets `closeAt`. Does **not** add the organiser as member (they join next, screen 3).
- `updateExchange({ id, name?, budget?, deadline? }) → { ok }`: organiser only; status `open`: any field; status `drawn`: only `deadline` (else `ALREADY_DRAWN`); `closed`: `CLOSED`. Recomputes `closeAt`.
- `deleteExchange({ id }) → { ok }`: organiser, status `open`; deletes exchange + members; notifies other members with `t(lang,'exchangeCancelled',{exchange})`.
- `home({}) → { me: { id, firstName, lang, blocks: [{ id, exchangeName, createdAt, appealed, decision }] }, exchanges: [{ id, name, status, view: 'waiting'|'see'|'drawn'|'closed', isOrganiser, memberCount }] }`: exchanges where I'm organiser or member, newest first; `view = 'see'` when drawn and my assignment has `seenAt` null. `blocks` lists active blocks only.

Bot copy (`i18n.js`): `exchangeCancelled` — en `"{exchange}" was cancelled by its organiser.` / ru `Обмен «{exchange}» отменён организатором.`

- [ ] **Step 1: Failing tests:** create returns 6-char code and appears in creator's `home` as `waiting`, `isOrganiser: true`; past deadline → `BAD_INPUT` and no row; range min>max → `BAD_INPUT`; non-organiser update → `FORBIDDEN`; after draw (set status manually) updating `budget` → `ALREADY_DRAWN` but `deadline` succeeds and moves `closeAt`; delete notifies a member (one `sendMessage` to them, none to organiser); blocked user create → `BLOCKED`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: exchange create/edit/delete, home`.

### Task 6: Join, details, leave, remove, exchange view before the draw

**Files:** Create `tgcloud/endpoints/findByCode.js`, `join.js`, `updateMyDetails.js`, `leave.js`, `removeMember.js`, `getExchange.js` (pre-draw part); Test `tests/members.test.js`

**Interfaces:**
- `details = { nickname, address, wishMode: 'ideas'|'surprise', wishlistUrl?, wishes? }`; validate: nickname 1–40, address 1–500, wishlistUrl empty or `https://`/`http://` ≤ 500, wishes ≤ 1000; `surprise` stores wishlistUrl/wishes as null. Else `BAD_INPUT`.
- `findByCode({ code }) → { id, name, status, budget, deadline, organiserName, memberCount, isMember }`; `NOT_FOUND` if `normalizeCode` null or no row.
- `join({ code, details }) → { id }`: `BLOCKED`, `NOT_FOUND`, `ALREADY_DRAWN`/`CLOSED`, `ALREADY_MEMBER`, `FULL` at 100.
- `updateMyDetails({ id, details }) → { ok }`: member; allowed in `open` and `drawn`; `CLOSED` otherwise.
- `leave({ id })`: member, not organiser (`FORBIDDEN`), status `open`. `removeMember({ id, userId })`: organiser, status `open`, target not organiser; notifies removed user `t(lang,'removed',{exchange})`.
- `getExchange({ id }) → { id, name, code, displayCode, inviteLink, status, budget, deadline, isOrganiser, organiserName, members: [{ userId, nickname, isMe, isOrganiser, tag: 'wishlist'|'surprise'|null }], me: details|null, …drawn fields from Task 8 }`. Members list **never** includes address, wishlistUrl or wishes of others. Organiser who hasn't joined yet gets `me: null`.

Bot copy: `removed` — en `You were removed from "{exchange}".` / ru `Вас удалили из обмена «{exchange}».`

- [ ] **Step 1: Failing tests:** join by `'k7q 4mx'`-style input of a real code works; unknown code → `NOT_FOUND`; second join → `ALREADY_MEMBER`; 101st join → `FULL`; join after draw → `ALREADY_DRAWN`; `getExchange` JSON for member B contains no substring of member A's address/wishes (`JSON.stringify(res).includes(addressA) === false`); surprise member gets `tag: 'surprise'`; organiser can't `leave`; member leave works before draw and `ALREADY_DRAWN` after; non-member `getExchange` → `FORBIDDEN`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: join, details, leave, remove, pre-draw view`.

### Task 7: The draw

**Files:** Create `tgcloud/endpoints/draw.js`; Test `tests/drawEndpoint.test.js`

**Interfaces:**
- `draw({ id }) → { ok }`: organiser; `TOO_FEW` under 3 members; if assignments already exist → just ensure `status = 'drawn'` and return `ALREADY_DRAWN`; else `derange(memberUserIds)`, **one** batch `insert(assignments).values(pairs)` (atomic single statement; the unique indexes make a concurrent second batch fail entirely → catch → `ALREADY_DRAWN`), then `update exchanges set status='drawn', drawnAt` where `status='open'`, then notify every member: `send(userId, t(lang,'drawn',{exchange, organiser, budget}), [[{ text: t(lang,'btnSeeRecipient'), app: '#/x/<id>/giftee' }]])`.

Bot copy: `drawn` — en `<b>Names are drawn for "{exchange}"</b>\n{organiser} started the draw. Open the app to see who you're gifting to. Budget: {budget}.` / ru `<b>Жеребьёвка в обмене «{exchange}» прошла</b>\n{organiser} запустил(а) жеребьёвку. Откройте приложение, чтобы узнать, кому вы дарите подарок. Бюджет: {budget}.`; `btnSeeRecipient` — `See my recipient` / `Кому я дарю`.

- [ ] **Step 1: Failing tests:** 5 members → 5 assignment rows satisfying the pairing invariant, status `drawn`, exactly 5 `sendMessage` calls, and no message text contains any member nickname other than the organiser's; second `draw` → `ALREADY_DRAWN` and still 5 messages total; `Promise.all([draw(), draw()])` → one success, one `ALREADY_DRAWN`, 5 assignments; 2 members → `TOO_FEW`; non-organiser → `FORBIDDEN`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: draw`.

### Task 7b: Type checking (user request, added mid-plan)

The user chose: stay on JavaScript, but add type checking via JSDoc + `checkJs` — no build step, deploy unchanged.

**Files:**
- Modify: `jsconfig.json` (keep the existing `paths` for `sdk`/`sdk/db`), `package.json` (script `typecheck`)
- Create: `tgcloud/lib/types.js` (JSDoc `@typedef`s only, no runtime code)
- Modify: every `.js` under `tgcloud/`, `test/`, `tests/` as needed to pass

**Requirements:**
- `~/.bun/bin/bun add -d typescript @types/bun`; `"typecheck": "tsc -p jsconfig.json"`.
- jsconfig `compilerOptions`: `checkJs: true`, `noEmit: true`, `strict: true`, `module: "esnext"`, `moduleResolution: "bundler"`, `target: "es2022"`, `types: ["bun"]`, `allowJs: true`; `include`: `tgcloud`, `test`, `tests`. (`src/` and Svelte get `svelte-check` in Task 13.)
- `types.js` defines the shared shapes and the endpoints use them via `/** @typedef {import('../lib/types.js').X} X */` or `@param`/`@returns`: `Me` (enter's return), `Budget` ({kind:'any'|'max'|'min'|'range', min:number|null, max:number|null, currency:string|null}), `Details` (join input), `Button` (notify button union: `{text, app}` | `{text, url}` | `{text, data}`), `ErrCode`, `Lang` ('en'|'ru'), `EndpointCtx` ({ initData: { user: TgUser, start_param?: string } }), `TgUser`.
- Every endpoint's default export gets `@param {…} input` and `@param {EndpointCtx} ctx` and `@returns`.
- Fix real errors the checker finds (report each one that was a real bug, not just an annotation). Use `// @ts-expect-error` only with a one-line reason, and only for fake-SDK/platform mismatches.
- `bun run typecheck` exits 0 and `bun test` stays green.

**Steps:**
- [ ] Step 1: add deps, jsconfig options, script; run `bun run typecheck` and record the initial error count (this is the RED).
- [ ] Step 2: add `types.js` and annotations; fix errors until 0.
- [ ] Step 3: `bun run typecheck` → exit 0; `bun test` → all pass.
- [ ] Step 4: commit `chore: type checking with JSDoc + checkJs`.

### Task 8: After the draw — giftee, my gift, progress, sent, received

**Files:** Modify `tgcloud/endpoints/getExchange.js`; Create `markSent.js`, `markReceived.js`, `tgcloud/lib/closing.js` (`closeExchange(ex, reason)` — Task 8 implements the `'complete'` path; Task 11 adds `'timeout'`); Test `tests/afterDraw.test.js`

**Interfaces:**
- `getExchange` adds when status ≠ open: `giftee: { nickname, address, wishMode, wishlistUrl, wishes, sentAt, tracking }` (from my assignment as Santa; sets `seenAt` if null), `myGift: { status: 'not_sent'|'on_way'|'received', tracking, sentAt }` (my assignment as giftee; no Santa id/name ever), `progress: [{ userId, nickname, gift: same enum }]`, `overdue` (Task 10). When closed, personal fields are null.
- `markSent({ id, tracking? }) → { ok }`: tracking ≤ 64 chars trimmed or null; sets `sentAt` (idempotent; updating tracking allowed); notifies giftee `t('giftSent',{exchange, tracking?})` with button `app: '#/x/<id>/gift'`.
- `markReceived({ id }) → { ok }`: sets `receivedAt` on my assignment as giftee; notifies my Santa `t('giftReceived',{exchange})`; if every assignment received → `closeExchange(ex, 'complete')`.
- `closeExchange(ex, 'complete')`: status `closed`, `closedAt`; wipe `members.address/wishlistUrl/wishes`, `assignments.tracking`, delete `messages` of that exchange.

Bot copy: `giftSent` — en `<b>{exchange}</b>\nYour Secret Santa sent your gift. It's on its way!` + optional `\nTracking: <code>{tracking}</code>` / ru `<b>{exchange}</b>\nВаш Тайный Санта отправил подарок. Он уже в пути!` + `\nТрек-номер: <code>{tracking}</code>`; `giftReceived` — `<b>{exchange}</b>\nYour giftee received your gift. Nice work, Santa!` / `<b>{exchange}</b>\nВаш получатель получил подарок. Отличная работа, Санта!`; `btnMyGift` — `My gift` / `Мой подарок`.

- [ ] **Step 1: Failing tests:** Santa's `getExchange` shows giftee's address; giftee then calls `updateMyDetails` with a new address and Santa's next `getExchange` shows the new one (Review Focus 2); giftee's response JSON contains neither the Santa's userId nor nickname anywhere (`JSON.stringify` check); `markSent` with tracking → giftee `myGift.status === 'on_way'` with tracking, one message to giftee whose text has no Santa name; all `markReceived` → status `closed`, addresses null, messages table empty for that exchange; home shows `view: 'see'` before Santa opens and `'drawn'` after.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: gift tracking and completion`.

### Task 9: Anonymous chat

**Files:** Create `tgcloud/endpoints/getThread.js`, `sendMessage.js`; Test `tests/chat.test.js`

**Interfaces:**
- `side: 'giftee'` = thread where I am Santa; `side: 'santa'` = thread where I am giftee.
- `getThread({ id, side }) → { title, messages: [{ mine, text, at }] }`; `title` = giftee nickname for `'giftee'`, `null` for `'santa'` (app shows "Your Secret Santa"). Status must be `drawn`.
- `sendMessage({ id, side, text }) → { ok }`: text 1–2000; inserts with `fromSanta`; notifies the other party: to giftee `t('newFromSanta',{exchange})` button `app: '#/x/<id>/chat/santa'`; to Santa `t('newFromGiftee',{exchange})` button `app: '#/x/<id>/chat/giftee'`.

Bot copy: `newFromSanta` — `<b>{exchange}</b>\nYour Secret Santa sent you a message.` / `<b>{exchange}</b>\nТайный Санта прислал вам сообщение.`; `newFromGiftee` — `<b>{exchange}</b>\nYour giftee replied to you.` / `<b>{exchange}</b>\nВаш получатель ответил вам.`; `btnOpenChat` — `Open chat` / `Открыть чат`.

- [ ] **Step 1: Failing tests:** Santa → giftee message appears in giftee's `getThread('santa')` with `mine: false` and in Santa's with `mine: true`; giftee's thread response never contains Santa's userId/nickname; notification texts contain neither nickname nor message text; a third member calling either side for someone else's thread only ever sees their own pairs; chat before draw → `NOT_DRAWN`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: anonymous chat`.

### Task 10: Deadline accountability — overdue, nudge, message Santa

**Files:** Modify `getExchange.js`; Create `nudge.js`, `messageSanta.js`; Test `tests/overdue.test.js`

**Interfaces:**
- `getExchange.overdue` (organiser only, status drawn, `isPast(deadline, now)`): `[{ gifteeUserId, gifteeName, santaUserId, santaName, santaUsername }]` for assignments with `sentAt` null and `receivedAt` null. Empty/absent otherwise and for everyone else.
- `nudge({ id }) → { sent: n }`: organiser, drawn, deadline past (`NOT_YET` before); messages each overdue Santa `t('nudge',{exchange, deadline})` with button `app: '#/x/<id>/giftee'`.
- `messageSanta({ id, santaUserId, text }) → { ok }`: organiser; target must be in `overdue` (`FORBIDDEN` otherwise); text 1–1000; sends `t('fromOrganiser',{organiser, exchange, text})` with a `{ text: t('btnReplyOrganiser'), url: 'tg://user?id=<organiserId>' }` button; if that send fails, retry without the button. App also shows `https://t.me/<username>` when `santaUsername` exists.

Bot copy: `nudge` — `<b>{exchange}</b>\nReminder: gifts were due by {deadline}, and your giftee hasn't received theirs yet. If it's on the way, mark it as sent or tell them in the anonymous chat.` / `<b>{exchange}</b>\nНапоминание: подарки нужно было отправить до {deadline}, а ваш получатель ещё ничего не получил. Если подарок в пути, отметьте его как отправленный или напишите получателю в анонимном чате.`; `fromOrganiser` — `<b>Message from {organiser}, organiser of "{exchange}"</b>\n{text}` / `<b>Сообщение от {organiser}, организатора обмена «{exchange}»</b>\n{text}`; `btnReplyOrganiser` — `Reply to {organiser}` / `Ответить {organiser}`.

- [ ] **Step 1: Failing tests:** before deadline `overdue` is empty and `nudge` → `NOT_YET`; after deadline organiser sees only the not-sent Santa (a Santa with `sentAt` is absent); a non-organiser member's `getExchange` has no `overdue` and its JSON lacks the overdue Santa's name; `nudge` sends exactly one message per overdue Santa; `messageSanta` to a Santa who marked sent → `FORBIDDEN`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: overdue, nudge, message santa`.

### Task 11: Auto-close and the "sorry" flow

**Files:** Modify `tgcloud/lib/sweep.js`, `tgcloud/lib/closing.js`; Create `public/sorry.svg`, `public/sorry.png`; Test `tests/closing.test.js`

**Interfaces:**
- `sweep(now)`: select up to 5 exchanges with `status = 'drawn'` and `closeAt <= now` (`sql` comparison), `closeExchange(ex, 'timeout')` each.
- `closeExchange(ex, 'timeout')`: before wiping (same wipe as `'complete'`): for each assignment with `receivedAt` null → `sendPhoto(gifteeId, APP_URL + '/sorry.png', t('sorry',{name: gifteeNickname, exchange, organiser}))`; to organiser: `t('closedSummary',{exchange, received, total})`; then per assignment with `receivedAt` null and `sentAt` null → `send(organiser, t('closedNoGift',{exchange, giftee, santa}), [[{ text: t('btnBlock',{santa}), data: 'block:<exId>:<santaId>' }, { text: t('btnLetGo'), data: 'letgo:<exId>:<santaId>' }], [{ text: t('btnMessage',{santa}), url: 'tg://user?id=<santaId>' }]])` (on failure, resend without the url row); per unreceived but sent → `t('closedLost',{exchange, giftee})` (no name of Santa, no buttons).
- `sorry.png`: 1280×800, rendered from `sorry.svg` (fox in snow at night, as in mockup 8) with `magick public/sorry.svg -resize 1280x800 public/sorry.png`.

Bot copy (`sorry` en): `<b>We're so sorry, {name}</b>\n"{exchange}" has closed, and your gift never made it to you. That isn't how Secret Santa should feel, and it's not your fault.\n\nWe've let {organiser}, the organiser, know. Thank you for being part of it. We hope next year brings you the best gift under the tree.` — ru: `<b>Нам очень жаль, {name}</b>\nОбмен «{exchange}» завершён, а ваш подарок так и не пришёл. Тайный Санта не должен так заканчиваться, и вашей вины здесь нет.\n\nМы сообщили организатору, {organiser}. Спасибо, что участвовали. Пусть в следующем году под ёлкой вас ждёт самый лучший подарок.`; `closedSummary` — `<b>"{exchange}" has closed</b>\n{received} of {total} gifts arrived.` / `<b>Обмен «{exchange}» завершён</b>\nДошло подарков: {received} из {total}.`; `closedNoGift` — `{giftee} never received a gift. Their Santa was <b>{santa}</b>, who never marked it as sent. You can message {santa}, or block them from Secret Santa so they can't create or join exchanges again.` / `{giftee} так и не получил(а) подарок. Санта — <b>{santa}</b>, он(а) так и не отметил(а) отправку. Вы можете написать {santa} или заблокировать в Тайном Санте, чтобы он(а) больше не мог(ла) создавать обмены и участвовать в них.`; `closedLost` — `{giftee}'s gift was marked as sent but never arrived. It may have been lost in the post.` / `Подарок для {giftee} был отправлен, но так и не дошёл. Возможно, он потерялся на почте.`; `btnBlock` `Block {santa}` / `Заблокировать {santa}`; `btnLetGo` `Let it go` / `Оставить как есть`; `btnMessage` `Message {santa}` / `Написать {santa}`.

- [ ] **Step 1: Failing tests:** with `setNow` 31 days after the deadline, any endpoint call (via `enter`) closes the exchange; giftee without gift gets one `sendPhoto` whose caption contains their nickname and not the Santa's; organiser gets the summary and one `closedNoGift` with callback data `block:<ex>:<santa>`; a sent-but-unreceived assignment yields `closedLost` and no block button; personal data wiped; at most 5 exchanges close per call.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: auto-close and sorry flow`.

### Task 12: Blocking, appeals, bot handlers

**Files:** Create `tgcloud/lib/moderation.js`, `tgcloud/endpoints/block.js`, `submitAppeal.js`, `decideAppeal.js`, `tgcloud/handlers/callback_query.js`, `tgcloud/handlers/message.js`; Test `tests/moderation.test.js`

**Interfaces:**
- `blockSanta(organiserId, exchangeId, santaUserId) → void`: organiser of exchange; assignment of that Santa has `sentAt` null and `receivedAt` null and deadline past (else `FORBIDDEN`/`NOT_YET`); no duplicate active block for same (user, exchange). Effects: insert `blocks`; delete the user's memberships in `open` exchanges they don't organise; for `open` exchanges they organise → same as `deleteExchange` (notify members); notify the blocked user `t('blocked',{exchange})` with `[[{ text: t('btnAppeal'), app: '#/blocked' }]]`.
- `submitAppeal(userId, blockId, text, tracking?) → void`: own block, active, not yet appealed (`FORBIDDEN`); text 1–1000, tracking ≤ 64; sets appeal fields; sends organiser `t('appeal',{name, exchange, date, text, tracking?})` with `[[{ text: t('btnUnblock'), data: 'appeal:<blockId>:unblock' }, { text: t('btnKeep'), data: 'appeal:<blockId>:keep' }]]`.
- `decideAppeal(organiserId, blockId, 'unblock'|'keep') → void`: organiser of that block, appealed, undecided; sets decision; tells the user `t('appealUnblocked'|'appealKept',{exchange})`.
- Endpoints: `block({ id, santaUserId })`, `submitAppeal({ blockId, text, tracking })`, `decideAppeal({ blockId, decision })` → `{ ok }`, each wrapping the lib function with `me.id`.
- `handlers/callback_query.js`: parses `block:`, `letgo:`, `appeal:`; calls lib with `query.from.id`; `answerCallbackQuery` with `t('done')` or the error's localized text; removes the inline keyboard from the message (`editMessageReplyMarkup`) on success. `letgo` just answers.
- `handlers/message.js`: on `/start` (any payload) replies `t('start')` with `[[{ text: t('btnOpen'), app: '#/' }]]`; ignores everything else.

Bot copy: `blocked` — `<b>You've been blocked from Secret Santa</b>\nIn "{exchange}", your giftee never received a gift and it was never marked as sent. The organiser has blocked you, so you can't create or join exchanges.\n\nIf something went wrong, tell us what happened.` / `<b>Вас заблокировали в Тайном Санте</b>\nВ обмене «{exchange}» ваш получатель так и не получил подарок, и отправка не была отмечена. Организатор заблокировал вас, поэтому вы не можете создавать обмены и участвовать в них.\n\nЕсли что-то пошло не так, расскажите, что случилось.`; `btnAppeal` `Appeal` / `Обжаловать`; `appeal` — `<b>{name} appealed their block</b>\n{exchange} · blocked {date}\n<blockquote>{text}</blockquote>` + optional `\nTracking: <code>{tracking}</code>` / `<b>{name} обжалует блокировку</b>\n{exchange} · заблокирован(а) {date}\n<blockquote>{text}</blockquote>` + `\nТрек-номер: <code>{tracking}</code>`; `btnUnblock` `Unblock` / `Разблокировать`; `btnKeep` `Keep blocked` / `Оставить блокировку`; `appealUnblocked` — `Good news: the organiser of "{exchange}" lifted your block.` / `Хорошие новости: организатор обмена «{exchange}» снял блокировку.`; `appealKept` — `The organiser of "{exchange}" reviewed your appeal and kept the block.` / `Организатор обмена «{exchange}» рассмотрел вашу жалобу и оставил блокировку.`; `start` — `Secret Santa: draw names with friends, right here in Telegram.` / `Тайный Санта: жеребьёвка подарков с друзьями прямо в Telegram.`; `btnOpen` `Open` / `Открыть`; `done` `Done` / `Готово`.

- [ ] **Step 1: Failing tests:** block before deadline → `NOT_YET`; block a Santa who marked sent → `FORBIDDEN`; after block: `home.me.blocks` has one entry, `join` → `BLOCKED` (Review Focus 3), the user's membership in an open exchange is gone, their own open exchange is deleted and its members notified, their membership in a drawn exchange stays and the pairing invariant still holds; second appeal → `FORBIDDEN`; `decideAppeal('unblock')` → `join` works again; with two blocks, unblocking one keeps the user blocked; callback `block:…` from a non-organiser `from.id` answers with an error and changes nothing; `/start` replies with an Open button.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: blocking, appeals, bot handlers`.

### Task 13: Front-end shell — Vite, Svelte, daisyUI, API, theme, i18n, router

**Files:** Create `index.html`, `vite.config.js`, `src/main.js`, `src/App.svelte`, `src/app.css`, `src/lib/api.js`, `src/lib/tg.js`, `src/lib/theme.js`, `src/lib/i18n.js`, `src/lib/strings/en.js`, `src/lib/strings/ru.js`, `src/lib/router.js`, `src/dev/mock.js`, `tgcloud.jsonc`; Test `tests/frontend.test.js`

Before writing Svelte code, load the `svelte-code-writer` and `svelte-core-bestpractices` skills and the `daisyui` skill; run `svelte-autofixer` on every component.

**Interfaces:**
- `index.html` loads `https://telegram.org/js/telegram-web-app.js` before the app.
- `api.js`: `call(name, input = {}) → Promise<result>`; rejects with `{ code }` from `err.parameters?.code` (else `'INTERNAL'`); uses `Telegram.WebApp.Serverless.call` when `Telegram.WebApp.initData` is non-empty, otherwise `src/dev/mock.js` (`mockCall(name, input)` returning fixture data matching each endpoint's shape — enough to render every screen in a desktop browser).
- `tg.js`: `ready()` (`ready()`, `expand()`), `backButton(onClick|null)`, `share(url, text)` (`openTelegramLink('https://t.me/share/url?url=…&text=…')`), `openLink(url)`, `startParam()`, `requestWriteAccess() → Promise<boolean>`, `cloudGet(key)`, `cloudSet(key, value)` (Promise wrappers; resolve null on error), `haptic(type)`.
- `theme.js`: `resolveTheme(pref: 'auto'|'light'|'dark'|'christmas', scheme: 'light'|'dark') → 'tglight'|'tgdark'|'christmas'`; `applyTheme(pref)` sets `data-theme` on `<html>` and, for `tglight/tgdark`, sets daisyUI CSS vars (`--color-base-100/200/content`, `--color-primary/-content`) from `Telegram.WebApp.themeParams` (`bg_color`, `secondary_bg_color`, `text_color`, `button_color`, `button_text_color`), and calls `Telegram.WebApp.setHeaderColor/setBackgroundColor`; listens to `themeChanged`. `loadThemePref()`/`saveThemePref(pref)` via CloudStorage key `theme`.
- `app.css`: `@import "tailwindcss"; @plugin "daisyui" { themes: false; }` plus three `@plugin "daisyui/theme"` blocks `tglight` (default), `tgdark` (prefersdark), `christmas` using the mockup tokens: base-100 `#0b2a1e`, base-200 `#123a2a`, base-content `#fff6e6`, primary `#d42a3c`, primary-content `#ffffff`, accent `#f2c45a`, secondary `#8e1626`; Christmas adds the snow background and the 6px garland (`repeating-linear-gradient(90deg,#d42a3c 0 10px,#f2c45a 10px 20px,#2e8b57 20px 30px)`) on the top of each screen.
- `i18n.js`: `lang` (from `Telegram.WebApp.initDataUnsafe.user.language_code` via `langOf` imported from `../../tgcloud/lib/i18n.js`), `t(key, params)` built with `makeT({ en, ru })`. Strings for every screen label in Tasks 14–17 live in `en.js`/`ru.js`, keyed by screen (`home.title`, `create.budget.any`, …), plus one localized message per `ERR` code (`errors.NOT_FOUND` = "No exchange with this code" / "Обмен с таким кодом не найден", etc.).
- `router.js`: hash router; `route` store `{ name, params }` for: `#/` home, `#/new`, `#/join/:code`, `#/x/:id`, `#/x/:id/edit`, `#/x/:id/details`, `#/x/:id/:tab` (`giftee|gift|progress`), `#/x/:id/chat/:side`, `#/blocked`, `#/appeal/:blockId`; `go(path)`. On launch, a `startParam()` that `normalizeCode`s → `#/join/<code>`; a start param starting with `x` (e.g. `x12_gift`) → `#/x/12/gift`.
- `tgcloud.jsonc`: `{ "static": { "source": "dist", "spa": true, "immutable": ["/assets/*"] } }`.

- [ ] **Step 1: Failing tests** (`bun test`, pure modules only): `resolveTheme('auto','dark') === 'tgdark'`, `resolveTheme('christmas','light') === 'christmas'`; `en.js` and `ru.js` have identical key sets (deep key comparison) and every `ERR` code has an `errors.*` entry; router parses `#/x/12/chat/santa` → `{ name: 'chat', params: { id: '12', side: 'santa' } }` and maps start param `x12_gift` → `#/x/12/gift`.
- [ ] **Step 2:** FAIL. **Step 3:** `bun add svelte @sveltejs/vite-plugin-svelte vite tailwindcss @tailwindcss/vite daisyui`, implement. **Step 4:** `bun test` PASS and `bun run build` produces `dist/index.html`.
- [ ] **Step 5:** Commit `feat: front-end shell, theme, i18n, router`.

### Task 14: Home, create/edit exchange, join/edit details

**Files:** Create `src/screens/Home.svelte`, `ExchangeForm.svelte`, `DetailsForm.svelte`

Behaviour (screens 1, 2, 3; copy in `en.js`/`ru.js`):
- **Home:** theme switcher (labelled "Theme": Auto/Light/Dark/Christmas, applies instantly, saved), "My exchanges" list with status chips (`waiting` → "Waiting", `see` → "See recipient" highlighted, `drawn`, `closed`), "Have a code?" input + Join (calls `findByCode`, then `#/join/<code>`; shows `errors.NOT_FOUND` inline), "Create an exchange". Empty list → short intro text instead. If `home.me.blocks` is non-empty → `go('#/blocked')`.
- **ExchangeForm** (`#/new`, `#/x/:id/edit`): name, budget switch **Any / Up to / At least / Range** showing only the needed number inputs (`inputmode="numeric"`) + currency `<select>` from `Intl.supportedValuesOf('currency')` (default from `lang`: `ru` → `RUB`, else `EUR`), "Gifts arrive by" `<input type="date" min=tomorrow>`. Edit mode after draw shows only the date. Create → `createExchange` → `#/join/<code>`.
- **DetailsForm** (`#/join/:code`, `#/x/:id/details`): nickname (prefilled from Telegram first name), shipping address (textarea), "I have ideas / Surprise me" switch hiding the two optional fields (wishlist link `type="url"`, likes and dislikes textarea), hint "Only the person who draws you will see this address." Join → `join` → `requestWriteAccess()` (hint text before the button explains why) → `#/x/<id>`. Errors shown next to the field / under the button.

- [ ] **Step 1:** Implement; run `svelte-autofixer` on each file until clean.
- [ ] **Step 2:** `bun run build` succeeds. `bun run dev` with the mock: open `/#/`, `/#/new`, `/#/join/K7Q4MX` in the browser at 390px width in all three themes; every control works, no horizontal scroll.
- [ ] **Step 3:** Commit `feat: home, exchange form, details form`.

### Task 15: Exchange screen before the draw

**Files:** Create `src/screens/Exchange.svelte` (pre-draw part)

Behaviour (screens 4, 4a): invite code (display form) + "Share link" (`share(inviteLink, …)`); summary line "N people joined · {formatBudget} · gifts by {date}"; member list with "creator", "wishlist ✓", "surprise me" tags and "(you)"; "Edit my details"; organiser: "Edit exchange", "Start the draw" (disabled with hint under 3 members; confirm step in-page; handles `ALREADY_DRAWN` by reloading), ⋯ actions remove member / delete exchange (in-page confirm); others: "Leave exchange" (in-page confirm) and "Waiting for {organiser} to start the draw". Organiser who hasn't joined yet sees a "Join your exchange" button to `#/join/<code>`. Poll `getExchange` on `visibilitychange` to visible.

- [ ] **Step 1:** Implement; `svelte-autofixer` clean.
- [ ] **Step 2:** `bun run build`; in the mock, view as organiser and as member (mock flag `?as=member`), exercise leave/remove/delete confirms and the under-3 state.
- [ ] **Step 3:** Commit `feat: waiting room`.

### Task 16: After the draw — tabs, chat, blocked and appeal screens

**Files:** Modify `src/screens/Exchange.svelte`; Create `GifteeTab.svelte`, `GiftTab.svelte`, `ProgressTab.svelte`, `Chat.svelte`, `Blocked.svelte`, `Appeal.svelte`

Behaviour:
- Tabs **My giftee / My gift / Progress** (screens 5, 5b, 5c, 7), tab in the URL.
- **My giftee:** hero "You're Secret Santa for {nickname}" + budget + "send by {date}"; "Message {nickname} anonymously" → `#/x/:id/chat/giftee`; wishlist link (opens via `openLink`), likes and dislikes as typed (`white-space: pre-line`), or the "{nickname} says: surprise me" card, or "No wishlist yet"; address with Copy; Shipping box: tracking input (optional) + "Mark as sent" / after sent shows "Sent {date}" and lets tracking be edited.
- **My gift:** "Not sent yet" / "On its way" (+ tracking with Copy) / "Received"; "Message my Santa" → `#/x/:id/chat/santa`; "Edit my details"; "I received my gift" (in-page confirm).
- **Progress:** deadline box ("gifts due by …" / "The deadline passed N days ago" + organiser's "Move the deadline" → edit form); member list with not sent / on its way / received; organiser after deadline: "Only you see this" box per overdue Santa with "Message {santa}" (compose sheet → `messageSanta`; plus "Open profile" link when `santaUsername`), "Block {santa}" (in-page confirm → `block`), and one "Nudge" button (`nudge`, shows count sent).
- Closed exchange: read-only Progress + "This exchange has closed".
- **Chat** (screen 6): header "Your Secret Santa" or giftee nickname, bubbles mine/theirs, input + Send, poll every 10 s while visible.
- **Blocked** (screen 9): explanation per active block (exchange name, date) and "Appeal" (if not appealed) → `#/appeal/<blockId>`; "Appeal sent, waiting for the organiser" otherwise.
- **Appeal** (screen 9b): explanation textarea, optional tracking, "You can send one appeal per block. We'll message you with the answer.", Send → `submitAppeal` → back to Blocked.

- [ ] **Step 1:** Implement; `svelte-autofixer` clean.
- [ ] **Step 2:** `bun run build`; walk every screen above in the mock in all three themes at 390px; check no other member's address or Santa name appears anywhere in the giftee-side screens' fixture output.
- [ ] **Step 3:** Commit `feat: post-draw screens, chat, blocked, appeal`.

### Task 17: Russian copy review pack

**Files:** Create `docs/ru-copy-review.md`

- [ ] **Step 1:** Generate a two-column table (en | ru) of every bot string in `tgcloud/lib/i18n.js` and every app string in `src/lib/strings/*.js` (small script `bun scripts/copy-table.js > docs/ru-copy-review.md`, script kept in `scripts/`).
- [ ] **Step 2:** Commit `docs: Russian copy for review`. Ask the user to review it (spec: "Russian copy … reviewed by the user before release").

### Task 18: Deploy and smoke test in Telegram

Needs the user for the interactive steps (marked **USER**).

- [ ] **Step 1 (USER):** In @BotFather: create the bot, enable Serverless, set it up as the bot's **Main Mini App**, get the CLI token; run `! ~/.bun/bin/bunx @tgcloud/cli login` (interactive).
- [ ] **Step 2:** Put the real `APP_URL` (`https://app<app_id>.tgcloud.ai`) and `BOT_USERNAME` in `tgcloud/lib/config.js`; commit.
- [ ] **Step 3:** `bunx @tgcloud/cli migrate --dry-run` → shows the six tables; then `migrate --yes`.
- [ ] **Step 4:** `bun run build && bunx @tgcloud/cli push`; `bunx @tgcloud/cli webhook sync`; `bunx @tgcloud/cli status` shows handlers, endpoints and static site.
- [ ] **Step 5:** Platform checks with `bunx @tgcloud/cli run`: run `handlers/message` with `{ chat: { id: <user id> }, from: { id: <user id>, first_name: 'T' }, text: '/start' }` → the user gets the Open button. Confirm in logs that `crypto.getRandomValues` exists (draw uses it) and that the conditional update / batch insert behave as in tests.
- [ ] **Step 6 (USER + agent):** Smoke test with 3 Telegram accounts (one with Russian UI): create → share link → join ×3 (one "Surprise me") → draw (check notices carry no names) → anonymous chat both ways → mark sent with tracking → all mark received → exchange shows Closed. Deadline, overdue, auto-close and blocking paths are covered by `bun test` only (deadlines can't be in the past in production); after the first real deadline passes, check one overdue view live. Fix any mismatch between the platform DB API and the fake SDK in both.
- [ ] **Step 7:** Commit `chore: deploy config`.
