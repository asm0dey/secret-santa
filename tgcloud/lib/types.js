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

export {};
