import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { HistoryCard } from "@/components/history-card";
import { modes } from "@/components/mode-selector";
import { AppButton, Body, Card, Eyebrow, Heading, IconTile, Pill, ScrollScreen } from "@/components/ui";
import { useAccessibleAction } from "@/hooks/use-accessible-action";
import { useHistory } from "@/hooks/use-history";
import { useSettings } from "@/hooks/use-settings";
import { useAppTheme } from "@/styles/theme";

export default function HomeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [history] = useHistory();
  const [settings] = useSettings();
  const { confirm } = useAccessibleAction();
  const recent = history.slice(0, 2);

  const openCapture = async (mode: "describe" | "read" | "find", demo = false) => {
    await confirm();
    router.push({ pathname: "/capture", params: { mode, demo: demo ? "1" : "0" } });
  };

  return (
    <ScrollScreen>
      <View style={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }}>
        <Eyebrow>YOUR WORLD, MADE CLEAR</Eyebrow>
        <Heading style={{ fontSize: 32, lineHeight: 39 }}>What can I help you see?</Heading>
        <Body secondary>Point your camera or choose a photo. VisionAid will guide the capture and clearly say what it knows.</Body>
      </View>

      <Card style={{ backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <View
            accessible={false}
            style={{ width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" }}
          >
            <Text style={{ color: theme.colors.onPrimary, fontSize: 26, fontWeight: "900" }}>V</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable style={{ color: theme.colors.onPrimary, fontSize: 22, lineHeight: 28, fontWeight: "900" }}>
              Start with a photo
            </Text>
            <Text selectable style={{ color: theme.colors.onPrimary, opacity: 0.9, fontSize: 15, lineHeight: 21 }}>
              Capture guidance helps you get a clear answer.
            </Text>
          </View>
        </View>
        <AppButton
          label="Open camera"
          hint="Opens the guided camera in Describe mode"
          icon="camera"
          variant="secondary"
          onPress={() => void openCapture("describe")}
          style={{ backgroundColor: theme.colors.surface }}
        />
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <Heading style={{ fontSize: 20, lineHeight: 26 }}>Choose a task</Heading>
        {modes.map((mode, index) => (
          <Pressable
            key={mode.value}
            accessibilityRole="button"
            accessibilityLabel={`${mode.label}. ${mode.shortDescription}`}
            accessibilityHint={mode.description}
            onPress={() => void openCapture(mode.value)}
            style={({ pressed }) => ({
              minHeight: 94,
              backgroundColor: theme.colors.surface,
              borderColor: pressed ? theme.colors.primary : theme.colors.border,
              borderWidth: 1,
              borderRadius: theme.radius.lg,
              borderCurve: "continuous",
              padding: theme.spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.md,
              opacity: pressed ? 0.76 : 1,
            })}
          >
            <IconTile name={mode.icon} tone={index === 2 ? "success" : "primary"} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: theme.colors.text, fontSize: 18, lineHeight: 23, fontWeight: "800" }}>{mode.label}</Text>
              <Text selectable style={{ color: theme.colors.textSecondary, fontSize: 15, lineHeight: 21 }}>
                {mode.shortDescription} {mode.description}
              </Text>
            </View>
            <Text accessible={false} style={{ color: theme.colors.primary, fontSize: 30 }}>
              ›
            </Text>
          </Pressable>
        ))}
      </View>

      {settings.demoMode ? (
        <Card style={{ backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
            <IconTile name="sparkle" />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <Heading style={{ fontSize: 19, lineHeight: 24 }}>Try the investor demo</Heading>
                <Pill label="NO CAMERA NEEDED" tone="primary" />
              </View>
              <Body secondary>See a complete safety-aware analysis in seconds.</Body>
            </View>
          </View>
          <AppButton label="Run guided demo" hint="Runs a built-in sample analysis" icon="sparkle" onPress={() => void openCapture("describe", true)} />
        </Card>
      ) : null}

      <Card accessibilityLabel="Privacy note. Photos are analyzed only when you ask. History is stored on this device.">
        <View style={{ flexDirection: "row", gap: theme.spacing.md, alignItems: "center" }}>
          <IconTile name="privacy" tone="success" />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: theme.colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" }}>Private by design</Text>
            <Text selectable style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
              Photos are analyzed only when you ask. Saved history stays on this device.
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm }}>
          <Heading style={{ fontSize: 20, lineHeight: 26 }}>Recent activity</Heading>
          {history.length > 0 ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="See all history"
              onPress={() => router.push("/history")}
              hitSlop={8}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }}
            >
              <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: "800" }}>See all</Text>
            </Pressable>
          ) : null}
        </View>
        {recent.length > 0 ? (
          recent.map((item) => <HistoryCard key={item.id} item={item} />)
        ) : (
          <Card style={{ alignItems: "center", paddingVertical: theme.spacing.xl }}>
            <IconTile name="history" />
            <Body secondary style={{ textAlign: "center" }}>
              Your completed analyses will appear here.
            </Body>
          </Card>
        )}
      </View>
    </ScrollScreen>
  );
}

