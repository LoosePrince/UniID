/**
 * 存储抽象：浏览器使用 localStorage，Node/SSR 使用内存 fallback。
 */
import type { UniIDSession } from "./types";

export interface SessionStorageAdapter {
  load(): UniIDSession | null;
  save(session: UniIDSession | null): void;
}

export function createSessionStorage(storageKey: string): SessionStorageAdapter {
  const inMemory: { value: UniIDSession | null } = { value: null };
  const hasWindow = typeof window !== "undefined" && !!window.localStorage;

  return {
    load(): UniIDSession | null {
      if (!hasWindow) return inMemory.value;
      try {
        const s = window.localStorage.getItem(storageKey);
        if (!s) return null;
        return JSON.parse(s) as UniIDSession;
      } catch {
        return null;
      }
    },
    save(session: UniIDSession | null): void {
      if (!hasWindow) {
        inMemory.value = session;
        return;
      }
      try {
        if (session) window.localStorage.setItem(storageKey, JSON.stringify(session));
        else window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  };
}
