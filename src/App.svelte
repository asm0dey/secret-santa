<script>
  // Route switch.
  import { route } from './lib/router.js';
  import { applyTheme, loadThemePref } from './lib/theme.js';
  import { backButton } from './lib/tg.js';
  import { closeTopOverlay } from './lib/overlay.js';
  import Home from './screens/Home.svelte';
  import ExchangeForm from './screens/ExchangeForm.svelte';
  import DetailsForm from './screens/DetailsForm.svelte';
  import Exchange from './screens/Exchange.svelte';
  import Chat from './screens/Chat.svelte';
  import Blocked from './screens/Blocked.svelte';
  import Appeal from './screens/Appeal.svelte';

  loadThemePref().then(applyTheme);

  // Switching tabs only changes the hash's last part: the same screen stays mounted (no reload flash).
  const screenKey = $derived($route.name + JSON.stringify($route.params, (k, v) => (k === 'tab' ? undefined : v)));

  // Home and Blocked are roots. Elsewhere Back closes an open dialog or sheet first, then navigates.
  $effect(() => {
    backButton($route.name === 'home' || $route.name === 'blocked' ? null : () => closeTopOverlay() || history.back());
  });
</script>

<main class="mx-auto w-full max-w-md p-4 pt-6 pb-10">
  <!-- Keyed by screen and params: a new id/code remounts the screen, so its loader runs again. -->
  {#key screenKey}
    {#if $route.name === 'new'}
      <ExchangeForm />
    {:else if $route.name === 'edit'}
      <ExchangeForm id={$route.params.id} />
    {:else if $route.name === 'join'}
      <DetailsForm code={$route.params.code} />
    {:else if $route.name === 'details'}
      <DetailsForm id={$route.params.id} />
    {:else if $route.name === 'exchange'}
      <Exchange id={$route.params.id} tab={$route.params.tab} />
    {:else if $route.name === 'chat'}
      <Chat id={$route.params.id} side={$route.params.side} />
    {:else if $route.name === 'blocked'}
      <Blocked />
    {:else if $route.name === 'appeal'}
      <Appeal blockId={$route.params.blockId} />
    {:else}
      <Home />
    {/if}
  {/key}
</main>
