<script>
  // Anonymous chat (mockup 6). side 'giftee' = I am the Santa writing to my giftee; 'santa' = I am the giftee writing to my Santa.
  // The API gives the giftee side nothing about the Santa, and this screen adds nothing.
  import { tick } from 'svelte';
  import { call } from '../lib/api.js';
  import { t, errorText } from '../lib/i18n.js';
  import { stamp } from '../lib/format.js';

  /** @type {{ id: string, side: string }} */
  let { id, side } = $props();

  const MAX = 2000;
  const POLL_MS = 10_000;

  /** @typedef {{ title: string | null, messages: { mine: boolean, text: string | null, at: number | null }[] }} Thread */
  let thread = $state.raw(/** @type {Thread | null} */ (null));
  let loadCode = $state('');
  let draft = $state('');
  let busy = $state(false);
  let sendError = $state('');
  let visible = $state(document.visibilityState === 'visible');
  /** @type {HTMLElement | undefined} */
  let end = $state();
  let shown = 0;
  let seq = 0;

  const title = $derived(side === 'santa' ? t('chat.santa') : (thread?.title ?? ''));
  const hint = $derived(side === 'santa' ? t('chat.hintSanta') : t('chat.hintGiftee', { name: thread?.title ?? '' }));
  const canSend = $derived(!busy && draft.trim().length > 0);

  async function load() {
    const n = ++seq; // an older, slower answer must not replace a newer one
    try {
      const th = await call('getThread', { id: Number(id), side });
      if (n !== seq) return;
      thread = th;
      loadCode = '';
      if (th.messages.length > shown) {
        shown = th.messages.length;
        await tick();
        end?.scrollIntoView({ block: 'end' });
      }
    } catch (e) {
      if (n !== seq) return;
      const code = /** @type {{ code?: string }} */ (e).code ?? 'INTERNAL';
      if (!thread || code !== 'INTERNAL') loadCode = code; // a failed background poll is not worth interrupting a conversation for
    }
  }

  // Poll only while the app is visible: stop when hidden, load at once and resume when shown again.
  $effect(() => {
    if (!visible) return;
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  });

  /** @param {SubmitEvent} e */
  async function send(e) {
    e.preventDefault();
    if (!canSend) return;
    busy = true;
    sendError = '';
    try {
      await call('sendMessage', { id: Number(id), side, text: draft.trim() });
      draft = '';
      await load();
    } catch (err) {
      sendError = errorText(/** @type {{ code?: string }} */ (err).code);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:document onvisibilitychange={() => (visible = document.visibilityState === 'visible')} />

{#if loadCode}
  <div class="alert alert-error alert-soft" role="alert"><span>{errorText(loadCode === 'NOT_FOUND' ? 'EXCHANGE_GONE' : loadCode)}</span></div>
{:else if !thread}
  <div class="flex justify-center p-6"><span class="loading loading-spinner loading-lg" role="status" aria-label={t('common.loading')}></span></div>
{:else}
  <div class="flex min-h-[calc(100dvh-5rem)] flex-col gap-3">
    <div class="text-center">
      <h1 class="text-xl font-bold break-words">{title}</h1>
      <p class="text-sm opacity-70">{hint}</p>
    </div>

    <div class="flex flex-1 flex-col gap-1" aria-live="polite">
      {#each thread.messages as m, i (`${m.at}-${i}`)}
        <div class={['chat', m.mine ? 'chat-end' : 'chat-start']}>
          <div class={['chat-bubble break-words whitespace-pre-wrap', m.mine && 'chat-bubble-primary']}>{m.text ?? ''}</div>
          {#if m.at}<div class="chat-footer text-xs opacity-70">{stamp(m.at)}</div>{/if}
        </div>
      {:else}
        <p class="m-auto max-w-xs text-center text-sm opacity-70">{t('chat.empty')}</p>
      {/each}
      <div bind:this={end}></div>
    </div>

    <form class="sticky bottom-0 flex flex-col gap-1 bg-base-100 pt-2 pb-1" onsubmit={send}>
      {#if sendError}<p class="text-sm text-error" role="alert">{sendError}</p>{/if}
      {#if draft.length >= MAX - 200}<p class="text-right text-xs opacity-70">{draft.length}/{MAX}</p>{/if}
      <div class="flex items-end gap-2">
        <textarea
          class="textarea max-h-32 min-h-11 flex-1 resize-none [field-sizing:content]"
          rows="1"
          maxlength={MAX}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.placeholder')}
          bind:value={draft}
        ></textarea>
        <button class="btn btn-primary" type="submit" disabled={!canSend}>
          {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
          {t('common.send')}
        </button>
      </div>
    </form>
  </div>
{/if}
