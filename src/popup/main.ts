import { mount } from 'svelte';
import App from './App.svelte';
import { getDraft } from '../lib/store';

async function boot() {
  // chrome.tabs.query/sendMessage need no "tabs" permission: active-tab URL is granted via <all_urls> host permission; do not add "tabs".
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let draft = null;
  let origin = '', path = '';
  if (tab?.url) {
    const u = new URL(tab.url);
    origin = u.origin; path = u.pathname;
    draft = await getDraft(origin, path);
  }
  mount(App, { target: document.getElementById('app')!, props: { draft } });

  window.addEventListener('fda-restore', () => {
    if (tab?.id && draft) chrome.tabs.sendMessage(tab.id, { kind: 'RESTORE', fields: draft.fields });
  });
  window.addEventListener('fda-delete', async () => {
    if (tab?.id) {
      await chrome.runtime.sendMessage({ kind: 'CLEAR', origin, path });
    } else {
      const { deleteDraft } = await import('../lib/store');
      await deleteDraft(origin, path);
    }
    window.close();
  });
}
void boot();
