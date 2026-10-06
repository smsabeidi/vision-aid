import { Alert, Pressable, Text, View } from "react-native";

import { SettingsRow } from "@/components/settings-row";
import { Body, Card, Divider, Heading, IconTile, ScrollScreen } from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import { useAppTheme, type ThemeMode } from "@/styles/theme";
import { clearHistory } from "@/utils/storage";

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsScreen() {
  const theme = useAppTheme();
  const [settings, setSettings] = useSettings();

  const update = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const confirmClear = () => {
    Alert.alert("Clear saved history?", "All saved analyses will be removed from this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearHistory },
    ]);
  };

  return (
    <ScrollScreen>
      <View style={{ gap: theme.spacing.sm }}>
        <Heading style={{ fontSize: 20, lineHeight: 26 }}>Appearance</Heading>
        <Card>
          <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: "700" }}>Color theme</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Color theme" style={{ flexDirection: "row", gap: theme.spacing.xs, backgroundColor: theme.colors.surfaceMuted, padding: 5, borderRadius: theme.radius.md }}>
            {themeOptions.map((option) => {
              const selected = settings.theme === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label} theme`}
                  accessibilityState={{ selected, checked: selected }}
                  onPress={() => update("theme", option.value)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 48,
                    borderRadius: theme.radius.sm,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selected ? theme.colors.surface : pressed ? theme.colors.background : "transparent",
                    borderWidth: selected ? 1 : 0,
                    borderColor: theme.colors.primary,
                  })}
                >
                  <Text style={{ color: selected ? theme.colors.primary : theme.colors.textSecondary, fontSize: 15, fontWeight: "800" }}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Heading style={{ fontSize: 20, lineHeight: 26 }}>Accessibility</Heading>
        <Card>
          <SettingsRow
            label="Speak results automatically"
            description="Reads the answer, evidence, and safety guidance after analysis."
            value={settings.autoSpeak}
            onValueChange={(value) => update("autoSpeak", value)}
          />
          <Divider />
          <SettingsRow
            label="Haptic feedback"
            description="Uses gentle vibration to confirm important actions on supported devices."
            value={settings.haptics}
            onValueChange={(value) => update("haptics", value)}
          />
        </Card>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Heading style={{ fontSize: 20, lineHeight: 26 }}>Privacy and data</Heading>
        <Card>
          <SettingsRow
            label="Save analysis history"
            description="Stores results locally on this device. Photos are never captured in the background."
            value={settings.saveHistory}
            onValueChange={(value) => update("saveHistory", value)}
          />
          <Divider />
          <SettingsRow label="Stored data" description="Remove saved results from this device at any time.">
            <Pressable accessibilityRole="button" accessibilityLabel="Clear history" onPress={confirmClear} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 8 }}>
              <Text style={{ color: theme.colors.danger, fontSize: 15, fontWeight: "800" }}>Clear</Text>
            </Pressable>
          </SettingsRow>
        </Card>
        <Card style={{ backgroundColor: theme.colors.successSoft, borderColor: theme.colors.success }}>
          <View style={{ flexDirection: "row", gap: theme.spacing.md, alignItems: "center" }}>
            <IconTile name="privacy" tone="success" />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: theme.colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" }}>You stay in control</Text>
              <Body secondary>VisionAid analyzes only images you explicitly capture or select. API credentials remain on the server.</Body>
            </View>
          </View>
        </Card>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Heading style={{ fontSize: 20, lineHeight: 26 }}>Demo</Heading>
        <Card>
          <SettingsRow
            label="Show sample demo"
            description="Displays the no-camera investor demo on the home screen."
            value={settings.demoMode}
            onValueChange={(value) => update("demoMode", value)}
          />
        </Card>
      </View>

      <Card style={{ backgroundColor: theme.colors.surfaceMuted, boxShadow: "none", alignItems: "center" }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 16, fontWeight: "900" }}>VisionAid MVP</Text>
        <Text selectable style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Version 0.1.0</Text>
        <Body secondary style={{ textAlign: "center", fontSize: 13, lineHeight: 19 }}>
          An assistive tool, not a replacement for mobility training, emergency services, or professional advice.
        </Body>
      </Card>
    </ScrollScreen>
  );
}
