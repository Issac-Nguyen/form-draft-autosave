import { putField, deleteDraft, getDraft } from '../lib/store';
import { evict, purgeExpired } from '../lib/eviction';
import { getSettings } from '../lib/settings';
import type { DraftField } from '../types';

type Msg =
  | { kind: 'SAVE'; origin: string; path: string; field: DraftField }
  | { kind: 'CLEAR'; origin: string; path: string }
  | { kind: 'HAS'; origin: string; path: string };

export async function handleMessage(msg: Msg): Promise<{ ok: boolean } | { has: boolean }> {
  if (msg.kind === 'SAVE') {
    await putField(msg.origin, msg.path, msg.field);
    const s = await getSettings();
    await evict({ countCap: s.countCap, totalSoftBytes: 8_000_000, totalTargetBytes: 6_000_000 });
    return { ok: true };
  }
  if (msg.kind === 'CLEAR') { await deleteDraft(msg.origin, msg.path); return { ok: true }; }
  return { has: (await getDraft(msg.origin, msg.path)) !== null };
}

export async function runMaintenance(): Promise<void> {
  const s = await getSettings();
  await purgeExpired(s.ttlDays * 86_400_000);
}

// --- Chrome wiring (not unit-tested; exercised in e2e) ---
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg: Msg, sender, sendResponse) => {
    handleMessage(msg)
      .then((res) => {
        if ('has' in res && sender.tab?.id != null) {
          chrome.action.setBadgeText({ tabId: sender.tab.id, text: res.has ? '●' : '' });
          chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
        }
        sendResponse(res);
      })
      .catch((err) => {
        console.error('[form-draft-autosave] message handler error:', err);
        sendResponse({ ok: false });
      });
    return true; // async response
  });
  chrome.alarms?.create('maintenance', { periodInMinutes: 1440 });
  chrome.alarms?.onAlarm.addListener((a) => { if (a.name === 'maintenance') void runMaintenance(); });
}
