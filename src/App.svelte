<script>
  // Placeholder shell: proves routing, theme switching, i18n and the API/mock path. Screens replace this in Tasks 14-16.
  import { route, go } from './lib/router.js';
  import { t, lang, errorText } from './lib/i18n.js';
  import { THEME_PREFS, applyTheme, loadThemePref, saveThemePref } from './lib/theme.js';
  import { call } from './lib/api.js';

  /** @type {import('./lib/theme.js').ThemePref} */
  let pref = $state('auto');
  /** @type {string} */
  let result = $state('');

  loadThemePref().then((p) => {
    pref = p;
    applyTheme(p);
  });

  /** @param {import('./lib/theme.js').ThemePref} p */
  function choose(p) {
    pref = p;
    applyTheme(p);
    saveThemePref(p);
  }

  async function ping() {
    try {
      const home = await call('home');
      result = `${home.me.firstName}: ${home.exchanges.length}`;
    } catch (e) {
      result = errorText(/** @type {{ code: string }} */ (e).code);
    }
  }
</script>

<main class="mx-auto flex max-w-md flex-col gap-4 p-4 pt-6">
  <h1 class="text-2xl font-bold">{t('app.title')}</h1>

  <section class="flex flex-col gap-2">
    <h2 class="text-sm opacity-70">{t('theme.label')}</h2>
    <div class="join w-full">
      {#each THEME_PREFS as p (p)}
        <button class={['btn join-item flex-1', pref === p && 'btn-primary']} onclick={() => choose(p)}>
          {t(`theme.${p}`)}
        </button>
      {/each}
    </div>
  </section>

  <section class="card bg-base-200 p-4">
    <p class="font-mono text-sm break-all">{$route.name} {JSON.stringify($route.params)} · {lang}</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button class="btn btn-sm" onclick={() => go('#/')}>#/</button>
      <button class="btn btn-sm" onclick={() => go('#/new')}>#/new</button>
      <button class="btn btn-sm" onclick={() => go('#/x/2/gift')}>#/x/2/gift</button>
      <button class="btn btn-sm" onclick={() => go('#/x/2/chat/santa')}>chat</button>
    </div>
  </section>

  <section class="flex items-center gap-3">
    <button class="btn btn-primary" onclick={ping}>{t('home.title')}</button>
    <span class="text-sm">{result}</span>
  </section>
</main>
