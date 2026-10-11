<script>
  // "My gift" tab (mockup 5c): the state of the gift I will receive. Nothing here says who the Santa is.
  import { call } from '../lib/api.js';
  import { go } from '../lib/router.js';
  import { t, errorText } from '../lib/i18n.js';
  import { shortDate } from '../lib/format.js';
  import CopyButton from '../components/CopyButton.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';

  /** @typedef {import('../../tgcloud/lib/types.js').ExchangeView} ExchangeView */

  /** @type {{ view: ExchangeView, reload: () => Promise<void> }} */
  let { view, reload } = $props();

  const gift = $derived(view.myGift);
  const sub = $derived(
    [gift?.sentAt != null ? t('giftee.sent', { date: shortDate(gift.sentAt) }) : '', view.deadline ? t('gift.dueBy', { date: shortDate(view.deadline) }) : ''].filter(Boolean).join(' · '),
  );
  const TITLE = { not_sent: 'gift.notSent', on_way: 'gift.onWay', received: 'gift.received' };

  let asking = $state(false);
  let busy = $state(false);
  let error = $state('');
  /** @type {HTMLElement | undefined} */
  let trigger = $state();

  async function received() {
    asking = false;
    if (busy) return;
    busy = true;
    error = '';
    try {
      await call('markReceived', { id: view.id });
      await reload();
    } catch (e) {
      error = errorText(/** @type {{ code?: string }} */ (e).code);
    } finally {
      busy = false;
    }
  }

  function cancel() {
    asking = false;
    trigger?.focus();
  }
</script>

{#if gift}
  <div class="flex flex-col gap-4">
    <div class="flex flex-col items-center gap-2 rounded-box bg-primary p-4 text-center text-primary-content">
      <p class="text-sm">★ {t('gift.from')} ★</p>
      <p class="text-2xl font-bold">{t(TITLE[gift.status])}</p>
      <p class="text-sm">
        {sub}
      </p>
    </div>

    {#if gift.tracking}
      <div class="rounded-box bg-base-200 p-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold opacity-70">{t('giftee.tracking')}</p>
          <CopyButton text={gift.tracking} />
        </div>
        <p class="font-mono text-lg break-all">{gift.tracking}</p>
      </div>
    {/if}

    {#if view.me}
      <div class="flex flex-col items-start gap-1 rounded-box bg-base-200 p-3">
        <p class="text-sm font-semibold opacity-70">{t('gift.detailsTitle')}</p>
        <p class="text-sm opacity-70">{t('gift.detailsHint')}</p>
        <button class="btn btn-ghost btn-sm px-0" onclick={() => go(`#/x/${view.id}/details`)}>{t('gift.editMine')}</button>
      </div>
    {/if}

    <button class="btn btn-outline" onclick={() => go(`#/x/${view.id}/chat/santa`)}>{t('gift.messageSanta')}</button>

    {#if error}<p class="text-sm text-error" role="alert">{error}</p>{/if}
    {#if gift.status !== 'received'}
      <button class="btn btn-primary btn-block" bind:this={trigger} disabled={busy} onclick={() => (asking = true)}>
        {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
        {t('gift.markReceived')}
      </button>
    {/if}
  </div>

  {#if asking}
    <ConfirmDialog text={t('gift.receivedConfirm')} label={t('gift.markReceived')} danger={false} onapprove={received} oncancel={cancel} />
  {/if}
{/if}
