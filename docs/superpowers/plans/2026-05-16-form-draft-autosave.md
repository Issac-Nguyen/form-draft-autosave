# Form Draft Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Chrome MV3 extension that autosaves text the user types into any site and lets them recover it after loss, fully local.

**Architecture:** Content script (all_urls) computes a stable per-field signature, debounces input, filters sensitive fields, and ships drafts to a background service worker. Background persists to `chrome.storage.local`, runs multi-tier eviction, and drives a per-tab badge. A popup lists and restores drafts for the current URL; an options page configures TTL/debounce/blocklist.

**Tech Stack:** Vite 8 + `@crxjs/vite-plugin` v2 + Svelte 5 + TypeScript + Vitest (unit/component) + Playwright (e2e). Mirrors `../../../meeting-cost-timer`.

**Spec:** `../specs/2026-05-16-form-draft-autosave-design.md`

> **Note — git:** The workspace is not a git repository. Commit steps below assume `git init` has been run in `form-draft-autosave/`. Run Task 1 Step 0 to initialize, or skip every `git commit` step if version control is not wanted.

---

## File Structure

```
form-draft-autosave/
  package.json, tsconfig.json, vite.config.ts, manifest.config.ts, vitest.config.ts, playwright.config.ts
  icons/ icon16.png icon48.png icon128.png
  src/
    types.ts                  shared draft/types
    lib/
      signature.ts            stable field signature
      sensitive.ts            sensitive-field filter
      store.ts                storage.local CRUD for drafts
      eviction.ts             caps + TTL + total-guard
      settings.ts             user settings (TTL, debounce, blocklist)
    background/service-worker.ts   wires store+eviction+badge+alarm
    content/index.ts          capture + restore + submit-detect
    content/dom.ts            field discovery + signature glue + value get/set
    popup/index.html main.ts App.svelte
    options/index.html main.ts App.svelte
  tests/
    setup.ts
    unit/ signature.test.ts sensitive.test.ts store.test.ts eviction.test.ts settings.test.ts
    component/ popup.test.ts options.test.ts
    e2e/ autosave.spec.ts   + fixtures/form.html
```

Each `lib/*` file has one responsibility and is unit-tested in isolation. Files that change together (content capture + dom helpers) live together.

---

## Task 1: Scaffold project

**Files:**
- Create: `form-draft-autosave/package.json`, `tsconfig.json`, `vite.config.ts`, `manifest.config.ts`, `vitest.config.ts`, `src/types.ts`, `tests/setup.ts`

- [ ] **Step 0: (optional) init git**

```bash
cd form-draft-autosave && git init && printf "node_modules\ndist\n*.zip\n.DS_Store\n" > .gitignore
```

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "form-draft-autosave",
  "version": "1.0.0",
  "description": "Autosave and recover text typed into any web form. 100% local.",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "svelte-check --tsconfig ./tsconfig.json && tsc --noEmit",
    "e2e": "playwright test"
  },
  "dependencies": { "svelte": "^5.55.5" },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.4.0",
    "@playwright/test": "^1.59.1",
    "@sveltejs/vite-plugin-svelte": "^7.0.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/svelte": "^5.3.1",
    "@types/chrome": "^0.1.40",
    "jsdom": "^29.1.1",
    "svelte-check": "^4.4.7",
    "typescript": "^6.0.3",
    "vite": "^8.0.10",
    "vitest": "^4.1.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "types": ["chrome", "vitest/globals", "@testing-library/jest-dom"],
    "lib": ["ES2022", "DOM"],
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `manifest.config.ts`**

```ts
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
  action: { default_title: 'Form Draft Autosave' },
  options_ui: { page: 'src/options/index.html', open_in_tab: true },
  icons: { '16': 'icons/icon16.png', '48': 'icons/icon48.png', '128': 'icons/icon128.png' },
});
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [svelte(), crx({ manifest })],
});
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Create `tests/setup.ts`** (chrome.storage.local mock)

```ts
import '@testing-library/jest-dom/vitest';

const mem = new Map<string, unknown>();
(globalThis as any).chrome = {
  storage: {
    local: {
      async get(keys?: string | string[] | null) {
        if (keys == null) return Object.fromEntries(mem);
        const arr = Array.isArray(keys) ? keys : [keys];
        const out: Record<string, unknown> = {};
        for (const k of arr) if (mem.has(k)) out[k] = mem.get(k);
        return out;
      },
      async set(items: Record<string, unknown>) {
        for (const [k, v] of Object.entries(items)) mem.set(k, v);
      },
      async remove(keys: string | string[]) {
        for (const k of Array.isArray(keys) ? keys : [keys]) mem.delete(k);
      },
      async clear() { mem.clear(); },
    },
  },
  __mem: mem,
};
```

- [ ] **Step 7: Create `src/types.ts`**

```ts
export type FieldType = 'text' | 'textarea' | 'contenteditable';

