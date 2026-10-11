<script>
  // The exchange before the draw (mockups 4 and 4a), also shown while the draw is pending (drawn, no assignments yet).
  import { tick } from 'svelte';
  import { call } from '../lib/api.js';
  import { go, backOrReplace } from '../lib/router.js';
  import { t, tn, lang, errorText } from '../lib/i18n.js';
  import { share } from '../lib/tg.js';
  import { formatBudget } from '../../tgcloud/lib/budget.js';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';

  /** @typedef {import('../../tgcloud/lib/types.js').ExchangeView} ExchangeView */
  /** @typedef {{ kind: 'leave' | 'remove' | 'delete' | 'draw', userId?: number, name?: string }} Confirm */

  /** @type {{ view: ExchangeView, reload: () => Promise<void> }} */
  let { view, reload } = $props();

  const AVATAR = ['bg-primary text-primary-content', 'bg-secondary text-secondary-content', 'bg-accent text-accent-content', 'bg-base-300 text-base-content'];
  const day = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' });

  let confirm = $state(/** @type {Confirm | null} */ (null));
  /** Open ⋯ menu: 'ex' or a member's user id. */
  let menu = $state(/** @type {'ex' | number | null} */ (null));
  let busy = $state(false);
  let error = $state('');
  /** @type {HTMLElement | undefined} */
  let heading = $state();
  /** Where focus goes when the confirm dialog is done: the control that started it, or the heading if that is gone. */
  let restoreTo = /** @type {HTMLElement | null} */ (null);

  const open = $derived(view.status === 'open');
  const canDraw = $derived(view.members.length >= 3);

  async function restoreFocus() {
    await tick();
    (restoreTo?.isConnected ? restoreTo : heading)?.focus();
  }

  /** @param {Confirm} c @param {HTMLElement} trigger */
  function ask(c, trigger) {
    restoreTo = trigger;
    menu = null;
    confirm = c;
  }

  /** From a menu item: focus returns to that menu's ⋯ button. @param {MouseEvent} e @param {Confirm} c */
  function askFromMenu(e, c) {
    const trigger = /** @type {HTMLElement | null} */ ((/** @type {HTMLElement} */ (e.currentTarget)).closest('[data-menu]')?.querySelector('[aria-haspopup]') ?? null);
    ask(c, trigger ?? /** @type {HTMLElement} */ (e.currentTarget));
  }

  /** @param {Confirm} c */
  function confirmText(c) {
    if (c.kind === 'leave') return t('exchange.leaveConfirm', { name: view.name });
    if (c.kind === 'delete') return t('exchange.deleteConfirm', { name: view.name });
    if (c.kind === 'remove') return t('exchange.removeConfirm', { name: c.name ?? '' });
    return t('exchange.drawConfirm');
  }

  /** @param {Confirm['kind']} kind */
  const confirmLabel = (kind) =>
    t(kind === 'leave' ? 'exchange.leave' : kind === 'delete' ? 'common.delete' : kind === 'remove' ? 'common.remove' : 'exchange.drawConfirmYes');

  /** @param {Confirm['kind']} kind @param {number} [userId] */
  async function perform(kind, userId) {
    if (busy) return;
    busy = true;
    error = '';
    try {
      if (kind === 'leave' || kind === 'delete') {
        await call(kind === 'leave' ? 'leave' : 'deleteExchange', { id: view.id });
        backOrReplace('#/');
        return;
      }
      await (kind === 'remove' ? call('removeMember', { id: view.id, userId }) : call('draw', { id: view.id }));
      await reload();
    } catch (e) {
      const code = /** @type {{ code?: string }} */ (e).code;
      await reload(); // the screen may be stale: ALREADY_DRAWN, TOO_FEW, a member who already left
      // ALREADY_DRAWN: the reload shows the drawn state, nothing to report. TOO_FEW: the reloaded hint says it, unless the count looks fine.
      if (code !== 'ALREADY_DRAWN' && !(code === 'TOO_FEW' && !canDraw)) error = errorText(code);
    } finally {
      busy = false;
    }
    restoreFocus();
  }

  function approve() {
    const c = confirm;
    confirm = null;
    if (c) perform(c.kind, c.userId);
  }

  function cancel() {
    confirm = null;
    restoreFocus();
  }

  /** @param {HTMLElement} trigger */
  async function toggleMenu(trigger, /** @type {'ex' | number} */ key) {
    menu = menu === key ? null : key;
    if (menu === null) return;
    await tick();
    /** @type {HTMLElement | null | undefined} */ (trigger.closest('[data-menu]')?.querySelector('[role=menuitem]'))?.focus();
  }

  /** @param {MouseEvent} e */
  function outsideMenu(e) {
    if (!(e.target instanceof Element) || !e.target.closest('[data-menu]')) menu = null;
  }

  /** Escape closes the menu and puts focus back on its ⋯ button. @param {KeyboardEvent} e */
  function onKey(e) {
    if (e.key !== 'Escape' || menu === null) return;
    /** @type {HTMLElement | null} */ (document.querySelector('[data-menu] [aria-expanded="true"]'))?.focus();
    menu = null;
  }

  /** Tabbing out of an open menu closes it. @param {FocusEvent} e */
  function menuFocusOut(e) {
    const wrap = /** @type {HTMLElement} */ (e.currentTarget);
    if (!(e.relatedTarget instanceof Node) || !wrap.contains(e.relatedTarget)) menu = null;
  }
</script>

<svelte:document onclick={outsideMenu} onkeydown={onKey} />

