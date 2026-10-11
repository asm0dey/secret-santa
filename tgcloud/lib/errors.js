const NAMES = ['NOT_FOUND', 'FORBIDDEN', 'BLOCKED', 'BAD_INPUT', 'ALREADY_MEMBER', 'FULL', 'TOO_FEW', 'ALREADY_DRAWN', 'NOT_DRAWN', 'CLOSED', 'NOT_YET'];
/** @type {{ [K in import('./types.js').ErrCode]: K }} */
export const ERR = /** @type {any} */ (Object.fromEntries(NAMES.map((n) => [n, n])));

import { EndpointError } from 'sdk';
/** @param {import('./types.js').ErrCode} code @returns {never} */
export function fail(code) {
  throw new EndpointError(code, { code });
}
