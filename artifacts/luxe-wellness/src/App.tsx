import { useEffect, useRef } from "react";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { useClaimReferral, getGetRewardsSummaryQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { PrivacyAckDialog } from "@/components/PrivacyAckDialog";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Book from "@/pages/book";
import Weight from "@/pages/weight";
import Food from "@/pages/food";
import Restaurants from "@/pages/restaurants";
import LuxeAI from "@/pages/luxe-ai";
import Glow from "@/pages/glow";
import Bhrt from "@/pages/bhrt";
import Rewards from "@/pages/rewards";
import Friends from "@/pages/friends";
import Photos from "@/pages/photos";
import Skin from "@/pages/skin";
import Ingredients from "@/pages/ingredients";
import Passport from "@/pages/passport";
import Mind from "@/pages/mind";
import ActivityPage from "@/pages/activity";
import Community from "@/pages/community";
import Settings from "@/pages/settings";
import StaffVerify from "@/pages/staff-verify";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Support from "@/pages/support";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const REF_STORAGE_KEY = "luxe_pending_ref";

(() => {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && ref.trim()) {
      localStorage.setItem(REF_STORAGE_KEY, ref.trim().toUpperCase());
    }
  } catch {
    // ignore storage errors
  }
})();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(222 47% 11%)",
    colorForeground: "hsl(222 47% 11%)",
    colorMutedForeground: "hsl(215 16% 47%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(40 25% 97%)",
    colorInputForeground: "hsl(222 47% 11%)",
    colorNeutral: "hsl(222 30% 30%)",
    fontFamily: "'Lexend', sans-serif",
    borderRadius: "0.9rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-[hsl(40,15%,90%)]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-serif text-[hsl(222,47%,11%)]",
    headerSubtitle: "text-[hsl(215,16%,47%)]",
    socialButtonsBlockButtonText: "text-[hsl(222,47%,11%)] font-medium",
    formFieldLabel: "text-[hsl(222,47%,11%)]",
    footerActionLink: "text-[hsl(43,60%,38%)] hover:text-[hsl(43,60%,30%)] font-medium",
    footerActionText: "text-[hsl(215,16%,47%)]",
    dividerText: "text-[hsl(215,16%,47%)]",
    identityPreviewEditButton: "text-[hsl(43,60%,38%)]",
    formFieldSuccessText: "text-emerald-600",
    alertText: "text-[hsl(222,47%,11%)]",
    logoBox: "justify-center",
    logoImage: "h-10",
    socialButtonsBlockButton: "border border-[hsl(40,15%,88%)] bg-white hover:bg-[hsl(40,25%,97%)]",
    formButtonPrimary: "bg-[hsl(222,47%,11%)] hover:bg-[hsl(222,47%,18%)] text-white",
    formFieldInput: "bg-[hsl(40,25%,97%)] border-[hsl(40,15%,88%)]",
    footerAction: "justify-center",
    dividerLine: "bg-[hsl(40,15%,90%)]",
    alert: "bg-[hsl(40,25%,97%)] border border-[hsl(40,15%,88%)]",
    otpCodeFieldInput: "border-[hsl(40,15%,80%)] text-[hsl(222,47%,11%)]",
    formFieldRow: "gap-2",
    main: "gap-6",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ReferralClaimer() {
  const claim = useClaimReferral();
  const qc = useQueryClient();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    let code: string | null = null;
    try {
      code = localStorage.getItem(REF_STORAGE_KEY);
    } catch {
      return;
    }
    if (!code) return;
    attemptedRef.current = true;
    claim.mutate(
      { data: { code } },
      {
        onSuccess: (result) => {
          try {
            localStorage.removeItem(REF_STORAGE_KEY);
          } catch {
            // ignore
          }
          if (result.claimed) {
            toast.success(`Welcome bonus! You earned ${result.pointsAwarded} LUXE points 🎉`);
            void qc.invalidateQueries({ queryKey: getGetRewardsSummaryQueryKey() });
          }
        },
      },
    );
  }, [claim, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <SubscriptionGate>
          <Layout>
            <Dashboard />
          </Layout>
        </SubscriptionGate>
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function Protected({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <SubscriptionGate>
          <Layout>
            <Component />
          </Layout>
        </SubscriptionGate>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function PublicPage({ component: Component }: { component: React.ComponentType }) {
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back to LUXE",
            subtitle: "Sign in to your patient companion",
          },
        },
        signUp: {
          start: {
            title: "Join LUXE Wellness",
            subtitle: "Create your patient account to start tracking your journey",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Show when="signed-in">
          <ReferralClaimer />
          <PrivacyAckDialog />
        </Show>
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/book">{() => <Protected component={Book} />}</Route>
            <Route path="/weight">{() => <Protected component={Weight} />}</Route>
            <Route path="/food">{() => <Protected component={Food} />}</Route>
            <Route path="/restaurants">{() => <Protected component={Restaurants} />}</Route>
            <Route path="/luxe-ai">{() => <Protected component={LuxeAI} />}</Route>
            <Route path="/glow">{() => <Protected component={Glow} />}</Route>
            <Route path="/bhrt">{() => <Protected component={Bhrt} />}</Route>
            <Route path="/rewards">{() => <Protected component={Rewards} />}</Route>
            <Route path="/friends">{() => <Protected component={Friends} />}</Route>
            <Route path="/photos">{() => <Protected component={Photos} />}</Route>
            <Route path="/skin">{() => <Protected component={Skin} />}</Route>
            <Route path="/ingredients">{() => <Protected component={Ingredients} />}</Route>
            <Route path="/passport">{() => <Protected component={Passport} />}</Route>
            <Route path="/mind">{() => <Protected component={Mind} />}</Route>
            <Route path="/activity">{() => <Protected component={ActivityPage} />}</Route>
            <Route path="/community">{() => <Protected component={Community} />}</Route>
            <Route path="/settings">{() => <Protected component={Settings} />}</Route>
            <Route path="/staff">{() => <Protected component={StaffVerify} />}</Route>
            <Route path="/privacy">{() => <PublicPage component={Privacy} />}</Route>
            <Route path="/terms">{() => <PublicPage component={Terms} />}</Route>
            <Route path="/support">{() => <PublicPage component={Support} />}</Route>
            <Route>{() => <PublicPage component={NotFound} />}</Route>
          </Switch>
          <Toaster />
          <SonnerToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
