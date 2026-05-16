import { describe, it, expect, beforeEach } from 'vitest';
import { putField, getDraft, deleteDraft, listDrafts } from '../../src/lib/store';

beforeEach(async () => { await chrome.storage.local.clear(); });

describe('store', () => {
  it('puts and reads a field', async () => {
    await putField('https://a.com', '/p', { sig: 's1', value: 'hi', type: 'text' });
    const d = await getDraft('https://a.com', '/p');
    expect(d?.fields['s1']!.value).toBe('hi');
    expect(typeof d?.ts).toBe('number');
  });
  it('overwrites same sig, keeps others', async () => {
    await putField('https://a.com', '/p', { sig: 's1', value: 'one', type: 'text' });
    await putField('https://a.com', '/p', { sig: 's2', value: 'two', type: 'text' });
    await putField('https://a.com', '/p', { sig: 's1', value: 'ONE', type: 'text' });
    const d = await getDraft('https://a.com', '/p');
    expect(d?.fields['s1']!.value).toBe('ONE');
    expect(d?.fields['s2']!.value).toBe('two');
  });
  it('truncates values over cap', async () => {
    const big = 'x'.repeat(150_000);
    await putField('https://a.com', '/p', { sig: 's1', value: big, type: 'textarea' });
    const d = await getDraft('https://a.com', '/p');
    expect(d!.fields['s1']!.value.length).toBe(100_000);
    expect(d!.fields['s1']!.truncated).toBe(true);
  });
  it('clears stale truncated flag when value later fits', async () => {
    await putField('https://a.com', '/p', { sig: 's1', value: 'x'.repeat(150_000), type: 'textarea' });
    expect((await getDraft('https://a.com', '/p'))!.fields['s1']!.truncated).toBe(true);
    await putField('https://a.com', '/p', { sig: 's1', value: 'short', type: 'textarea' });
    const f = (await getDraft('https://a.com', '/p'))!.fields['s1']!;
    expect(f.value).toBe('short');
    expect(f.truncated).toBeUndefined();
  });
  it('deletes and lists', async () => {
    await putField('https://a.com', '/p', { sig: 's1', value: 'hi', type: 'text' });
    await putField('https://b.com', '/q', { sig: 's1', value: 'yo', type: 'text' });
    expect((await listDrafts()).length).toBe(2);
    await deleteDraft('https://a.com', '/p');
    expect((await listDrafts()).length).toBe(1);
    expect(await getDraft('https://a.com', '/p')).toBeNull();
  });
});
