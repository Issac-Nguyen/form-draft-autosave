# CLAUDE.md — Form Draft Autosave

## Read first, every session

**Before doing any work in this repo, read this file and the spec/plan under `docs/superpowers/`.** It records the architecture and the non-obvious decisions already settled. Repeating mistakes wastes time and may regress shipped, security-critical behavior.

When you fix a bug, ship a refactor, or settle a non-obvious decision, append a note here (or to a `TODO.md` if one is created) so the next session inherits the lesson.

## What this is

Chrome MV3 extension. A content script on `<all_urls>` debounces text the user types into editable fields (`<textarea>`, text `<input>`, `contenteditable`), filters out sensitive fields, and ships drafts to a background service worker that persists them in `chrome.storage.local` with multi-tier eviction. A toolbar popup lists and restores the draft for the current URL; an options page configures debounce / retention / max-pages / domain blocklist / clear-all.

Local-only. No backend, no account, no telemetry, no network requests at all.

## Codebase layout

```
src/
  types.ts                      # DraftField, DraftRecord, FieldType, DRAFT_PREFIX, draftKey
  lib/
    signature.ts                # fieldSignature() — stable per-field id (djb2 of name|type|form|label + sibling index)
    sensitive.ts                # isSensitive() — SECURITY: excludes password/hidden/cc/otp/secret fields
    store.ts                    # storage.local CRUD, PER_FIELD_CAP=100KB truncation
    eviction.ts                 # evict() count-cap+total-guard, purgeExpired() TTL
    settings.ts                 # Settings, DEFAULTS, getSettings/saveSettings, isBlocked()
  background/service-worker.ts  # pure handleMessage/runMaintenance + guarded chrome wiring (badge, alarm)
  content/
    dom.ts                      # captured(), readValue(), writeValue() — DOMPurify sanitize on contenteditable write
    index.ts                    # capture (debounced) + RESTORE handler + submit-detect glue
  popup/                        # App.svelte + main.ts + index.html — list/preview/Restore/Delete
  options/                      # App.svelte + main.ts + index.html — settings + clear-all
tests/
  unit/                         # signature, sensitive, store, eviction, settings, background-handlers, dom
  component/                    # popup, options (@testing-library/svelte)
  e2e/                          # autosave.spec.ts (Playwright, real Chrome, SW storage assertion)
docs/superpowers/
  specs/2026-05-16-form-draft-autosave-design.md
  plans/2026-05-16-form-draft-autosave.md
```

## Key invariants

- **`lib/sensitive.ts` is security-critical.** `BLOCK_AUTOCOMPLETE` is NOT `^`-anchored — it matches the token anywhere so `billing cc-number` / `shipping one-time-code` are excluded. `BLOCK_NAME` is a substring match (NOT `\b`-bounded) on purpose: `\bcvv\b` would fail to match `card_cvv` and `\botp\b` would miss `otpCode`. Over-blocking a benign field is acceptable; leaking a credential is not. Do not "tighten" these regexes without re-checking `card_cvv` / `otpCode`.
- **Restore sanitizes with DOMPurify.** `content/dom.ts:writeValue()` writes contenteditable via `DOMPurify.sanitize(value, { USE_PROFILES: { html: true } })`. Never set raw `innerHTML`. DOMPurify is a bundled production dependency (Vite bundles it at build — no remote code, Web Store requirement).
- **Pure handlers vs chrome wiring.** `background/service-worker.ts` exports pure `handleMessage`/`runMaintenance` (unit-tested, no `chrome.*`). All `chrome.*` wiring (onMessage, badge, alarms) lives inside `if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage)` so importing the module under vitest does not register listeners. Keep that split.
- **Always `sendResponse`.** The onMessage `.then()` has a `.catch` → `sendResponse({ ok: false })`. Content `onMessage` returns `true` ONLY in the handled RESTORE branch (else `false`) — never leave a port open.
- **No `tabs` permission.** Popup uses `chrome.tabs.query`/`sendMessage`; active-tab URL is granted via `<all_urls>` host permission. Do NOT add `"tabs"`, `"cookies"`, or `"webRequest"` to the manifest.
- **`tsconfig` is `strict` + `noUncheckedIndexedAccess`.** Indexed access is `T | undefined`. Guard or assert in tests; do not relax tsconfig.
- **Vitest needs `resolve.conditions: ['browser']`** in `vitest.config.ts` for Svelte 5 under jsdom (else `mount` resolves to the server build). Already set.
- **Eviction is by `rec.ts` (LRU).** The count-cap test mocks `Date.now()` monotonically; do not rely on Map insertion order.

## Workflow

- `npm test` — Vitest, 39 tests (unit + component). e2e is separate.
- `npm run typecheck` — `svelte-check` + `tsc --noEmit`. Must exit 0.
- `npm run build` — emits `dist/` (manifest.json at root). Reload at `chrome://extensions` afterwards.
- `npm run e2e` — Playwright, real Chrome, asserts `chrome.storage.local` via the extension **service worker** context (not `page.evaluate`).
- Package: `cd dist && zip -r ../form-draft-autosave-1.0.0.zip . -x "*.DS_Store"`.

## Don't

- Don't add `\b` word boundaries to `BLOCK_NAME` or re-anchor `BLOCK_AUTOCOMPLETE` with `^` (re-introduces credential leak; see invariants).
- Don't set `element.innerHTML` from stored draft text without DOMPurify.
- Don't call `chrome.*` from `handleMessage`/`runMaintenance` (breaks unit tests).
- Don't add `tabs`/`cookies`/`webRequest` permissions.
- Don't rely on `--load-extension` in stable Chrome 148 — it is ignored. Load unpacked via the `chrome://extensions` UI, or use Playwright's Chrome-for-Testing which honors the flag.
- Don't relax `noUncheckedIndexedAccess` or weaken a test assertion to make typecheck/tests pass.

## When you finish a task

1. `npm test` and `npm run typecheck` — both must pass.
2. `npm run build`; reload the extension if runtime behavior changed.
3. If the change touched capture/restore/sensitive, run `npm run e2e` to verify the real-Chrome path.
4. If you discovered a new "do not" or settled a non-obvious trade-off, append it here.
5. Commit with a `feat:` / `fix:` / `chore:` / `test:` prefix and a one-line subject.
