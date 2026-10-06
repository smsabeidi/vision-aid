import "expo-sqlite/localStorage/install";

import type { AnalysisMode, AnalysisResult } from "@/types/analysis";
import type { ThemeMode } from "@/styles/theme";

export type AppSettings = {
  theme: ThemeMode;
  autoSpeak: boolean;
  haptics: boolean;
  saveHistory: boolean;
  demoMode: boolean;
};

export type AnalysisHistoryItem = {
  id: string;
  createdAt: string;
  mode: AnalysisMode;
  imageUri?: string;
  title: string;
  summary: string;
  analysis: AnalysisResult;
  isDemo?: boolean;
};

export const STORAGE_KEYS = {
  settings: "vision-aid.settings.v1",
  history: "vision-aid.history.v1",
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  autoSpeak: true,
  haptics: true,
  saveHistory: true,
  demoMode: true,
};

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
const sessionResults = new Map<string, AnalysisHistoryItem>();
const snapshotCache = new Map<string, unknown>();

function readStorage<T>(key: string, fallback: T): T {
  if (snapshotCache.has(key)) return snapshotCache.get(key) as T;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    const value = raw ? (JSON.parse(raw) as T) : fallback;
    snapshotCache.set(key, value);
    return value;
  } catch {
    snapshotCache.set(key, fallback);
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } finally {
    snapshotCache.set(key, value);
    listeners.get(key)?.forEach((listener) => listener());
  }
}

export const storage = {
  get<T>(key: string, fallback: T): T {
    return readStorage(key, fallback);
  },

  set<T>(key: string, value: T): void {
    writeStorage(key, value);
  },

  remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } finally {
      snapshotCache.delete(key);
      listeners.get(key)?.forEach((listener) => listener());
    }
  },

  subscribe(key: string, listener: Listener): () => void {
    const keyListeners = listeners.get(key) ?? new Set<Listener>();
    keyListeners.add(listener);
    listeners.set(key, keyListeners);
    return () => {
      keyListeners.delete(listener);
    };
  },
};

export function addHistoryItem(item: AnalysisHistoryItem): void {
  const current = storage.get<AnalysisHistoryItem[]>(STORAGE_KEYS.history, []);
  storage.set(STORAGE_KEYS.history, [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, 50));
}

export function removeHistoryItem(id: string): void {
  const current = storage.get<AnalysisHistoryItem[]>(STORAGE_KEYS.history, []);
  storage.set(
    STORAGE_KEYS.history,
    current.filter((entry) => entry.id !== id),
  );
}

export function clearHistory(): void {
  storage.set(STORAGE_KEYS.history, [] as AnalysisHistoryItem[]);
}

export function getHistoryItem(id: string): AnalysisHistoryItem | undefined {
  return sessionResults.get(id) ?? storage.get<AnalysisHistoryItem[]>(STORAGE_KEYS.history, []).find((entry) => entry.id === id);
}

export function setSessionHistoryItem(item: AnalysisHistoryItem): void {
  sessionResults.set(item.id, item);
}
