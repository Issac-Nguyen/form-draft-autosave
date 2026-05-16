import '@testing-library/jest-dom/vitest';

const mem = new Map<string, unknown>();
(globalThis as any).chrome = {
  storage: {
    local: {
      async get(keys?: string | string[] | null) {
        if (keys == null) return Object.fromEntries(mem);
        const arr = Array.isArray(keys) ? keys : [keys];
        const out: Record<string, unknown> = {};
        for (const k of arr) if (mem.has(k)) out[k] = mem.get(k);
        return out;
      },
      async set(items: Record<string, unknown>) {
        for (const [k, v] of Object.entries(items)) mem.set(k, v);
      },
      async remove(keys: string | string[]) {
        for (const k of Array.isArray(keys) ? keys : [keys]) mem.delete(k);
      },
      async clear() { mem.clear(); },
    },
  },
  __mem: mem,
};