{#snippet menuButton(/** @type {'ex' | number} */ key)}
  <button
    class="btn btn-ghost btn-square"
    aria-label={t('common.more')}
    aria-haspopup="menu"
    aria-expanded={menu === key}
    disabled={busy}
    onclick={(e) => toggleMenu(e.currentTarget, key)}
  >⋯</button>
{/snippet}

<div class="flex flex-col gap-4">
  <div class="flex items-start gap-2">
    <h1 class="min-w-0 flex-1 text-2xl font-bold break-words outline-none" tabindex="-1" bind:this={heading}>{view.name}</h1>
    {#if view.isOrganiser && open}
      <div class={['dropdown dropdown-end', menu === 'ex' && 'dropdown-open']} data-menu onfocusout={menuFocusOut}>
        {@render menuButton('ex')}
        <ul class="menu dropdown-content z-10 w-56 rounded-box bg-base-100 p-2 shadow-lg" role="menu">
          <li role="none"><button role="menuitem" class="text-error" onclick={(e) => askFromMenu(e, { kind: 'delete' })}>{t('exchange.delete')}</button></li>
        </ul>
      </div>
    {/if}
  </div>

  {#if open}
    <div class="flex items-center gap-3 rounded-box bg-base-200 p-3">
      <div class="min-w-0 flex-1">
        <p class="text-sm opacity-70">{t('exchange.code')}</p>
        <p class="font-mono text-xl tracking-widest">{view.displayCode}</p>
      </div>
      <button class="btn btn-outline" onclick={() => share(view.inviteLink, t('exchange.shareText', { name: view.name }))}>{t('exchange.share')}</button>
    </div>
  {/if}

  <p class="text-sm opacity-70">
    {tn('exchange.summary', view.members.length, { budget: formatBudget(view.budget, lang), date: view.deadline ? day.format(Date.parse(`${view.deadline}T00:00:00Z`)) : '—' })}
  </p>

  <ul class="list rounded-box bg-base-200">
    {#each view.members as m, i (m.userId)}
      <li class="list-row items-center">
        <div class="avatar avatar-placeholder" aria-hidden="true">
          <div class={['w-9 rounded-full', AVATAR[i % AVATAR.length]]}><span>{[...(m.nickname ?? '?')][0]?.toUpperCase()}</span></div>
        </div>
        <div class="min-w-0">
          <p class="truncate font-medium">{m.nickname}{m.isMe ? ` (${t('common.you')})` : ''}</p>
          {#if m.isOrganiser || m.tag}
            <div class="mt-1 flex flex-wrap gap-1">
              {#if m.isOrganiser}<span class="badge badge-soft badge-sm">{t('common.creator')}</span>{/if}
              {#if m.tag}<span class="badge badge-soft badge-success badge-sm">{t(`exchange.tag.${m.tag}`)}</span>{/if}
            </div>
          {/if}
        </div>
        {#if view.isOrganiser && open && !m.isOrganiser}
          <div class={['dropdown dropdown-end', menu === m.userId && 'dropdown-open']} data-menu onfocusout={menuFocusOut}>
            {@render menuButton(m.userId)}
            <ul class="menu dropdown-content z-10 w-56 rounded-box bg-base-100 p-2 shadow-lg" role="menu">
              <li role="none">
                <button role="menuitem" class="text-error" onclick={(e) => askFromMenu(e, { kind: 'remove', userId: m.userId, name: m.nickname ?? '' })}>
                  {t('exchange.removeMember', { name: m.nickname ?? '' })}
                </button>
              </li>
            </ul>
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  {#if view.isOrganiser && open && !view.me}
    <button class="btn btn-primary btn-block" disabled={busy} onclick={() => go(`#/join/${view.code}`)}>{t('exchange.joinOwn')}</button>
  {/if}

  <div class="flex flex-wrap justify-between gap-2">
    {#if view.me}<button class="btn btn-ghost" disabled={busy} onclick={() => go(`#/x/${view.id}/details`)}>{t('exchange.editMine')}</button>{/if}
    {#if open && view.isOrganiser}
      <button class="btn btn-ghost" disabled={busy} onclick={() => go(`#/x/${view.id}/edit`)}>{t('exchange.editExchange')}</button>
    {:else if open}
      <button class="btn btn-ghost text-error" disabled={busy} onclick={(e) => ask({ kind: 'leave' }, e.currentTarget)}>{t('exchange.leave')}</button>
    {/if}
  </div>

  {#if error}<div class="alert alert-error alert-soft" role="alert"><span>{error}</span></div>{/if}

  {#if view.isOrganiser && open}
    <button class="btn btn-primary btn-block" disabled={!canDraw || busy} aria-describedby={canDraw ? undefined : 'draw-hint'} onclick={(e) => ask({ kind: 'draw' }, e.currentTarget)}>
      {t('exchange.draw')}
    </button>
    {#if !canDraw}<p id="draw-hint" class="text-center text-sm opacity-70">{t('exchange.drawNeedMore')}</p>{/if}
  {:else if view.isOrganiser}
    <p class="text-center text-sm opacity-70">{t('exchange.finishDrawHint')}</p>
    <button class="btn btn-primary btn-block" disabled={busy} onclick={() => perform('draw')}>{t('exchange.finishDraw')}</button>
  {:else}
    <div class="rounded-box bg-base-200 p-3 text-center text-sm opacity-80">
      {open ? t('exchange.waitingFor', { organiser: view.organiserName }) : t('exchange.drawing')}
    </div>
  {/if}
</div>

{#if confirm}
  <ConfirmDialog text={confirmText(confirm)} label={confirmLabel(confirm.kind)} danger={confirm.kind !== 'draw'} onapprove={approve} oncancel={cancel} />
{/if}
