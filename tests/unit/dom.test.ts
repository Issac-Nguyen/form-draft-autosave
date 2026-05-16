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
  it('sanitizes script/handlers on contenteditable write', () => {
    const d = document.createElement('div'); d.setAttribute('contenteditable', 'true');
    writeValue(d, '<img src="https://evil.test/x.png"><script>alert(1)</script><b onclick="x()">ok</b>');
    expect(d.innerHTML).not.toContain('<script');
    expect(d.innerHTML).not.toContain('onclick');
    expect(d.innerHTML).not.toContain('https://evil.test');
    expect(d.innerHTML).toContain('ok');
  });
  it('captured() finds text input, textarea, contenteditable (incl password structurally)', () => {
    document.body.innerHTML =
      '<input type="text" id="a"><input type="password" id="b">' +
      '<textarea id="c"></textarea><div contenteditable id="d"></div><div id="e"></div>';
    const ids = captured(document).map((el) => el.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });
});
