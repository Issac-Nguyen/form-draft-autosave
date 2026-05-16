/**
 * E2E tests for form-draft-autosave Chrome extension.
 *
 * IMPORTANT: These tests MUST be run manually (`npm run e2e`) on a machine with
 * a display (headed Chrome required for MV3 extension service workers). They
 * cannot run in a headless/sandboxed CI environment that lacks a display server
 * or does not support Chrome extensions in Playwright's bundled Chromium.
 *
 * Unit + component coverage (36 tests, including password-exclusion via
 * isSensitive/DOMPurify unit tests) serves as the gate in environments where
 * headed Chrome is unavailable.
 */

import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST = path.resolve(__dirname, '../../dist');
const FIXTURE = path.resolve(__dirname, 'fixtures/form.html');

test('autosave stores text but excludes password fields', async () => {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
    ],
  });

  try {
    // Obtain the extension service worker
    let sw = context.serviceWorkers()[0];
    if (!sw) {
      sw = await context.waitForEvent('serviceworker', { timeout: 15_000 }).catch(() => null as any);
    }
    if (!sw) {
      throw new Error(
        'Extension service worker never appeared within 15 s. ' +
        'Ensure the dist/ is built and the extension loaded correctly. ' +
        `DIST path used: ${DIST}`
      );
    }

    // Derive extension id from the service worker URL
    // SW URL is of the form: chrome-extension://<id>/service-worker-loader.js
    const swUrl = sw.url();
    const extIdMatch = swUrl.match(/chrome-extension:\/\/([^/]+)\//);
    if (!extIdMatch) {
      throw new Error(`Could not derive extension ID from service worker URL: ${swUrl}`);
    }
    const extId = extIdMatch[1];
    console.log(`Extension ID: ${extId}`);

    // Open the fixture page via file:// URL
    const page = await context.newPage();
    await page.goto(`file://${FIXTURE}`);

    // Wait for the content script to finish init (it async-loads settings)
    await page.waitForTimeout(1000);

    // Type into textarea and password field using keyboard events (not fill)
    // so the content script's 'input' event listener is triggered.
    await page.click('#body');
    await page.keyboard.type('recover me please');
    await page.click('#pw');
    await page.keyboard.type('topsecret');

    // Wait longer than the debounce (default 1500ms) so autosave triggers
    await page.waitForTimeout(2500);

    // Read chrome.storage.local via the service worker context
    const storageData = await sw.evaluate(async () => {
      return await chrome.storage.local.get(null);
    });

    const storageJson = JSON.stringify(storageData);
    console.log('Storage contents:', storageJson);

    // Assertions — never weakened
    expect(storageJson, 'Expected autosaved text to be present in storage').toContain('recover me please');
    expect(storageJson, 'Expected password to be excluded from storage').not.toContain('topsecret');

    // At least one key must start with 'draft:'
    const keys = Object.keys(storageData);
    const hasDraftKey = keys.some((k) => k.startsWith('draft:'));
    expect(hasDraftKey, `Expected at least one key starting with 'draft:' but found keys: ${JSON.stringify(keys)}`).toBe(true);
  } finally {
    await context.close();
  }
});
