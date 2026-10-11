<script>
  // Copies text to the clipboard; the label reads "Copied" for a moment.
  import { t } from '../lib/i18n.js';

  /** @type {{ text: string }} */
  let { text } = $props();
  let done = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older WebViews: a throwaway textarea and execCommand.
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    done = true;
    setTimeout(() => (done = false), 1500);
  }
</script>

<button class="btn btn-ghost btn-sm" type="button" onclick={copy} aria-live="polite">{done ? t('common.copied') : t('common.copy')}</button>
