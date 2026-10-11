import { table, integer, text, index, uniqueIndex } from 'sdk/db';

export const users = table('users', {
  id: integer('id').primaryKey(),
  firstName: text('first_name').notNull(),
  username: text('username'),
  lang: text('lang').notNull(),
  canMessage: integer('can_message'),
  createdAt: integer('created_at'),
});

export const exchanges = table('exchanges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  organiserId: integer('organiser_id').notNull(),
  budgetKind: text('budget_kind'), // any|max|min|range
  budgetMin: integer('budget_min'),
  budgetMax: integer('budget_max'),
  currency: text('currency'),
  deadline: text('deadline'), // YYYY-MM-DD
  closeAt: integer('close_at'),
  status: text('status'), // open|drawn|closed
  drawnAt: integer('drawn_at'),
  drawToken: text('draw_token'), // random value written by the request that wins the open -> drawn flip
  closedAt: integer('closed_at'),
  createdAt: integer('created_at'),
});

export const members = table('members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  exchangeId: integer('exchange_id'),
  userId: integer('user_id'),
  nickname: text('nickname'),
  address: text('address'),
  wishMode: text('wish_mode'), // ideas|surprise
  wishlistUrl: text('wishlist_url'),
  wishes: text('wishes'),
  joinedAt: integer('joined_at'),
}, (t) => [uniqueIndex('members_ex_user').on(t.exchangeId, t.userId)]);

export const assignments = table('assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  exchangeId: integer('exchange_id'),
  santaId: integer('santa_id'),
  gifteeId: integer('giftee_id'),
  seenAt: integer('seen_at'),
  sentAt: integer('sent_at'),
  tracking: text('tracking'),
  receivedAt: integer('received_at'),
}, (t) => [
  uniqueIndex('asg_ex_santa').on(t.exchangeId, t.santaId),
  uniqueIndex('asg_ex_giftee').on(t.exchangeId, t.gifteeId),
]);

export const messages = table('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  exchangeId: integer('exchange_id'),
  assignmentId: integer('assignment_id'),
  fromSanta: integer('from_santa'),
  text: text('text'),
  createdAt: integer('created_at'),
}, (t) => [index('messages_assignment').on(t.assignmentId)]);

export const blocks = table('blocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  organiserId: integer('organiser_id'),
  exchangeId: integer('exchange_id'),
  exchangeName: text('exchange_name'),
  createdAt: integer('created_at'),
  appealText: text('appeal_text'),
  appealTracking: text('appeal_tracking'),
  appealAt: integer('appeal_at'),
  decision: text('decision'), // unblocked|kept
  decidedAt: integer('decided_at'),
});
