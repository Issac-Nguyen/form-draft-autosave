# Store listing copy (paste into Chrome Web Store dev console)

## Name (≤75 chars)

```
Form Draft Autosave — recover lost text
```

## Short description / summary (≤132 chars)

```
Auto-saves text you type into any web form. Recover it after a crash, accidental back, expired session, or failed submit. 100% local.
```

## Detailed description

```
Form Draft Autosave quietly saves the text you type into web forms so a crash, an accidental Back button, an expired login, or a failed submit never costs you your work again.

It works on the editors people actually lose work in — long comment boxes, forum posts, support tickets, job applications, CMS editors, and rich-text fields like the ones in Gmail and Notion (contenteditable).

How it works:

• You type. After a short pause the draft is saved locally.
• You lose the page (crash / back / session timeout / rejected submit).
• You reopen the page. The toolbar icon shows a dot. Click it, preview the saved text, click Restore.
• Submit a form successfully and its draft is cleared automatically.

What it deliberately ignores:

• Password fields, hidden fields, payment / credit-card fields, one-time codes, and anything whose name looks sensitive (cvv, ssn, otp, secret…). These are never captured.

Controls (options page):

• Debounce delay, retention period (default 7 days), max saved pages (default 50)
• Per-domain blocklist — turn capture off for banking, health portals, anywhere you want
• One-click "Clear all saved drafts"

Privacy:

• 100% local. No backend, no account, no telemetry, no tracking, no network requests at all.
• Drafts are stored only in chrome.storage on your device, auto-expire, and are deleted on successful submit or on uninstall.
• Rich-text is sanitized with DOMPurify before it is ever restored — no script, no injected handlers.

For anyone who has ever lost a long reply, a form, or an application to a misclick or a crash.
```

## Privacy tab justifications

### Single purpose description (≤1000 chars)

```
Form Draft Autosave has one purpose: recover text the user loses from web forms. It observes text typed into non-sensitive editable fields (textarea, text input, contenteditable), debounces it, and stores it locally keyed by page URL. When the user returns to a page with a saved draft, a toolbar popup lets them preview and restore it. A successful submit clears the draft. Everything in the options page (debounce, retention, max-pages, domain blocklist, clear-all) exists to support that single recovery feature. No data leaves the device.
```

### `storage` permission justification (≤1000 chars)

```
chrome.storage.local persists the user's form drafts (the text they typed, keyed by page origin+path) and their settings (debounce delay, retention days, max saved pages, domain blocklist) on the user's own device. This is the core mechanism of the extension — without local storage there is nothing to recover after a crash or navigation. No data is transmitted; storage is never read by any remote party.
```

### `alarms` permission justification (≤1000 chars)

```
chrome.alarms schedules a single once-per-day maintenance job that purges drafts older than the user's configured retention period (default 7 days). This enforces the privacy promise that drafts auto-expire and are not retained indefinitely. The alarm does nothing else and contacts no network.
```

### Host permission justification — `<all_urls>` (≤1000 chars)

```
Form draft recovery requires observing text the user types on whatever site they happen to lose work on. Narrower host patterns cannot work because the extension cannot predict in advance which site the user's tab will crash on or which form submission will fail. The content script reads only text the user types into non-sensitive editable fields (password, hidden, payment, and one-time-code fields are explicitly excluded), stores it locally, and never transmits it. Users can disable capture for any domain via the options-page blocklist. No requests are sent to any host.
```

### Remote code

`No, I am not using remote code. All scripts, including DOMPurify, are bundled by Vite at build time. There is no <script src>, no dynamic remote import, no eval of remote strings, and no Wasm fetched at runtime.`

### Data usage — checkboxes

This extension processes user-typed form text, so:

- **Website content** — CHECK. Justification: "The extension stores text the user types into non-sensitive form fields, locally on the user's device, solely to let the user restore it after accidental loss. It is never transmitted, sold, or shared. Sensitive fields (passwords, payment, OTP, hidden) are excluded. Drafts auto-expire and are deleted on successful submit or uninstall."
- **User activity** — CHECK if asked to interpret keystroke capture as activity; use the same justification (text capture is the only 'activity' observed; no clickstream, no analytics).
- All other categories (PII, health, financial, authentication, personal communications, location, web history) — UNchecked. (Note: the extension does not target or parse communications/PII; it stores whatever the user types verbatim without inspection, and excludes credential/payment fields.)

Tick all 3 certify statements (not using data outside stated purpose; not selling/transferring; not for creditworthiness).

### Privacy policy URL

Required (Website content is checked). Publish `PRIVACY.md` as a public HTTPS page (Notion, same as prior extensions) and paste the URL.

## Support URL

`mailto:` is rejected. Use a public GitHub repo Issues page, or a Notion "Report an issue" page with a contact email. Decide and fill before submit.

## Category

Productivity.
