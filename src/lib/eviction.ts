import { DRAFT_PREFIX, type DraftRecord } from '../types';

export interface EvictOpts {
  countCap: number;
  totalSoftBytes: number;
  totalTargetBytes: number;
}

async function entries(): Promise<Array<{ key: string; rec: DraftRecord }>> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith(DRAFT_PREFIX))
    .map(([key, rec]) => ({ key, rec: rec as DraftRecord }))
    .sort((a, b) => a.rec.ts - b.rec.ts); // oldest first
}

function totalBytes(map: Record<string, unknown>): number {
  return JSON.stringify(map).length;
}

export async function purgeExpired(ttlMs: number): Promise<void> {
  const now = Date.now();
  const dead = (await entries())
    .filter(({ rec }) => now - rec.ts > ttlMs)
    .map(({ key }) => key);
  if (dead.length) await chrome.storage.local.remove(dead);
}

export async function evict(opts: EvictOpts): Promise<void> {
  let list = await entries();
  if (list.length > opts.countCap) {
    const drop = list.slice(0, list.length - opts.countCap).map((e) => e.key);
    await chrome.storage.local.remove(drop);
    list = list.filter((e) => !drop.includes(e.key));
  }
  let all = await chrome.storage.local.get(null);
  if (totalBytes(all) > opts.totalSoftBytes) {
    for (const { key } of list) {
      await chrome.storage.local.remove(key);
      all = await chrome.storage.local.get(null);
      if (totalBytes(all) <= opts.totalTargetBytes) break;
    }
  }
}
