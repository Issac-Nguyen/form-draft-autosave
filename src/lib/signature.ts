function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function labelText(elm: HTMLElement): string {
  const id = elm.getAttribute('id');
  if (id) {
    const lbl = elm.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (lbl?.textContent) return lbl.textContent.trim().slice(0, 60);
  }
  const wrap = elm.closest('label');
  if (wrap?.textContent) return wrap.textContent.trim().slice(0, 60);
  return elm.getAttribute('aria-label')?.trim().slice(0, 60) ?? '';
}

function rawKey(elm: HTMLElement): string {
  const name = elm.getAttribute('name') || elm.getAttribute('id') || '';
  const type = elm.tagName.toLowerCase() === 'input'
    ? (elm.getAttribute('type') || 'text')
    : elm.tagName.toLowerCase();
  const form = elm.closest('form');
  const formId = form ? (form.getAttribute('action') || form.getAttribute('name') || 'f') : 'nf';
  return `${name}|${type}|${formId}|${labelText(elm)}`;
}

function siblingIndex(elm: HTMLElement, key: string): number {
  const scope = elm.closest('form') ?? elm.ownerDocument.body;
  let idx = 0;
  for (const cand of Array.from(scope.querySelectorAll<HTMLElement>('input,textarea,[contenteditable]'))) {
    if (cand === elm) return idx;
    if (rawKey(cand) === key) idx++;
  }
  return idx;
}

export function fieldSignature(elm: HTMLElement): string {
  const key = rawKey(elm);
  return djb2(`${key}|${siblingIndex(elm, key)}`);
}
