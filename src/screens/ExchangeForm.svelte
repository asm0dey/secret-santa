<script>
  // Create (#/new) and edit (#/x/:id/edit). After the draw only the deadline can change.
  import { call } from '../lib/api.js';
  import { replace, backOrReplace } from '../lib/router.js';
  import { t, lang, errorText } from '../lib/i18n.js';
  import Segmented from '../components/Segmented.svelte';
  import { isValidFutureDate } from '../../tgcloud/lib/dates.js';

  /** @type {{ id?: string }} */
  let { id } = $props();

  const KINDS = /** @type {const} */ (['any', 'max', 'min', 'range']);
  const kindOptions = KINDS.map((k) => ({ value: k, label: t(`create.budget.${k}`) }));
  // The server's rule: a deadline passes at the end of its day, UTC, so today (UTC) is still allowed.
  const today = new Date().toISOString().slice(0, 10);
  const stillOpen = (/** @type {string} */ d) => isValidFutureDate(d, Date.now());
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
  /** @type {{ name?: string, min?: string, max?: string, deadline?: string }} */
  let fieldErrors = $state({});
  let drawn = $state(false);
  let ready = $state(false);
  let error = $state('');
  let loadCode = $state('');
  let busy = $state(false);

  const currencies = $derived(currencyList(currency));

  async function load() {
    loadCode = '';
    try {
      const ex = await call('getExchange', { id: Number(id) });
      if (!ex.isOrganiser) throw { code: 'FORBIDDEN' };
      if (ex.status === 'closed') throw { code: 'CLOSED' };
      name = ex.name;
      kind = ex.budget.kind;
      min = ex.budget.min == null ? '' : String(ex.budget.min);
      max = ex.budget.max == null ? '' : String(ex.budget.max);
      currency = ex.budget.currency ?? defaultCurrency;
      // The server refuses a past deadline: make the organiser pick a new one instead of resubmitting the old.
      if (ex.deadline && stillOpen(ex.deadline)) deadline = ex.deadline;
      else fieldErrors = { deadline: t('create.deadlinePast') };
      drawn = ex.status !== 'open';
      ready = true;
    } catch (e) {
      loadCode = /** @type {{ code?: string }} */ (e).code ?? 'INTERNAL';
    }
  }
  // The screen is remounted for every route, so props are read once at start.
  (function start() {
    if (id) load();
    else ready = true;
  })();

  /** @param {string} s Whole numbers only, spaces allowed as thousands separators; NaN otherwise. */
  const amount = (s) => {
    const n = /^\d+$/.test(s.replace(/\s/g, '')) ? Number(s.replace(/\s/g, '')) : NaN;
    return Number.isSafeInteger(n) ? n : NaN;
  };

  function validate() {
    /** @type {typeof fieldErrors} */
    const e = {};
    if (!drawn) {
      if (!name.trim()) e.name = t('common.required');
      if (kind !== 'any') {
        const lo = amount(min), hi = amount(max);
        if (kind !== 'max' && !(lo > 0)) e.min = t('create.amountInvalid');
        if (kind !== 'min' && !(hi > 0)) e.max = t('create.amountInvalid');
        if (kind === 'range' && !e.min && !e.max && lo > hi) e.max = t('create.rangeInvalid');
      }
    }
    if (!deadline) e.deadline = t('common.required');
    else if (!stillOpen(deadline)) e.deadline = t('create.deadlinePast');
    fieldErrors = e;
    return Object.keys(e).length === 0;
  }

  function budget() {
    if (kind === 'any') return { kind, min: null, max: null, currency: null };
    return { kind, min: kind === 'max' ? null : amount(min), max: kind === 'min' ? null : amount(max), currency };
  }

  /** @param {SubmitEvent} e */
  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    busy = true;
    error = '';
    try {
      if (!id) {
        const res = await call('createExchange', { name: name.trim(), budget: budget(), deadline });
        replace(`#/join/${res.code}`);
      } else {
        await call('updateExchange', drawn ? { id: Number(id), deadline } : { id: Number(id), name: name.trim(), budget: budget(), deadline });
        backOrReplace(`#/x/${id}`);
      }
    } catch (err) {
      error = errorText(/** @type {{ code?: string }} */ (err).code);
    } finally {
      busy = false;
    }
  }
