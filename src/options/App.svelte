<script lang="ts">
  import type { Settings } from '../lib/settings';
  let { initial }: { initial: Settings } = $props();
  let debounceMs = $state(initial.debounceMs);
  let ttlDays = $state(initial.ttlDays);
  let countCap = $state(initial.countCap);
  let blocklistText = $state(initial.blocklist.join('\n'));

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
  <input id="debounce" type="number" bind:value={debounceMs}><br><br>
  <label for="ttl">Retention (days)</label><br>
  <input id="ttl" type="number" bind:value={ttlDays}><br><br>
  <label for="cap">Max saved pages</label><br>
  <input id="cap" type="number" bind:value={countCap}><br><br>
  <label for="blocklist">Blocked domains (one per line)</label><br>
  <textarea id="blocklist" rows="5" bind:value={blocklistText}></textarea><br><br>
  <button onclick={save}>Save</button>
</main>
