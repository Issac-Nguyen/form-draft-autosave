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
    expect(fieldSignature(a).length).toBeGreaterThan(0);
  });

  it('disambiguates identical siblings by index', () => {
    const form = el('<form action="/x"><input name="q" type="text"><input name="q" type="text"></form>');
    const [i0, i1] = Array.from(form.querySelectorAll('input'));
    expect(fieldSignature(i0)).not.toBe(fieldSignature(i1));
  });
});
