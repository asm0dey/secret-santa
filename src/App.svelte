<script>
  // Route switch. Chat, blocked and appeal screens arrive in Task 16; until then they show Home.
  import { route } from './lib/router.js';
  import { applyTheme, loadThemePref } from './lib/theme.js';
  import { backButton } from './lib/tg.js';
  import Home from './screens/Home.svelte';
  import ExchangeForm from './screens/ExchangeForm.svelte';
  import DetailsForm from './screens/DetailsForm.svelte';
  import Exchange from './screens/Exchange.svelte';

  loadThemePref().then(applyTheme);

  $effect(() => {
    backButton($route.name === 'home' ? null : () => history.back());
  });
</script>

<main class="mx-auto w-full max-w-md p-4 pt-6 pb-10">
  <!-- Keyed by route object: a new hash remounts the screen, so its loader runs again for new params. -->
  {#key $route}
    {#if $route.name === 'new'}
      <ExchangeForm />
    {:else if $route.name === 'edit'}
      <ExchangeForm id={$route.params.id} />
    {:else if $route.name === 'join'}
      <DetailsForm code={$route.params.code} />
    {:else if $route.name === 'details'}
      <DetailsForm id={$route.params.id} />
    {:else if $route.name === 'exchange'}
      <Exchange id={$route.params.id} />
    {:else}
      <Home />
    {/if}
  {/key}
</main>
