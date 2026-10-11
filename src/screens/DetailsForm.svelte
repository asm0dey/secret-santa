<script>
  // Join (#/join/:code) and edit my details (#/x/:id/details).
  import { call } from '../lib/api.js';
  import { go } from '../lib/router.js';
  import { t, errorText } from '../lib/i18n.js';
  import { requestWriteAccess, wa } from '../lib/tg.js';
  import Segmented from '../components/Segmented.svelte';

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
  /** @type {{ name: string, organiserName: string, memberCount: number } | null} */
  let exchange = $state(null);
  let ready = $state(false);
  let loadError = $state('');
  let error = $state('');
  let busy = $state(false);

  async function load() {
    loadError = '';
    try {
      if (code) {
        const ex = await call('findByCode', { code });
        if (ex.isMember) return go(`#/x/${ex.id}`);
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
      loadError = errorText(/** @type {{ code?: string }} */ (e).code);
    }
  }
  load();

  /** @param {SubmitEvent} e */
  async function submit(e) {
    e.preventDefault();
    busy = true;
    error = '';
    const details = { nickname, address, wishMode, wishlistUrl, wishes };
    try {
      if (code) {
        const res = await call('join', { code, details });
        await requestWriteAccess();
        go(`#/x/${res.id}`);
      } else {
        await call('updateMyDetails', { id: Number(id), details });
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
  <h1 class="text-2xl font-bold">{t(id ? 'join.editTitle' : 'join.title')}</h1>

  {#if !ready}
    {#if loadError}
      <div class="alert alert-error alert-soft" role="alert">
        <span>{loadError}</span>
        <button class="btn btn-sm" onclick={load}>{t('common.retry')}</button>
      </div>
    {:else}
      <div class="flex justify-center p-6"><span class="loading loading-spinner loading-lg" role="status" aria-label={t('common.loading')}></span></div>
    {/if}
  {:else}
    {#if exchange}
      <div class="rounded-box bg-base-200 p-3">
        <p class="font-semibold">{exchange.name}</p>
        <p class="text-sm opacity-70">{t('join.summary', { organiser: exchange.organiserName, count: exchange.memberCount })}</p>
      </div>
    {/if}

    <form class="flex flex-col gap-4" onsubmit={submit}>
      <div class="fieldset">
        <label class="fieldset-legend" for="nickname">{t('join.nickname')}</label>
        <input id="nickname" class="input w-full" maxlength="40" autocomplete="nickname" required bind:value={nickname} />
        <p class="label whitespace-normal">{t('join.nicknameHint')}</p>
      </div>

      <div class="fieldset">
        <label class="fieldset-legend" for="address">{t('join.address')}</label>
        <textarea id="address" class="textarea h-28 w-full" maxlength="500" autocomplete="street-address" required bind:value={address}></textarea>
        <p class="label whitespace-normal">{t('join.addressHint')}</p>
      </div>

      <Segmented legend={t('join.wishMode')} hideLegend options={wishOptions} bind:value={wishMode} />

      {#if wishMode === 'ideas'}
        <div class="fieldset">
          <label class="fieldset-legend" for="wishlist">{t('join.wishlist')} <span class="font-normal opacity-60">({t('common.optional')})</span></label>
          <input id="wishlist" class="input w-full" type="url" inputmode="url" maxlength="500" placeholder="https://" bind:value={wishlistUrl} />
        </div>
        <div class="fieldset">
          <label class="fieldset-legend" for="wishes">{t('join.wishes')} <span class="font-normal opacity-60">({t('common.optional')})</span></label>
          <textarea id="wishes" class="textarea h-28 w-full" maxlength="1000" bind:value={wishes}></textarea>
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
