<script>
  // A row of mutually exclusive choices (radio inputs styled as joined buttons).
  /** @type {{ legend: string, options: { value: string, label: string }[], value: string, hideLegend?: boolean, onselect?: (value: string) => void }} */
  let { legend, options, value = $bindable(), hideLegend = false, onselect } = $props();
  const name = $props.id();
</script>

<fieldset class="fieldset">
  <legend class={['fieldset-legend', hideLegend && 'sr-only']}>{legend}</legend>
  <div class="join w-full">
    {#each options as o (o.value)}
      <input
        class="btn join-item checked:btn-primary flex-1"
        type="radio"
        {name}
        value={o.value}
        aria-label={o.label}
        bind:group={value}
        onchange={() => onselect?.(o.value)}
      />
    {/each}
  </div>
</fieldset>
