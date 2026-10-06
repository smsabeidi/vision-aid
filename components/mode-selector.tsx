import { Pressable, Text, View } from "react-native";

import { AppIcon } from "@/components/ui";
import { useAppTheme } from "@/styles/theme";
import type { AnalysisMode } from "@/types/analysis";

export const modes: {
  value: AnalysisMode;
  label: string;
  shortDescription: string;
  description: string;
  icon: "camera" | "text" | "verify";
}[] = [
  {
    value: "describe",
    label: "Describe",
    shortDescription: "What’s around me?",
    description: "Understand a scene, object, or space.",
    icon: "camera",
  },
  {
    value: "read",
    label: "Read",
    shortDescription: "What does it say?",
    description: "Read labels, signs, menus, or documents.",
    icon: "text",
  },
  {
    value: "find",
    label: "Verify",
    shortDescription: "Is this the right one?",
    description: "Check an item, setting, or visible state.",
    icon: "verify",
  },
];

export function modeLabel(mode: AnalysisMode) {
  return modes.find((item) => item.value === mode)?.label ?? "Describe";
}

export function ModeSelector({ value, onChange, compact = false }: { value: AnalysisMode; onChange: (mode: AnalysisMode) => void; compact?: boolean }) {
  const theme = useAppTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Analysis mode"
      style={{ flexDirection: "row", gap: theme.spacing.xs, backgroundColor: theme.colors.surface, padding: 5, borderRadius: theme.radius.md }}
    >
      {modes.map((mode) => {
        const selected = value === mode.value;
        return (
          <Pressable
            key={mode.value}
            accessibilityRole="tab"
            accessibilityLabel={mode.label}
            accessibilityHint={mode.description}
            accessibilityState={{ selected }}
            onPress={() => onChange(mode.value)}
            style={({ pressed }) => ({
              minHeight: compact ? 48 : 58,
              flex: 1,
              paddingHorizontal: 8,
              paddingVertical: 8,
              gap: 3,
              borderRadius: theme.radius.sm,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: selected ? theme.colors.primary : pressed ? theme.colors.surfaceMuted : "transparent",
            })}
          >
            {!compact ? <AppIcon name={mode.icon} size={19} color={selected ? theme.colors.onPrimary : theme.colors.textSecondary} /> : null}
            <Text style={{ color: selected ? theme.colors.onPrimary : theme.colors.text, fontSize: 14, fontWeight: "800", textAlign: "center" }}>
              {mode.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
