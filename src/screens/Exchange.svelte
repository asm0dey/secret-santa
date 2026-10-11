<script>
  // Exchange screen (#/x/:id): loads the exchange, refreshes it when the app becomes visible again, and picks the view by status.
  // Before the draw: WaitingRoom. After it: the tabs My giftee / My gift / Progress (the tab is in the URL); closed shows Progress only.
  import { call } from '../lib/api.js';
  import { replace } from '../lib/router.js';
  import { t, errorText } from '../lib/i18n.js';
  import WaitingRoom from './WaitingRoom.svelte';
  import GifteeTab from './GifteeTab.svelte';
  import GiftTab from './GiftTab.svelte';
  import ProgressTab from './ProgressTab.svelte';
  import Segmented from '../components/Segmented.svelte';

  /** @typedef {import('../../tgcloud/lib/types.js').ExchangeView} ExchangeView */

  /** @type {{ id: string, tab?: string }} */
  let { id, tab } = $props();

  let view = $state.raw(/** @type {ExchangeView | null} */ (null));
  let loadCode = $state('');
  let seq = 0;

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

  // On this screen a missing exchange was deleted, not mistyped: NOT_FOUND must not say "No exchange with this code".
  // Closed exchanges and an organiser who is not in a pair have no personal tabs.
  const tabs = $derived(view && view.status !== 'closed' && (view.giftee || view.myGift) ? ['giftee', 'gift', 'progress'] : ['progress']);
  const active = $derived(tab && tabs.includes(tab) ? tab : tabs[0]);
  const tabOptions = $derived(tabs.map((v) => ({ value: v, label: t(`tabs.${v}`) })));

  const loadError = $derived(errorText(loadCode === 'NOT_FOUND' ? 'EXCHANGE_GONE' : loadCode));
</script>

<svelte:document onvisibilitychange={() => document.visibilityState === 'visible' && load(true)} />

{#if loadCode}
  <div class="alert alert-error alert-soft" role="alert">
    <span>{loadError}</span>
    {#if loadCode === 'INTERNAL'}
      <button class="btn btn-sm" onclick={() => load()}>{t('common.retry')}</button>
    {:else}
      <button class="btn btn-sm" onclick={() => replace('#/')}>{t('home.title')}</button>
    {/if}
  </div>
{:else if !view}
  <div class="flex justify-center p-6"><span class="loading loading-spinner loading-lg" role="status" aria-label={t('common.loading')}></span></div>
{:else if view.status === 'open' || view.drawPending}
  <WaitingRoom {view} reload={() => load()} />
{:else}
  <div class="flex flex-col gap-4">
    <h1 class="text-2xl font-bold break-words">{view.name}</h1>
    {#if tabs.length > 1}
      <Segmented legend={view.name} hideLegend options={tabOptions} value={active} onselect={(v) => replace(`#/x/${view?.id}/${v}`)} />
    {/if}
    {#if active === 'giftee'}
      <GifteeTab {view} reload={() => load()} />
    {:else if active === 'gift'}
      <GiftTab {view} reload={() => load()} />
    {:else}
      <ProgressTab {view} reload={() => load()} />
    {/if}
  </div>
{/if}
