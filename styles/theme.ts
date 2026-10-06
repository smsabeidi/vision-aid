import { useColorScheme } from "react-native";

import { useSettings } from "@/hooks/use-settings";

export type ThemeMode = "system" | "light" | "dark";

const light = {
  background: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#E9EEF5",
  text: "#101828",
  textSecondary: "#475467",
  textMuted: "#667085",
  border: "#D0D5DD",
  primary: "#2457D6",
  primaryPressed: "#183FA8",
  primarySoft: "#E9EFFF",
  onPrimary: "#FFFFFF",
  success: "#087443",
  successSoft: "#E5F7EE",
  warning: "#9A5B00",
  warningSoft: "#FFF3D6",
  danger: "#B42318",
  dangerSoft: "#FEECEB",
  cameraOverlay: "rgba(4, 10, 20, 0.76)",
  scrim: "rgba(5, 10, 20, 0.62)",
  shadow: "rgba(16, 24, 40, 0.12)",
} as const;

const dark = {
  background: "#090D14",
  surface: "#121823",
  surfaceElevated: "#1A2230",
  surfaceMuted: "#222C3C",
  text: "#F7F9FC",
  textSecondary: "#D0D8E5",
  textMuted: "#AAB5C5",
  border: "#344054",
  primary: "#7EA2FF",
  primaryPressed: "#A9BEFF",
  primarySoft: "#1C315F",
  onPrimary: "#07122E",
  success: "#6CE9A6",
  successSoft: "#123C2D",
  warning: "#FEC84B",
  warningSoft: "#473510",
  danger: "#FDA29B",
  dangerSoft: "#551C1B",
  cameraOverlay: "rgba(4, 10, 20, 0.82)",
  scrim: "rgba(0, 0, 0, 0.72)",
  shadow: "rgba(0, 0, 0, 0.4)",
} as const;

export type AppTheme = {
  colors: { [K in keyof typeof light]: string };
  isDark: boolean;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
};

export function useAppTheme(): AppTheme {
  const systemScheme = useColorScheme();
  const [settings] = useSettings();
  const isDark = settings.theme === "dark" || (settings.theme === "system" && systemScheme === "dark");

  return {
    colors: isDark ? dark : light,
    isDark,
    spacing: { xs: 6, sm: 10, md: 16, lg: 20, xl: 28, xxl: 36 },
    radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 },
  };
}

