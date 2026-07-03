import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  useGetBillingStatus,
  getGetBillingStatusQueryKey,
  useCreateBillingCheckout,
  useCreateBillingPortal,
  useRedeemMembershipCode,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Loader2,
  Check,
  Camera,
  MessageCircle,
  TrendingDown,
  Gift,
  Sun,
  Users,
} from "lucide-react";
import logoUrl from "@assets/brand/luxe_logo.jpeg";

const FEATURES = [
  { icon: TrendingDown, label: "GLP-1 weight & measurement tracking" },
  { icon: Camera, label: "AI meal scanner & food logging" },
  { icon: Sun, label: "Daily Glow Score & habit streaks" },
  { icon: MessageCircle, label: "Luxe AI — 24/7 wellness assistant" },
  { icon: Gift, label: "Earn points, redeem real treatment perks" },
  { icon: Users, label: "Friends, cheers & shared journeys" },
];

function readBillingParam(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("billing");
    if (value) {
      params.delete("billing");
      const rest = params.toString();
      const url = window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash;
      window.history.replaceState(null, "", url);
    }
    return value;
  } catch {
    return null;
  }
}

function FullScreenSpinner({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}

function RedeemCodeSection() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  const redeem = useRedeemMembershipCode({
    mutation: {
      onSuccess: (result) => {
        toast.success(
          result.kind === "unlimited"
            ? "Code accepted — you now have free access!"
            : "Code accepted — you have 6 months of free access!",
        );
        void queryClient.invalidateQueries({ queryKey: getGetBillingStatusQueryKey() });
      },
      onError: (err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        toast.error(
          status === 429
            ? "Too many attempts — please wait a minute and try again."
            : "That code is not valid or has already been used.",
        );
      },
    },
  });

  if (!open) {
    return (
      <Button
        variant="ghost"
        className="w-full text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
        data-testid="button-have-code"
      >
        Have an access code?
      </Button>
    );
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim().length < 4 || redeem.isPending) return;
        redeem.mutate({ data: { code: code.trim() } });
      }}
    >
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="LW-XXXX-XXXX"
        className="flex-1 font-mono uppercase"
        maxLength={40}
        autoFocus
        data-testid="input-access-code"
      />
      <Button
        type="submit"
        variant="secondary"
        disabled={redeem.isPending || code.trim().length < 4}
        data-testid="button-redeem-code"
      >
        {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
      </Button>
    </form>
  );
}

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [billingParam] = useState<string | null>(() => readBillingParam());
  const [activationStart] = useState(() => Date.now());
  const [activationTimedOut, setActivationTimedOut] = useState(false);
  const canceledToastShown = useRef(false);

  const statusQuery = useGetBillingStatus({
    query: {
      queryKey: getGetBillingStatusQueryKey(),
      staleTime: 30_000,
    },
  });

  const status = statusQuery.data?.status;
  const exempt = statusQuery.data?.exempt === true;
  const isMember = exempt || status === "trialing" || status === "active";

  // Just returned from Stripe checkout: webhook sync can lag a few seconds,
  // so poll until the membership shows up (max 60s).
  const waitingForActivation =
    billingParam === "success" && !isMember && !activationTimedOut && !statusQuery.isError;

  useEffect(() => {
    if (!waitingForActivation) return;
    const interval = setInterval(() => {
      if (Date.now() - activationStart > 60_000) {
        setActivationTimedOut(true);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: getGetBillingStatusQueryKey() });
    }, 2_000);
    return () => clearInterval(interval);
  }, [waitingForActivation, activationStart, queryClient]);

  useEffect(() => {
    if (billingParam === "success" && isMember) {
      toast.success("Welcome to LUXE Membership! Your free trial has started.");
    }
    if (billingParam === "canceled" && !canceledToastShown.current) {
      canceledToastShown.current = true;
      toast.info("Checkout canceled — you can start your membership anytime.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingParam, isMember]);

  const checkout = useCreateBillingCheckout({
    mutation: {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
      onError: () => {
        toast.error("Could not start checkout. Please try again.");
      },
    },
  });

  const portal = useCreateBillingPortal({
    mutation: {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
      onError: () => {
        toast.error("Could not open billing settings. Please try again.");
      },
    },
  });

  const priceLabel = useMemo(() => {
    const cents = statusQuery.data?.priceCents ?? 499;
    return `$${(cents / 100).toFixed(2)}`;
  }, [statusQuery.data?.priceCents]);

  if (statusQuery.isLoading) {
    return <FullScreenSpinner />;
  }

  if (statusQuery.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">
          We couldn't check your membership. Please try again.
        </p>
        <Button variant="outline" onClick={() => void statusQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (isMember) {
    return <>{children}</>;
  }

  if (waitingForActivation) {
    return <FullScreenSpinner message="Activating your membership…" />;
  }

  const isPastDue = status === "past_due";
  const isReturning = status === "canceled" || status === "past_due" || status === "incomplete";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background via-background to-primary/5 px-4 py-10">
      <Card className="w-full max-w-md overflow-hidden border-primary/20 shadow-lg">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center">
            <img
              src={logoUrl}
              alt="LUXE Wellness & Aesthetics"
              className="h-16 w-16 rounded-full object-cover"
            />
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              LUXE Membership
            </div>
            <h1 className="mt-3 font-serif text-2xl font-semibold tracking-tight">
              {isPastDue ? "Payment needs attention" : "Your wellness journey starts here"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isPastDue
                ? "Your last payment didn't go through. Update your payment method to keep your membership active."
                : isReturning
                  ? "Restart your membership to pick up right where you left off."
                  : `Try everything free for 30 days, then ${priceLabel}/month. Cancel anytime.`}
            </p>
          </div>

          <ul className="mt-6 space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </span>
                {label}
              </li>
            ))}
          </ul>

          <div className="mt-7 space-y-3">
            {isPastDue ? (
              <Button
                className="w-full"
                size="lg"
                disabled={portal.isPending}
                onClick={() => portal.mutate()}
                data-testid="button-fix-payment"
              >
                {portal.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update payment method"
                )}
              </Button>
            ) : (
              <Button
                className="w-full"
                size="lg"
                disabled={checkout.isPending}
                onClick={() => checkout.mutate()}
                data-testid="button-start-membership"
              >
                {checkout.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isReturning ? (
                  `Restart membership — ${priceLabel}/month`
                ) : (
                  "Start 30-day free trial"
                )}
              </Button>
            )}
            {!isPastDue && !isReturning ? (
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary" />
                {priceLabel}/month after trial · cancel anytime
              </p>
            ) : null}
            {isReturning && !isPastDue ? (
              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                disabled={portal.isPending}
                onClick={() => portal.mutate()}
                data-testid="button-billing-settings"
              >
                Billing settings
              </Button>
            ) : null}
            {!isPastDue ? <RedeemCodeSection /> : null}
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            LUXE team member?{" "}
            <Link href="/staff" className="underline" data-testid="link-staff-access">
              Staff sign-in
            </Link>
          </p>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
            Secure payment by Stripe. By subscribing you agree to our{" "}
            <a href={`${import.meta.env.BASE_URL}terms`} className="underline">
              Terms
            </a>{" "}
            and{" "}
            <a href={`${import.meta.env.BASE_URL}privacy`} className="underline">
              Privacy Policy
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
