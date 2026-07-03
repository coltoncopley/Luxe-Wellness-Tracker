import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetNotificationPrefs,
  getGetNotificationPrefsQueryKey,
  useUpdateNotificationPrefs,
  useSubscribePush,
  useUnsubscribePush,
  useSendTestNotification,
  getVapidPublicKey,
  useGetMe,
  getGetMeQueryKey,
  useUpdateBirthday,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, Mail, Smartphone, Loader2, Send, Cake } from "lucide-react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function BirthdayCard() {
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const [month, setMonth] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const updateBirthday = useUpdateBirthday({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: () => toast.error("Couldn't save your birthday. Please try again."),
    },
  });

  const saved = me?.birthday ?? null;
  const savedMonth = saved ? saved.slice(0, 2) : null;
  const savedDay = saved ? saved.slice(3) : null;
  const effMonth = month ?? savedMonth;
  const effDay = day ?? savedDay;
  const maxDay = effMonth ? DAYS_IN_MONTH[Number(effMonth) - 1]! : 31;
  const dirty = effMonth !== savedMonth || effDay !== savedDay;

  function save() {
    if (!effMonth || !effDay) return;
    updateBirthday.mutate(
      { data: { birthday: `${effMonth}-${effDay.padStart(2, "0")}` } },
      {
        onSuccess: () => {
          toast.success("Birthday saved — a treat will be waiting for you! 🎂");
          setMonth(null);
          setDay(null);
        },
      },
    );
  }

  function clear() {
    updateBirthday.mutate(
      { data: { birthday: null } },
      {
        onSuccess: () => {
          toast.success("Birthday removed.");
          setMonth(null);
          setDay(null);
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Cake className="h-5 w-5 text-primary" />
          Birthday treat
        </CardTitle>
        <CardDescription>
          Tell us your birthday (month and day only) and we'll surprise you with bonus reward
          points on your special day.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label>Month</Label>
            <Select value={effMonth ?? ""} onValueChange={(v) => setMonth(v)}>
              <SelectTrigger className="w-36" data-testid="select-birthday-month">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1).padStart(2, "0")}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Day</Label>
            <Select value={effDay ?? ""} onValueChange={(v) => setDay(v)}>
              <SelectTrigger className="w-24" data-testid="select-birthday-day">
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: maxDay }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1).padStart(2, "0")}>
                    {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {dirty && effMonth && effDay && (
            <Button
              onClick={save}
              disabled={updateBirthday.isPending}
              data-testid="button-save-birthday"
            >
              Save
            </Button>
          )}
          {saved && (
            <Button variant="ghost" onClick={clear} disabled={updateBirthday.isPending}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {saved
            ? "Your birthday is saved. It's only used for your in-app treat — never shared."
            : "Optional — only the month and day, never the year."}
        </p>
      </CardContent>
    </Card>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: prefs, isLoading } = useGetNotificationPrefs({
    query: { queryKey: getGetNotificationPrefsQueryKey() },
  });
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const updatePrefs = useUpdateNotificationPrefs({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetNotificationPrefsQueryKey(), data);
      },
      onError: () => toast.error("Could not save your preferences. Please try again."),
    },
  });
  const subscribePush = useSubscribePush();
  const unsubscribePush = useUnsubscribePush();
  const sendTest = useSendTestNotification({
    mutation: {
      onSuccess: (result) => {
        if (result.push || result.email) {
          const parts = [];
          if (result.push) parts.push("push notification");
          if (result.email) parts.push("email");
          toast.success(`Test ${parts.join(" and ")} sent! Check your device${result.email ? " and inbox" : ""}.`);
        } else {
          toast.info("Nothing was sent — turn on push or email notifications first.");
        }
      },
      onError: () => toast.error("Could not send the test. Please try again."),
    },
  });

  async function enablePush(): Promise<void> {
    if (!pushSupported()) {
      toast.error("Push notifications aren't supported in this browser.");
      return;
    }
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications are blocked. Allow them in your browser settings to enable push.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await getVapidPublicKey();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }
      let json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        toast.error("Could not set up push on this device.");
        return;
      }
      try {
        await subscribePush.mutateAsync({
          data: {
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          },
        });
      } catch (err: unknown) {
        const status = (err as { status?: number } | null)?.status;
        if (status !== 409) throw err;
        // Endpoint belonged to a different account (shared device) — create a
        // fresh browser subscription and register that instead.
        await subscription.unsubscribe();
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
        json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          toast.error("Could not set up push on this device.");
          return;
        }
        await subscribePush.mutateAsync({
          data: {
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          },
        });
      }
      await updatePrefs.mutateAsync({ data: { pushEnabled: true } });
      toast.success("Push notifications are on for this device!");
    } catch {
      toast.error("Something went wrong enabling push notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush(): Promise<void> {
    setPushBusy(true);
    try {
      if (pushSupported()) {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await unsubscribePush.mutateAsync({ data: { endpoint: subscription.endpoint } });
          await subscription.unsubscribe();
        }
      }
      await updatePrefs.mutateAsync({ data: { pushEnabled: false } });
      toast.success("Push notifications turned off.");
    } catch {
      toast.error("Something went wrong turning off push.");
    } finally {
      setPushBusy(false);
    }
  }

  function saveEmail(): void {
    const value = emailDraft?.trim() ?? "";
    updatePrefs.mutate(
      { data: { emailOverride: value === "" ? null : value } },
      {
        onSuccess: () => {
          toast.success("Notification email updated.");
          setEmailDraft(null);
        },
      },
    );
  }

  if (isLoading || !prefs) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const effectiveEmail = prefs.emailOverride ?? prefs.accountEmail ?? "";

  const topics: Array<{
    key: "announcements" | "habitReminders" | "streakAlerts" | "weeklySummary" | "treatmentReminders";
    label: string;
    description: string;
  }> = [
    {
      key: "announcements",
      label: "Spa news & specials",
      description: "New announcements, offers, and events from LUXE",
    },
    {
      key: "habitReminders",
      label: "Daily habit reminders",
      description: "A morning nudge to log your check-in, meals, and weigh-in",
    },
    {
      key: "streakAlerts",
      label: "Streak protection",
      description: "An evening heads-up when your streak is about to break",
    },
    {
      key: "weeklySummary",
      label: "Weekly progress summary",
      description: "Your week in review, every Sunday evening",
    },
    {
      key: "treatmentReminders",
      label: "Touch-up reminders",
      description: "A heads-up when a treatment in your Beauty Passport is due for a touch-up",
    },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-serif text-3xl font-semibold flex items-center gap-3">
          <Bell className="h-7 w-7 text-primary" />
          Notifications
        </h1>
        <p className="text-muted-foreground mt-1">
          Choose how LUXE keeps you motivated. Everything here is optional and only you control it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5 text-primary" />
            Push notifications
          </CardTitle>
          <CardDescription>
            Instant alerts on this device — even when the app is closed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="push-toggle" className="cursor-pointer">
              {prefs.pushEnabled ? "Push is on" : "Push is off"}
            </Label>
            <div className="flex items-center gap-2">
              {pushBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                id="push-toggle"
                checked={prefs.pushEnabled}
                disabled={pushBusy}
                onCheckedChange={(checked) => (checked ? void enablePush() : void disablePush())}
                data-testid="switch-push"
              />
            </div>
          </div>
          {!pushSupported() && (
            <p className="text-xs text-muted-foreground mt-3">
              This browser doesn't support push notifications. On iPhone, add the app to your home
              screen first (Share &rarr; Add to Home Screen).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-primary" />
            Email notifications
          </CardTitle>
          <CardDescription>Reminders and updates delivered to your inbox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-toggle" className="cursor-pointer">
              {prefs.emailEnabled ? "Email is on" : "Email is off"}
            </Label>
            <Switch
              id="email-toggle"
              checked={prefs.emailEnabled}
              onCheckedChange={(checked) => updatePrefs.mutate({ data: { emailEnabled: checked } })}
              data-testid="switch-email"
            />
          </div>
          {prefs.emailEnabled && (
            <div className="space-y-2">
              <Label htmlFor="notification-email">Send to</Label>
              <div className="flex gap-2">
                <Input
                  id="notification-email"
                  type="email"
                  placeholder={prefs.accountEmail ?? "you@example.com"}
                  value={emailDraft ?? effectiveEmail}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  data-testid="input-notification-email"
                />
                {emailDraft !== null && emailDraft.trim() !== effectiveEmail && (
                  <Button onClick={saveEmail} disabled={updatePrefs.isPending}>
                    Save
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {prefs.emailOverride
                  ? "Using a custom email. Clear the field and save to use your account email."
                  : "Using your account email. Enter a different address if you prefer."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What you'll hear about</CardTitle>
          <CardDescription>Applies to both push and email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {topics.map((topic, i) => (
            <div key={topic.key}>
              {i > 0 && <Separator className="my-3" />}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor={`topic-${topic.key}`} className="cursor-pointer">
                    {topic.label}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{topic.description}</p>
                </div>
                <Switch
                  id={`topic-${topic.key}`}
                  checked={prefs[topic.key]}
                  onCheckedChange={(checked) =>
                    updatePrefs.mutate({ data: { [topic.key]: checked } })
                  }
                  data-testid={`switch-topic-${topic.key}`}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Send a test notification</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Make sure everything is working on your enabled channels.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => sendTest.mutate()}
            disabled={sendTest.isPending || (!prefs.pushEnabled && !prefs.emailEnabled)}
            data-testid="button-send-test"
          >
            {sendTest.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send test
          </Button>
        </CardContent>
      </Card>

      <BirthdayCard />

      <p className="text-xs text-muted-foreground">
        Notifications never include your private health details — just friendly nudges and spa
        news. Your tracking data stays private to you.
      </p>
    </div>
  );
}
