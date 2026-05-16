import { describe, it, expect, beforeEach } from 'vitest';
import { handleMessage, runMaintenance } from '../../src/background/service-worker';
import { getDraft } from '../../src/lib/store';

beforeEach(async () => { await chrome.storage.local.clear(); });

describe('background handlers', () => {
  it('SAVE persists a field and reports ok', async () => {
    const r = await handleMessage(
      { kind: 'SAVE', origin: 'https://a.com', path: '/p', field: { sig: 's', value: 'v', type: 'text' } },
    );
    expect(r).toEqual({ ok: true });
    expect((await getDraft('https://a.com', '/p'))?.fields['s']?.value).toBe('v');
  });
  it('CLEAR deletes a draft', async () => {
    await handleMessage({ kind: 'SAVE', origin: 'https://a.com', path: '/p', field: { sig: 's', value: 'v', type: 'text' } });
    await handleMessage({ kind: 'CLEAR', origin: 'https://a.com', path: '/p' });
    expect(await getDraft('https://a.com', '/p')).toBeNull();
  });
  it('HAS reports presence', async () => {
    expect(await handleMessage({ kind: 'HAS', origin: 'https://a.com', path: '/p' })).toEqual({ has: false });
    await handleMessage({ kind: 'SAVE', origin: 'https://a.com', path: '/p', field: { sig: 's', value: 'v', type: 'text' } });
    expect(await handleMessage({ kind: 'HAS', origin: 'https://a.com', path: '/p' })).toEqual({ has: true });
  });
  it('runMaintenance purges without throwing', async () => {
    await expect(runMaintenance()).resolves.toBeUndefined();
  });
});
