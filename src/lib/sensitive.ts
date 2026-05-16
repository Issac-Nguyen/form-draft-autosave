const BLOCK_AUTOCOMPLETE = /(cc-|one-time-code|current-password|new-password)/i;
const BLOCK_NAME = /pin|cvv|cvc|ssn|secret|token|otp|password|passwd/i;

export function isSensitive(elm: HTMLElement): boolean {
  const tag = elm.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (elm.getAttribute('type') || 'text').toLowerCase();
    if (type === 'password' || type === 'hidden') return true;
  }
  const ac = (elm.getAttribute('autocomplete') || '').trim();
  if (ac && BLOCK_AUTOCOMPLETE.test(ac)) return true;
  const idname = `${elm.getAttribute('name') || ''} ${elm.getAttribute('id') || ''}`;
  if (BLOCK_NAME.test(idname)) return true;
  return false;
}
