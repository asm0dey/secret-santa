/** @param {{ sentAt: number | null, receivedAt: number | null }} a @returns {import('./types.js').GiftStatus} */
export const giftStatus = (a) => (a.receivedAt != null ? 'received' : a.sentAt != null ? 'on_way' : 'not_sent');
