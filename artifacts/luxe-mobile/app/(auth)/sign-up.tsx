import { useAuth, useSignUp } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const NAVY = "#0F1729";
const GOLD = "#E6C566";
const CREAM = "#FAF8F4";
const MUTED = "#94A3B8";
const FIELD = "#152032";
const BORDER = "#242F42";

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const busy = fetchStatus === "fetching";

  const navigateHome = useCallback(
    ({ session, decorateUrl }: { session?: { currentTask?: unknown } | null; decorateUrl: (u: string) => string }) => {
      if (session?.currentTask) return;
      const url = decorateUrl("/");
      if (url.startsWith("http")) {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.location.href = url;
        } else {
          router.replace("/(tabs)" as Href);
        }
      } else {
        router.replace(url as Href);
      }
    },
    [router],
  );

  const handleSubmit = async () => {
    setFormError(null);
    const { error } = await signUp.password({ emailAddress: emailAddress.trim(), password });
    if (error) {
      setFormError(error.message ?? "Sign up failed. Please try again.");
      return;
    }
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    setFormError(null);
    await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (signUp.status === "complete") {
      await signUp.finalize({ navigate: navigateHome });
    } else {
      setFormError("Verification failed. Please double-check the code and try again.");
    }
  };

  if (signUp.status === "complete" || isSignedIn) {
    return null;
  }

  const verifying =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: NAVY }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 28,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <Text style={styles.wordmark}>LUXE</Text>
          <Text style={styles.tagline}>Wellness & Aesthetics</Text>
        </View>

        {verifying ? (
          <>
            <Text style={styles.heading}>Verify your email</Text>
            <Text style={styles.sub}>Enter the code we sent to {emailAddress}.</Text>
            <TextInput
              style={styles.input}
              value={code}
              placeholder="Verification code"
              placeholderTextColor={MUTED}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoFocus
            />
            {errors.fields.code ? <Text style={styles.error}>{errors.fields.code.message}</Text> : null}
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <Pressable style={[styles.goldBtn, busy && styles.disabled]} onPress={handleVerify} disabled={busy}>
              {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.goldBtnText}>Verify</Text>}
            </Pressable>
            <Pressable
              style={styles.resend}
              onPress={() => signUp.verifications.sendEmailCode()}
              hitSlop={8}
            >
              <Text style={styles.footerLink}>Resend code</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.heading}>Create your account</Text>

            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={emailAddress}
              placeholder="Email address"
              placeholderTextColor={MUTED}
              onChangeText={setEmailAddress}
            />
            <TextInput
              style={styles.input}
              value={password}
              placeholder="Password"
              placeholderTextColor={MUTED}
              secureTextEntry
              onChangeText={setPassword}
            />
            {errors.fields.emailAddress ? (
              <Text style={styles.error}>{errors.fields.emailAddress.message}</Text>
            ) : null}
            {errors.fields.password ? (
              <Text style={styles.error}>{errors.fields.password.message}</Text>
            ) : null}
            {formError ? <Text style={styles.error}>{formError}</Text> : null}

            {/* Required for Clerk bot protection on web */}
            <View nativeID="clerk-captcha" />

            <Pressable
              style={[styles.goldBtn, (busy || !emailAddress || !password) && styles.disabled]}
              onPress={handleSubmit}
              disabled={busy || !emailAddress || !password}
            >
              {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.goldBtnText}>Continue</Text>}
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Link href="/(auth)/sign-in" asChild>
                <Pressable hitSlop={8}>
                  <Text style={styles.footerLink}>Sign in</Text>
                </Pressable>
              </Link>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 52,
    letterSpacing: 10,
    color: GOLD,
  },
  tagline: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    letterSpacing: 3,
    color: MUTED,
    textTransform: "uppercase",
    marginTop: 6,
  },
  heading: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 26,
    color: CREAM,
    marginBottom: 20,
    textAlign: "center",
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    backgroundColor: FIELD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: CREAM,
    marginBottom: 12,
  },
  goldBtn: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  goldBtnText: {
    color: NAVY,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  error: {
    color: "#F87171",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginBottom: 8,
  },
  disabled: { opacity: 0.5 },
  resend: { alignItems: "center", marginTop: 18 },
  footerRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: { color: MUTED, fontFamily: "Inter_400Regular", fontSize: 14 },
  footerLink: { color: GOLD, fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
