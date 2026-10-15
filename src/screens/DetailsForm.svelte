<script>
  // Join (#/join/:code) and edit my details (#/x/:id/details).
  import { call } from '../lib/api.js';
  import { replace, backOrReplace } from '../lib/router.js';
  import { t, tn, errorText } from '../lib/i18n.js';
  import { requestWriteAccess, wa } from '../lib/tg.js';
  import Segmented from '../components/Segmented.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Privacy from './Privacy.svelte';

  /** @type {{ code?: string, id?: string }} */
  let { code, id } = $props();

  const wishOptions = [
    { value: 'ideas', label: t('join.wishMode.ideas') },
    { value: 'surprise', label: t('join.wishMode.surprise') },
  ];

  let nickname = $state(wa()?.initDataUnsafe?.user?.first_name ?? '');
  let address = $state('');
  let wishMode = $state('ideas');
  let wishlistUrl = $state('');
  let wishes = $state('');
  let consent = $state(false);
  let showPolicy = $state(false);
  /** @type {{ name: string, organiserName: string, memberCount: number } | null} */
  let exchange = $state(null);
  /** @type {{ nickname?: string, address?: string, wishlist?: string, consent?: string }} */
  let fieldErrors = $state({});
  let exchangeId = 0;
  let ready = $state(false);
  let loadCode = $state('');
  let error = $state('');
  let busy = $state(false);

  async function load() {
    loadCode = '';
    try {
      if (code) {
        const ex = await call('findByCode', { code });
        if (ex.isMember) return replace(`#/x/${ex.id}`);
        exchangeId = ex.id;
        if (ex.status !== 'open') throw { code: ex.status === 'closed' ? 'CLOSED' : 'ALREADY_DRAWN' };
        exchange = { name: ex.name, organiserName: ex.organiserName, memberCount: ex.memberCount };
      } else {
        const ex = await call('getExchange', { id: Number(id) });
        if (!ex.me) throw { code: 'FORBIDDEN' };
        nickname = ex.me.nickname ?? '';
        address = ex.me.address ?? '';
        wishMode = ex.me.wishMode ?? 'ideas';
        wishlistUrl = ex.me.wishlistUrl ?? '';
        wishes = ex.me.wishes ?? '';
        exchange = { name: ex.name, organiserName: ex.organiserName, memberCount: ex.members.length };
      }
      ready = true;
    } catch (e) {
      loadCode = /** @type {{ code?: string }} */ (e).code ?? 'INTERNAL';
    }
  }
  load();

  function validate() {
    /** @type {typeof fieldErrors} */
    const e = {};
    if (!nickname.trim()) e.nickname = t('common.required');
    if (!address.trim()) e.address = t('common.required');
    if (code && !consent) e.consent = t('join.consentRequired');
    if (wishMode === 'ideas' && wishlistUrl.trim() && !/^https?:\/\//.test(wishlistUrl.trim())) e.wishlist = t('join.wishlistInvalid');
    fieldErrors = e;
    return Object.keys(e).length === 0;
  }

  /** @param {SubmitEvent} e */
  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    busy = true;
    error = '';
    const ideas = wishMode === 'ideas';
    const details = {
      nickname: nickname.trim(), address: address.trim(), wishMode,
      wishlistUrl: ideas ? wishlistUrl.trim() : '', wishes: ideas ? wishes : '',
    };
    try {
      if (code) {
        const res = await call('join', { code, details, consent });
        await requestWriteAccess();
        replace(`#/x/${res.id}`);
      } else {
        await call('updateMyDetails', { id: Number(id), details });
        backOrReplace(`#/x/${id}`);
      }
    } catch (err) {
      const c = /** @type {{ code?: string }} */ (err).code;
      if (code && c === 'ALREADY_MEMBER') return replace(`#/x/${exchangeId}`);
      error = errorText(c);
    } finally {
      busy = false;
    }
  }
</script>

