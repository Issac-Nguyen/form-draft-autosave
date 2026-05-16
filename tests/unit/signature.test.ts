import { describe, it, expect } from 'vitest';
import { fieldSignature, fieldLabel } from '../../src/lib/signature';

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
    expect(fieldSignature(a).length).toBeGreaterThan(0);
  });

  it('disambiguates identical siblings by index', () => {
    const form = el('<form action="/x"><input name="q" type="text"><input name="q" type="text"></form>');
    const inputs = Array.from(form.querySelectorAll('input'));
    const i0 = inputs[0]!;
    const i1 = inputs[1]!;
    expect(fieldSignature(i0)).not.toBe(fieldSignature(i1));
  });

  it('signature is unchanged when element has a placeholder (fieldLabel additions do not leak into rawKey)', () => {
    const withoutPlaceholder = el('<form action="/post"><input name="body" type="text"></form>')
      .querySelector('input')!;
    const withPlaceholder = el('<form action="/post"><input name="body" type="text" placeholder="Enter text"></form>')
      .querySelector('input')!;
    expect(fieldSignature(withoutPlaceholder)).toBe(fieldSignature(withPlaceholder));
  });
});

describe('fieldLabel', () => {
  it('returns label[for=id] text when present', () => {
    const d = document.createElement('div');
    d.innerHTML = '<label for="myfield">Full name</label><input id="myfield" name="name">';
    const input = d.querySelector('input')!;
    expect(fieldLabel(input)).toBe('Full name');
  });

  it('returns wrapping label text when no label[for]', () => {
    const d = document.createElement('div');
    d.innerHTML = '<label>Email address<input name="email"></label>';
    const input = d.querySelector('input')!;
    expect(fieldLabel(input)).toBe('Email address');
  });

  it('returns aria-label when no label element', () => {
    const input = el('<input aria-label="Search query" name="q">');
    expect(fieldLabel(input)).toBe('Search query');
  });

  it('returns placeholder when no label or aria-label', () => {
    const input = el('<input name="q" placeholder="Enter search term">');
    expect(fieldLabel(input)).toBe('Enter search term');
  });

  it('returns name attribute when no label, aria-label, or placeholder', () => {
    const input = el('<input name="username" type="text">');
    expect(fieldLabel(input)).toBe('username');
  });

  it('returns id attribute as last fallback when no name', () => {
    const input = el('<input id="field-123" type="text">');
    expect(fieldLabel(input)).toBe('field-123');
  });

  it('returns empty string when none of the sources exist', () => {
    const input = el('<input type="text">');
    expect(fieldLabel(input)).toBe('');
  });

  it('prefers label[for] over aria-label and placeholder', () => {
    const d = document.createElement('div');
    d.innerHTML = '<label for="f">Preferred label</label><input id="f" aria-label="Not this" placeholder="Nor this">';
    const input = d.querySelector('input')!;
    expect(fieldLabel(input)).toBe('Preferred label');
  });

  it('slices result to 60 characters', () => {
    const longName = 'a'.repeat(80);
    const input = el(`<input name="${longName}">`);
    expect(fieldLabel(input)).toBe('a'.repeat(60));
  });
});
