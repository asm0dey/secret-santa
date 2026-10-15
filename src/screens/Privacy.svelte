<script>
  // Privacy policy: the #/privacy page, and the sheet on the join form.
  import { t, lang } from '../lib/i18n.js';
  import { BOT_USERNAME } from '../../tgcloud/lib/config.js';

  const UPDATED = '2026-10-15';

  /** @type {{ titleId?: string }} */
  let { titleId = 'privacy-title' } = $props();
  // Per instance, from .env.local (see vite.config.js).
  const who = { controller: import.meta.env.VITE_PRIVACY_CONTROLLER ?? '', contact: import.meta.env.VITE_PRIVACY_CONTACT ?? '', bot: BOT_USERNAME };
</script>

<article class="flex flex-col gap-3">
  <h1 id={titleId} class="text-2xl font-bold">{t('privacy.title')}</h1>
  <p class="text-sm opacity-70">{t('privacy.updated', { date: new Date(UPDATED).toLocaleDateString(lang, { dateStyle: 'long', timeZone: 'UTC' }) })}</p>
  {#each [1, 2, 3, 4, 5, 6, 7] as n (n)}
    <h2 class="mt-2 font-semibold">{t(`privacy.${n}.h`)}</h2>
    <p class="whitespace-pre-line">{t(`privacy.${n}.b`, who)}</p>
  {/each}
</article>
