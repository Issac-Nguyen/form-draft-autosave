import { mount } from 'svelte';
import App from './App.svelte';
import { getSettings, saveSettings } from '../lib/settings';

async function boot() {
  const initial = await getSettings();
  mount(App, { target: document.getElementById('app')!, props: { initial } });
  window.addEventListener('fda-save', async (e: any) => {
    await saveSettings(e.detail);
    window.dispatchEvent(new CustomEvent('fda-status', { detail: 'Saved' }));
  });
  window.addEventListener('fda-clear-all', async () => {
    const { listDrafts, deleteDraft } = await import('../lib/store');
    for (const d of await listDrafts()) await deleteDraft(d.origin, d.path);
    window.dispatchEvent(new CustomEvent('fda-status', { detail: 'All drafts cleared' }));
  });
}
void boot();
