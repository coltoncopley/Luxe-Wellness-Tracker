import { useSignIn, useSSO } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import { type Href, Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
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

const NAVY = "#0A0A0A";
const GOLD = "#FFFFFF";
const CREAM = "#FAFAFA";
const MUTED = "#A3A3A3";
const FIELD = "#161616";
const BORDER = "#262626";

// Preloads the browser for Android devices to reduce authentication load time
const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  useWarmUpBrowser();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsEmailCode, setNeedsEmailCode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);

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
    const { error } = await signIn.password({ emailAddress: emailAddress.trim(), password });
    if (error) {
      setFormError(error.message ?? "Sign in failed. Please try again.");
      return;
    }
    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: navigateHome });
    } else if (signIn.status === "needs_client_trust") {
      const emailCodeFactor = signIn.supportedSecondFactors.find(
        (factor) => factor.strategy === "email_code",
      );
      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode();
        setNeedsEmailCode(true);
      }
    } else {
      setFormError("Additional verification is required. Please sign in on the website first.");
    }
  };

  const handleVerify = async () => {
    setFormError(null);
    await signIn.mfa.verifyEmailCode({ code: code.trim() });
    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: navigateHome });
    } else {
      setFormError("Verification failed. Please try again.");
    }
  };

  const handleGoogle = useCallback(async () => {
    setFormError(null);
    setSsoLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async ({ session, decorateUrl }) => {
            navigateHome({ session, decorateUrl });
          },
        });
      }
    } catch {
      setFormError("Google sign-in was cancelled or failed.");
    } finally {
      setSsoLoading(false);
    }
  }, [startSSOFlow, navigateHome]);

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

        {needsEmailCode ? (
          <>
            <Text style={styles.heading}>Check your email</Text>
            <Text style={styles.sub}>Enter the verification code we sent you.</Text>
            <TextInput
              style={styles.input}
              value={code}
              placeholder="Verification code"
              placeholderTextColor={MUTED}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoFocus
            />
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <Pressable style={[styles.goldBtn, busy && styles.disabled]} onPress={handleVerify} disabled={busy}>
              {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.goldBtnText}>Verify</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.heading}>Welcome back</Text>

            <Pressable
              style={[styles.googleBtn, ssoLoading && styles.disabled]}
              onPress={handleGoogle}
              disabled={ssoLoading}
            >
              {ssoLoading ? (
                <ActivityIndicator color={CREAM} />
              ) : (
                <>
                  <Feather name="log-in" size={17} color={CREAM} />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

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
            {errors.fields.identifier ? (
              <Text style={styles.error}>{errors.fields.identifier.message}</Text>
            ) : null}
            {errors.fields.password ? (
              <Text style={styles.error}>{errors.fields.password.message}</Text>
            ) : null}
            {formError ? <Text style={styles.error}>{formError}</Text> : null}

            <Pressable
              style={[styles.goldBtn, (busy || !emailAddress || !password) && styles.disabled]}
              onPress={handleSubmit}
              disabled={busy || !emailAddress || !password}
            >
              {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.goldBtnText}>Sign in</Text>}
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>New to LUXE?</Text>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable hitSlop={8}>
                  <Text style={styles.footerLink}>Create an account</Text>
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
  googleBtn: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: FIELD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  googleBtnText: {
    color: CREAM,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 18,
  },
  divider: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { color: MUTED, fontFamily: "Inter_400Regular", fontSize: 13 },
  error: {
    color: "#F87171",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginBottom: 8,
  },
  disabled: { opacity: 0.5 },
  footerRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: { color: MUTED, fontFamily: "Inter_400Regular", fontSize: 14 },
  footerLink: { color: GOLD, fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
