import { fieldSignature } from '../lib/signature';
import { isSensitive } from '../lib/sensitive';
import { captured, readValue, writeValue } from './dom';
import type { DraftField, FieldType } from '../types';

const origin = location.origin;
const path = location.pathname;
let debounceMs = 1500;
let blocked = false;

function fieldType(e: HTMLElement): FieldType {
  const tag = e.tagName.toLowerCase();
  if (tag === 'textarea') return 'textarea';
  if (tag === 'input') return 'text';
  return 'contenteditable';
}

const timers = new WeakMap<HTMLElement, number>();

function onInput(ev: Event): void {
  if (blocked) return;
  const e = ev.target as HTMLElement | null;
  if (!e || !(e instanceof HTMLElement)) return;
  const tag = e.tagName.toLowerCase();
  const editable = tag === 'input' || tag === 'textarea' || e.isContentEditable;
  if (!editable || isSensitive(e)) return;
  const prev = timers.get(e);
  if (prev !== undefined) clearTimeout(prev);
  const t = window.setTimeout(() => {
    const field: DraftField = { sig: fieldSignature(e), value: readValue(e), type: fieldType(e) };
    if (field.value.trim() === '') return;
    chrome.runtime.sendMessage({ kind: 'SAVE', origin, path, field });
  }, debounceMs);
  timers.set(e, t);
}

function onSubmitSuccess(): void {
  chrome.runtime.sendMessage({ kind: 'CLEAR', origin, path });
}

async function init(): Promise<void> {
  const { getSettings, isBlocked } = await import('../lib/settings');
  const s = await getSettings();
  debounceMs = s.debounceMs;
  blocked = await isBlocked(location.href);
  if (blocked) return;
  document.addEventListener('input', onInput, true);
  document.addEventListener('submit', (e) => { if (!e.defaultPrevented) onSubmitSuccess(); }, true);
  chrome.runtime.sendMessage({ kind: 'HAS', origin, path });
  chrome.runtime.onMessage.addListener((msg: { kind: string; fields?: Record<string, { value: string }> }, _s, send) => {
    if (msg.kind === 'RESTORE' && msg.fields) {
      const map = msg.fields;
      let restored = 0;
      for (const e of captured(document)) {
        const f = map[fieldSignature(e)];
        if (f) { writeValue(e, f.value); restored++; }
      }
      const missing = Object.keys(map).length - restored;
      send({ restored, missing });
    }
    return true;
  });
}

void init();
