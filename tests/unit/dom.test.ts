import { describe, it, expect } from 'vitest';
import { readValue, writeValue, captured } from '../../src/content/dom';

describe('content dom helpers', () => {
  it('reads/writes input value', () => {
    const i = document.createElement('input'); i.type = 'text';
    writeValue(i, 'hello');
    expect(readValue(i)).toBe('hello');
    expect((i as HTMLInputElement).value).toBe('hello');
  });
  it('reads/writes textarea', () => {
    const t = document.createElement('textarea');
    writeValue(t, 'multi\nline');
    expect(readValue(t)).toBe('multi\nline');
  });
  it('reads/writes contenteditable', () => {
    const d = document.createElement('div'); d.setAttribute('contenteditable', 'true');
    writeValue(d, '<b>x</b>');
    expect(d.innerHTML).toContain('x');
    expect(readValue(d)).toContain('x');
  });
  it('sanitizes XSS vectors on contenteditable write (DOMPurify)', () => {
    const d = document.createElement('div'); d.setAttribute('contenteditable', 'true');
    writeValue(d,
      '<script>alert(1)</script>' +
      '<b onclick="x()">ok</b>' +
      '<a href="javascript:alert(1)">link</a>' +
      '<img src="x" onerror="alert(1)">' +
      '<svg><script>alert(1)</script></svg>' +
      '<button formaction="javascript:alert(1)">go</button>' +
      '<template><img src=q onerror=alert(1)></template>');
    const html = d.innerHTML;
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onerror');
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toContain('formaction');
    expect(html).toContain('ok');
  });
  it('keeps benign formatting and text', () => {
    const d = document.createElement('div'); d.setAttribute('contenteditable', 'true');
    writeValue(d, '<p>Hello <b>world</b></p>');
    expect(d.innerHTML).toContain('Hello');
    expect(d.innerHTML).toContain('<b>world</b>');
  });
  it('captured() finds text input, textarea, contenteditable (incl password structurally)', () => {
    document.body.innerHTML =
      '<input type="text" id="a"><input type="password" id="b">' +
      '<textarea id="c"></textarea><div contenteditable id="d"></div><div id="e"></div>';
    const ids = captured(document).map((el) => el.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });
});
