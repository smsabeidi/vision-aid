import { Text, View } from "react-native";

import { AppIcon, Body, Card, Divider, Heading, Pill } from "@/components/ui";
import { useAppTheme } from "@/styles/theme";
import type { AnalysisResult } from "@/types/analysis";

function sentenceList(items: string[]) {
  return items.filter(Boolean).join(". ");
}

export function analysisSpeechText(result: AnalysisResult) {
  const safetyPrefix = result.safety.safeToAct
    ? "Safety assessment: no immediate concern was identified."
    : "Caution: do not act on this result without confirmation.";
  return [
    result.summary,
    sentenceList(result.details),
    safetyPrefix,
    result.safety.guidance,
    result.suggestedActions.length ? `Suggested next steps: ${sentenceList(result.suggestedActions)}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function safetyTone(level: AnalysisResult["safety"]["level"]) {
  if (level === "low") return "success" as const;
  if (level === "medium") return "warning" as const;
  return "danger" as const;
}

export function AnalysisContent({ result }: { result: AnalysisResult }) {
  const theme = useAppTheme();
  const confidence = Math.round(Math.max(0, Math.min(1, result.confidence)) * 100);
  const tone = safetyTone(result.safety.level);
  const safetyColor = tone === "success" ? theme.colors.success : tone === "warning" ? theme.colors.warning : theme.colors.danger;
  const safetyBackground = tone === "success" ? theme.colors.successSoft : tone === "warning" ? theme.colors.warningSoft : theme.colors.dangerSoft;

  return (
    <>
      <Card accessibilityLabel={`Answer. ${result.summary}`}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          <Pill label={result.source === "demo" ? "DEMO · SAMPLE RESULT" : "LIVE AI · GENERATED RESULT"} tone={result.source === "demo" ? "primary" : "success"} />
          <Pill label={`AI ESTIMATE · ${confidence}%`} tone={confidence >= 80 ? "success" : confidence >= 55 ? "warning" : "danger"} />
        </View>
        <Heading style={{ fontSize: 26, lineHeight: 34 }}>{result.summary}</Heading>
        <Text selectable style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 }}>
          The AI estimate is a model signal, not a probability or guarantee of correctness.
        </Text>
      </Card>

      {result.details.length > 0 ? (
        <Card>
          <Heading style={{ fontSize: 20, lineHeight: 26 }}>What I noticed</Heading>
          <Divider />
          <View style={{ gap: theme.spacing.md }}>
            {result.details.map((detail, index) => (
              <View key={`${index}-${detail}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md }}>
                <View
                  accessible={false}
                  style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{index + 1}</Text>
                </View>
                <Body style={{ flex: 1 }}>{detail}</Body>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card
        accessibilityLabel={`Safety assessment. ${result.safety.level} risk. ${result.safety.guidance}`}
        style={{ backgroundColor: safetyBackground, borderColor: safetyColor }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <View
            accessible={false}
            style={{ width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface }}
          >
            <AppIcon name={result.safety.safeToAct ? "check" : "warning"} color={safetyColor} size={24} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: safetyColor, fontSize: 13, lineHeight: 17, fontWeight: "900", letterSpacing: 0.6 }}>
              {result.safety.level.toUpperCase()} RISK
            </Text>
            <Heading style={{ color: theme.colors.text, fontSize: 20, lineHeight: 25 }}>
              {result.safety.safeToAct ? "No immediate concern identified" : "Confirm before you act"}
            </Heading>
          </View>
        </View>
        <Body>{result.safety.guidance}</Body>
        {result.safety.requiresHumanConfirmation ? <Pill label="HUMAN CONFIRMATION RECOMMENDED" tone="danger" /> : null}
        {result.safety.categories.filter((category) => category !== "none").length > 0 ? (
          <Text selectable style={{ color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
            Safety categories: {result.safety.categories.filter((category) => category !== "none").join(", ")}
          </Text>
        ) : null}
      </Card>

      {result.suggestedActions.length > 0 ? (
        <Card>
          <Heading style={{ fontSize: 20, lineHeight: 26 }}>What you can do next</Heading>
          <Divider />
          <View style={{ gap: theme.spacing.md }}>
            {result.suggestedActions.map((action) => (
              <View key={action} style={{ flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md }}>
                <Text accessible={false} style={{ color: theme.colors.success, fontSize: 18, fontWeight: "900" }}>
                  ✓
                </Text>
                <Body style={{ flex: 1 }}>{action}</Body>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </>
  );
}
