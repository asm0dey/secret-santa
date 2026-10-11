<script>
  // Appeal a block (mockup 9b): one per block. Afterwards the Blocked screen shows "Appeal sent".
  import { call } from '../lib/api.js';
  import { replace, backOrReplace } from '../lib/router.js';
  import { t, errorText } from '../lib/i18n.js';
  import { shortDate } from '../lib/format.js';

  /** @type {{ blockId: string }} */
  let { blockId } = $props();

  const MAX = 1000;

  /** @typedef {Awaited<ReturnType<import('../../tgcloud/endpoints/home.js').default>>['me']['blocks'][number]} Block */
  let block = $state(/** @type {Block | null} */ (null));
  let loadCode = $state('');
  let text = $state('');
  let tracking = $state('');
  let textError = $state('');
  let error = $state('');
  let busy = $state(false);

  async function load() {
    loadCode = '';
    try {
      const home = await call('home');
      const b = home.me.blocks.find((/** @type {Block} */ x) => String(x.id) === blockId);
      if (!b || b.appealed) return replace('#/blocked');
      block = b;
    } catch (e) {
      loadCode = /** @type {{ code?: string }} */ (e).code ?? 'INTERNAL';
    }
  }
  load();

  /** @param {SubmitEvent} e */
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!text.trim()) {
      textError = t('common.required');
      return;
    }
    busy = true;
    error = '';
    try {
      await call('submitAppeal', { blockId: Number(blockId), text: text.trim(), tracking: tracking.trim() || undefined });
      backOrReplace('#/blocked');
    } catch (err) {
      const code = /** @type {{ code?: string }} */ (err).code;
      if (code === 'FORBIDDEN' || code === 'NOT_FOUND') return replace('#/blocked'); // appealed already, or the block is gone
      error = errorText(code);
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex flex-col gap-4">
  <h1 class="text-2xl font-bold">{t('appeal.title')}</h1>

  {#if loadCode}
    <div class="alert alert-error alert-soft" role="alert">
      <span>{errorText(loadCode)}</span>
      <button class="btn btn-sm" onclick={load}>{t('common.retry')}</button>
    </div>
  {:else if !block}
    <div class="flex justify-center p-6"><span class="loading loading-spinner loading-lg" role="status" aria-label={t('common.loading')}></span></div>
  {:else}
    {#if block.exchangeName}
      <p class="text-sm opacity-70">{t('appeal.blockedInfo', { exchange: block.exchangeName, date: block.createdAt ? shortDate(block.createdAt) : '' })}</p>
    {/if}

    <form class="flex flex-col gap-4" novalidate onsubmit={submit}>
      <div class="fieldset">
        <label class="fieldset-legend" for="appeal-text">{t('appeal.text')}</label>
        <textarea
          id="appeal-text"
          class="textarea h-32 w-full"
          maxlength={MAX}
          required
          aria-invalid={textError ? 'true' : undefined}
          aria-describedby={textError ? 'appeal-text-error' : undefined}
          oninput={() => (textError = '')}
          bind:value={text}
        ></textarea>
        {#if text.length >= MAX - 100}<p class="label justify-end">{text.length}/{MAX}</p>{/if}
        {#if textError}<p id="appeal-text-error" class="label whitespace-normal text-error" role="alert">{textError}</p>{/if}
      </div>

      <div class="fieldset">
        <label class="fieldset-legend" for="appeal-tracking">{t('appeal.tracking')} <span class="font-normal opacity-60">({t('common.optional')})</span></label>
        <input id="appeal-tracking" class="input w-full font-mono" maxlength="64" autocomplete="off" bind:value={tracking} />
      </div>

      <p class="text-sm opacity-70">{t('appeal.hint')}</p>
      {#if error}<p class="text-sm text-error" role="alert">{error}</p>{/if}
      <button class="btn btn-primary btn-block" type="submit" disabled={busy}>
        {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
        {t('appeal.submit')}
      </button>
    </form>
  {/if}
</div>
