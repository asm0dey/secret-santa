// Dev-only stand-in for the backend. Every handler is typed against the real endpoint, so a shape change in tgcloud/
// fails `bun run typecheck` here. Flags (query string): ?as=member (waiting room as a non-organiser), ?blocked,
// ?few (exchange 1 has 2 members: the draw is disabled), ?unjoined (the organiser has not joined exchange 1),
// ?race (the first draw of exchange 1 answers ALREADY_DRAWN). After the draw: ?giftee=surprise|nowish (what exchange 2's
// giftee wrote), ?gift=notsent|onway|received (exchange 2, my own gift), ?santa=nouser (the overdue Santa has no @username),
// ?undelivered (messageSanta cannot deliver), ?empty (empty chat thread), ?blocked (two blocks: one appealed, one not).
// Exchanges: 1 waiting (code K7Q4MX), 2 drawn, first view "see" (code DRW234), 3 drawn past its deadline with one
// overdue Santa (code LATE23), 4 closed (code CLS234), 5 drawn but the assignments were never written (code PEND23).

/**
 * @typedef {{
 *   home: typeof import('../../tgcloud/endpoints/home.js').default,
 *   findByCode: typeof import('../../tgcloud/endpoints/findByCode.js').default,
 *   getExchange: typeof import('../../tgcloud/endpoints/getExchange.js').default,
 *   getThread: typeof import('../../tgcloud/endpoints/getThread.js').default,
 *   createExchange: typeof import('../../tgcloud/endpoints/createExchange.js').default,
 *   join: typeof import('../../tgcloud/endpoints/join.js').default,
 *   draw: typeof import('../../tgcloud/endpoints/draw.js').default,
 *   markSent: typeof import('../../tgcloud/endpoints/markSent.js').default,
 *   markReceived: typeof import('../../tgcloud/endpoints/markReceived.js').default,
 *   sendMessage: typeof import('../../tgcloud/endpoints/sendMessage.js').default,
 *   nudge: typeof import('../../tgcloud/endpoints/nudge.js').default,
 *   messageSanta: typeof import('../../tgcloud/endpoints/messageSanta.js').default,
 *   block: typeof import('../../tgcloud/endpoints/block.js').default,
 *   submitAppeal: typeof import('../../tgcloud/endpoints/submitAppeal.js').default,
 *   decideAppeal: typeof import('../../tgcloud/endpoints/decideAppeal.js').default,
 *   updateExchange: typeof import('../../tgcloud/endpoints/updateExchange.js').default,
 *   deleteExchange: typeof import('../../tgcloud/endpoints/deleteExchange.js').default,
 *   updateMyDetails: typeof import('../../tgcloud/endpoints/updateMyDetails.js').default,
 *   leave: typeof import('../../tgcloud/endpoints/leave.js').default,
 *   removeMember: typeof import('../../tgcloud/endpoints/removeMember.js').default,
 * }} Endpoints
 */
/** @typedef {import('../../tgcloud/lib/types.js').ExchangeView} ExchangeView */
/** @typedef {import('../../tgcloud/lib/types.js').Budget} Budget */
/** @typedef {import('../../tgcloud/lib/types.js').OverdueRow} OverdueRow */
/** @typedef {import('../../tgcloud/lib/types.js').GiftStatus} GiftStatus */

const DAY = 86_400_000;
const flags = new URLSearchParams(location.search);
const asMember = flags.get('as') === 'member';
const few = flags.has('few');
const unjoined = flags.has('unjoined') && !asMember;
const gifteeKind = flags.get('giftee');
const giftFlag = flags.get('gift');

/** @param {number} days from today, may be negative */
const day = (days) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

const ME = 101; // the organiser of exchange 1; "as=member" plays 102 instead
const myId = asMember ? 102 : ME;
const GIFTEE = asMember ? 'Chloe' : 'Boris'; // never yourself
/** Single source for home and getExchange; "as=member" is a non-organiser everywhere. @param {number} id */
const organiserOf = (id) => !asMember && (id === 1 || id === 3 || id === 5);

/** @type {NonNullable<ExchangeView['me']>} */
const myDetails = {
  nickname: asMember ? 'Boris' : 'Anna', address: '12 Pine Street\nSpringfield 12345', wishMode: 'ideas',
  wishlistUrl: 'https://example.com/anna-wishlist', wishes: 'Books and tea.\nNo candles, please.',
};

const PEOPLE = [
  { userId: 101, nickname: 'Anna', tag: /** @type {'surprise' | 'wishlist' | null} */ ('wishlist') },
  { userId: 102, nickname: 'Boris', tag: /** @type {'surprise' | 'wishlist' | null} */ ('wishlist') },
  { userId: 103, nickname: 'Chloe', tag: /** @type {'surprise' | 'wishlist' | null} */ ('surprise') },
  { userId: 104, nickname: 'Dmitri', tag: /** @type {'surprise' | 'wishlist' | null} */ (null) },
  { userId: 105, nickname: 'Elena', tag: /** @type {'surprise' | 'wishlist' | null} */ ('wishlist') },
];

