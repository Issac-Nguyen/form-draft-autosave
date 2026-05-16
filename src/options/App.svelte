<script lang="ts">
  import { untrack } from 'svelte';
  import type { Settings } from '../lib/settings';
  let { initial }: { initial: Settings } = $props();
  const { debounceMs: d0, ttlDays: t0, countCap: c0, blocklist: b0 } = untrack(() => initial);
  let debounceMs = $state(d0);
  let ttlDays = $state(t0);
  let countCap = $state(c0);
  let blocklistText = $state(b0.join('\n'));

  function save() {
    const blocklist = blocklistText.split('\n').map((s) => s.trim()).filter(Boolean);
    window.dispatchEvent(new CustomEvent('fda-save', {
      detail: { debounceMs: +debounceMs, ttlDays: +ttlDays, countCap: +countCap, blocklist },
    }));
  }
</script>

<main style="max-width:520px;margin:24px auto;font:14px system-ui">
  <h1>Form Draft Autosave — Settings</h1>
  <label for="debounce">Debounce (ms)</label><br>
  <input id="debounce" type="number" min="200" max="60000" step="100" bind:value={debounceMs}><br><br>
  <label for="ttl">Retention (days)</label><br>
  <input id="ttl" type="number" min="1" max="365" bind:value={ttlDays}><br><br>
  <label for="cap">Max saved pages</label><br>
  <input id="cap" type="number" min="1" max="500" bind:value={countCap}><br><br>
  <label for="blocklist">Blocked domains (one per line)</label><br>
  <textarea id="blocklist" rows="5" bind:value={blocklistText}></textarea><br><br>
  <button onclick={save}>Save</button>
</main>
