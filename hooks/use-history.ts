import { useMemo } from "react";

import { useStorage } from "@/hooks/use-storage";
import { AnalysisHistoryItem, STORAGE_KEYS } from "@/utils/storage";

export function useHistory() {
  const fallback = useMemo<AnalysisHistoryItem[]>(() => [], []);
  return useStorage<AnalysisHistoryItem[]>(STORAGE_KEYS.history, fallback);
}