/** @type {Record<number, { name: string, code: string, status: 'open' | 'drawn' | 'closed', budget: Budget, deadline: string }>} */
const EX = {
  1: { name: 'Office Secret Santa', code: 'K7Q4MX', status: 'open', budget: { kind: 'range', min: 1000, max: 3000, currency: 'RUB' }, deadline: day(20) },
  2: { name: 'Family Christmas', code: 'DRW234', status: 'drawn', budget: { kind: 'max', min: null, max: 50, currency: 'EUR' }, deadline: day(12) },
  3: { name: 'Book Club Swap', code: 'LATE23', status: 'drawn', budget: { kind: 'min', min: 20, max: null, currency: 'EUR' }, deadline: day(-10) },
  5: { name: 'Neighbours Swap', code: 'PEND23', status: 'drawn', budget: { kind: 'max', min: null, max: 30, currency: 'EUR' }, deadline: day(15) },
  4: { name: 'Class of 2019', code: 'CLS234', status: 'closed', budget: { kind: 'any', min: null, max: null, currency: null }, deadline: day(-50) },
};

let pending5 = true; // exchange 5: the draw crashed before inserting; the organiser's draw call finishes it
let race = flags.has('race');
/** @type {Set<number>} */
const removed = new Set();
/** @param {number} id */
const peopleOf = (id) => PEOPLE.filter((p) => !removed.has(p.userId) && !(id === 1 && ((few && p.userId > 102) || (unjoined && p.userId === ME))));
let seen2 = false; // exchange 2 shows as "see recipient" on home until its giftee tab was opened
/** What I, as Santa, marked as sent, by exchange id. @type {Map<number, { at: number, tracking: string | null }>} */
const sent = new Map();
let received2 = giftFlag === 'received';
/** @type {Set<number>} */
const appealedIds = new Set([8]);
/** Santas the organiser blocked in this session. @type {Set<number>} */
const blockedSantas = new Set();
/** @type {{ fromSanta: boolean, text: string, at: number }[]} */
const thread = flags.has('empty') ? [] : [
  { fromSanta: true, text: 'Hi! Any size preferences for the scarf?', at: Date.now() - 30 * 3600_000 },
  { fromSanta: false, text: 'Hello Santa! Medium is perfect, thank you.', at: Date.now() - 2 * 3600_000 },
  { fromSanta: true, text: 'Great, noted.\nAny colours you dislike?', at: Date.now() - 3600_000 },
];

/** @param {number} id @returns {ExchangeView} */
function exchangeView(id) {
  const ex = EX[id];
  if (!ex) throw { code: 'NOT_FOUND' };
  const open = ex.status === 'open';
  const drawPending = id === 5 && pending5;
  const live = ex.status === 'drawn' && !drawPending; // assignments exist
  const isOrganiser = organiserOf(id);
  const uid = myId;
  /** @type {GiftStatus[]} */
  const gifts = id === 2 ? ['received', 'on_way', 'not_sent', 'on_way', 'not_sent'] : id === 3 ? ['received', 'not_sent', 'on_way', 'received', 'on_way'] : ['received', 'received', 'received', 'received', 'received'];
  const you = (id === 1 && !unjoined) || id === 5 || live; // closed exchanges keep no personal data
  /** @type {OverdueRow[]} */
  const overdue = id === 3 && isOrganiser
    ? [{ gifteeUserId: 102, gifteeName: 'Boris', santaUserId: 103, santaName: 'Chloe', santaUsername: flags.get('santa') === 'nouser' ? null : 'chloe_k', blocked: blockedSantas.has(103) }]
    : [];
  const myGift = live
    ? /** @type {NonNullable<ExchangeView['myGift']>} */ ({ status: id === 2 ? (received2 ? 'received' : giftFlag === 'notsent' ? 'not_sent' : 'on_way') : 'not_sent', tracking: id === 2 && giftFlag !== 'notsent' ? 'RB987654321CN' : null, sentAt: id === 2 && giftFlag !== 'notsent' ? Date.now() - 2 * DAY : null })
    : null;
  return {
    id, name: ex.name, code: ex.code, displayCode: `${ex.code.slice(0, 3)}-${ex.code.slice(3)}`,
    inviteLink: `https://t.me/secret_santa_bot?startapp=${ex.code}`,
    status: ex.status, budget: ex.budget, deadline: ex.deadline,
    isOrganiser, organiserName: 'Anna',
    members: peopleOf(id).map((p) => ({ userId: p.userId, nickname: p.nickname, isMe: p.userId === uid, isOrganiser: p.userId === ME, tag: p.tag })),
    me: you ? myDetails : null,
    drawPending,
    giftee: live
      ? {
          nickname: GIFTEE, address: '5 Birch Lane\nShelbyville 54321',
          wishMode: gifteeKind === 'surprise' ? 'surprise' : 'ideas',
          wishlistUrl: gifteeKind ? null : 'https://example.com/boris-wishlist',
          wishes: gifteeKind ? null : 'Warm socks.\nCoffee beans.\nNo perfume.',
          sentAt: sent.get(id)?.at ?? null, tracking: sent.get(id)?.tracking ?? null,
        }
      : null,
    myGift,
    // my own row is what myGift says, so the two tabs never disagree
    progress: open || drawPending ? [] : PEOPLE.map((p, i) => ({ userId: p.userId, nickname: p.nickname, gift: p.userId === uid && myGift ? myGift.status : gifts[i] })),
    overdue,
  };
}

