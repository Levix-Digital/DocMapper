import { vi } from 'vitest';

/** An in-memory browser storage and `window`, for tests of the browser store. */
export function stubBrowserStorage(): Map<string, string> {
  const items = new Map<string, string>();
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, String(value)),
    removeItem: (key: string) => void items.delete(key),
  });
  return items;
}
