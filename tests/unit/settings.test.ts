import { describe, it, expect, beforeEach } from 'vitest';
import { getSettings, saveSettings, isBlocked, DEFAULTS } from '../../src/lib/settings';

beforeEach(async () => { await chrome.storage.local.clear(); });

describe('settings', () => {
  it('returns defaults when unset', async () => {
    expect(await getSettings()).toEqual(DEFAULTS);
  });
  it('persists and merges partial', async () => {
    await saveSettings({ debounceMs: 3000 });
    const s = await getSettings();
    expect(s.debounceMs).toBe(3000);
    expect(s.ttlDays).toBe(DEFAULTS.ttlDays);
  });
  it('blocklist matches by hostname', async () => {
    await saveSettings({ blocklist: ['bank.example.com'] });
    expect(await isBlocked('https://bank.example.com/login')).toBe(true);
    expect(await isBlocked('https://news.example.com/x')).toBe(false);
  });
  it('blocklist matches subdomains and not lookalikes', async () => {
    await saveSettings({ blocklist: ['bank.example.com'] });
    expect(await isBlocked('https://api.bank.example.com/x')).toBe(true);
    expect(await isBlocked('https://notbank.example.com/x')).toBe(false);
  });
  it('isBlocked returns false on malformed url', async () => {
    await saveSettings({ blocklist: ['bank.example.com'] });
    expect(await isBlocked('not-a-url')).toBe(false);
    expect(await isBlocked('')).toBe(false);
  });
});
