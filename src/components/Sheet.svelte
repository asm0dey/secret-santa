<script>
  // A bottom sheet: native modal <dialog> (focus trap, Esc, backdrop click). Mount it to open it; unmount to close.
  // Telegram's BackButton closes it first (see lib/overlay.js).
  import { t } from '../lib/i18n.js';
  import { onBackClose } from '../lib/overlay.js';

  /** @type {{ labelId: string, onclose: () => void, children: import('svelte').Snippet }} */
  let { labelId, onclose, children } = $props();

  $effect(() => onBackClose(onclose));
</script>

<dialog class="modal modal-bottom" aria-labelledby={labelId} {@attach (d) => /** @type {HTMLDialogElement} */ (d).showModal()} {onclose}>
  <div class="modal-box">{@render children()}</div>
  <form method="dialog" class="modal-backdrop"><button tabindex="-1" aria-label={t('common.close')}>{t('common.close')}</button></form>
</dialog>
