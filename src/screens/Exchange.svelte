<script>
  // Exchange screen (#/x/:id). This file holds the waiting room (before the draw, mockups 4 and 4a); Task 16 adds the drawn tabs.
  import { call } from '../lib/api.js';
  import { go, replace, backOrReplace } from '../lib/router.js';
  import { t, tn, lang, errorText } from '../lib/i18n.js';
  import { share } from '../lib/tg.js';
  import { formatBudget } from '../../tgcloud/lib/budget.js';

  /** @typedef {import('../../tgcloud/lib/types.js').ExchangeView} ExchangeView */
  /** @typedef {{ kind: 'leave' | 'remove' | 'delete' | 'draw', userId?: number, name?: string }} Confirm */

  /** @type {{ id: string }} */
  let { id } = $props();

  const AVATAR = ['bg-primary text-primary-content', 'bg-secondary text-secondary-content', 'bg-accent text-accent-content', 'bg-base-300 text-base-content'];
  const day = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' });

  let view = $state.raw(/** @type {ExchangeView | null} */ (null));
  let loadCode = $state('');
  let confirm = $state(/** @type {Confirm | null} */ (null));
  /** Open ⋯ menu: 'ex' or a member's user id. */
  let menu = $state(/** @type {'ex' | number | null} */ (null));
  let busy = $state(false);
  let error = $state('');
  let seq = 0;

  const open = $derived(view?.status === 'open');
  const canDraw = $derived((view?.members.length ?? 0) >= 3);

  /** @param {boolean} [quiet] background refresh: keeps the screen, surfaces only "gone" errors */
  async function load(quiet = false) {
    const n = ++seq; // a slower, older response must not overwrite a newer one
    if (!quiet) loadCode = '';
    try {
      const v = await call('getExchange', { id: Number(id) });
      if (n !== seq) return;
      view = v;
      loadCode = '';
    } catch (e) {
      if (n !== seq) return;
      const code = /** @type {{ code?: string }} */ (e).code ?? 'INTERNAL';
      if (!quiet || code === 'NOT_FOUND' || code === 'FORBIDDEN') loadCode = code;
    }
  }
  load();

  /** @param {Confirm} c */
  function confirmText(c) {
    const name = view?.name ?? '';
    if (c.kind === 'leave') return t('exchange.leaveConfirm', { name });
    if (c.kind === 'delete') return t('exchange.deleteConfirm', { name });
    if (c.kind === 'remove') return t('exchange.removeConfirm', { name: c.name ?? '' });
    return t('exchange.drawConfirm');
  }

  /** @param {Confirm['kind']} kind */
  const confirmLabel = (kind) =>
    t(kind === 'leave' ? 'exchange.leave' : kind === 'delete' ? 'common.delete' : kind === 'remove' ? 'common.remove' : 'exchange.drawConfirmYes');

  /** @param {Confirm['kind']} kind @param {number} [userId] */
  async function perform(kind, userId) {
    busy = true;
    error = '';
    try {
      const n = Number(id);
      if (kind === 'leave' || kind === 'delete') {
        await call(kind === 'leave' ? 'leave' : 'deleteExchange', { id: n });
        backOrReplace('#/');
        return;
      }
      await (kind === 'remove' ? call('removeMember', { id: n, userId }) : call('draw', { id: n }));
      await load();
    } catch (e) {
      const code = /** @type {{ code?: string }} */ (e).code;
      await load(); // the screen may be stale: ALREADY_DRAWN, TOO_FEW, a member who already left
      // ALREADY_DRAWN: the reload shows the drawn state, nothing to report. TOO_FEW: the reloaded hint says it, unless the count looks fine.
      if (code !== 'ALREADY_DRAWN' && !(code === 'TOO_FEW' && !canDraw)) error = errorText(code);
    } finally {
      busy = false;
    }
  }

  function approve() {
    const c = confirm;
    confirm = null;
    if (c) perform(c.kind, c.userId);
  }

  /** @param {MouseEvent} e */
  function outsideMenu(e) {
    if (!(e.target instanceof Element) || !e.target.closest('[data-menu]')) menu = null;
  }
</script>

<svelte:document
  onvisibilitychange={() => document.visibilityState === 'visible' && !busy && load(true)}
  onclick={outsideMenu}
  onkeydown={(e) => e.key === 'Escape' && (menu = null)}
/>

