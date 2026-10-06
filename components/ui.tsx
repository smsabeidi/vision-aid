import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";

import { useAppTheme } from "@/styles/theme";

type GlyphName =
  | "camera"
  | "text"
  | "verify"
  | "history"
  | "settings"
  | "speaker"
  | "privacy"
  | "gallery"
  | "sparkle"
  | "back"
  | "close"
  | "retry"
  | "warning"
  | "check";

const glyphs: Record<GlyphName, string> = {
  camera: "◉",
  text: "Aa",
  verify: "✓",
  history: "↺",
  settings: "⚙",
  speaker: ")))",
  privacy: "◆",
  gallery: "▧",
  sparkle: "✦",
  back: "‹",
  close: "×",
  retry: "↻",
  warning: "!",
  check: "✓",
};

export function AppIcon({ name, color, size = 22 }: { name: GlyphName; color?: string; size?: number }) {
  const theme = useAppTheme();
  return (
    <Text
      accessible={false}
      importantForAccessibility="no"
      style={{ color: color ?? theme.colors.text, fontSize: name === "speaker" ? size * 0.62 : size, fontWeight: "800" }}
    >
      {glyphs[name]}
    </Text>
  );
}

export function ScrollScreen({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const theme = useAppTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: theme.spacing.xxl, gap: theme.spacing.lg, ...style }}
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  accessibilityLabel,
}: PropsWithChildren<{ style?: ViewStyle; accessibilityLabel?: string }>) {
  const theme = useAppTheme();
  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        borderCurve: "continuous",
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
        boxShadow: `0 8px 24px ${theme.colors.shadow}`,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

export function IconTile({ name, tone = "primary" }: { name: GlyphName; tone?: "primary" | "success" | "warning" }) {
  const theme = useAppTheme();
  const backgroundColor =
    tone === "success" ? theme.colors.successSoft : tone === "warning" ? theme.colors.warningSoft : theme.colors.primarySoft;
  const color = tone === "success" ? theme.colors.success : tone === "warning" ? theme.colors.warning : theme.colors.primary;

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={{ width: 52, height: 52, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center", backgroundColor }}
    >
      <AppIcon name={name} color={color} size={24} />
    </View>
  );
}

export function Eyebrow({ children, color }: PropsWithChildren<{ color?: string }>) {
  const theme = useAppTheme();
  return (
    <Text
      selectable
      style={{ color: color ?? theme.colors.primary, fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.7 }}
    >
      {children}
    </Text>
  );
}

export function Heading({ children, style }: PropsWithChildren<{ style?: TextStyle }>) {
  const theme = useAppTheme();
  return (
    <Text selectable accessibilityRole="header" style={{ color: theme.colors.text, fontSize: 24, lineHeight: 31, fontWeight: "800", ...style }}>
      {children}
    </Text>
  );
}

export function Body({ children, secondary = false, style }: PropsWithChildren<{ secondary?: boolean; style?: TextStyle }>) {
  const theme = useAppTheme();
  return (
    <Text selectable style={{ color: secondary ? theme.colors.textSecondary : theme.colors.text, fontSize: 16, lineHeight: 24, ...style }}>
      {children}
    </Text>
  );
}

export function AppButton({
  label,
  onPress,
  hint,
  icon,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  hint?: string;
  icon?: GlyphName;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const theme = useAppTheme();
  const primary = variant === "primary";
  const danger = variant === "danger";
  const backgroundColor = primary
    ? theme.colors.primary
    : danger
      ? theme.colors.dangerSoft
      : variant === "quiet"
        ? "transparent"
        : theme.colors.surfaceMuted;
  const color = primary ? theme.colors.onPrimary : danger ? theme.colors.danger : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ busy: loading, disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 54,
        borderRadius: theme.radius.md,
        borderCurve: "continuous",
        backgroundColor,
        borderWidth: primary || variant === "quiet" ? 0 : 1,
        borderColor: danger ? theme.colors.danger : theme.colors.border,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.sm,
        opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
        ...style,
      })}
    >
      {loading ? <ActivityIndicator color={color} /> : icon ? <AppIcon name={icon} color={color} size={22} /> : null}
      <Text style={{ color, fontSize: 17, lineHeight: 22, fontWeight: "800", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
}) {
  const theme = useAppTheme();
  const palette = {
    neutral: [theme.colors.surfaceMuted, theme.colors.textSecondary],
    primary: [theme.colors.primarySoft, theme.colors.primary],
    success: [theme.colors.successSoft, theme.colors.success],
    warning: [theme.colors.warningSoft, theme.colors.warning],
    danger: [theme.colors.dangerSoft, theme.colors.danger],
  }[tone];

  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: palette[0], paddingHorizontal: 11, paddingVertical: 6, borderRadius: theme.radius.pill }}>
      <Text selectable style={{ color: palette[1], fontWeight: "800", fontSize: 13, lineHeight: 17 }}>
        {label}
      </Text>
    </View>
  );
}

export function Divider() {
  const theme = useAppTheme();
  return <View accessible={false} style={{ height: 1, backgroundColor: theme.colors.border }} />;
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  const theme = useAppTheme();
  return (
    <Card style={{ alignItems: "center", paddingVertical: theme.spacing.xxl }}>
      <IconTile name="sparkle" />
      <Heading style={{ textAlign: "center" }}>{title}</Heading>
      <Body secondary style={{ textAlign: "center", maxWidth: 420 }}>
        {message}
      </Body>
      {action}
    </Card>
  );
}

