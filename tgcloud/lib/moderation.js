import { db, EndpointError } from 'sdk';
import { eq, and, sql } from 'sdk/db';
import { exchanges, members, assignments, blocks, users } from '../schema.js';
import { clock } from './clock.js';
import { isPast } from './dates.js';
import { ERR, fail } from './errors.js';
import { loadExchange, requireOrganiser, requireStatus } from './access.js';
import { removeMemberRow } from './membership.js';
import { cancelExchange } from './cancel.js';
import { send, esc } from './notify.js';
import { t } from './i18n.js';

/** @param {number} id */
const userOf = (id) => db.select().from(users).where(eq(users.id, id)).get();
/** @param {number} id @returns {Promise<import('./types.js').Lang>} */
export const langFor = async (id) => /** @type {import('./types.js').Lang} */ ((await userOf(id))?.lang ?? 'en');
/** @param {number} id */
const loadBlock = async (id) => (await db.select().from(blocks).where(eq(blocks.id, id)).get()) ?? fail(ERR.NOT_FOUND);
/** @param {{ decision: string | null }} b */
const isActive = (b) => b.decision == null || b.decision === 'kept';

// A removal that lost a race with the draw/close leaves the exchange untouched: that is the pairing invariant working.
/** @param {() => Promise<unknown>} fn */
async function unlessDrawn(fn) {
  try { await fn(); } catch (e) { if (!(e instanceof EndpointError)) throw e; }
}

// The organiser blocks a Santa whose gift was never sent or received, after the deadline.
// Eligibility comes from the assignment row, which survives the close wipe.
/** @param {number} organiserId @param {number} exchangeId @param {number} santaUserId */
export async function blockSanta(organiserId, exchangeId, santaUserId) {
  const ex = await loadExchange(exchangeId);
  requireOrganiser(ex, organiserId);
  requireStatus(ex, 'drawn', 'closed');
  const a = await db.select().from(assignments)
    .where(and(eq(assignments.exchangeId, ex.id), eq(assignments.santaId, santaUserId))).get();
  if (!a || a.sentAt != null || a.receivedAt != null) fail(ERR.FORBIDDEN);
  if (!ex.deadline || !isPast(ex.deadline, clock.now())) fail(ERR.NOT_YET);
  const existing = await db.select().from(blocks)
    .where(and(eq(blocks.userId, santaUserId), eq(blocks.exchangeId, ex.id))).all();
  if (existing.some(isActive)) return; // double tap

  await db.insert(blocks).values({ userId: santaUserId, organiserId, exchangeId: ex.id, exchangeName: ex.name, createdAt: clock.now() }).run();

  // Undrawn exchanges only: drawn/closed memberships stay so every pairing holds.
  const organised = await db.select().from(exchanges)
    .where(and(eq(exchanges.organiserId, santaUserId), eq(exchanges.status, 'open'))).all();
  for (const o of organised) await unlessDrawn(() => cancelExchange(o));
  for (const m of await db.select().from(members).where(eq(members.userId, santaUserId)).all()) {
    const o = await db.select().from(exchanges).where(eq(exchanges.id, m.exchangeId)).get();
    if (o?.status === 'open' && o.organiserId !== santaUserId) await unlessDrawn(() => removeMemberRow(o.id, m.id));
  }

  const lang = await langFor(santaUserId);
  await send(santaUserId, t(lang, 'blocked', { exchange: esc(ex.name) }), [[{ text: t(lang, 'btnAppeal'), app: '#/blocked' }]]);
}

// One appeal per block: explanation text and an optional tracking number go to the organiser who blocked.
/** @param {number} userId @param {number} blockId @param {unknown} text @param {unknown} [tracking] */
export async function submitAppeal(userId, blockId, text, tracking) {
  const b = await loadBlock(blockId);
  if (b.userId !== userId || !isActive(b) || b.appealAt != null) fail(ERR.FORBIDDEN);
  if (typeof text !== 'string' || !text.trim() || text.length > 1000) fail(ERR.BAD_INPUT);
  const track = tracking == null || tracking === '' ? null : tracking;
  if (track !== null && (typeof track !== 'string' || track.length > 64)) fail(ERR.BAD_INPUT);

  // Conditional on still being unappealed; re-read to see whether this call won.
  const now = clock.now();
  await db.update(blocks).set({ appealText: text, appealTracking: track, appealAt: now })
    .where(and(eq(blocks.id, b.id), sql`${blocks.appealAt} is null`)).run();
  const won = await loadBlock(b.id);
  if (won.appealAt !== now || won.appealText !== text) fail(ERR.FORBIDDEN);

  const member = await db.select().from(members).where(and(eq(members.exchangeId, b.exchangeId), eq(members.userId, userId))).get();
  const name = member?.nickname ?? (await userOf(userId))?.firstName ?? '';
  const lang = await langFor(b.organiserId);
  const body = t(lang, 'appeal', {
    name: esc(name), exchange: esc(b.exchangeName ?? ''), date: new Date(b.createdAt ?? now).toISOString().slice(0, 10), text: esc(text),
  }) + (track ? t(lang, 'appealTracking', { tracking: esc(track) }) : '');
  await send(b.organiserId, body, [[
    { text: t(lang, 'btnUnblock'), data: `appeal:${b.id}:unblock` },
    { text: t(lang, 'btnKeep'), data: `appeal:${b.id}:keep` },
  ]]);
}

/** @param {number} organiserId @param {number} blockId @param {unknown} decision */
export async function decideAppeal(organiserId, blockId, decision) {
  if (decision !== 'unblock' && decision !== 'keep') fail(ERR.BAD_INPUT);
  const b = await loadBlock(blockId);
  if (b.organiserId !== organiserId || b.appealAt == null || b.decision != null) fail(ERR.FORBIDDEN);

  // Conditional on still being undecided; re-read to see whether this call won.
  const [value, now] = [decision === 'unblock' ? 'unblocked' : 'kept', clock.now()];
  await db.update(blocks).set({ decision: value, decidedAt: now })
    .where(and(eq(blocks.id, b.id), sql`${blocks.decision} is null`)).run();
  const won = await loadBlock(b.id);
  if (won.decision !== value || won.decidedAt !== now) fail(ERR.FORBIDDEN);

  const lang = await langFor(b.userId);
  await send(b.userId, t(lang, decision === 'unblock' ? 'appealUnblocked' : 'appealKept', { exchange: esc(b.exchangeName ?? '') }));
}
