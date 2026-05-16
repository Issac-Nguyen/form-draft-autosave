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
  it('blocks cc/otp autocomplete with section/shipping/billing prefixes', () => {
    expect(isSensitive(input({ type: 'text', autocomplete: 'billing cc-number' }))).toBe(true);
    expect(isSensitive(input({ type: 'text', autocomplete: 'section-blue shipping cc-expiry' }))).toBe(true);
    expect(isSensitive(input({ type: 'text', autocomplete: 'shipping one-time-code' }))).toBe(true);
  });
  it('allows normal text/textarea/contenteditable', () => {
    expect(isSensitive(input({ type: 'text', name: 'comment' }))).toBe(false);
    const ta = document.createElement('textarea');
    expect(isSensitive(ta)).toBe(false);
    const ce = document.createElement('div'); ce.setAttribute('contenteditable', 'true');
    expect(isSensitive(ce)).toBe(false);
  });
});
