<script>
  import { call } from '../lib/api.js';
  import { go } from '../lib/router.js';
  import { t, errorText } from '../lib/i18n.js';
  import { THEME_PREFS, applyTheme, loadThemePref, mirroredPref, saveThemePref } from '../lib/theme.js';
  import { normalizeCode } from '../../tgcloud/lib/code.js';
  import Segmented from '../components/Segmented.svelte';

  /** @typedef {Awaited<ReturnType<import('../../tgcloud/endpoints/home.js').default>>} HomeData */

  const CHIP = /** @type {const} */ ({ waiting: 'badge-outline', see: 'badge-primary', drawn: 'badge-soft', closed: 'badge-ghost' });

  /** @type {HomeData | null} */
  let data = $state(null);
  let loadError = $state('');
  let pref = $state(mirroredPref());
  let code = $state('');
  let codeError = $state('');
  let busy = $state(false);

  const themeOptions = THEME_PREFS.map((p) => ({ value: p, label: t(`theme.${p}`) }));

  loadThemePref().then((p) => (pref = p));

  async function load() {
    loadError = '';
    try {
      const home = await call('home');
      if (home.me.blocks.length) return go('#/blocked');
      data = home;
    } catch (e) {
      loadError = errorText(/** @type {{ code?: string }} */ (e).code);
    }
  }
  load();

  /** @param {string} p */
  function chooseTheme(p) {
    const next = /** @type {import('../lib/theme.js').ThemePref} */ (p);
    applyTheme(next);
    saveThemePref(next);
  }

  /** @param {SubmitEvent} e */
  async function joinByCode(e) {
    e.preventDefault();
    const c = normalizeCode(code);
    codeError = '';
    if (!c) {
      codeError = errorText('NOT_FOUND');
      return;
    }
    busy = true;
    try {
      const ex = await call('findByCode', { code: c });
      go(ex.isMember ? `#/x/${ex.id}` : `#/join/${c}`);
    } catch (err) {
      codeError = errorText(/** @type {{ code?: string }} */ (err).code);
    } finally {
      busy = false;
    }
  }

  /** @param {{ isOrganiser: boolean, memberCount: number }} ex */
  const subtitle = (ex) => [ex.isOrganiser && t('common.creator'), t('home.members', { count: ex.memberCount })].filter(Boolean).join(' · ');
</script>

<div class="flex flex-col gap-5">
  <Segmented legend={t('theme.label')} options={themeOptions} bind:value={pref} onselect={chooseTheme} />

  <h1 class="text-2xl font-bold">{t('home.title')}</h1>

  {#if loadError}
    <div class="alert alert-error alert-soft" role="alert">
      <span>{loadError}</span>
      <button class="btn btn-sm" onclick={load}>{t('common.retry')}</button>
    </div>
  {:else if !data}
    <div class="flex justify-center p-6"><span class="loading loading-spinner loading-lg" role="status" aria-label={t('common.loading')}></span></div>
  {:else if data.exchanges.length === 0}
    <p class="opacity-80">{t('home.empty')}</p>
  {:else}
    <ul class="list rounded-box bg-base-200">
      {#each data.exchanges as ex (ex.id)}
        <li class="list-row relative items-center">
          <div class="list-col-grow min-w-0">
            <a class="block truncate font-semibold after:absolute after:inset-0" href={`#/x/${ex.id}`}>{ex.name}</a>
            <div class="text-sm opacity-70">{subtitle(ex)}</div>
          </div>
          <span class={['badge shrink-0 whitespace-nowrap', CHIP[ex.view]]}>{t(`home.status.${ex.view}`)}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <form class="fieldset" onsubmit={joinByCode}>
    <label class="fieldset-legend" for="code">{t('home.haveCode')}</label>
    <div class="flex gap-2">
      <input
        id="code"
        class="input min-w-0 flex-1 font-mono tracking-widest uppercase"
        placeholder={t('home.codePlaceholder')}
        autocomplete="off"
        autocapitalize="characters"
        maxlength="7"
        aria-invalid={codeError ? 'true' : undefined}
        aria-describedby={codeError ? 'code-error' : undefined}
        bind:value={code}
      />
      <button class="btn" type="submit" disabled={busy || !code.trim()}>{t('home.join')}</button>
    </div>
    {#if codeError}<p id="code-error" class="text-sm text-error" role="alert">{codeError}</p>{/if}
  </form>

  <button class="btn btn-primary btn-block" onclick={() => go('#/new')}>{t('home.create')}</button>
</div>
