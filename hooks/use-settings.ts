import { useMemo } from "react";

import { useStorage } from "@/hooks/use-storage";
import { AppSettings, DEFAULT_SETTINGS, STORAGE_KEYS } from "@/utils/storage";

export function useSettings() {
  const fallback = useMemo(() => DEFAULT_SETTINGS, []);
  return useStorage<AppSettings>(STORAGE_KEYS.settings, fallback);
}

