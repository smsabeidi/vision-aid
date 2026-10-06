import { useCallback, useSyncExternalStore } from "react";

import { storage } from "@/utils/storage";

export function useStorage<T>(key: string, fallback: T): [T, (value: T | ((current: T) => T)) => void] {
  const subscribe = useCallback((listener: () => void) => storage.subscribe(key, listener), [key]);
  const getSnapshot = useCallback(() => storage.get<T>(key, fallback), [fallback, key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = storage.get<T>(key, fallback);
      storage.set(key, typeof next === "function" ? (next as (value: T) => T)(current) : next);
    },
    [fallback, key],
  );

  return [value, setValue];
}

