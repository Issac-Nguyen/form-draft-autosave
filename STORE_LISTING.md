# Chrome Web Store listing — copy & paste

## Item details

**Name** (max 75 chars)
> Form Draft Autosave — recover lost text

**Summary** (max 132 chars)
> Auto-saves text you type into any web form. Recover it after a crash, accidental back, expired session, or failed submit. 100% local.

**Category**
> Productivity

**Language**
> English

**Support URL** (Item details tab)
> https://github.com/Issac-Nguyen/form-draft-autosave/issues

> Public repo, Issues enabled — reachable HTTPS, accepted by the store. (`mailto:` is rejected; the Notion privacy site is a last-resort fallback only.)

## Description (detailed)

```
Form Draft Autosave quietly saves the text you type into web forms so a crash, an accidental Back button, an expired login, or a failed submit never costs you your work again.

It works on the editors people actually lose work in — long comment boxes, forum posts, support tickets, job applications, CMS editors, and rich-text fields like the ones in Gmail and Notion (contenteditable).

HOW IT WORKS
  • You type. After a short pause the draft is saved locally.
  • You lose the page (crash / back / session timeout / rejected submit).
  • You reopen the page. The toolbar icon shows a dot. Click it, preview the saved text, click Restore.
  • Submit a form successfully and its draft is cleared automatically.

WHAT IT DELIBERATELY IGNORES
  • Password fields, hidden fields, payment / credit-card fields, one-time codes, and anything whose name looks sensitive (cvv, ssn, otp, secret…). These are never captured.

CONTROLS (options page)
  • Debounce delay, retention period (default 7 days), max saved pages (default 50)
  • Per-domain blocklist — turn capture off for banking, health portals, anywhere you want
  • One-click "Clear all saved drafts"

WHY THIS EXISTS
Old draft-savers like Lazarus and Typio are dead or abandoned, and most "form recovery" today ships nothing or ships telemetry. This one runs entirely on your machine. No backend. No account. No analytics. No network requests at all.

PRIVACY
  • 100% local. Drafts live only in chrome.storage on your device, auto-expire, and are deleted on successful submit or on uninstall.
  • Rich-text is sanitized with DOMPurify before it is ever restored — no script, no injected handlers.

PRICING
Free.

Open to feedback — file issues at the repository linked below.
```

## Privacy form — paste-ready text (Chrome Web Store dashboard)

Each block is ≤1000 characters and fits the corresponding form field exactly.

### Single purpose description

```
Form Draft Autosave has one purpose: recover text the user loses from web forms. It observes text typed into non-sensitive editable fields (textarea, text input, contenteditable), debounces it, and stores it locally keyed by page URL. When the user returns to a page with a saved draft, a toolbar popup lets them preview and restore it. A successful submit clears the draft. Everything in the options page (debounce, retention, max-pages, domain blocklist, clear-all) exists to support that single recovery feature. No data leaves the device.
```

### storage justification

```
chrome.storage.local persists the user's form drafts (the text they typed, keyed by page origin+path) and their settings (debounce delay, retention days, max saved pages, domain blocklist) on the user's own device. This is the core mechanism of the extension — without local storage there is nothing to recover after a crash or navigation. Per-field values are capped at 100 KB, drafts auto-expire, and at most 50 pages are retained (least-recently-used evicted). No data is transmitted; storage is never read by any remote party.
```

### alarms justification

```
chrome.alarms schedules a single once-per-day maintenance job that purges drafts older than the user's configured retention period (default 7 days). This enforces the privacy promise that drafts auto-expire and are not retained indefinitely. The alarm does nothing else and contacts no network.
```

### Host permission justification (`<all_urls>`)

```
Form draft recovery requires observing text the user types on whatever site they happen to lose work on. Narrower host patterns cannot work because the extension cannot predict in advance which site the user's tab will crash on or which form submission will fail. The content script reads only text the user types into non-sensitive editable fields (password, hidden, payment, and one-time-code fields are explicitly excluded), stores it locally, and never transmits it. Users can disable capture for any domain via the options-page blocklist. No requests are sent to any host. No telemetry, no remote endpoints.
```

