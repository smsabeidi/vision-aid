import type { ReactNode } from "react";
import { Switch, Text, View } from "react-native";

import { useAppTheme } from "@/styles/theme";

export function SettingsRow({
  label,
  description,
  value,
  onValueChange,
  children,
}: {
  label: string;
  description: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  children?: ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: theme.colors.text, fontSize: 17, lineHeight: 22, fontWeight: "700" }}>{label}</Text>
        <Text selectable style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 19 }}>
          {description}
        </Text>
      </View>
      {onValueChange ? (
        <Switch
          accessibilityLabel={label}
          accessibilityHint={description}
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.primary }}
        />
      ) : (
        children
      )}
    </View>
  );
}

