<script>
  // Create (#/new) and edit (#/x/:id/edit). After the draw only the deadline can change.
  import { call } from '../lib/api.js';
  import { go } from '../lib/router.js';
  import { t, lang, errorText } from '../lib/i18n.js';
  import Segmented from '../components/Segmented.svelte';

  /** @type {{ id?: string }} */
  let { id } = $props();

  const KINDS = /** @type {const} */ (['any', 'max', 'min', 'range']);
  const kindOptions = KINDS.map((k) => ({ value: k, label: t(`create.budget.${k}`) }));
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const defaultCurrency = lang === 'ru' ? 'RUB' : 'EUR';

  /** @param {string} current */
  function currencyList(current) {
    let list = ['EUR', 'RUB', 'USD'];
    try {
      list = Intl.supportedValuesOf('currency');
    } catch {}
    return list.includes(current) ? list : [current, ...list];
  }

  let name = $state('');
  let kind = $state('any');
  let min = $state('');
  let max = $state('');
  let currency = $state(defaultCurrency);
  let deadline = $state('');
  let origDeadline = '';
  let drawn = $state(false);
  let ready = $state(false);
  let error = $state('');
  let busy = $state(false);

  const currencies = $derived(currencyList(currency));
  // An existing deadline may already be today or past: let an untouched date stay valid.
  const minDate = $derived(origDeadline && origDeadline < tomorrow ? origDeadline : tomorrow);

  async function load() {
    error = '';
    try {
      const ex = await call('getExchange', { id: Number(id) });
      if (!ex.isOrganiser) throw { code: 'FORBIDDEN' };
      name = ex.name;
      kind = ex.budget.kind;
      min = ex.budget.min == null ? '' : String(ex.budget.min);
      max = ex.budget.max == null ? '' : String(ex.budget.max);
      currency = ex.budget.currency ?? defaultCurrency;
      deadline = origDeadline = ex.deadline ?? '';
      drawn = ex.status !== 'open';
      ready = true;
    } catch (e) {
      error = errorText(/** @type {{ code?: string }} */ (e).code);
    }
  }
  // The screen is remounted for every route, so props are read once at start.
  (function start() {
    if (id) load();
    else ready = true;
  })();

  /** @param {string} s */
  const amount = (s) => (/^\d+$/.test(s.replace(/\s/g, '')) ? Number(s.replace(/\s/g, '')) : NaN);

  function budget() {
    if (kind === 'any') return { kind, min: null, max: null, currency: null };
    return { kind, min: kind === 'max' ? null : amount(min), max: kind === 'min' ? null : amount(max), currency };
  }

  /** @param {SubmitEvent} e */
  async function submit(e) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      if (!id) {
        const res = await call('createExchange', { name, budget: budget(), deadline });
        go(`#/join/${res.code}`);
      } else {
        await call('updateExchange', drawn ? { id: Number(id), deadline } : { id: Number(id), name, budget: budget(), deadline });
        go(`#/x/${id}`);
      }
    } catch (err) {
      error = errorText(/** @type {{ code?: string }} */ (err).code);
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex flex-col gap-4">
  <h1 class="text-2xl font-bold">{t(id ? 'create.editTitle' : 'create.title')}</h1>

  {#if !ready}
    {#if error}
      <div class="alert alert-error alert-soft" role="alert">
        <span>{error}</span>
        <button class="btn btn-sm" onclick={load}>{t('common.retry')}</button>
      </div>
    {:else}
      <div class="flex justify-center p-6"><span class="loading loading-spinner loading-lg" role="status" aria-label={t('common.loading')}></span></div>
    {/if}
  {:else}
    <form class="flex flex-col gap-4" onsubmit={submit}>
      {#if drawn}
        <p class="opacity-80">{t('create.deadlineOnly')}</p>
      {:else}
        <div class="fieldset">
          <label class="fieldset-legend" for="name">{t('create.name')}</label>
          <input id="name" class="input w-full" placeholder={t('create.namePlaceholder')} maxlength="60" required bind:value={name} />
        </div>

        <Segmented legend={t('create.budget')} options={kindOptions} bind:value={kind} />

        {#if kind !== 'any'}
          <div class={['grid items-end gap-2', kind === 'range' ? 'grid-cols-[1fr_1fr_6rem]' : 'grid-cols-[1fr_6rem]']}>
            {#if kind !== 'max'}
              <div class="fieldset min-w-0">
                <label class="fieldset-legend" for="min">{t(kind === 'range' ? 'create.budget.minAmount' : 'create.budget.amount')}</label>
                <input id="min" class="input w-full" inputmode="numeric" pattern="[0-9 ]*" required bind:value={min} />
              </div>
            {/if}
            {#if kind !== 'min'}
              <div class="fieldset min-w-0">
                <label class="fieldset-legend" for="max">{t(kind === 'range' ? 'create.budget.maxAmount' : 'create.budget.amount')}</label>
                <input id="max" class="input w-full" inputmode="numeric" pattern="[0-9 ]*" required bind:value={max} />
              </div>
            {/if}
            <div class="fieldset min-w-0">
              <label class="fieldset-legend" for="currency">{t('create.currency')}</label>
              <select id="currency" class="select w-full" bind:value={currency}>
                {#each currencies as c (c)}<option value={c}>{c}</option>{/each}
              </select>
            </div>
          </div>
        {/if}
      {/if}

      <div class="fieldset">
        <label class="fieldset-legend" for="deadline">{t('create.deadline')}</label>
        <input id="deadline" class="input w-full" type="date" min={minDate} required bind:value={deadline} />
        <p class="label whitespace-normal">{t('create.deadlineHint')}</p>
      </div>

      <div class="flex flex-col gap-2">
        {#if error}<p class="text-sm text-error" role="alert">{error}</p>{/if}
        <button class="btn btn-primary btn-block" type="submit" disabled={busy}>
          {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
          {t(id ? 'common.save' : 'create.submit')}
        </button>
      </div>
    </form>
  {/if}
</div>
