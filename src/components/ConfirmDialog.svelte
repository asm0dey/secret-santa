<script>
  // In-page confirmation. Mount it to open it; unmount to close.
  import { t } from '../lib/i18n.js';
  import Sheet from './Sheet.svelte';

  /** @type {{ text: string, label: string, danger?: boolean, onapprove: () => void, oncancel: () => void }} */
  let { text, label, danger = true, onapprove, oncancel } = $props();
  const textId = $props.id();
</script>

<Sheet labelId={textId} onclose={oncancel}>
  <p id={textId} class="text-lg">{text}</p>
  <div class="modal-action">
    <form method="dialog"><button class="btn">{t('common.cancel')}</button></form>
    <button class={['btn', danger ? 'btn-error' : 'btn-primary']} onclick={onapprove}>{label}</button>
  </div>
</Sheet>
