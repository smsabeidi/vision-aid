import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { modeLabel } from "@/components/mode-selector";
import { AppIcon, Pill } from "@/components/ui";
import { useAppTheme } from "@/styles/theme";
import type { AnalysisHistoryItem } from "@/utils/storage";

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : date.toLocaleDateString([], { month: "short", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function HistoryCard({ item }: { item: AnalysisHistoryItem }) {
  const theme = useAppTheme();
  const safetyLevel = item.analysis.safety.level;
  const safetyTone = safetyLevel === "low" ? "success" : safetyLevel === "medium" ? "warning" : "danger";

  return (
    <Link href={{ pathname: "/result/[id]", params: { id: item.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${modeLabel(item.mode)} result. ${item.title}. ${item.summary}`}
        accessibilityHint="Opens the full analysis"
        style={({ pressed }) => ({
          minHeight: 116,
          backgroundColor: theme.colors.surface,
          borderColor: pressed ? theme.colors.primary : theme.colors.border,
          borderWidth: 1,
          borderRadius: theme.radius.lg,
          borderCurve: "continuous",
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          opacity: pressed ? 0.78 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md }}>
          <View
            accessible={false}
            style={{ width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.primarySoft }}
          >
            <AppIcon name={item.mode === "read" ? "text" : item.mode === "find" ? "verify" : "camera"} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6 }}>
              <Text style={{ flexShrink: 1, color: theme.colors.text, fontSize: 17, lineHeight: 22, fontWeight: "800" }}>{item.title}</Text>
              {item.isDemo ? <Pill label="DEMO" tone="primary" /> : null}
            </View>
            <Text selectable style={{ color: theme.colors.textSecondary, fontSize: 15, lineHeight: 21 }}>
              {item.summary}
            </Text>
          </View>
          <Text accessible={false} style={{ color: theme.colors.textMuted, fontSize: 28, lineHeight: 32 }}>
            ›
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm }}>
          <Text selectable style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            {formatTimestamp(item.createdAt)}
          </Text>
          <Pill label={`${safetyLevel} risk`} tone={safetyTone} />
        </View>
      </Pressable>
    </Link>
  );
}

