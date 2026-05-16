export interface Settings {
  debounceMs: number;
  ttlDays: number;
  countCap: number;
  blocklist: string[];
}

export const DEFAULTS: Settings = { debounceMs: 1500, ttlDays: 7, countCap: 50, blocklist: [] };
const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const got = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...(got[KEY] as Partial<Settings> | undefined) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
}

export async function isBlocked(url: string): Promise<boolean> {
  let host: string;
  try { host = new URL(url).hostname; } catch { return false; }
  return (await getSettings()).blocklist.some((b) => host === b || host.endsWith(`.${b}`));
}
