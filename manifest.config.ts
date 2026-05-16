import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Form Draft Autosave',
  version: '1.0.0',
  description: 'Autosave and recover text typed into any web form. 100% local.',
  permissions: ['storage', 'alarms'],
  host_permissions: ['<all_urls>'],
  background: { service_worker: 'src/background/service-worker.ts', type: 'module' },
  content_scripts: [{
    matches: ['<all_urls>'],
    js: ['src/content/index.ts'],
    run_at: 'document_idle',
    all_frames: true,
  }],
  action: { default_title: 'Form Draft Autosave', default_popup: 'src/popup/index.html' },
  options_ui: { page: 'src/options/index.html', open_in_tab: true },
  icons: { '16': 'icons/icon16.png', '48': 'icons/icon48.png', '128': 'icons/icon128.png' },
});