### Are you using remote code?

Select: **No, I am not using Remote code.**

The form still requires text in the justification field. Paste:

```
The extension does not load or execute any remote code. All JavaScript executed by the extension — content script, background service worker, popup, options page, and the DOMPurify sanitizer — is bundled at build time by Vite into the dist/ directory and zipped for upload. The manifest declares no externally hosted scripts, no <script src> pointing at remote URLs, and no remote module imports. The code does not call eval(), new Function(), or fetch() followed by dynamic import on any string. The extension performs no network requests at all — there is no backend, no analytics, no telemetry, and no remote configuration. Every line of code that runs is reviewable in the submitted package.
```

### Data usage disclosures

| Question | Answer |
|---|---|
| Personally identifiable information | **No** — the extension stores whatever text the user types verbatim without inspecting or parsing it; it does not target or extract PII |
| Health information | **No** |
| Financial / payment information | **No** — payment / credit-card (`autocomplete` cc-*) and `cvv`/`cvc` fields are explicitly excluded from capture |
| Authentication information | **No** — `password` fields, one-time codes, and `otp`/`secret`/`token`-named fields are explicitly excluded |
| Personal communications | **No** — text is stored verbatim and never inspected or transmitted |
| Location | **No** |
| Web history | **No** — the page origin+path is used only as a local storage key for the user's own draft; never stored as history or transmitted |
| User activity | **No** — no clickstream, no keystroke logging for analytics; only the user's own draft text is saved so they can restore it |
| Website content | **Yes** — the text the user types into non-sensitive form fields is stored locally on the user's device so the user can restore it after accidental loss; it is never transmitted, sold, or shared; sensitive fields are excluded; drafts auto-expire and are deleted on successful submit or uninstall |

| Certification | Answer |
|---|---|
| Using/transferring user data outside the stated single purpose? | **No** |
| Selling or transferring user data to third parties? | **No** |
| Using user data for purposes unrelated to single purpose? | **No** |
| Using user data to determine creditworthiness or for lending? | **No** |

Tick the certification checkbox: *"I certify that the above disclosures reflect the up-to-date content of my privacy policy."*

## Privacy policy URL

> https://catkin-lion-07e.notion.site/Privacy-Policy-Form-Draft-Autosave-3622fed9431080b9af38dd93501d828e

## Listing assets

Ready to upload (in `store-assets/`):
- `01-options.png` — 1280×800 — real options page (debounce / retention / max-pages / blocklist / Save / Clear all)
- `02-popup-restore.png` — 1280×800 — real popup with a saved draft, Restore + Delete
- `03-demo-form.png` — 1280×800 — demo form with typed text being autosaved

Store icon (128×128): `icons/icon128.png` (branded — document + restore arrow).

Promo tiles (24-bit RGB PNG, no alpha — verified):
- `promo-small-440x280.png` — 440×280 — small promo tile
- `promo-marquee-1400x560.png` — 1400×560 — marquee promo tile (only shown if Google features the listing)

## Submission checklist

- [x] Icons in `icons/` (16/48/128)
- [x] `npm test && npm run typecheck && npm run build` (39 tests, typecheck 0)
- [x] Bundle zip: `form-draft-autosave-1.0.0.zip` at repo root (manifest.json at zip root)
- [x] 3 listing screenshots at 1280×800 in `store-assets/`
- [x] Promo tiles RGB no-alpha in `store-assets/`
- [x] Support URL reachable: https://github.com/Issac-Nguyen/form-draft-autosave/issues
- [x] Publish `PRIVACY.md` to Notion → Privacy policy URL filled above
- [ ] Smoke-test unpacked `dist/` in a fresh Chrome profile (type → reload → Restore; password not saved; submit clears)
- [ ] Upload zip + screenshots at https://chrome.google.com/webstore/devconsole
- [ ] Pay one-time $5 developer registration fee (if first publish under this account)
- [ ] Paste copy from sections above into form fields
- [ ] **Data usage: check "Website content"** (others No) — different from meeting-cost-timer
- [ ] Submit for review (expect in-depth review: `<all_urls>` + website content; turnaround hours to several days)