{#snippet problem(/** @type {string} */ field, /** @type {string | undefined} */ msg)}
  {#if msg}<p id="{field}-error" class="label whitespace-normal text-error" role="alert">{msg}</p>{/if}
{/snippet}

<div class="flex flex-col gap-4">
  <h1 class="text-2xl font-bold">{t(id ? 'join.editTitle' : 'join.title')}</h1>

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
    {#if exchange}
      <div class="rounded-box bg-base-200 p-3">
        <p class="font-semibold">{exchange.name}</p>
        <p class="text-sm opacity-70">{tn('join.summary', exchange.memberCount, { organiser: exchange.organiserName })}</p>
      </div>
    {/if}

    <form class="flex flex-col gap-4" novalidate onsubmit={submit}>
      <div class="fieldset">
        <label class="fieldset-legend" for="nickname">{t('join.nickname')}</label>
        <input
          id="nickname"
          class="input w-full"
          maxlength="40"
          autocomplete="nickname"
          required
          aria-invalid={fieldErrors.nickname ? 'true' : undefined}
          aria-describedby={fieldErrors.nickname ? 'nickname-error' : undefined}
          oninput={() => (fieldErrors.nickname = undefined)}
          bind:value={nickname}
        />
        {@render problem('nickname', fieldErrors.nickname)}
      </div>

      <div class="fieldset">
        <label class="fieldset-legend" for="address">{t('join.address')}</label>
        <textarea
          id="address"
          class="textarea h-28 w-full"
          maxlength="500"
          autocomplete="street-address"
          required
          aria-invalid={fieldErrors.address ? 'true' : undefined}
          aria-describedby={fieldErrors.address ? 'address-error' : undefined}
          oninput={() => (fieldErrors.address = undefined)}
          bind:value={address}
        ></textarea>
        <p class="label whitespace-normal">{t('join.addressHint')}</p>
        {@render problem('address', fieldErrors.address)}
      </div>

      <Segmented legend={t('join.wishMode')} hideLegend options={wishOptions} bind:value={wishMode} />

      {#if wishMode === 'ideas'}
        <div class="fieldset">
          <label class="fieldset-legend" for="wishlist">{t('join.wishlist')} <span class="font-normal opacity-60">({t('common.optional')})</span></label>
          <input
            id="wishlist"
            class="input w-full"
            type="url"
            inputmode="url"
            maxlength="500"
            placeholder="https://"
            aria-invalid={fieldErrors.wishlist ? 'true' : undefined}
            aria-describedby={fieldErrors.wishlist ? 'wishlist-error' : undefined}
            oninput={() => (fieldErrors.wishlist = undefined)}
            bind:value={wishlistUrl}
          />
          {@render problem('wishlist', fieldErrors.wishlist)}
        </div>
        <div class="fieldset">
          <label class="fieldset-legend" for="wishes">{t('join.wishes')} <span class="font-normal opacity-60">({t('common.optional')})</span></label>
          <textarea id="wishes" class="textarea h-28 w-full" maxlength="1000" bind:value={wishes}></textarea>
        </div>
      {/if}

      {#if code}
        <div class="fieldset">
          <label class="flex items-start gap-3">
            <input
              type="checkbox"
              class="checkbox mt-0.5"
              aria-invalid={fieldErrors.consent ? 'true' : undefined}
              aria-describedby={fieldErrors.consent ? 'consent-error' : undefined}
              onchange={() => (fieldErrors.consent = undefined)}
              bind:checked={consent}
            />
            <span class="text-sm">{t('join.consent')} <a href="#/privacy" class="link link-primary" onclick={(e) => { e.preventDefault(); showPolicy = true; }}>{t('join.consentLink')}</a></span>
          </label>
          {@render problem('consent', fieldErrors.consent)}
        </div>
      {/if}

      <div class="flex flex-col gap-2">
        {#if code}<p class="text-sm opacity-70">{t('join.writeAccessHint')}</p>{/if}
        {#if error}<p class="text-sm text-error" role="alert">{error}</p>{/if}
        <button class="btn btn-primary btn-block" type="submit" disabled={busy}>
          {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
          {t(code ? 'join.submit' : 'join.save')}
        </button>
      </div>
    </form>
  {/if}
</div>

{#if showPolicy}
  <Sheet labelId="policy-title" onclose={() => (showPolicy = false)}>
    <Privacy titleId="policy-title" />
    <button class="btn btn-block mt-4" onclick={() => (showPolicy = false)}>{t('common.close')}</button>
  </Sheet>
{/if}
