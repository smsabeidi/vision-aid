import { useEffect, useMemo } from "react";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";

import { AnalysisContent, analysisSpeechText } from "@/components/analysis-content";
import { modeLabel } from "@/components/mode-selector";
import { AppButton, Body, Card, EmptyState, Pill, ScrollScreen } from "@/components/ui";
import { useAccessibleAction } from "@/hooks/use-accessible-action";
import { useAnalysisSpeech } from "@/hooks/use-analysis-speech";
import { useAppTheme } from "@/styles/theme";
import { getHistoryItem } from "@/utils/storage";

export default function AnalysisResultScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const item = useMemo(() => getHistoryItem(id), [id]);
  const speechText = item ? analysisSpeechText(item.analysis) : "";
  const { announce } = useAccessibleAction();
  const { speaking, toggle } = useAnalysisSpeech(speechText, true);

  useEffect(() => {
    if (item) announce(`Analysis complete. ${item.summary}`);
  }, [announce, item]);

  if (!item) {
    return (
      <ScrollScreen>
        <EmptyState
          title="Analysis not found"
          message="This result may have been removed or was created without saving history in a previous session."
          action={<AppButton label="Start a new analysis" icon="camera" onPress={() => router.replace("/capture")} />}
        />
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm }}>
        <Pill label={`${modeLabel(item.mode).toUpperCase()} MODE`} tone="primary" />
        <Text selectable style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 }}>
          {new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
        </Text>
      </View>

      {item.imageUri ? (
        <Image
          source={{ uri: item.imageUri }}
          accessibilityLabel={`Photo analyzed in ${modeLabel(item.mode)} mode`}
          contentFit="cover"
          transition={180}
          style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceMuted }}
        />
      ) : (
        <Card style={{ backgroundColor: theme.colors.primarySoft, alignItems: "center" }}>
          <Pill label="GUIDED SAMPLE" tone="primary" />
          <Body secondary style={{ textAlign: "center" }}>
            This sample shows the same answer, evidence, safety, and speech experience used for camera analyses.
          </Body>
        </Card>
      )}

      <AppButton
        label={speaking ? "Stop speaking" : "Read result aloud"}
        hint={speaking ? "Stops spoken analysis" : "Speaks the answer, evidence, and safety guidance"}
        icon="speaker"
        variant={speaking ? "secondary" : "primary"}
        onPress={toggle}
      />

      <AnalysisContent result={item.analysis} />

      <Card style={{ backgroundColor: theme.colors.surfaceMuted, boxShadow: "none" }}>
        <Text selectable style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: "center" }}>
          VisionAid can make mistakes. Do not use it alone for navigation, medication, emergencies, identity, or other high-stakes decisions.
        </Text>
      </Card>

      <View style={{ gap: theme.spacing.sm }}>
        <AppButton label="Analyze another photo" icon="camera" onPress={() => router.replace({ pathname: "/capture", params: { mode: item.mode } })} />
        <AppButton label="Back to home" variant="quiet" onPress={() => router.dismissTo("/")} />
      </View>
    </ScrollScreen>
  );
}
