import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ModeSelector, modeLabel } from "@/components/mode-selector";
import { AppButton, AppIcon, Body, Card, Heading, Pill } from "@/components/ui";
import { useAccessibleAction } from "@/hooks/use-accessible-action";
import { useSettings } from "@/hooks/use-settings";
import { analyzeImage, AnalysisApiError } from "@/lib/analysis-client";
import { useAppTheme } from "@/styles/theme";
import type { AnalysisMode, AnalysisResult } from "@/types/analysis";
import { addHistoryItem, setSessionHistoryItem, type AnalysisHistoryItem } from "@/utils/storage";

const DEMO_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function isAnalysisMode(value: string | undefined): value is AnalysisMode {
  return value === "describe" || value === "read" || value === "find";
}

function guidanceFor(mode: AnalysisMode) {
  if (mode === "read") return "Move closer until the text fills the frame. Keep the phone level.";
  if (mode === "find") return "Center the item or control you want to verify.";
  return "Include the full scene and hold steady for a clear description.";
}

function titleFor(mode: AnalysisMode) {
  if (mode === "read") return "Text reading";
  if (mode === "find") return "Visual verification";
  return "Scene description";
}

function mimeTypeFor(uri: string) {
  const normalized = uri.toLowerCase();
  if (normalized.includes(".png")) return "image/png";
  if (normalized.includes(".webp")) return "image/webp";
  return "image/jpeg";
}

