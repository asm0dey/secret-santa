<script>
  // Exchange screen (#/x/:id): loads the exchange, refreshes it when the app becomes visible again, and picks the view by status.
  // Before the draw: WaitingRoom. Drawn and closed: placeholder until Task 16 adds the tabs.
  import { call } from '../lib/api.js';
  import { replace } from '../lib/router.js';
  import { t, errorText } from '../lib/i18n.js';
  import WaitingRoom from './WaitingRoom.svelte';

  /** @typedef {import('../../tgcloud/lib/types.js').ExchangeView} ExchangeView */

  /** @type {{ id: string }} */
  let { id } = $props();

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
    <!-- Placeholder for drawn and closed exchanges: Task 16 replaces this block with the tabs. -->
    <p class="rounded-box bg-base-200 p-3">{view.status === 'closed' ? t('exchange.closed') : t('exchange.drawnNote')}</p>
  </div>
{/if}
