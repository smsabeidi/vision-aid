import { Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { HistoryCard } from "@/components/history-card";
import { AppButton, Body, Card, EmptyState, Heading, IconTile, ScrollScreen } from "@/components/ui";
import { useHistory } from "@/hooks/use-history";
import { useSettings } from "@/hooks/use-settings";
import { useAppTheme } from "@/styles/theme";
import { clearHistory } from "@/utils/storage";

export default function HistoryScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [history] = useHistory();
  const [settings] = useSettings();

  const confirmClear = () => {
    Alert.alert("Clear all history?", "This removes saved analyses from this device. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear history", style: "destructive", onPress: clearHistory },
    ]);
  };

  return (
    <ScrollScreen>
      {!settings.saveHistory ? (
        <Card style={{ backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.warning }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
            <IconTile name="privacy" tone="warning" />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: theme.colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" }}>History saving is off</Text>
              <Body secondary>New analyses are available only until you close the app.</Body>
            </View>
          </View>
        </Card>
      ) : null}

      {history.length === 0 ? (
        <EmptyState
          title="No saved analyses yet"
          message="Your Describe, Read, and Verify results will appear here when history saving is on."
          action={<AppButton label="Start an analysis" icon="camera" onPress={() => router.push("/capture")} />}
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ gap: 4 }}>
            <Heading style={{ fontSize: 21, lineHeight: 27 }}>{history.length} saved {history.length === 1 ? "analysis" : "analyses"}</Heading>
            <Body secondary>Stored privately on this device.</Body>
          </View>
          {history.map((item) => <HistoryCard key={item.id} item={item} />)}
          <AppButton label="Clear all history" variant="danger" onPress={confirmClear} />
        </View>
      )}
    </ScrollScreen>
  );
}

