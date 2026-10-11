// Dev-only stand-in for the backend. Every handler is typed against the real endpoint, so a shape change in tgcloud/
// fails `bun run typecheck` here. Flags (query string): ?as=member (waiting room as a non-organiser), ?blocked.
// Exchanges: 1 waiting (code K7Q4MX), 2 drawn, first view "see" (code DRW234), 3 drawn past its deadline with one
// overdue Santa (code LATE23), 4 closed (code CLS234).

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

/** @param {number} days from today, may be negative */
const day = (days) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

const ME = 101; // the organiser of exchange 1; "as=member" plays 102 instead
const myId = asMember ? 102 : ME;

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
  4: { name: 'Class of 2019', code: 'CLS234', status: 'closed', budget: { kind: 'any', min: null, max: null, currency: null }, deadline: day(-50) },
};

let seen2 = false; // exchange 2 shows as "see recipient" on home until its giftee tab was opened
let sent2 = false;
let received2 = false;
let appealed = false;
/** @type {{ fromSanta: boolean, text: string, at: number }[]} */
const thread = [
  { fromSanta: true, text: 'Hi! Any size preferences for the scarf?', at: Date.now() - 3 * 3600_000 },
  { fromSanta: false, text: 'Hello Santa! Medium is perfect, thank you.', at: Date.now() - 2 * 3600_000 },
];

/** @param {number} id @returns {ExchangeView} */
function exchangeView(id) {
  const ex = EX[id];
  if (!ex) throw { code: 'NOT_FOUND' };
  const open = ex.status === 'open';
  const live = ex.status === 'drawn';
  const isOrganiser = id === 1 ? !asMember : true;
  const uid = id === 1 ? myId : ME;
  /** @type {GiftStatus[]} */
  const gifts = id === 2 ? ['received', 'on_way', 'not_sent', 'on_way', 'not_sent'] : id === 3 ? ['received', 'not_sent', 'on_way', 'received', 'on_way'] : ['received', 'received', 'received', 'received', 'received'];
  const you = id === 1 || live; // closed exchanges keep no personal data
  /** @type {OverdueRow[]} */
  const overdue = id === 3 && isOrganiser
    ? [{ gifteeUserId: 102, gifteeName: 'Boris', santaUserId: 103, santaName: 'Chloe', santaUsername: 'chloe_k' }]
    : [];
  return {
    id, name: ex.name, code: ex.code, displayCode: `${ex.code.slice(0, 3)}-${ex.code.slice(3)}`,
    inviteLink: `https://t.me/secret_santa_bot?startapp=${ex.code}`,
    status: ex.status, budget: ex.budget, deadline: ex.deadline,
    isOrganiser, organiserName: 'Anna',
    members: PEOPLE.map((p) => ({ userId: p.userId, nickname: p.nickname, isMe: p.userId === uid, isOrganiser: p.userId === ME, tag: p.tag })),
    me: you ? myDetails : null,
    drawPending: false,
    giftee: live
      ? {
          nickname: 'Boris', address: '5 Birch Lane\nShelbyville 54321', wishMode: 'ideas',
          wishlistUrl: 'https://example.com/boris-wishlist', wishes: 'Warm socks.\nCoffee beans.\nNo perfume.',
          sentAt: id === 2 && sent2 ? Date.now() : null, tracking: id === 2 && sent2 ? 'RB123456789CN' : null,
        }
      : null,
    myGift: live
      ? { status: id === 2 ? (received2 ? 'received' : 'on_way') : 'not_sent', tracking: id === 2 ? 'RB987654321CN' : null, sentAt: id === 2 ? Date.now() - 2 * DAY : null }
      : null,
    progress: open ? [] : PEOPLE.map((p, i) => ({ userId: p.userId, nickname: p.nickname, gift: gifts[i] })),
    overdue,
  };
}

/** @type {{ [K in keyof Endpoints]: (input: Parameters<Endpoints[K]>[0]) => Awaited<ReturnType<Endpoints[K]>> }} */
const handlers = {
  home: () => ({
    me: {
      id: myId, firstName: asMember ? 'Boris' : 'Anna', lang: 'en',
      blocks: flags.has('blocked')
        ? [{ id: 7, exchangeName: 'Book Club Swap', createdAt: Date.now() - 5 * DAY, appealed, decision: null }]
        : [],
    },
    exchanges: [
      { id: 1, name: EX[1].name, status: 'open', view: 'waiting', isOrganiser: !asMember, memberCount: 5 },
      { id: 2, name: EX[2].name, status: 'drawn', view: seen2 ? 'drawn' : 'see', isOrganiser: false, memberCount: 5 },
      { id: 3, name: EX[3].name, status: 'drawn', view: 'drawn', isOrganiser: true, memberCount: 5 },
      { id: 4, name: EX[4].name, status: 'closed', view: 'closed', isOrganiser: false, memberCount: 5 },
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
    exchangeView(id);
    return {
      title: side === 'giftee' ? 'Boris' : null,
      messages: thread.map((m) => ({ mine: m.fromSanta === (side === 'giftee'), text: m.text, at: m.at })),
    };
  },
  createExchange: () => ({ id: 1, code: EX[1].code }),
  join: () => ({ id: 1 }),
  draw: () => ({ ok: true }),
  markSent: () => {
    sent2 = true;
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
  messageSanta: () => ({ ok: true, delivered: true }),
  block: () => ({ ok: true }),
  submitAppeal: () => {
    appealed = true;
    return { ok: true };
  },
  decideAppeal: () => ({ ok: true }),
  updateExchange: () => ({ ok: true }),
  deleteExchange: () => ({ ok: true }),
  updateMyDetails: () => ({ ok: true }),
  leave: () => ({ ok: true }),
  removeMember: () => ({ ok: true }),
};

/**
 * @param {string} name
 * @param {any} input
 * @returns {Promise<any>}
 */
export async function mockCall(name, input) {
  await new Promise((r) => setTimeout(r, 120));
  const h = /** @type {Record<string, (i: any) => any>} */ (/** @type {unknown} */ (handlers))[name];
  if (!h) throw { code: 'INTERNAL' };
  return structuredClone(h(input ?? {}));
}
