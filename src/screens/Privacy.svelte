<script>
  // Privacy policy: the #/privacy page, and the sheet on the join form.
  import { t, lang } from '../lib/i18n.js';

  // The data controller and their contact for privacy requests.
  const CONTROLLER = 'Pasha Finkelshteyn';
  const CONTACT = 'me+privacy@asm0dey.site';
  const UPDATED = '2026-10-15';

  /** @type {{ titleId?: string }} */
  let { titleId = 'privacy-title' } = $props();
  const who = { controller: CONTROLLER, contact: CONTACT };
</script>

<article class="flex flex-col gap-3">
  <h1 id={titleId} class="text-2xl font-bold">{t('privacy.title')}</h1>
  <p class="text-sm opacity-70">{t('privacy.updated', { date: new Date(UPDATED).toLocaleDateString(lang, { dateStyle: 'long', timeZone: 'UTC' }) })}</p>
  {#each [1, 2, 3, 4, 5, 6, 7] as n (n)}
    <h2 class="mt-2 font-semibold">{t(`privacy.${n}.h`)}</h2>
    <p class="whitespace-pre-line">{t(`privacy.${n}.b`, who)}</p>
  {/each}
</article>
