import { DRAFT_PREFIX, draftKey, type DraftField, type DraftRecord } from '../types';

export const PER_FIELD_CAP = 100_000;

export async function getDraft(origin: string, path: string): Promise<DraftRecord | null> {
  const k = draftKey(origin, path);
  const got = await chrome.storage.local.get(k);
  return (got[k] as DraftRecord) ?? null;
}

export async function putField(origin: string, path: string, field: DraftField): Promise<void> {
  const k = draftKey(origin, path);
  const existing = await getDraft(origin, path);
  const rec: DraftRecord = existing ?? { origin, path, fields: {}, ts: 0 };
  let value = field.value;
  let truncated = field.truncated;
  if (value.length > PER_FIELD_CAP) { value = value.slice(0, PER_FIELD_CAP); truncated = true; }
  rec.fields[field.sig] = { ...field, value, ...(truncated ? { truncated: true } : {}) };
  rec.ts = Date.now();
  await chrome.storage.local.set({ [k]: rec });
}

export async function deleteDraft(origin: string, path: string): Promise<void> {
  await chrome.storage.local.remove(draftKey(origin, path));
}

export async function listDrafts(): Promise<DraftRecord[]> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith(DRAFT_PREFIX))
    .map(([, v]) => v as DraftRecord);
}