/** @type {{ [K in keyof Endpoints]: (input: Parameters<Endpoints[K]>[0]) => Awaited<ReturnType<Endpoints[K]>> }} */
const handlers = {
  home: () => ({
    me: {
      id: myId, firstName: asMember ? 'Boris' : 'Anna', lang: 'en',
      blocks: flags.has('blocked')
        ? [
            { id: 7, exchangeName: 'Book Club Swap', createdAt: Date.now() - 5 * DAY, appealed: appealedIds.has(7), decision: null },
            { id: 8, exchangeName: 'Class of 2019', createdAt: Date.now() - 9 * DAY, appealed: appealedIds.has(8), decision: null },
          ]
        : [],
    },
    exchanges: [
      { id: 1, name: EX[1].name, status: 'open', view: 'waiting', isOrganiser: organiserOf(1), memberCount: peopleOf(1).length },
      { id: 2, name: EX[2].name, status: 'drawn', view: seen2 ? 'drawn' : 'see', isOrganiser: organiserOf(2), memberCount: 5 },
      { id: 3, name: EX[3].name, status: 'drawn', view: 'drawn', isOrganiser: organiserOf(3), memberCount: 5 },
      { id: 4, name: EX[4].name, status: 'closed', view: 'closed', isOrganiser: organiserOf(4), memberCount: 5 },
    ],
  }),
  findByCode: ({ code }) => {
    const c = String(code).replace(/[\s-]/g, '').toUpperCase();
    const id = Object.keys(EX).map(Number).find((i) => EX[i].code === c);
    if (!id) throw { code: 'NOT_FOUND' };
    const ex = EX[id];
    return {
      id, name: ex.name, status: ex.status, budget: ex.budget, deadline: ex.deadline,
      organiserName: 'Anna', memberCount: 5, isMember: id !== 1, // exchange 1 is the join-form case
    };
  },
  getExchange: ({ id }) => {
    if (id === 2) seen2 = true;
    return exchangeView(id);
  },
  getThread: ({ id, side }) => {
    const ex = exchangeView(id);
    return {
      exchangeName: ex.name,
      title: side === 'giftee' ? GIFTEE : null,
      messages: thread.map((m) => ({ mine: m.fromSanta === (side === 'giftee'), text: m.text, at: m.at })),
    };
  },
  createExchange: () => ({ id: 1, code: EX[1].code }),
  join: () => ({ id: 1 }),
  draw: ({ id }) => {
    if (id === 5 && pending5) {
      pending5 = false;
      return { ok: true };
    }
    if (race) {
      race = false;
      EX[1].status = 'drawn';
      throw { code: 'ALREADY_DRAWN' };
    }
    if (EX[id]?.status !== 'open') throw { code: 'ALREADY_DRAWN' };
    if (peopleOf(id).length < 3) throw { code: 'TOO_FEW' };
    EX[id].status = 'drawn';
    return { ok: true };
  },
  markSent: ({ id, tracking }) => {
    sent.set(id, { at: sent.get(id)?.at ?? Date.now(), tracking: tracking?.trim() || sent.get(id)?.tracking || null });
    return { ok: true };
  },
  markReceived: () => {
    received2 = true;
    return { ok: true };
  },
  sendMessage: ({ side, text }) => {
    thread.push({ fromSanta: side === 'giftee', text, at: Date.now() });
    return { ok: true };
  },
  nudge: () => ({ sent: 1 }),
  messageSanta: () => ({ ok: true, delivered: !flags.has('undelivered') }),
  block: ({ santaUserId }) => {
    blockedSantas.add(santaUserId);
    return { ok: true };
  },
  submitAppeal: ({ blockId }) => {
    appealedIds.add(blockId);
    return { ok: true };
  },
  decideAppeal: () => ({ ok: true }),
  updateExchange: () => ({ ok: true }),
  deleteExchange: () => ({ ok: true }),
  updateMyDetails: () => ({ ok: true }),
  leave: () => ({ ok: true }),
  removeMember: ({ userId }) => {
    removed.add(userId);
    return { ok: true };
  },
};

/**
 * @param {string} name
 * @param {any} input
 * @returns {Promise<any>}
 */
export async function mockCall(name, input) {
  const counts = ((/** @type {any} */ (globalThis)).__mockCalls ??= {}); // lets browser checks count requests
  counts[name] = (counts[name] ?? 0) + 1;
  await new Promise((r) => setTimeout(r, 120));
  const h = /** @type {Record<string, (i: any) => any>} */ (/** @type {unknown} */ (handlers))[name];
  if (!h) throw { code: 'INTERNAL' };
  return structuredClone(h(input ?? {}));
}
