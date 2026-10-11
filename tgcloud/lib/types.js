// Shared JSDoc typedefs. No runtime code.

/** @typedef {'en' | 'ru'} Lang */

/** @typedef {'NOT_FOUND' | 'FORBIDDEN' | 'BLOCKED' | 'BAD_INPUT' | 'ALREADY_MEMBER' | 'FULL' | 'TOO_FEW' | 'ALREADY_DRAWN' | 'NOT_DRAWN' | 'CLOSED' | 'NOT_YET'} ErrCode */

/** @typedef {{ kind: 'any' | 'max' | 'min' | 'range', min: number | null, max: number | null, currency: string | null }} Budget */

/** @typedef {{ nickname: string, address: string, wishMode: 'ideas' | 'surprise', wishlistUrl?: string | null, wishes?: string | null }} Details */

/** @typedef {{ text: string, app: string } | { text: string, url: string } | { text: string, data: string }} Button */

/** @typedef {{ id: number, first_name: string, username?: string, language_code?: string, allows_write_to_pm?: boolean }} TgUser */

/** @typedef {{ initData: { user: TgUser, start_param?: string } }} EndpointCtx */

/** @typedef {{ id: number, firstName: string, username: string | null, lang: Lang, canMessage: boolean | null, blocked: boolean }} Me */

/** @typedef {typeof import('../schema.js').exchanges.$inferSelect} Exchange */
/** @typedef {typeof import('../schema.js').members.$inferSelect} Member */
/** @typedef {import('./details.js').DetailsColumns} DetailsColumns */

/** @typedef {'not_sent' | 'on_way' | 'received'} GiftStatus */

/** @typedef {{ nickname: string | null, address: string | null, wishMode: string | null, wishlistUrl: string | null, wishes: string | null, sentAt: number | null, tracking: string | null }} Giftee what a Santa sees about their giftee */

/** @typedef {{ status: GiftStatus, tracking: string | null, sentAt: number | null }} MyGift what a giftee sees about their gift: never who the Santa is */

/** @typedef {{ userId: number, nickname: string | null, gift: GiftStatus }} ProgressRow status of the gift this member will receive */

/** @typedef {{ gifteeUserId: number, gifteeName: string, santaUserId: number, santaName: string, santaUsername: string | null }} OverdueRow organiser-only: a Santa past the deadline who has not sent */

/**
 * The getExchange response. `giftee`/`myGift` are null unless the exchange is drawn and the caller is in a pair;
 * `progress` is empty until assignments exist. `drawPending`: drawn but the assignments were never written.
 * @typedef {{
 *   id: number, name: string, code: string, displayCode: string, inviteLink: string,
 *   status: string | null, budget: Budget, deadline: string | null,
 *   isOrganiser: boolean, organiserName: string,
 *   members: { userId: number, nickname: string | null, isMe: boolean, isOrganiser: boolean, tag: 'surprise' | 'wishlist' | null }[],
 *   me: ReturnType<typeof import('./details.js').detailsOf> | null,
 *   drawPending: boolean, giftee: Giftee | null, myGift: MyGift | null, progress: ProgressRow[], overdue: OverdueRow[],
 * }} ExchangeView
 */

export {};
