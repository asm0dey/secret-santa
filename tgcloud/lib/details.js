import { ERR, fail } from './errors.js';

const str = (v, max, min = 0) => (typeof v === 'string' && v.length >= min && v.length <= max ? v : fail(ERR.BAD_INPUT));

// Validates member details from the client and returns the members-table columns.
export function detailsColumns(d) {
  if (!d || typeof d !== 'object') fail(ERR.BAD_INPUT);
  const nickname = str(typeof d.nickname === 'string' ? d.nickname.trim() : d.nickname, 40, 1);
  const address = str(typeof d.address === 'string' ? d.address.trim() : d.address, 500, 1);
  const wishMode = d.wishMode === 'ideas' || d.wishMode === 'surprise' ? d.wishMode : fail(ERR.BAD_INPUT);
  if (wishMode === 'surprise') return { nickname, address, wishMode, wishlistUrl: null, wishes: null };
  const url = str(d.wishlistUrl ?? '', 500).trim();
  if (url && !/^https?:\/\//.test(url)) fail(ERR.BAD_INPUT);
  const wishes = str(d.wishes ?? '', 1000); // Santa sees it exactly as typed
  return { nickname, address, wishMode, wishlistUrl: url || null, wishes: wishes.trim() ? wishes : null };
}

export const detailsOf = (m) => ({
  nickname: m.nickname, address: m.address, wishMode: m.wishMode, wishlistUrl: m.wishlistUrl, wishes: m.wishes,
});

// What others may see about a member's wishes: never the text itself.
export const wishTag = (m) => (m.wishMode === 'surprise' ? 'surprise' : m.wishlistUrl || m.wishes ? 'wishlist' : null);
