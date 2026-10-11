<script>
  // Shown instead of Home to a blocked user (mockup 9): one explanation per active block.
  import { call } from '../lib/api.js';
  import { go, replace } from '../lib/router.js';
  import { t, errorText } from '../lib/i18n.js';
  import { shortDate } from '../lib/format.js';

  /** @typedef {Awaited<ReturnType<import('../../tgcloud/endpoints/home.js').default>>['me']['blocks'][number]} Block */

  /** @type {Block[] | null} */
  let blocks = $state(null);
  let loadCode = $state('');

  async function load() {
    loadCode = '';
    try {
      const home = await call('home');
      if (!home.me.blocks.length) return replace('#/'); // unblocked since
      blocks = home.me.blocks;
    } catch (e) {
      loadCode = /** @type {{ code?: string }} */ (e).code ?? 'INTERNAL';
    }
  }
  load();

  /** @param {Block} b */
  const explain = (b) => {
    const date = b.createdAt ? shortDate(b.createdAt) : '';
    return b.exchangeName ? t('blocked.explain', { exchange: b.exchangeName, date }) : t('blocked.explainNoName', { date });
  };
</script>

<svelte:document onvisibilitychange={() => document.visibilityState === 'visible' && blocks && load()} />

<div class="flex flex-col gap-4">
  <h1 class="text-2xl font-bold">{t('blocked.title')}</h1>

  {#if loadCode}
    <div class="alert alert-error alert-soft" role="alert">
      <span>{errorText(loadCode)}</span>
      <button class="btn btn-sm" onclick={load}>{t('common.retry')}</button>
    </div>
  {:else if !blocks}
    <div class="flex justify-center p-6"><span class="loading loading-spinner loading-lg" role="status" aria-label={t('common.loading')}></span></div>
  {:else}
    {#each blocks as b (b.id)}
      <div class="flex flex-col gap-3 rounded-box bg-base-200 p-4">
        <p>{explain(b)}</p>
        {#if b.appealed}
          <p class="font-semibold">{b.decision === 'kept' ? t('blocked.kept') : t('blocked.appealSent')}</p>
        {:else}
          <button class="btn btn-primary btn-block" onclick={() => go(`#/appeal/${b.id}`)}>{t('blocked.appeal')}</button>
        {/if}
      </div>
    {/each}
  {/if}
</div>