</script>

{#snippet problem(/** @type {string} */ field, /** @type {string | undefined} */ msg)}
  {#if msg}<p id="{field}-error" class="label whitespace-normal text-error" role="alert">{msg}</p>{/if}
{/snippet}

<div class="flex flex-col gap-4">
  <h1 class="text-2xl font-bold">{t(id ? 'create.editTitle' : 'create.title')}</h1>

  {#if !ready}
    {#if loadCode}
      <div class="alert alert-error alert-soft" role="alert">
        <span>{errorText(loadCode)}</span>
        {#if loadCode === 'INTERNAL'}<button class="btn btn-sm" onclick={load}>{t('common.retry')}</button>{/if}
      </div>
    {:else}
      <div class="flex justify-center p-6"><span class="loading loading-spinner loading-lg" role="status" aria-label={t('common.loading')}></span></div>
    {/if}
  {:else}
    <form class="flex flex-col gap-4" novalidate onsubmit={submit}>
      {#if drawn}
        <p class="opacity-80">{t('create.deadlineOnly')}</p>
      {:else}
        <div class="fieldset">
          <label class="fieldset-legend" for="name">{t('create.name')}</label>
          <input
            id="name"
            class="input w-full"
            placeholder={t('create.namePlaceholder')}
            maxlength="60"
            required
            aria-invalid={fieldErrors.name ? 'true' : undefined}
            aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            oninput={() => (fieldErrors.name = undefined)}
            bind:value={name}
          />
          {@render problem('name', fieldErrors.name)}
        </div>

        <Segmented legend={t('create.budget')} options={kindOptions} bind:value={kind} />

        {#if kind !== 'any'}
          <div class={['grid items-end gap-2', kind === 'range' ? 'grid-cols-[1fr_1fr_6rem]' : 'grid-cols-[1fr_6rem]']}>
            {#if kind !== 'max'}
              <div class="fieldset min-w-0">
                <label class="fieldset-legend" for="min">{t(kind === 'range' ? 'create.budget.minAmount' : 'create.budget.amount')}</label>
                <input
                  id="min"
                  class="input w-full"
                  inputmode="numeric"
                  required
                  aria-invalid={fieldErrors.min ? 'true' : undefined}
                  aria-describedby={fieldErrors.min ? 'min-error' : undefined}
                  oninput={() => (fieldErrors.min = undefined)}
                  bind:value={min}
                />
                {@render problem('min', fieldErrors.min)}
              </div>
            {/if}
            {#if kind !== 'min'}
              <div class="fieldset min-w-0">
                <label class="fieldset-legend" for="max">{t(kind === 'range' ? 'create.budget.maxAmount' : 'create.budget.amount')}</label>
                <input
                  id="max"
                  class="input w-full"
                  inputmode="numeric"
                  required
                  aria-invalid={fieldErrors.max ? 'true' : undefined}
                  aria-describedby={fieldErrors.max ? 'max-error' : undefined}
                  oninput={() => (fieldErrors.max = undefined)}
                  bind:value={max}
                />
                {@render problem('max', fieldErrors.max)}
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
        <input
          id="deadline"
          class="input w-full"
          type="date"
          min={today}
          required
          aria-invalid={fieldErrors.deadline ? 'true' : undefined}
          aria-describedby={fieldErrors.deadline ? 'deadline-error' : undefined}
          oninput={() => (fieldErrors.deadline = undefined)}
          bind:value={deadline}
        />
        {@render problem('deadline', fieldErrors.deadline)}
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
