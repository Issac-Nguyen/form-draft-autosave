import { mount } from 'svelte';
import App from './App.svelte';
import { getSettings, saveSettings } from '../lib/settings';

async function boot() {
  const initial = await getSettings();
  mount(App, { target: document.getElementById('app')!, props: { initial } });
  window.addEventListener('fda-save', async (e: any) => {
    await saveSettings(e.detail);
    alert('Saved');
  });
}
void boot();
