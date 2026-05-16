<script lang="ts">
  import type { DraftRecord } from '../types';
  let { draft = null }: { draft: DraftRecord | null } = $props();

  function restore() { window.dispatchEvent(new CustomEvent('fda-restore')); }
  function del() { window.dispatchEvent(new CustomEvent('fda-delete')); }
</script>

<main style="width:320px;font:13px system-ui;padding:12px">
  {#if !draft}
    <p>No draft saved for this page.</p>
  {:else}
    <h1 style="font-size:14px;margin:0 0 8px">Saved draft</h1>
    <ul style="list-style:none;padding:0;margin:0 0 12px;max-height:240px;overflow:auto">
      {#each Object.values(draft.fields) as f}
        <li style="border:1px solid #e5e7eb;border-radius:6px;padding:6px;margin-bottom:6px">
          <small style="color:#6b7280">{f.label || f.type}{f.truncated ? ' (truncated)' : ''}</small>
          <div style="white-space:pre-wrap;word-break:break-word">{f.value.slice(0, 400)}</div>
        </li>
      {/each}
    </ul>
    <button onclick={restore}>Restore</button>
    <button onclick={del} style="margin-left:8px">Delete</button>
  {/if}
</main>
