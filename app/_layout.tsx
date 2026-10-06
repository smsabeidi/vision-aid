import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { HeaderLink } from "@/components/header-button";
import { useAppTheme } from "@/styles/theme";

export default function RootLayout() {
  const theme = useAppTheme();

  return (
    <>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: "800" },
          headerBackTitle: "Back",
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "VisionAid",
            headerRight: () => <HeaderLink href="/settings" label="Settings" icon="settings" />,
          }}
        />
        <Stack.Screen name="capture" options={{ headerShown: false }} />
        <Stack.Screen name="history" options={{ title: "History" }} />
        <Stack.Screen name="settings" options={{ title: "Settings", presentation: "modal" }} />
        <Stack.Screen name="result/[id]" options={{ title: "Analysis" }} />
      </Stack>
    </>
  );
}
