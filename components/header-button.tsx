import { Link } from "expo-router";
import { Pressable } from "react-native";

import { AppIcon } from "@/components/ui";
import { useAppTheme } from "@/styles/theme";

export function HeaderLink({ href, label, icon }: { href: "/history" | "/settings"; label: string; icon: "history" | "settings" }) {
  const theme = useAppTheme();
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={`Opens ${label.toLowerCase()}`}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? theme.colors.surfaceMuted : "transparent",
        })}
      >
        <AppIcon name={icon} color={theme.colors.primary} />
      </Pressable>
    </Link>
  );
}

