<script>
  // In-page confirmation: a native modal <dialog> (focus trap, Esc, backdrop click). Mount it to open it; unmount to close.
  import { t } from '../lib/i18n.js';

  /** @type {{ text: string, label: string, danger?: boolean, onapprove: () => void, oncancel: () => void }} */
  let { text, label, danger = true, onapprove, oncancel } = $props();
  const textId = $props.id();
</script>

<dialog class="modal modal-bottom" aria-labelledby={textId} {@attach (d) => /** @type {HTMLDialogElement} */ (d).showModal()} onclose={oncancel}>
  <div class="modal-box">
    <p id={textId} class="text-lg">{text}</p>
    <div class="modal-action">
      <form method="dialog"><button class="btn">{t('common.cancel')}</button></form>
      <button class={['btn', danger ? 'btn-error' : 'btn-primary']} onclick={onapprove}>{label}</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button tabindex="-1" aria-label={t('common.close')}>{t('common.close')}</button></form>
</dialog>
