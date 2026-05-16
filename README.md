# Form Draft Autosave

Autosave and recover text you type into any web form. A crash, an accidental Back, an expired session, or a failed submit never costs you your work again. **100% local — no backend, no account, no telemetry, no network requests at all.**

Chrome MV3 extension.

## What it does

- Debounces text you type into `<textarea>`, text `<input>`, and rich-text `contenteditable` fields (Gmail / Notion / CMS editors) and saves it locally.
- You lose the page → reopen it → the toolbar badge shows a dot → click the icon → preview each saved field (by its label) → **Restore**.
- A successful form submit clears that page's draft automatically.
- Captures **multiple fields and multiple forms** on the same page into one per-URL record.

### Never captured

`password`, `hidden`, payment / credit-card (`autocomplete` `cc-*`), one-time codes, and any field whose name/id looks sensitive (`cvv`, `cvc`, `ssn`, `otp`, `secret`, `token`, …). Section-prefixed autocomplete (`billing cc-number`, `shipping one-time-code`) is excluded too.

## Privacy

- Drafts live only in `chrome.storage.local` on your device.
- Auto-expire (default 7 days), evicted least-recently-used past 50 pages, capped 100 KB/field, deleted on successful submit or on uninstall.
- Rich-text is sanitized with **DOMPurify** (bundled at build time, no remote code) before it is ever restored.
- Full policy: [`PRIVACY.md`](./PRIVACY.md).

## Options

`chrome://extensions` → Details → Extension options:

- Debounce delay, retention days, max saved pages
- Per-domain blocklist (turn capture off for banking, health portals, anywhere)
- One-click **Clear all saved drafts**

## Install (development)

```bash
npm install
npm run build          # emits dist/
```

Then `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `dist/`.

> Stable Chrome ignores the `--load-extension` CLI flag — load via the UI.

## Develop

| Command | What |
|---|---|
| `npm test` | Vitest unit + component tests |
| `npm run typecheck` | `svelte-check` + `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) |
| `npm run build` | Production build → `dist/` |
| `npm run e2e` | Playwright, real Chrome, asserts `chrome.storage.local` via the extension service worker |

Stack: Vite + `@crxjs/vite-plugin` + Svelte 5 + TypeScript. Architecture and invariants: [`CLAUDE.md`](./CLAUDE.md). Design + plan under [`docs/superpowers/`](./docs/superpowers/).

A ready-made multi-field test page: `tests/e2e/fixtures/multi-field-demo.html`.

## Report an issue

https://github.com/Issac-Nguyen/form-draft-autosave/issues