{#snippet menuButton(/** @type {'ex' | number} */ key)}
  <button
    class="btn btn-ghost btn-square"
    aria-label={t('common.more')}
    aria-haspopup="menu"
    aria-expanded={menu === key}
    onclick={() => (menu = menu === key ? null : key)}
  >⋯</button>
{/snippet}

<div class="flex flex-col gap-4">
  {#if loadCode}
    <div class="alert alert-error alert-soft" role="alert">
      <span>{errorText(loadCode)}</span>
      {#if loadCode === 'INTERNAL'}
        <button class="btn btn-sm" onclick={() => load()}>{t('common.retry')}</button>
      {:else}
        <button class="btn btn-sm" onclick={() => replace('#/')}>{t('home.title')}</button>
      {/if}
    </div>
  {:else if !view}
    <div class="flex justify-center p-6"><span class="loading loading-spinner loading-lg" role="status" aria-label={t('common.loading')}></span></div>
  {:else}
    <div class="flex items-start gap-2">
      <h1 class="min-w-0 flex-1 text-2xl font-bold break-words">{view.name}</h1>
      {#if view.isOrganiser && open}
        <div class={['dropdown dropdown-end', menu === 'ex' && 'dropdown-open']} data-menu>
          {@render menuButton('ex')}
          <ul class="menu dropdown-content z-10 w-56 rounded-box bg-base-100 p-2 shadow-lg">
            <li><button class="text-error" onclick={() => ((menu = null), (confirm = { kind: 'delete' }))}>{t('exchange.delete')}</button></li>
          </ul>
        </div>
      {/if}
    </div>

    {#if open}
      <div class="flex items-center gap-3 rounded-box bg-base-200 p-3">
        <div class="min-w-0 flex-1">
          <p class="text-sm opacity-70">{t('exchange.code')}</p>
          <p class="font-mono text-xl tracking-widest">{view.displayCode}</p>
        </div>
        <button class="btn btn-outline" onclick={() => view && share(view.inviteLink, t('exchange.shareText', { name: view.name }))}>{t('exchange.share')}</button>
      </div>
    {/if}

    {#if open || view.drawPending}
      <p class="text-sm opacity-70">
        {tn('exchange.summary', view.members.length, { budget: formatBudget(view.budget, lang), date: view.deadline ? day.format(Date.parse(`${view.deadline}T00:00:00Z`)) : '—' })}
      </p>

      <ul class="list rounded-box bg-base-200">
        {#each view.members as m, i (m.userId)}
          <li class="list-row items-center">
            <div class="avatar avatar-placeholder" aria-hidden="true">
              <div class={['w-9 rounded-full', AVATAR[i % AVATAR.length]]}><span>{[...(m.nickname ?? '?')][0]?.toUpperCase()}</span></div>
            </div>
            <div class="min-w-0">
              <p class="truncate font-medium">{m.nickname}{m.isMe ? ` (${t('common.you')})` : ''}</p>
              {#if m.isOrganiser || m.tag}
                <div class="mt-1 flex flex-wrap gap-1">
                  {#if m.isOrganiser}<span class="badge badge-soft badge-sm">{t('common.creator')}</span>{/if}
                  {#if m.tag}<span class="badge badge-soft badge-success badge-sm">{t(`exchange.tag.${m.tag}`)}</span>{/if}
                </div>
              {/if}
            </div>
            {#if view.isOrganiser && open && !m.isOrganiser}
              <div class={['dropdown dropdown-end', menu === m.userId && 'dropdown-open']} data-menu>
                {@render menuButton(m.userId)}
                <ul class="menu dropdown-content z-10 w-56 rounded-box bg-base-100 p-2 shadow-lg">
                  <li>
                    <button class="text-error" onclick={() => ((menu = null), (confirm = { kind: 'remove', userId: m.userId, name: m.nickname ?? '' }))}>
                      {t('exchange.removeMember', { name: m.nickname ?? '' })}
                    </button>
                  </li>
                </ul>
              </div>
            {/if}
          </li>
        {/each}
      </ul>

      {#if view.isOrganiser && open && !view.me}
        <button class="btn btn-primary btn-block" onclick={() => go(`#/join/${view?.code}`)}>{t('exchange.joinOwn')}</button>
      {/if}

      <div class="flex flex-wrap justify-between gap-2">
        {#if view.me}<button class="btn btn-ghost" onclick={() => go(`#/x/${id}/details`)}>{t('exchange.editMine')}</button>{/if}
        {#if open && view.isOrganiser}
          <button class="btn btn-ghost" onclick={() => go(`#/x/${id}/edit`)}>{t('exchange.editExchange')}</button>
        {:else if open}
          <button class="btn btn-ghost text-error" disabled={busy} onclick={() => (confirm = { kind: 'leave' })}>{t('exchange.leave')}</button>
        {/if}
      </div>

      {#if error}<div class="alert alert-error alert-soft" role="alert"><span>{error}</span></div>{/if}

      {#if view.isOrganiser && open}
        <button class="btn btn-primary btn-block" disabled={!canDraw || busy} aria-describedby={canDraw ? undefined : 'draw-hint'} onclick={() => (confirm = { kind: 'draw' })}>
          {t('exchange.draw')}
        </button>
        {#if !canDraw}<p id="draw-hint" class="text-center text-sm opacity-70">{t('exchange.drawNeedMore')}</p>{/if}
      {:else if view.isOrganiser}
        <p class="text-center text-sm opacity-70">{t('exchange.finishDrawHint')}</p>
        <button class="btn btn-primary btn-block" disabled={busy} onclick={() => perform('draw')}>{t('exchange.finishDraw')}</button>
      {:else}
        <div class="rounded-box bg-base-200 p-3 text-center text-sm opacity-80">
          {open ? t('exchange.waitingFor', { organiser: view.organiserName }) : t('exchange.drawing')}
        </div>
      {/if}
    {:else}
      <!-- Placeholder for drawn and closed exchanges: Task 16 replaces this block with the tabs. -->
      <p class="rounded-box bg-base-200 p-3">{view.status === 'closed' ? t('exchange.closed') : t('exchange.drawnNote')}</p>
    {/if}
  {/if}
</div>

{#if confirm}
  <dialog class="modal modal-bottom" aria-labelledby="confirm-text" {@attach (d) => /** @type {HTMLDialogElement} */ (d).showModal()} onclose={() => (confirm = null)}>
    <div class="modal-box">
      <p id="confirm-text" class="text-lg">{confirmText(confirm)}</p>
      <div class="modal-action">
        <form method="dialog"><button class="btn">{t('common.cancel')}</button></form>
        <button class={['btn', confirm.kind === 'draw' ? 'btn-primary' : 'btn-error']} onclick={approve}>{confirmLabel(confirm.kind)}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button tabindex="-1" aria-label={t('common.close')}>{t('common.close')}</button></form>
  </dialog>
{/if}
