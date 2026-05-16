import { describe, it, expect, beforeEach, vi } from 'vitest';
import { putField, listDrafts } from '../../src/lib/store';
import { evict, purgeExpired } from '../../src/lib/eviction';

beforeEach(async () => { await chrome.storage.local.clear(); });

describe('eviction', () => {
  it('enforces count cap by LRU', async () => {
    let t = 1_000_000;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => (t += 1000));
    for (let i = 0; i < 55; i++) {
      await putField(`https://s${i}.com`, '/p', { sig: 'x', value: 'v', type: 'text' });
    }
    spy.mockRestore();
    await evict({ countCap: 50, totalSoftBytes: 8_000_000, totalTargetBytes: 6_000_000 });
    const left = await listDrafts();
    expect(left.length).toBe(50);
    expect(left.find((d) => d.origin === 'https://s0.com')).toBeUndefined();
  });

  it('purges entries older than TTL', async () => {
    await putField('https://old.com', '/p', { sig: 'x', value: 'v', type: 'text' });
    const all = await chrome.storage.local.get(null);
    const key = Object.keys(all)[0]!;
    (all[key] as any).ts = Date.now() - 8 * 86_400_000;
    await chrome.storage.local.set({ [key]: all[key] });
    await purgeExpired(7 * 86_400_000);
    expect((await listDrafts()).length).toBe(0);
  });

  it('total guard evicts LRU until under target', async () => {
    for (let i = 0; i < 5; i++) {
      await putField(`https://b${i}.com`, '/p', { sig: 'x', value: 'y'.repeat(2000), type: 'text' });
    }
    await evict({ countCap: 999, totalSoftBytes: 6000, totalTargetBytes: 4000 });
    const total = JSON.stringify(await chrome.storage.local.get(null)).length;
    expect(total).toBeLessThanOrEqual(6000);
  });
});
