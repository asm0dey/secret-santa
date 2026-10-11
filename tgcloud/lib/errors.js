const NAMES = ['NOT_FOUND', 'FORBIDDEN', 'BLOCKED', 'BAD_INPUT', 'ALREADY_MEMBER', 'FULL', 'TOO_FEW', 'ALREADY_DRAWN', 'NOT_DRAWN', 'CLOSED', 'NOT_YET'];
export const ERR = Object.fromEntries(NAMES.map((n) => [n, n]));

import { EndpointError } from 'sdk';
export function fail(code) {
  throw new EndpointError(code, { code });
}