async function uriToDataUrl(uri: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("The selected image could not be opened.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function pictureDataUrl(photo: CameraCapturedPicture) {
  return photo.base64 ? `data:${mimeTypeFor(photo.uri)};base64,${photo.base64}` : uriToDataUrl(photo.uri);
}

export default function CaptureScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; demo?: string }>();
  const requestedMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const demoRequested = (Array.isArray(params.demo) ? params.demo[0] : params.demo) === "1";
  const [mode, setMode] = useState<AnalysisMode>(isAnalysisMode(requestedMode) ? requestedMode : "describe");
  const [permission, requestPermission] = useCameraPermissions();
  const [settings] = useSettings();
  const { announce, confirm, success } = useAccessibleAction();
  const cameraRef = useRef<CameraView>(null);
  const demoStarted = useRef(false);
  const cameraPermissionRequested = useRef(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyQuery, setVerifyQuery] = useState("");
  const [lastRequest, setLastRequest] = useState<{ imageDataUrl: string; imageUri?: string; demo?: boolean } | null>(null);

  useEffect(() => {
    if (!demoRequested && permission && !permission.granted && permission.canAskAgain && !cameraPermissionRequested.current) {
      cameraPermissionRequested.current = true;
      void requestPermission();
    }
  }, [demoRequested, permission, requestPermission]);

  const changeMode = (nextMode: AnalysisMode) => {
    setMode(nextMode);
    announce(`${modeLabel(nextMode)} mode. ${guidanceFor(nextMode)}`);
  };

  const completeAnalysis = async (analysis: AnalysisResult, imageUri?: string, explicitlyDemo = false) => {
    const id = `${analysis.requestId}-${Date.now()}`;
    const item: AnalysisHistoryItem = {
      id,
      createdAt: analysis.generatedAt,
      mode: analysis.mode,
      imageUri,
      title: titleFor(analysis.mode),
      summary: analysis.summary,
      analysis,
      isDemo: explicitlyDemo || analysis.source === "demo",
    };

    if (settings.saveHistory) addHistoryItem(item);
    else setSessionHistoryItem(item);

    await success();
    announce("Analysis complete.");
    router.replace({ pathname: "/result/[id]", params: { id } });
  };

  const runAnalysis = async (input: { imageDataUrl: string; imageUri?: string; demo?: boolean }) => {
    setProcessing(true);
    setError(null);
    setLastRequest(input);
    announce(input.demo ? "Running the guided demo." : "Photo captured. Analyzing now.");

    try {
      const analysis = await analyzeImage(
        {
          imageDataUrl: input.imageDataUrl,
          mode,
          query:
            mode === "find"
              ? verifyQuery.trim() || "Verify the visible item, setting, or state and explain what supports the answer."
              : undefined,
          demo: input.demo,
        },
        { timeoutMs: 30_000, fallbackToDemo: Boolean(input.demo) },
      );
      await completeAnalysis(analysis, input.imageUri, Boolean(input.demo));
    } catch (caught) {
      const message =
        caught instanceof AnalysisApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "VisionAid could not analyze that image.";
      setError(`${message} Try again, or choose a different photo.`);
      announce(`Analysis failed. ${message}`);
    } finally {
      setProcessing(false);
    }
  };

  // Effect Events call the latest implementation without making the timer depend on
  // render-local function identity, which keeps hydration rerenders from cancelling it.
  const runDemoAnalysis = useEffectEvent(() => {
    void runAnalysis({ imageDataUrl: DEMO_PIXEL, demo: true });
  });

  const takePhoto = async () => {
    if (!cameraRef.current || processing) return;
    try {
      await confirm();
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.76, base64: true, skipProcessing: false });
      if (!photo) throw new Error("No photo was captured.");
      await runAnalysis({ imageDataUrl: await pictureDataUrl(photo), imageUri: photo.uri });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The camera could not take a photo.";
      setError(message);
      announce(message);
    }
  };

  const choosePhoto = async () => {
    try {
      await confirm();
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.82,
        base64: true,
      });
      const asset = selection.canceled ? undefined : selection.assets[0];
      if (!asset) return;
      const imageDataUrl = asset.base64
        ? `data:${asset.mimeType ?? mimeTypeFor(asset.uri)};base64,${asset.base64}`
        : await uriToDataUrl(asset.uri);
      await runAnalysis({ imageDataUrl, imageUri: asset.uri });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The photo library could not be opened.";
      setError(message);
      announce(message);
    }
  };

  useEffect(() => {
    if (demoRequested && !demoStarted.current) {
      demoStarted.current = true;
      const timer = setTimeout(() => {
        runDemoAnalysis();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [demoRequested]);

  if (demoRequested) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: theme.spacing.lg, gap: theme.spacing.lg }}
        >
          <Card style={{ alignItems: "center", paddingVertical: theme.spacing.xxl }}>
            <View
              accessible={false}
              style={{ width: 76, height: 76, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.primarySoft }}
            >
              <AppIcon name="sparkle" color={theme.colors.primary} size={34} />
            </View>
            <Pill label="INTERACTIVE DEMO" tone="primary" />
            <Heading style={{ textAlign: "center" }}>Understanding a kitchen counter</Heading>
            <Body secondary style={{ textAlign: "center" }}>
              VisionAid is checking the scene, grounding its answer, and assessing whether it is safe to act.
            </Body>
            <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel="Analysis in progress" />
            {error ? (
              <View accessibilityRole="alert" style={{ width: "100%", gap: theme.spacing.md }}>
                <Text selectable style={{ color: theme.colors.danger, textAlign: "center", fontSize: 16, lineHeight: 23 }}>
                  {error}
                </Text>
                <AppButton label="Retry demo" icon="retry" onPress={() => void runAnalysis({ imageDataUrl: DEMO_PIXEL, demo: true })} />
              </View>
            ) : null}
            <AppButton label="Cancel" variant="quiet" onPress={() => router.back()} />
          </Card>
        </ScrollView>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel="Checking camera access" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: theme.spacing.lg, gap: theme.spacing.lg }}
      >
        <Card style={{ alignItems: "center", paddingVertical: theme.spacing.xxl }}>
          <View
            accessible={false}
            style={{ width: 76, height: 76, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.primarySoft }}
          >
            <AppIcon name="camera" color={theme.colors.primary} size={34} />
          </View>
          <Heading style={{ textAlign: "center" }}>Camera access is off</Heading>
          <Body secondary style={{ textAlign: "center" }}>
            Allow camera access for guided capture, or choose an existing photo instead.
          </Body>
          {permission.canAskAgain ? <AppButton label="Allow camera" icon="camera" onPress={() => void requestPermission()} /> : null}
          <AppButton label="Choose a photo" icon="gallery" variant="secondary" onPress={() => void choosePhoto()} />
          <AppButton label="Go back" variant="quiet" onPress={() => router.back()} />
        </Card>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" active={!processing}>
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: theme.spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close camera"
              accessibilityHint="Returns to the home screen"
              onPress={() => router.back()}
              style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.cameraOverlay, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.72 : 1 })}
            >
              <AppIcon name="close" color="#FFFFFF" size={30} />
            </Pressable>
            <Pill label={`${modeLabel(mode).toUpperCase()} MODE`} tone="primary" />
            <View accessible={false} style={{ width: 52 }} />
          </View>

          <View
            accessible={false}
            style={{ alignSelf: "center", width: "78%", aspectRatio: mode === "read" ? 1.3 : 1, borderWidth: 2, borderColor: "rgba(255,255,255,0.9)", borderRadius: theme.radius.lg, borderCurve: "continuous" }}
          />

          <View
            style={{
              backgroundColor: theme.colors.cameraOverlay,
              paddingTop: theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
              paddingBottom: insets.bottom + theme.spacing.md,
              gap: theme.spacing.md,
            }}
          >
            <View accessibilityLiveRegion="polite" style={{ alignItems: "center", gap: 4 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 17, lineHeight: 23, fontWeight: "800", textAlign: "center" }}>Ready to {modeLabel(mode).toLowerCase()}</Text>
              <Text selectable style={{ color: "#E4E7EC", fontSize: 14, lineHeight: 20, textAlign: "center" }}>
                {guidanceFor(mode)}
              </Text>
            </View>
            <ModeSelector value={mode} onChange={changeMode} compact />
            {mode === "find" ? (
              <View style={{ gap: 5 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 19, fontWeight: "800" }}>What should I verify? (optional)</Text>
                <TextInput
                  accessibilityLabel="What should I verify? Optional"
                  accessibilityHint="Enter the item, control, or visible state you want VisionAid to check"
                  value={verifyQuery}
                  onChangeText={setVerifyQuery}
                  placeholder="Example: Is the oven set to off?"
                  placeholderTextColor={theme.colors.textMuted}
                  returnKeyType="done"
                  editable={!processing}
                  style={{
                    minHeight: 50,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    fontSize: 16,
                  }}
                />
              </View>
            ) : null}
            {error ? (
              <View accessibilityRole="alert" style={{ backgroundColor: theme.colors.dangerSoft, padding: theme.spacing.md, borderRadius: theme.radius.md, gap: theme.spacing.sm }}>
                <Text selectable style={{ color: theme.colors.danger, fontSize: 14, lineHeight: 20, fontWeight: "700" }}>
                  {error}
                </Text>
                {lastRequest ? <AppButton label="Retry analysis" icon="retry" variant="secondary" onPress={() => void runAnalysis(lastRequest)} /> : null}
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", gap: theme.spacing.lg }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose a photo"
                accessibilityHint="Opens your photo library"
                disabled={processing}
                onPress={() => void choosePhoto()}
                style={({ pressed }) => ({ width: 58, height: 58, borderRadius: 29, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center", opacity: processing ? 0.45 : pressed ? 0.72 : 1 })}
              >
                <AppIcon name="gallery" color={theme.colors.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Take photo to ${modeLabel(mode).toLowerCase()}`}
                accessibilityHint="Captures the current camera view and begins analysis"
                accessibilityState={{ busy: processing, disabled: processing }}
                disabled={processing}
                onPress={() => void takePhoto()}
                style={({ pressed }) => ({ width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: "#FFFFFF", backgroundColor: pressed ? theme.colors.primary : "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", opacity: processing ? 0.6 : 1 })}
              >
                {processing ? <ActivityIndicator color="#FFFFFF" /> : <View accessible={false} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#FFFFFF" }} />}
              </Pressable>
              <View accessible={false} style={{ width: 58 }} />
            </View>
            {processing ? (
              <Text accessibilityLiveRegion="assertive" style={{ color: "#FFFFFF", textAlign: "center", fontSize: 15, fontWeight: "700" }}>
                Analyzing… this usually takes a few seconds
              </Text>
            ) : null}
          </View>
        </View>
      </CameraView>
    </View>
  );
}