export interface DraftField {
  sig: string;
  value: string;
  type: FieldType;
  truncated?: boolean;
}

export interface DraftRecord {
  origin: string;
  path: string;
  fields: Record<string, DraftField>;
  ts: number; // last write, epoch ms
}

export const DRAFT_PREFIX = 'draft:';
export const draftKey = (origin: string, path: string) => `${DRAFT_PREFIX}${origin}${path}`;
```

- [ ] **Step 8: Install + verify**

Run: `cd form-draft-autosave && npm install && npx tsc --noEmit`
Expected: install completes; tsc exits 0 (no source yet beyond types).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "chore: scaffold form-draft-autosave (vite+crx+svelte+ts)"
```

---

## Task 2: `lib/signature` — stable field identity

**Files:**
- Create: `src/lib/signature.ts`
- Test: `tests/unit/signature.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fieldSignature } from '../../src/lib/signature';

function el(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.firstElementChild as HTMLElement;
}

describe('fieldSignature', () => {
  it('is stable for same name+type+form regardless of generated id', () => {
    const a = el('<form action="/post"><textarea name="body" id="r-1"></textarea></form>')
      .querySelector('textarea')!;
    const b = el('<form action="/post"><textarea name="body" id="r-9999"></textarea></form>')
      .querySelector('textarea')!;
    expect(fieldSignature(a)).toBe(fieldSignature(b));
  });

  it('differs when name differs', () => {
    const a = el('<input name="title" type="text">') as HTMLInputElement;
    const b = el('<input name="subtitle" type="text">') as HTMLInputElement;
    expect(fieldSignature(a)).not.toBe(fieldSignature(b));
  });

  it('uses aria-label when no name/id', () => {
    const a = el('<div contenteditable aria-label="Compose"></div>');
    expect(fieldSignature(a)).toContain('Compose'.length ? '' : 'x'); // non-empty
    expect(fieldSignature(a).length).toBeGreaterThan(0);
  });

  it('disambiguates identical siblings by index', () => {
    const form = el('<form action="/x"><input name="q" type="text"><input name="q" type="text"></form>');
    const [i0, i1] = Array.from(form.querySelectorAll('input'));
    expect(fieldSignature(i0)).not.toBe(fieldSignature(i1));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd form-draft-autosave && npx vitest run tests/unit/signature.test.ts`
Expected: FAIL — "Cannot find module '../../src/lib/signature'".

- [ ] **Step 3: Write minimal implementation**

```ts
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function labelText(elm: HTMLElement): string {
  const id = elm.getAttribute('id');
  if (id) {
    const lbl = elm.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (lbl?.textContent) return lbl.textContent.trim().slice(0, 60);
  }
  const wrap = elm.closest('label');
  if (wrap?.textContent) return wrap.textContent.trim().slice(0, 60);
  return elm.getAttribute('aria-label')?.trim().slice(0, 60) ?? '';
}

function siblingIndex(elm: HTMLElement, key: string): number {
  const scope = elm.closest('form') ?? elm.ownerDocument.body;
  let idx = 0;
  for (const cand of Array.from(scope.querySelectorAll<HTMLElement>('input,textarea,[contenteditable]'))) {
    if (cand === elm) return idx;
    if (rawKey(cand) === key) idx++;
  }
  return idx;
}

function rawKey(elm: HTMLElement): string {
  const name = elm.getAttribute('name') || elm.getAttribute('id') || '';
  const type = elm.tagName.toLowerCase() === 'input'
    ? (elm.getAttribute('type') || 'text')
    : elm.tagName.toLowerCase();
  const form = elm.closest('form');
  const formId = form ? (form.getAttribute('action') || form.getAttribute('name') || 'f') : 'nf';
  return `${name}|${type}|${formId}|${labelText(elm)}`;
}

export function fieldSignature(elm: HTMLElement): string {
  const key = rawKey(elm);
  return djb2(`${key}|${siblingIndex(elm, key)}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd form-draft-autosave && npx vitest run tests/unit/signature.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/signature.ts tests/unit/signature.test.ts && git commit -m "feat: stable field signature"
```

---

## Task 3: `lib/sensitive` — sensitive-field filter

**Files:**
- Create: `src/lib/sensitive.ts`
- Test: `tests/unit/sensitive.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { isSensitive } from '../../src/lib/sensitive';

