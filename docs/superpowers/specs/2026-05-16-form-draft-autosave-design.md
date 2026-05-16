# Form Draft Autosave — Design Spec

Date: 2026-05-16
Status: Approved (design), pending implementation plan

## Problem

Users lose typed text when a tab crashes, they accidentally navigate back, a session expires, or a form submit fails. Old solutions ("Lazarus", "Typio") are dead or abandoned; no maintained, privacy-respecting replacement exists. Gap confirmed in `../../../../ideas.md` (ship-priority #1).

## Goal

Automatically capture text the user types into any site and let them recover it after loss. Recovery, not archival. Local-only, privacy-first.

Non-goals (YAGNI): cloud sync, cross-device, version history, encrypted vault, autofill of saved-not-lost data, form-field analytics.

## Stack

Match `meeting-cost-timer`: Vite + `@crxjs/vite-plugin` v2 + Svelte 5 + TypeScript + Vitest (unit/component) + Playwright (e2e). MV3.

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Host permission | `<all_urls>` auto everywhere | Easiest UX (zero config). Accept in-depth review; strong host justification (precedent: bug-report-screenshot cleared review hotspots). |
| Field coverage | `textarea` + text `input` + `[contenteditable]` rich editors | Rich editors (Gmail/Notion/CMS) are where users lose the most work — primary differentiator. |
| Restore UX | Manual: icon badge + click popup → preview → Restore | No surprise overwrite of existing form data. |
| Storage backend | `chrome.storage.local` (~10MB, no `unlimitedStorage`) | Simple, matches existing extension; sufficient under budget caps. |
| Field identity | Field **signature** hash | Stable across DOM re-render / SPA id churn, unlike CSS selector path. |

## Architecture

Four units, each independently testable:

| Unit | Responsibility | Depends on |
|---|---|---|
| `content/` | Inject on `<all_urls>`. Debounced (1.5s) `input` listener on captured field types. Compute field signature. Filter sensitive fields. Send draft to background. Restore values + dispatch `input`/`change` so reactive frameworks (React/Svelte/Vue) register them. Detect successful submit. | `lib/signature`, `lib/sensitive` |
| `background/` | Service worker. Persist drafts to `storage.local`. Run eviction (caps + TTL + total guard). Maintain per-tab badge. Daily purge alarm. | `lib/store`, `lib/eviction` |
| `popup/` | List drafts for current tab URL. Preview field values. Restore / Delete / Delete-all. | `lib/store` |
| `options/` | Configure TTL, debounce, domain blocklist, clear-all. | `lib/store`, `lib/settings` |

Shared `lib/`: `signature.ts`, `sensitive.ts`, `store.ts`, `eviction.ts`, `settings.ts`.

## Field identity — signature

Signature = stable hash of: field `name` (or `id` fallback) + `type` + nearest `<label>` / `aria-label` text + owning `form` `action` (or `name`) + ordinal index among same-signature siblings. Excludes volatile generated ids. Stored per draft as the field key. A separate human-readable `label` (label/aria-label/placeholder/name/id, display-only, not part of the signature) is stored per field and shown in the popup.

## Data flow

```
User types in field
  → content: debounce 1.5s → compute signature → {origin, path, sig, value, type, ts}
  → background: storage.local["draft:"+origin+path].fields[sig] = value ; ts = now
  → eviction check (count cap / total guard)
  → background: if active tab URL has draft → action.setBadgeText("●")

User reopens page with draft
  → badge lit → user clicks icon
  → popup: read draft for URL → list fields + previews → Restore / Delete

Restore
  → content: locate field by signature → set value/innerHTML → dispatch input + change events
  → mark restored

Successful submit (submit event, not blocked by validation)
  → content → background → delete draft (free a slot)
```

## Storage budget & eviction

`chrome.storage.local` hard quota = 10MB. No `unlimitedStorage` (permission hotspot).

| Tier | Rule |
|---|---|
| Per-draft cap | Field value > 100KB → truncate + set `truncated` flag |
| Per-URL | One draft record per `origin+path`; re-typing overwrites (no accumulation) |
| Count cap | Max 50 URL records; exceeding evicts least-recently-used |
| TTL | 7 days untouched → purged by daily `chrome.alarms` job |
| Total guard | Before each write, estimate total; > 8MB (80%) → evict LRU until < 6MB |
| On submit | Successful submit deletes the draft (frees slot) |

Practical ceiling: 50 × 100KB = 5MB max, typically < 1MB. TTL and caps are user-configurable in options (within safe bounds).

## Privacy (Web Store selling point + rejection defense)

Never captured:
- `input[type=password]`, `input[type=hidden]`
- `autocomplete` in `{cc-*, one-time-code, current-password, new-password}` (matched anywhere in the token list, so `billing cc-number` / `shipping one-time-code` are also excluded)
- Fields whose `name`/`id` match `/pin|cvv|ssn|secret|token|otp/i`

Behavior:
- 100% local. Zero network calls. No analytics, no telemetry.
- Options domain blocklist: user disables capture per domain (banking, health portals).
- Privacy policy states: data stays on device, never transmitted, 7-day default retention, user can clear anytime.

`<all_urls>` justification (dashboard text):
> "Form draft recovery requires observing user-typed text on whatever site the user happens to lose work on. Narrower host patterns cannot predict that site in advance. The extension reads only text the user types into non-sensitive input fields, stores it locally, and never transmits it. Password, hidden, payment, and one-time-code fields are explicitly excluded."

## Manifest (planned)

```
manifest_version: 3
name: "Form Draft Autosave"
permissions: ["storage", "alarms"]
host_permissions: ["<all_urls>"]
content_scripts: [{ matches: ["<all_urls>"], js: ["src/content/index.ts"], run_at: "document_idle", all_frames: true }]
background: { service_worker: "src/background/service-worker.ts", type: "module" }
action: { default_title: "Form Draft Autosave" }
options_ui: { page: "src/options/index.html", open_in_tab: true }
icons: { 16, 48, 128 }
```

No `<all_urls>`-broadening extras; no `tabs`, `cookies`, `webRequest`.

## Error handling

- Storage write failure (quota/other): catch, run eviction, retry once; if still failing, drop oldest and surface a non-blocking badge state — never throw into the page.
- Signature collision (two fields same signature): disambiguate by ordinal index; if still ambiguous, restore by order, flag in popup preview.
- Field gone on restore (DOM changed): skip that field, show "field not found" in popup, keep draft for manual copy.
- contenteditable serialize: store raw innerHTML; on restore, sanitize with DOMPurify (bundled, no remote code) before writing — blocks script/event-handler/`javascript:`/mXSS vectors.

## Testing

- **unit (vitest):** signature stability across simulated DOM re-render; sensitive-field filter matrix; eviction (LRU, TTL, total-guard, per-draft cap); quota estimation.
- **component (@testing-library/svelte):** popup restore/delete/delete-all; contenteditable serialize↔restore round-trip; options blocklist add/remove.
- **e2e (playwright):** type → reload → badge appears → restore values present; submit → draft deleted; password field never persisted; blocklisted domain not captured.

## Open risks

- `<all_urls>` → in-depth Web Store review (slower turnaround). Mitigated by minimal permission set + strong justification + clear privacy policy.
- Rich-editor DOM variance across sites — signature heuristic may miss exotic editors; acceptable for v1 (textarea/input + common contenteditable), iterate post-launch.

## Notes

Workspace is not a git repository — design doc not committed (no `git init` without user request). Append publish lessons to `../../../../CHROME_WEB_STORE_PUBLISH_NOTES.md` at submit time; update its per-extension reference table.
