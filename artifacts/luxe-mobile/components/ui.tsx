import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

const R = colors.radius;

export function Screen({
  title,
  subtitle,
  right,
  children,
  refreshing,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 12,
          paddingHorizontal: 20,
          paddingBottom: 120,
        }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.accent} />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.foreground }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: c.mutedForeground }]}>{subtitle}</Text>
            ) : null}
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

export function StackScreen({
  children,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 16,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 60,
        }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.accent} />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderRadius: R,
          borderWidth: 1,
          borderColor: c.border,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={[styles.sectionTitle, { color: c.foreground }]}>{children}</Text>;
}

export function LuxeButton({
  label,
  onPress,
  variant = "gold",
  loading,
  disabled,
  icon,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: "gold" | "primary" | "outline" | "ghost" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  small?: boolean;
}) {
  const c = useColors();
  const bg =
    variant === "gold"
      ? c.accent
      : variant === "primary"
        ? c.primary
        : variant === "destructive"
          ? c.destructive
          : "transparent";
  const fg =
    variant === "gold"
      ? "#0F1729"
      : variant === "primary"
        ? c.primaryForeground
        : variant === "destructive"
          ? c.destructiveForeground
          : variant === "outline"
            ? c.foreground
            : c.mutedForeground;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: R,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: c.border,
          paddingVertical: small ? 8 : 14,
          paddingHorizontal: small ? 14 : 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Feather name={icon} size={small ? 14 : 17} color={fg} />
      ) : null}
      <Text style={{ color: fg, fontFamily: "Inter_600SemiBold", fontSize: small ? 13 : 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        backgroundColor: active ? c.accent : c.secondary,
        borderRadius: 999,
        paddingVertical: 7,
        paddingHorizontal: 14,
      }}
    >
      <Text
        style={{
          color: active ? "#0F1729" : c.secondaryForeground,
          fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: c.secondary,
        borderRadius: R,
        padding: 4,
        marginBottom: 16,
      }}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: R - 5,
              backgroundColor: active ? c.card : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: active ? c.foreground : c.mutedForeground,
                fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                fontSize: 14,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LuxeInput(props: TextInputProps) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.mutedForeground}
      {...props}
      style={[
        {
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.input,
          borderRadius: R - 4,
          paddingVertical: 12,
          paddingHorizontal: 14,
          fontSize: 15,
          fontFamily: "Inter_400Regular",
          color: c.foreground,
        },
        props.style,
      ]}
    />
  );
}

export function Stepper({
  label,
  value,
  display,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: number;
  display?: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const c = useColors();
  return (
    <View style={styles.stepperRow}>
      <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={onDecrement}
          hitSlop={8}
          style={[styles.stepBtn, { backgroundColor: c.secondary }]}
        >
          <Feather name="minus" size={16} color={c.foreground} />
        </Pressable>
        <Text
          style={{
            color: c.foreground,
            fontFamily: "Inter_600SemiBold",
            fontSize: 15,
            minWidth: 52,
            textAlign: "center",
          }}
        >
          {display ?? String(value)}
        </Text>
        <Pressable
          onPress={onIncrement}
          hitSlop={8}
          style={[styles.stepBtn, { backgroundColor: c.accent }]}
        >
          <Feather name="plus" size={16} color="#0F1729" />
        </Pressable>
      </View>
    </View>
  );
}

export function LoadingView() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
      <ActivityIndicator size="large" color={c.accent} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.background,
        padding: 32,
        gap: 16,
      }}
    >
      <Feather name="alert-circle" size={32} color={c.mutedForeground} />
      <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }}>
        {message}
      </Text>
      {onRetry ? <LuxeButton label="Try again" onPress={onRetry} variant="outline" small /> : null}
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 24, gap: 10 }}>
      <Feather name={icon} size={26} color={c.mutedForeground} />
      <Text
        style={{
          color: c.mutedForeground,
          fontFamily: "Inter_400Regular",
          fontSize: 14,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 30,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    marginTop: 24,
    marginBottom: 10,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
