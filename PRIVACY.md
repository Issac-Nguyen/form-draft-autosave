# Privacy Policy — Form Draft Autosave

**Effective date:** 2026-05-16

Form Draft Autosave ("the extension") is a Chrome browser extension that automatically saves text you type into web forms so you can recover it if a tab crashes, you navigate away, a session expires, or a submission fails.

## Data the extension processes

The extension stores the following **locally on your device** using `chrome.storage.local`:

- **Draft text** — the text you type into `<textarea>`, single-line text `<input>`, and rich-text (`contenteditable`) fields on pages you visit. Each draft is keyed by the page's origin + path. Stored fields: a stable field signature, the text value (capped at 100 KB per field), and the field type.
- **Settings** — your configured debounce delay, retention period, maximum number of saved pages, and your domain blocklist.

Retention: drafts older than the configured period (default 7 days) are automatically deleted. A successful form submission deletes that page's draft immediately. At most 50 pages are retained (least-recently-used evicted first). You can clear everything at any time (see "Data deletion").

## Data the extension does NOT process

- It does **not** transmit any data anywhere. There is no server, account, or backend.
- It does **not** capture: `password` fields, `hidden` fields, payment fields (`autocomplete` cc-*), one-time codes / OTP, or any field whose name/id matches sensitive patterns (pin, cvv, cvc, ssn, secret, token, otp, password).
- It does **not** use analytics, telemetry, advertising, or third-party tracking.
- It does **not** read page content other than the text you yourself type into non-sensitive editable fields.

## Permissions

- `storage` — persist drafts and settings locally on your device.
- `alarms` — run a once-daily cleanup that purges expired drafts.
- Host access `<all_urls>` — required because form-draft loss can happen on any site; the extension cannot predict in advance which site you will lose work on. It only observes text you type into non-sensitive editable fields and never transmits it. You can disable capture for specific domains via the options page blocklist.

## Data deletion

- Options page → "Clear all saved drafts".
- Options page → add a domain to the blocklist to stop capturing on it.
- Remove the extension from `chrome://extensions` — Chrome deletes all `chrome.storage` data on uninstall.

## Third-party services

None. The extension runs entirely on your device. HTML in rich-text drafts is sanitized with DOMPurify (bundled at build time; no remote code is loaded).

## Changes to this policy

If the policy changes, the effective date will be updated and changes announced in the Chrome Web Store listing changelog.