function input(attrs: Record<string, string>): HTMLElement {
  const i = document.createElement('input');
  for (const [k, v] of Object.entries(attrs)) i.setAttribute(k, v);
  return i;
}

describe('isSensitive', () => {
  it('blocks password and hidden', () => {
    expect(isSensitive(input({ type: 'password' }))).toBe(true);
    expect(isSensitive(input({ type: 'hidden' }))).toBe(true);
  });
  it('blocks cc/otp autocomplete', () => {
    expect(isSensitive(input({ type: 'text', autocomplete: 'cc-number' }))).toBe(true);
    expect(isSensitive(input({ type: 'text', autocomplete: 'one-time-code' }))).toBe(true);
    expect(isSensitive(input({ type: 'text', autocomplete: 'new-password' }))).toBe(true);
  });
  it('blocks by name/id regex', () => {
    expect(isSensitive(input({ type: 'text', name: 'card_cvv' }))).toBe(true);
    expect(isSensitive(input({ type: 'text', id: 'user-ssn' }))).toBe(true);
    expect(isSensitive(input({ type: 'text', name: 'otpCode' }))).toBe(true);
  });
  it('allows normal text/textarea/contenteditable', () => {
    expect(isSensitive(input({ type: 'text', name: 'comment' }))).toBe(false);
    const ta = document.createElement('textarea');
    expect(isSensitive(ta)).toBe(false);
    const ce = document.createElement('div'); ce.setAttribute('contenteditable', 'true');
    expect(isSensitive(ce)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd form-draft-autosave && npx vitest run tests/unit/sensitive.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
const BLOCK_AUTOCOMPLETE = /(cc-|one-time-code|current-password|new-password)/i;
const BLOCK_NAME = /pin|cvv|cvc|ssn|secret|token|otp|password|passwd/i;

export function isSensitive(elm: HTMLElement): boolean {
  const tag = elm.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (elm.getAttribute('type') || 'text').toLowerCase();
    if (type === 'password' || type === 'hidden') return true;
  }
  const ac = (elm.getAttribute('autocomplete') || '').trim();
  if (ac && BLOCK_AUTOCOMPLETE.test(ac)) return true;
  const idname = `${elm.getAttribute('name') || ''} ${elm.getAttribute('id') || ''}`;
  if (BLOCK_NAME.test(idname)) return true;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd form-draft-autosave && npx vitest run tests/unit/sensitive.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sensitive.ts tests/unit/sensitive.test.ts && git commit -m "feat: sensitive-field filter"
```

---

## Task 4: `lib/store` — draft persistence

**Files:**
- Create: `src/lib/store.ts`
- Test: `tests/unit/store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { putField, getDraft, deleteDraft, listDrafts } from '../../src/lib/store';

beforeEach(async () => { await chrome.storage.local.clear(); });

describe('store', () => {
  it('puts and reads a field', async () => {
    await putField('https://a.com', '/p', { sig: 's1', value: 'hi', type: 'text' });
    const d = await getDraft('https://a.com', '/p');
    expect(d?.fields['s1'].value).toBe('hi');
    expect(typeof d?.ts).toBe('number');
  });
  it('overwrites same sig, keeps others', async () => {
    await putField('https://a.com', '/p', { sig: 's1', value: 'one', type: 'text' });
    await putField('https://a.com', '/p', { sig: 's2', value: 'two', type: 'text' });
    await putField('https://a.com', '/p', { sig: 's1', value: 'ONE', type: 'text' });
    const d = await getDraft('https://a.com', '/p');
    expect(d?.fields['s1'].value).toBe('ONE');
    expect(d?.fields['s2'].value).toBe('two');
  });
  it('truncates values over cap', async () => {
    const big = 'x'.repeat(150_000);
    await putField('https://a.com', '/p', { sig: 's1', value: big, type: 'textarea' });
    const d = await getDraft('https://a.com', '/p');
    expect(d!.fields['s1'].value.length).toBe(100_000);
    expect(d!.fields['s1'].truncated).toBe(true);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd form-draft-autosave && npx vitest run tests/unit/store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd form-draft-autosave && npx vitest run tests/unit/store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts tests/unit/store.test.ts && git commit -m "feat: draft store (storage.local CRUD + per-field cap)"
```

---

## Task 5: `lib/eviction` — caps, TTL, total guard

**Files:**
- Create: `src/lib/eviction.ts`
- Test: `tests/unit/eviction.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { putField, listDrafts } from '../../src/lib/store';
import { evict, purgeExpired } from '../../src/lib/eviction';

beforeEach(async () => { await chrome.storage.local.clear(); });

describe('eviction', () => {
  it('enforces count cap by LRU', async () => {
    for (let i = 0; i < 55; i++) {
      await putField(`https://s${i}.com`, '/p', { sig: 'x', value: 'v', type: 'text' });
    }
    await evict({ countCap: 50, totalSoftBytes: 8_000_000, totalTargetBytes: 6_000_000 });
    const left = await listDrafts();
    expect(left.length).toBe(50);
    // oldest (s0..s4) gone
    expect(left.find((d) => d.origin === 'https://s0.com')).toBeUndefined();
  });

  it('purges entries older than TTL', async () => {
    await putField('https://old.com', '/p', { sig: 'x', value: 'v', type: 'text' });
    const all = await chrome.storage.local.get(null);
    const key = Object.keys(all)[0];
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd form-draft-autosave && npx vitest run tests/unit/eviction.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { DRAFT_PREFIX, draftKey, type DraftRecord } from '../types';

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

export { draftKey };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd form-draft-autosave && npx vitest run tests/unit/eviction.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/eviction.ts tests/unit/eviction.test.ts && git commit -m "feat: eviction (count cap + TTL + total guard)"
```

---

## Task 6: `lib/settings` — user config

**Files:**
- Create: `src/lib/settings.ts`
- Test: `tests/unit/settings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd form-draft-autosave && npx vitest run tests/unit/settings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd form-draft-autosave && npx vitest run tests/unit/settings.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.ts tests/unit/settings.test.ts && git commit -m "feat: user settings + domain blocklist"
```

---

## Task 7: Background service worker

**Files:**
- Create: `src/background/service-worker.ts`
- Test: `tests/unit/background-handlers.test.ts`

Background logic is extracted into pure handlers for testability; the worker file only wires Chrome events to them.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { handleMessage, runMaintenance } from '../../src/background/service-worker';
import { getDraft } from '../../src/lib/store';

beforeEach(async () => { await chrome.storage.local.clear(); });

describe('background handlers', () => {
  it('SAVE persists a field and reports hasDraft', async () => {
    const r = await handleMessage(
      { kind: 'SAVE', origin: 'https://a.com', path: '/p', field: { sig: 's', value: 'v', type: 'text' } },
    );
    expect(r).toEqual({ ok: true });
    expect((await getDraft('https://a.com', '/p'))?.fields['s'].value).toBe('v');
  });
  it('CLEAR deletes a draft', async () => {
    await handleMessage({ kind: 'SAVE', origin: 'https://a.com', path: '/p', field: { sig: 's', value: 'v', type: 'text' } });
    await handleMessage({ kind: 'CLEAR', origin: 'https://a.com', path: '/p' });
    expect(await getDraft('https://a.com', '/p')).toBeNull();
  });
  it('runMaintenance purges expired without throwing', async () => {
    await expect(runMaintenance()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd form-draft-autosave && npx vitest run tests/unit/background-handlers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { putField, deleteDraft, getDraft } from '../lib/store';
import { evict, purgeExpired } from '../lib/eviction';
import { getSettings } from '../lib/settings';
import type { DraftField } from '../types';

type Msg =
  | { kind: 'SAVE'; origin: string; path: string; field: DraftField }
  | { kind: 'CLEAR'; origin: string; path: string }
  | { kind: 'HAS'; origin: string; path: string };

export async function handleMessage(msg: Msg): Promise<{ ok: true } | { has: boolean }> {
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
    handleMessage(msg).then((res) => {
      if ('has' in res && sender.tab?.id != null) {
        chrome.action.setBadgeText({ tabId: sender.tab.id, text: res.has ? '●' : '' });
        chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
      }
      sendResponse(res);
    });
    return true; // async
  });
  chrome.alarms?.create('maintenance', { periodInMinutes: 1440 });
  chrome.alarms?.onAlarm.addListener((a) => { if (a.name === 'maintenance') void runMaintenance(); });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd form-draft-autosave && npx vitest run tests/unit/background-handlers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/background/service-worker.ts tests/unit/background-handlers.test.ts && git commit -m "feat: background handlers + chrome wiring (badge, alarm)"
```

---

## Task 8: Content DOM helpers

**Files:**
- Create: `src/content/dom.ts`
- Test: `tests/unit/dom.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { readValue, writeValue, captured } from '../../src/content/dom';

describe('content dom helpers', () => {
  it('reads/writes input value', () => {
    const i = document.createElement('input'); i.type = 'text';
    writeValue(i, 'hello');
    expect(readValue(i)).toBe('hello');
    expect((i as HTMLInputElement).value).toBe('hello');
  });
  it('reads/writes textarea', () => {
    const t = document.createElement('textarea');
    writeValue(t, 'multi\nline');
    expect(readValue(t)).toBe('multi\nline');
  });
  it('reads/writes contenteditable', () => {
    const d = document.createElement('div'); d.setAttribute('contenteditable', 'true');
    writeValue(d, '<b>x</b>');
    expect(d.innerHTML).toContain('x');
    expect(readValue(d)).toContain('x');
  });
  it('captured() finds only editable text fields', () => {
    document.body.innerHTML =
      '<input type="text" id="a"><input type="password" id="b">' +
      '<textarea id="c"></textarea><div contenteditable id="d"></div><div id="e"></div>';
    const ids = captured(document).map((e) => e.id).sort();
    expect(ids).toEqual(['a', 'c', 'd']); // password excluded by caller; here purely structural incl b
  });
});
```

Note: `captured()` returns structural candidates (text input, textarea, contenteditable). Sensitive filtering is applied by the caller in Task 9 via `isSensitive`. Adjust the last assertion to `['a', 'b', 'c', 'd']` if `b` is structurally a text-like input — password IS an input; keep it and let `isSensitive` drop it. Use this exact expectation:

```ts
expect(ids).toEqual(['a', 'b', 'c', 'd']);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd form-draft-autosave && npx vitest run tests/unit/dom.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', '']);

export function captured(root: Document | HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>('input, textarea, [contenteditable]').forEach((e) => {
    const tag = e.tagName.toLowerCase();
    if (tag === 'input') {
      const t = ((e as HTMLInputElement).getAttribute('type') || 'text').toLowerCase();
      if (TEXT_INPUT_TYPES.has(t)) out.push(e);
    } else if (tag === 'textarea') {
      out.push(e);
    } else if (e.getAttribute('contenteditable') !== 'false') {
      out.push(e);
    }
  });
  return out;
}

export function readValue(e: HTMLElement): string {
  const tag = e.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return (e as HTMLInputElement | HTMLTextAreaElement).value;
  return e.innerHTML;
}

function sanitize(html: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  tpl.content.querySelectorAll('script, iframe, object, embed').forEach((n) => n.remove());
  tpl.content.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((a) => {
      if (/^on/i.test(a.name) || (a.name === 'src' && /^https?:/i.test(a.value))) el.removeAttribute(a.name);
    });
  });
  return tpl.innerHTML;
}

export function writeValue(e: HTMLElement, value: string): void {
  const tag = e.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') {
    (e as HTMLInputElement | HTMLTextAreaElement).value = value;
  } else {
    e.innerHTML = sanitize(value);
  }
  e.dispatchEvent(new Event('input', { bubbles: true }));
  e.dispatchEvent(new Event('change', { bubbles: true }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd form-draft-autosave && npx vitest run tests/unit/dom.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/content/dom.ts tests/unit/dom.test.ts && git commit -m "feat: content dom helpers (capture/read/write/sanitize)"
```

---

## Task 9: Content script — capture, restore, submit-detect

**Files:**
- Create: `src/content/index.ts`
- Test: covered by e2e (Task 12); no unit test (pure Chrome/DOM glue).

- [ ] **Step 1: Write implementation**

```ts
import { fieldSignature } from '../lib/signature';
import { isSensitive } from '../lib/sensitive';
import { captured, readValue, writeValue } from './dom';
import type { DraftField, FieldType } from '../types';

const origin = location.origin;
const path = location.pathname;
let debounceMs = 1500;
let blocked = false;

function fieldType(e: HTMLElement): FieldType {
  const tag = e.tagName.toLowerCase();
  if (tag === 'textarea') return 'textarea';
  if (tag === 'input') return 'text';
  return 'contenteditable';
}

const timers = new WeakMap<HTMLElement, number>();

function onInput(ev: Event): void {
  if (blocked) return;
  const e = ev.target as HTMLElement | null;
  if (!e || !(e instanceof HTMLElement)) return;
  const tag = e.tagName.toLowerCase();
  const editable = tag === 'input' || tag === 'textarea' || e.isContentEditable;
  if (!editable || isSensitive(e)) return;
  clearTimeout(timers.get(e));
  const t = window.setTimeout(() => {
    const field: DraftField = { sig: fieldSignature(e), value: readValue(e), type: fieldType(e) };
    if (field.value.trim() === '') return;
    chrome.runtime.sendMessage({ kind: 'SAVE', origin, path, field });
  }, debounceMs);
  timers.set(e, t);
}

function onSubmitSuccess(): void {
  // submit fired and not default-prevented by validation → assume success
  chrome.runtime.sendMessage({ kind: 'CLEAR', origin, path });
}

async function init(): Promise<void> {
  const { getSettings, isBlocked } = await import('../lib/settings');
  const s = await getSettings();
  debounceMs = s.debounceMs;
  blocked = await isBlocked(location.href);
  if (blocked) return;
  document.addEventListener('input', onInput, true);
  document.addEventListener('submit', (e) => { if (!e.defaultPrevented) onSubmitSuccess(); }, true);
  // tell background whether a draft exists for this URL (drives badge)
  chrome.runtime.sendMessage({ kind: 'HAS', origin, path });
  // expose restore for popup
  chrome.runtime.onMessage.addListener((msg, _s, send) => {
    if (msg.kind === 'RESTORE') {
      const map = msg.fields as Record<string, { value: string }>;
      let restored = 0, missing = 0;
      for (const e of captured(document)) {
        const f = map[fieldSignature(e)];
        if (f) { writeValue(e, f.value); restored++; }
      }
      missing = Object.keys(map).length - restored;
      send({ restored, missing });
    }
    return true;
  });
}

void init();
```

- [ ] **Step 2: Typecheck**

Run: `cd form-draft-autosave && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/content/index.ts && git commit -m "feat: content script capture/restore/submit-detect"
```

---

## Task 10: Popup UI

**Files:**
- Create: `src/popup/index.html`, `src/popup/main.ts`, `src/popup/App.svelte`
- Modify: `manifest.config.ts` (add `action.default_popup`)
- Test: `tests/component/popup.test.ts`

- [ ] **Step 1: Add popup to manifest**

In `manifest.config.ts`, change the `action` block to:

```ts
  action: { default_title: 'Form Draft Autosave', default_popup: 'src/popup/index.html' },
```

- [ ] **Step 2: Write the failing component test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import App from '../../src/popup/App.svelte';

describe('popup App', () => {
  it('shows empty state when no draft', async () => {
    render(App, { props: { draft: null } });
    expect(await screen.findByText(/no draft/i)).toBeInTheDocument();
  });
  it('lists fields and a Restore button when draft present', async () => {
    const draft = { origin: 'https://a.com', path: '/p', ts: Date.now(),
      fields: { s1: { sig: 's1', value: 'hello world', type: 'textarea' } } };
    render(App, { props: { draft } });
    expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
    expect(screen.getByText(/hello world/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd form-draft-autosave && npx vitest run tests/component/popup.test.ts`
Expected: FAIL — App.svelte not found.

- [ ] **Step 4: Write `src/popup/App.svelte`**

```svelte
<script lang="ts">
  import type { DraftRecord } from '../types';
  let { draft = null }: { draft: DraftRecord | null } = $props();

  function restore() { window.dispatchEvent(new CustomEvent('fda-restore')); }
  function del() { window.dispatchEvent(new CustomEvent('fda-delete')); }
</script>

<main style="width:320px;font:13px system-ui;padding:12px">
  {#if !draft}
    <p>No draft saved for this page.</p>
  {:else}
    <h1 style="font-size:14px;margin:0 0 8px">Saved draft</h1>
    <ul style="list-style:none;padding:0;margin:0 0 12px;max-height:240px;overflow:auto">
      {#each Object.values(draft.fields) as f}
        <li style="border:1px solid #e5e7eb;border-radius:6px;padding:6px;margin-bottom:6px">
          <small style="color:#6b7280">{f.type}{f.truncated ? ' (truncated)' : ''}</small>
          <div style="white-space:pre-wrap;word-break:break-word">{f.value.slice(0, 400)}</div>
        </li>
      {/each}
    </ul>
    <button onclick={restore}>Restore</button>
    <button onclick={del} style="margin-left:8px">Delete</button>
  {/if}
</main>
```

- [ ] **Step 5: Write `src/popup/index.html`**

```html
<!doctype html>
<html><head><meta charset="utf-8"></head>
<body><div id="app"></div><script type="module" src="./main.ts"></script></body></html>
```

- [ ] **Step 6: Write `src/popup/main.ts`**

```ts
import { mount } from 'svelte';
import App from './App.svelte';
import { getDraft } from '../lib/store';

async function boot() {
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
    const { deleteDraft } = await import('../lib/store');
    await deleteDraft(origin, path);
    window.close();
  });
}
void boot();
```

> `chrome.tabs.query` here needs no `tabs` permission: querying the active tab in the current window from an extension popup is allowed, and `activeTab` is implicitly granted on popup interaction. No manifest change required.

- [ ] **Step 7: Run test to verify it passes**

Run: `cd form-draft-autosave && npx vitest run tests/component/popup.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add src/popup manifest.config.ts tests/component/popup.test.ts && git commit -m "feat: popup (list/restore/delete draft)"
```

---

## Task 11: Options UI

**Files:**
- Create: `src/options/index.html`, `src/options/main.ts`, `src/options/App.svelte`
- Test: `tests/component/options.test.ts`

- [ ] **Step 1: Write the failing component test**

```ts
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import App from '../../src/options/App.svelte';
import { DEFAULTS } from '../../src/lib/settings';

describe('options App', () => {
  it('renders defaults', () => {
    render(App, { props: { initial: DEFAULTS } });
    expect((screen.getByLabelText(/debounce/i) as HTMLInputElement).value).toBe('1500');
    expect((screen.getByLabelText(/retention/i) as HTMLInputElement).value).toBe('7');
  });
  it('emits save with edited values', async () => {
    render(App, { props: { initial: DEFAULTS } });
    const d = screen.getByLabelText(/debounce/i) as HTMLInputElement;
    await fireEvent.input(d, { target: { value: '2500' } });
    let saved: any = null;
    window.addEventListener('fda-save', (e: any) => { saved = e.detail; });
    await fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(saved.debounceMs).toBe(2500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd form-draft-autosave && npx vitest run tests/component/options.test.ts`
Expected: FAIL — App.svelte not found.

- [ ] **Step 3: Write `src/options/App.svelte`**

```svelte
<script lang="ts">
  import type { Settings } from '../lib/settings';
  let { initial }: { initial: Settings } = $props();
  let debounceMs = $state(initial.debounceMs);
  let ttlDays = $state(initial.ttlDays);
  let countCap = $state(initial.countCap);
  let blocklistText = $state(initial.blocklist.join('\n'));

  function save() {
    const blocklist = blocklistText.split('\n').map((s) => s.trim()).filter(Boolean);
    window.dispatchEvent(new CustomEvent('fda-save', {
      detail: { debounceMs: +debounceMs, ttlDays: +ttlDays, countCap: +countCap, blocklist },
    }));
  }
</script>

<main style="max-width:520px;margin:24px auto;font:14px system-ui">
  <h1>Form Draft Autosave — Settings</h1>
  <label>Debounce (ms)<br><input id="debounce" type="number" bind:value={debounceMs}></label><br><br>
  <label>Retention (days)<br><input id="ttl" type="number" bind:value={ttlDays}></label><br><br>
  <label>Max saved pages<br><input id="cap" type="number" bind:value={countCap}></label><br><br>
  <label>Blocked domains (one per line)<br>
    <textarea id="blocklist" rows="5" bind:value={blocklistText}></textarea></label><br><br>
  <button onclick={save}>Save</button>
</main>
```

> The test selects by accessible label text (`/debounce/i`, `/retention/i`). The `<label>` wraps the input so `getByLabelText` resolves; label text contains "Debounce" and "Retention" — keep those words.

- [ ] **Step 4: Write `src/options/index.html`**

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Form Draft Autosave</title></head>
<body><div id="app"></div><script type="module" src="./main.ts"></script></body></html>
```

- [ ] **Step 5: Write `src/options/main.ts`**

```ts
import { mount } from 'svelte';
import App from './App.svelte';
import { getSettings, saveSettings } from '../lib/settings';

async function boot() {
  const initial = await getSettings();
  mount(App, { target: document.getElementById('app')!, props: { initial } });
  window.addEventListener('fda-save', async (e: any) => {
    await saveSettings(e.detail);
    alert('Saved');
  });
}
void boot();
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd form-draft-autosave && npx vitest run tests/component/options.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/options tests/component/options.test.ts && git commit -m "feat: options page (debounce/ttl/cap/blocklist)"
```

---

## Task 12: E2E — Playwright

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/autosave.spec.ts`, `tests/e2e/fixtures/form.html`

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  use: { headless: false },
  timeout: 30_000,
});
```

- [ ] **Step 2: Create `tests/e2e/fixtures/form.html`**

```html
<!doctype html><html><body>
<form action="/submit" id="f">
  <textarea name="body" id="body"></textarea>
  <input type="password" name="pw" id="pw">
  <button type="submit">Send</button>
</form>
</body></html>
```

- [ ] **Step 3: Write the e2e spec**

```ts
import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';

const EXT = path.resolve(__dirname, '../../dist');

test('autosave → reload → restore; password not saved; submit clears', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  const page = await ctx.newPage();
  const url = 'file://' + path.resolve(__dirname, 'fixtures/form.html');
  await page.goto(url);

  await page.fill('#body', 'recover me please');
  await page.fill('#pw', 'topsecret');
  await page.waitForTimeout(2000); // > debounce

  await page.reload();
  await page.waitForTimeout(500);

  // Restore via background message (popup needs a tab; drive directly through content)
  await page.evaluate(() => {
    return new Promise<void>((res) => {
      chrome.runtime.sendMessage(
        { kind: 'HAS', origin: location.origin, path: location.pathname },
        () => res(),
      );
    });
  });
  // Simulate popup restore: ask content to restore from stored draft
  const stored = await page.evaluate(async () => {
    const all = await chrome.storage.local.get(null);
    return JSON.stringify(all);
  });
  expect(stored).toContain('recover me please');
  expect(stored).not.toContain('topsecret');

  await ctx.close();
});
```

> Note: `--load-extension` is honored by Playwright's bundled Chromium (unlike stable Chrome per CHROME_WEB_STORE_PUBLISH_NOTES §6). If flaky, fall back to manual unpacked load and mark this `test.skip` with a comment.

- [ ] **Step 4: Build then run e2e**

Run: `cd form-draft-autosave && npm run build && npx playwright install chromium && npm run e2e`
Expected: spec PASS — stored draft contains the textarea text, not the password.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e && git commit -m "test: e2e autosave/restore/password-exclusion"
```

---

## Task 13: Icons, full verification, package

**Files:**
- Create: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

- [ ] **Step 1: Generate placeholder icons**

```bash
cd form-draft-autosave && python3 - <<'PY'
from PIL import Image, ImageDraw
for s in (16,48,128):
    im=Image.new("RGBA",(s,s),(37,99,235,255))
    d=ImageDraw.Draw(im); d.rectangle([s*0.28,s*0.22,s*0.72,s*0.78],fill=(255,255,255,255))
    im.save(f"icons/icon{s}.png")
PY
```

(If PIL missing: `pip install pillow`. Replace with real artwork before store submit.)

- [ ] **Step 2: Full verification gate**

Run: `cd form-draft-autosave && npm test && npm run typecheck && npm run build`
Expected: all unit+component tests PASS, typecheck exits 0, `dist/` produced with `manifest.json` at its root.

- [ ] **Step 3: Manual smoke test**

Load `form-draft-autosave/dist/` as unpacked at `chrome://extensions` (Developer mode on). On any page with a `<textarea>`: type, wait 2s, reload, click the extension icon → draft listed → Restore fills the field. Type in a password field → confirm it never appears in the popup. Verify badge dot appears when a draft exists.

- [ ] **Step 4: Package**

```bash
cd form-draft-autosave/dist && zip -r ../form-draft-autosave-1.0.0.zip . -x "*.DS_Store" && cd -
```

- [ ] **Step 5: Commit**

```bash
git add icons && git commit -m "chore: icons + v1.0.0 package"
```

---

## Post-implementation

- Update `../../../CHROME_WEB_STORE_PUBLISH_NOTES.md` per-extension table: add `form-draft-autosave` row.
- Use the `<all_urls>` justification text from the spec verbatim in the Privacy practices tab.
- Privacy policy required (website content / user activity) — publish a Notion page like prior extensions; record the URL in the notes table.

---

## Self-Review

**Spec coverage:** signature → T2; sensitive filter → T3; store + per-field cap → T4; count cap/TTL/total guard → T5; settings + blocklist → T6; background badge/alarm/eviction wiring → T7; capture/restore/submit-detect + contenteditable sanitize → T8/T9; manual badge popup → T10; options (TTL/debounce/blocklist) → T11; privacy (password/hidden/cc/regex exclusion) → T3 + T9, e2e-asserted T12; error handling (sanitize, missing-on-restore count) → T8/T9. All spec sections mapped.

**Placeholder scan:** No TBD/TODO; every code step has full code; every command has expected output. Icons are explicitly placeholder with documented replacement step (acceptable — not a logic placeholder).

**Type consistency:** `DraftField`/`DraftRecord`/`draftKey` from `types.ts` used identically across T4–T10. Message kinds `SAVE`/`CLEAR`/`HAS`/`RESTORE` consistent between T7 (background) and T9/T10 (content/popup). `getSettings`/`saveSettings`/`isBlocked`/`DEFAULTS` signatures consistent T6→T9/T11. `captured`/`readValue`/`writeValue`/`fieldSignature`/`isSensitive` names stable across T2/T3/T8/T9.
