<script>
  // Progress tab (mockup 7): deadline box, who has received a gift, and the organiser's overdue box. Read-only once closed.
  import { tick } from 'svelte';
  import { call } from '../lib/api.js';
  import { go } from '../lib/router.js';
  import { t, tn, errorText } from '../lib/i18n.js';
  import { openLink } from '../lib/tg.js';
  import { shortDate } from '../lib/format.js';
  import { AVATAR, initial } from '../lib/ui.js';
  import { deadlineEnd, isPast } from '../../tgcloud/lib/dates.js';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import Sheet from '../components/Sheet.svelte';

  /** @typedef {import('../../tgcloud/lib/types.js').ExchangeView} ExchangeView */
  /** @typedef {import('../../tgcloud/lib/types.js').OverdueRow} OverdueRow */

  /** @type {{ view: ExchangeView, reload: () => Promise<void> }} */
  let { view, reload } = $props();

  const BADGE = /** @type {const} */ ({ not_sent: 'badge-outline', on_way: 'badge-soft badge-warning', received: 'badge-soft badge-success' });
  const LABEL = /** @type {const} */ ({ not_sent: 'progress.notSent', on_way: 'progress.onWay', received: 'progress.received' });

  const closed = $derived(view.status === 'closed');
  const meIds = $derived(new Set(view.members.filter((m) => m.isMe).map((m) => m.userId)));
  const counts = $derived({
    received: view.progress.filter((r) => r.gift === 'received').length,
    onWay: view.progress.filter((r) => r.gift === 'on_way').length,
    notSent: view.progress.filter((r) => r.gift === 'not_sent').length,
  });
  const passed = $derived(!!view.deadline && isPast(view.deadline, Date.now()));
  const daysAgo = $derived(view.deadline ? Math.floor((Date.now() - deadlineEnd(view.deadline)) / 86_400_000) : 0);

  let busy = $state(false);
  let error = $state('');
  /** Last result per Santa. */
  let outcome = $state(/** @type {Record<number, 'sent' | 'lost' | 'blocked'>} */ ({}));
  let nudged = $state(/** @type {number | null} */ (null));
  let compose = $state(/** @type {OverdueRow | null} */ (null));
  let blocking = $state(/** @type {OverdueRow | null} */ (null));
  let text = $state('');
  let composeError = $state('');
  const composeId = $props.id();
  /** Where focus returns when a sheet closes. @type {HTMLElement | null} */
  let restoreTo = null;

  /** @param {OverdueRow} o @param {Event} e */
  function openCompose(o, e) {
    restoreTo = /** @type {HTMLElement} */ (e.currentTarget);
    text = '';
    composeError = '';
    compose = o;
  }

  /** @param {OverdueRow} o @param {Event} e */
  function askBlock(o, e) {
    restoreTo = /** @type {HTMLElement} */ (e.currentTarget);
    blocking = o;
  }

  async function closeSheet() {
    compose = null;
    blocking = null;
    await tick(); // the dialog is gone from the DOM before focus returns
    restoreTo?.focus();
  }

  async function sendCompose() {
    const o = compose;
    if (!o || busy || !text.trim()) return;
    busy = true;
    composeError = '';
    try {
      const res = await call('messageSanta', { id: view.id, santaUserId: o.santaUserId, text: text.trim() });
      outcome[o.santaUserId] = res.delivered ? 'sent' : 'lost';
      closeSheet();
    } catch (e) {
      composeError = errorText(/** @type {{ code?: string }} */ (e).code);
    } finally {
      busy = false;
    }
  }

  async function block() {
    const o = blocking;
    blocking = null;
    if (!o || busy) return;
    busy = true;
    error = '';
    try {
      await call('block', { id: view.id, santaUserId: o.santaUserId });
      outcome[o.santaUserId] = 'blocked';
      await reload(); // the server now says blocked:true, which survives a tab switch
    } catch (e) {
      error = errorText(/** @type {{ code?: string }} */ (e).code);
    } finally {
      busy = false;
    }
  }

  async function nudge() {
    if (busy) return;
    busy = true;
    error = '';
    try {
      nudged = (await call('nudge', { id: view.id })).sent;
    } catch (e) {
      error = errorText(/** @type {{ code?: string }} */ (e).code);
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex flex-col gap-4">
  {#if closed}
    <div class="alert alert-info alert-soft" role="status"><span>{t('exchange.closed')}</span></div>
  {:else if view.deadline}
    <div class={['flex flex-col items-start gap-1 rounded-box border bg-base-200 p-3', passed ? 'border-primary' : 'border-transparent']}>
      <p class="font-semibold">{passed ? (daysAgo > 0 ? tn('progress.deadlinePassed', daysAgo) : t('progress.deadlineToday')) : t('progress.deadline', { date: shortDate(view.deadline) })}</p>
      {#if passed}<p class="text-sm opacity-70">{t('progress.dueWas', { date: shortDate(view.deadline) })}</p>{/if}
      <p class="text-sm opacity-70">{t('progress.counts', counts)}</p>
      {#if view.isOrganiser}
        <button class="btn btn-ghost btn-sm px-0" onclick={() => go(`#/x/${view.id}/edit`)}>{t('progress.moveDeadline')}</button>
      {/if}
    </div>
  {/if}

  <div>
    <h2 class="mb-2 text-sm font-semibold opacity-70">{t('progress.title')}</h2>
    <ul class="list rounded-box bg-base-200">
      {#each view.progress as r, i (r.userId)}
        <li class="list-row items-center">
          <div class="avatar avatar-placeholder" aria-hidden="true">
            <div class={['w-9 rounded-full', AVATAR[i % AVATAR.length]]}><span>{initial(r.nickname)}</span></div>
          </div>
          <p class="min-w-0 truncate font-medium">{r.nickname}{meIds.has(r.userId) ? ` (${t('common.you')})` : ''}</p>
          <span class={['badge badge-sm', BADGE[r.gift]]}>{t(LABEL[r.gift])}</span>
        </li>
      {/each}
    </ul>
  </div>

  {#if !closed}
    {#each view.overdue as o (o.santaUserId)}
      <div class="flex flex-col gap-2 rounded-box border border-primary bg-base-200 p-3">
        <p class="text-sm font-semibold opacity-70">{t('progress.onlyYou')}</p>
        <p>{t('progress.overdue', { giftee: o.gifteeName, santa: o.santaName })}</p>
        {#if o.blocked || outcome[o.santaUserId] === 'blocked'}
          <p class="text-sm font-semibold">{t('progress.blocked', { santa: o.santaName })}</p>
        {:else}
          <div class="flex flex-wrap gap-2">
            <button class="btn btn-outline" disabled={busy} onclick={(e) => openCompose(o, e)}>{t('progress.message', { santa: o.santaName })}</button>
            {#if o.santaUsername}
              <button class="btn btn-outline" onclick={() => openLink(`https://t.me/${o.santaUsername}`)}>{t('common.openProfile')}</button>
            {/if}
            {#if o.blockable}
              <button class="btn btn-outline btn-error" disabled={busy} onclick={(e) => askBlock(o, e)}>{t('progress.block', { santa: o.santaName })}</button>
            {/if}
          </div>
        {/if}
        {#if outcome[o.santaUserId] === 'sent'}
          <p class="text-sm" role="status">{t('progress.messageSent', { santa: o.santaName })}</p>
        {:else if outcome[o.santaUserId] === 'lost'}
          <p class="text-sm text-error" role="alert">{t('progress.notDelivered')}</p>
        {/if}
      </div>
    {/each}

    {#if view.overdue.some((o) => !o.blocked)}
      {#if error}<p class="text-sm text-error" role="alert">{error}</p>{/if}
      <button class="btn btn-primary btn-block" disabled={busy} onclick={nudge}>{t('progress.nudge')}</button>
      {#if nudged !== null}<p class="text-center text-sm" role="status">{tn('progress.nudged', nudged)}</p>{/if}
    {/if}
  {/if}
</div>

{#if compose}
  <Sheet labelId={composeId} onclose={closeSheet}>
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        sendCompose();
      }}
    >
      <h3 id={composeId} class="text-lg font-semibold">{t('progress.composeTitle', { santa: compose.santaName })}</h3>
      <textarea
        class="textarea h-32 w-full"
        maxlength="1000"
        placeholder={t('progress.composePlaceholder')}
        aria-label={t('progress.composePlaceholder')}
        bind:value={text}
      ></textarea>
      {#if text.length >= 900}<p class="text-right text-sm opacity-70">{text.length}/1000</p>{/if}
      {#if composeError}<p class="text-sm text-error" role="alert">{composeError}</p>{/if}
      <div class="modal-action mt-0">
        <button class="btn" type="button" onclick={closeSheet}>{t('common.cancel')}</button>
        <button class="btn btn-primary" type="submit" disabled={busy || !text.trim()}>
          {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
          {t('common.send')}
        </button>
      </div>
    </form>
  </Sheet>
{/if}

{#if blocking}
  <ConfirmDialog text={t('progress.blockConfirm', { santa: blocking.santaName })} label={t('progress.block', { santa: blocking.santaName })} onapprove={block} oncancel={closeSheet} />
{/if}
