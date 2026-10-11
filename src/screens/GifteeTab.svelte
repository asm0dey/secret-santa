<script>
  // "My giftee" tab (mockups 5 and 5b): who I draw for, their wishes and address, and the shipping box.
  import { call } from '../lib/api.js';
  import { go } from '../lib/router.js';
  import { t, lang, errorText } from '../lib/i18n.js';
  import { openLink } from '../lib/tg.js';
  import { shortDate } from '../lib/format.js';
  import { formatBudget } from '../../tgcloud/lib/budget.js';
  import CopyButton from '../components/CopyButton.svelte';

  /** @typedef {import('../../tgcloud/lib/types.js').ExchangeView} ExchangeView */

  /** @type {{ view: ExchangeView, reload: () => Promise<void> }} */
  let { view, reload } = $props();

  const g = $derived(view.giftee);
  const name = $derived(g?.nickname ?? '');
  const sent = $derived(g?.sentAt != null);
  const surprise = $derived(g?.wishMode === 'surprise');
  const noWishes = $derived(!surprise && !g?.wishlistUrl && !g?.wishes);

  // null until I type: then the server's value shows, and stays in step after a save.
  let typed = $state(/** @type {string | null} */ (null));
  const tracking = $derived(typed ?? g?.tracking ?? '');
  let busy = $state(false);
  let error = $state('');
  const dirty = $derived(tracking.trim() !== (g?.tracking ?? ''));

  async function markSent() {
    if (busy) return;
    busy = true;
    error = '';
    try {
      await call('markSent', { id: view.id, tracking: tracking.trim() || null });
      await reload();
    } catch (e) {
      error = errorText(/** @type {{ code?: string }} */ (e).code);
    } finally {
      busy = false;
    }
  }
</script>

{#if g}
  <div class="flex flex-col gap-4">
    <div class="flex flex-col items-center gap-2 rounded-box bg-primary p-4 text-center text-primary-content">
      <p class="text-sm">★ {t('giftee.hero')} ★</p>
      <p class="text-3xl font-bold break-words">{name}</p>
      <p class="text-sm">{formatBudget(view.budget, lang)}{view.deadline ? ` · ${t('giftee.sendBy', { date: shortDate(view.deadline) })}` : ''}</p>
      <button class="btn mt-1" onclick={() => go(`#/x/${view.id}/chat/giftee`)}>{t('giftee.message', { name })}</button>
    </div>

    {#if surprise}
      <div class="flex flex-col gap-1 rounded-box bg-base-200 p-4 text-center">
        <p class="text-lg font-semibold">{t('giftee.surprise', { name })}</p>
        <p class="text-sm opacity-70">{t('giftee.surpriseHint')}</p>
      </div>
    {:else if noWishes}
      <div class="rounded-box bg-base-200 p-4 text-center">{t('giftee.noWishlist')}</div>
    {:else}
      {#if g.wishlistUrl}
        <div class="rounded-box bg-base-200 p-3">
          <p class="text-sm font-semibold opacity-70">{t('giftee.wishlist')}</p>
          <a class="link link-primary break-all" href={g.wishlistUrl} onclick={(e) => { e.preventDefault(); openLink(/** @type {string} */ (g.wishlistUrl)); }}>{g.wishlistUrl.replace(/^https?:\/\//, '')} ↗</a>
        </div>
      {/if}
      {#if g.wishes}
        <div class="rounded-box bg-base-200 p-3">
          <p class="text-sm font-semibold opacity-70">{t('giftee.likes')}</p>
          <p class="break-words whitespace-pre-line">{g.wishes}</p>
        </div>
      {/if}
    {/if}

    <div class="rounded-box bg-base-200 p-3">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-semibold opacity-70">{t('giftee.address')}</p>
        <CopyButton text={g.address ?? ''} />
      </div>
      <p class="break-words whitespace-pre-line">{g.address}</p>
    </div>

    <form class="flex flex-col gap-2 rounded-box bg-base-200 p-3" onsubmit={(e) => { e.preventDefault(); markSent(); }}>
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-semibold opacity-70">{t('giftee.shipping')}</p>
        {#if sent}<span class="badge badge-soft badge-success">{t('giftee.sent', { date: shortDate(/** @type {number} */ (g.sentAt)) })}</span>{/if}
      </div>
      <label class="text-sm" for="tracking">{t('giftee.tracking')} <span class="opacity-70">({t('common.optional')})</span></label>
      <input id="tracking" class="input w-full font-mono" maxlength="64" autocomplete="off" aria-describedby="tracking-hint" value={tracking} oninput={(e) => (typed = e.currentTarget.value)} />
      <p id="tracking-hint" class="text-sm opacity-70">{t('giftee.trackingHint', { name })}</p>
      {#if error}<p class="text-sm text-error" role="alert">{error}</p>{/if}
      <button class="btn btn-primary btn-block" type="submit" disabled={busy || (sent && !dirty)}>
        {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
        {t(sent ? 'giftee.updateTracking' : 'giftee.markSent')}
      </button>
    </form>
  </div>
{/if}
