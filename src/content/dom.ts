import DOMPurify from 'dompurify';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', '']);

export function captured(root: Document | HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>('input, textarea, [contenteditable]').forEach((e) => {
    const tag = e.tagName.toLowerCase();
    if (tag === 'input') {
      const t = ((e as HTMLInputElement).getAttribute('type') || 'text').toLowerCase();
      if (TEXT_INPUT_TYPES.has(t)) out.push(e);
    } else if (tag === 'textarea') {
      out.push(e);
    } else if (e.getAttribute('contenteditable') !== 'false') {
      out.push(e);
    }
  });
  return out;
}

export function readValue(e: HTMLElement): string {
  const tag = e.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return (e as HTMLInputElement | HTMLTextAreaElement).value;
  return e.innerHTML;
}

export function writeValue(e: HTMLElement, value: string): void {
  const tag = e.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') {
    (e as HTMLInputElement | HTMLTextAreaElement).value = value;
  } else {
    e.innerHTML = DOMPurify.sanitize(value, { USE_PROFILES: { html: true } });
  }
  e.dispatchEvent(new Event('input', { bubbles: true }));
  e.dispatchEvent(new Event('change', { bubbles: true }));
}
