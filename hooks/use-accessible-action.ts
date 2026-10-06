import { useCallback } from "react";
import { AccessibilityInfo } from "react-native";
import * as Haptics from "expo-haptics";

import { useSettings } from "@/hooks/use-settings";

export function useAccessibleAction() {
  const [settings] = useSettings();

  const confirm = useCallback(async () => {
    if (settings.haptics && process.env.EXPO_OS === "ios") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [settings.haptics]);

  const success = useCallback(async () => {
    if (settings.haptics && process.env.EXPO_OS === "ios") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [settings.haptics]);

  const announce = useCallback((message: string) => {
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  return { announce, confirm, success };
}

