import { useState } from "react";
import {
  useGetActivitySummary,
  useListActivities,
  useListSleepEntries,
  useListDevices,
  useCreateActivity,
  useCreateSleepEntry,
  useDeleteActivity,
  useDeleteSleepEntry,
  useConnectOura,
  useUpdateOuraSettings,
  useDisconnectOura,
  useSyncOura,
  useImportPhoneSteps,
  getGetActivitySummaryQueryKey,
  getListActivitiesQueryKey,
  getListSleepEntriesQueryKey,
  getListDevicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Footprints,
  Moon,
  Flame,
  RefreshCw,
  Trash2,
  Smartphone,
  HeartPulse,
  CircleDot,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const ACTIVITY_TYPES = [
  { key: "walk", label: "Walk" },
  { key: "run", label: "Run" },
  { key: "strength", label: "Strength" },
  { key: "yoga", label: "Yoga" },
  { key: "swim", label: "Swim" },
  { key: "cycle", label: "Cycle" },
  { key: "other", label: "Other" },
] as const;

function typeLabel(type: string): string {
  if (type === "steps") return "Steps";
  return ACTIVITY_TYPES.find((t) => t.key === type)?.label ?? "Activity";
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtSleep(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDay(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d");
  } catch {
    return dateStr;
  }
}

type ApiErr = { status?: number; data?: { error?: string } | null };

export default function ActivityPage() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState<7 | 30>(7);

  const summary = useGetActivitySummary({ days });
  const activities = useListActivities();
  const sleepEntries = useListSleepEntries();
  const devices = useListDevices();

  const createActivity = useCreateActivity();
  const deleteActivity = useDeleteActivity();
  const createSleep = useCreateSleepEntry();
  const deleteSleep = useDeleteSleepEntry();
  const connectOura = useConnectOura();
  const updateOura = useUpdateOuraSettings();
  const disconnectOura = useDisconnectOura();
  const syncOura = useSyncOura();
  useImportPhoneSteps; // phone import lives in the mobile app

  const [actType, setActType] = useState<string>("walk");
  const [actDate, setActDate] = useState(todayStr());
  const [actMinutes, setActMinutes] = useState("");
  const [actSteps, setActSteps] = useState("");
  const [sleepDate, setSleepDate] = useState(todayStr());
  const [sleepHours, setSleepHours] = useState("");
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [ouraToken, setOuraToken] = useState("");
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [removeData, setRemoveData] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetActivitySummaryQueryKey({ days: 7 }) });
    void queryClient.invalidateQueries({ queryKey: getGetActivitySummaryQueryKey({ days: 30 }) });
    void queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListSleepEntriesQueryKey() });
  };
  const invalidateDevices = () => {
    void queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
  };

  const s = summary.data;
  const oura = devices.data?.devices.find((d) => d.provider === "oura") ?? null;
  const recentActivities = (activities.data ?? []).slice(0, 12);
  const recentSleep = (sleepEntries.data ?? []).slice(0, 10);

  const chartData = (s?.series ?? []).map((d) => ({
    day: fmtDay(d.date),
    minutes: d.minutes,
    steps: d.steps,
    sleepHrs: d.sleepMin != null ? Math.round((d.sleepMin / 60) * 10) / 10 : null,
  }));

  const handleLogActivity = () => {
    const mins = parseInt(actMinutes, 10);
    if (!Number.isInteger(mins) || mins < 1 || mins > 1440) {
      toast.error("Enter how many minutes you moved (1-1440).");
      return;
    }
    const steps = actSteps.trim() ? parseInt(actSteps, 10) : null;
    if (steps != null && (!Number.isInteger(steps) || steps < 0 || steps > 200000)) {
      toast.error("Steps must be a whole number.");
      return;
    }
    createActivity.mutate(
      { data: { date: actDate, type: actType as never, durationMin: mins, steps } },
      {
        onSuccess: () => {
          setActMinutes("");
          setActSteps("");
          invalidate();
          toast.success("Activity logged!");
        },
        onError: () => toast.error("Couldn't save that. Please try again."),
      },
    );
  };

  const handleLogSleep = () => {
    const hours = parseFloat(sleepHours);
    if (!Number.isFinite(hours) || hours < 0.5 || hours > 24) {
      toast.error("Enter how many hours you slept (0.5-24).");
      return;
    }
    createSleep.mutate(
      { data: { date: sleepDate, durationMin: Math.round(hours * 60), quality: sleepQuality } },
      {
        onSuccess: () => {
          setSleepHours("");
          setSleepQuality(null);
          invalidate();
          toast.success("Sleep logged!");
        },
        onError: () => toast.error("Couldn't save that. Please try again."),
      },
    );
  };

  const handleConnectOura = () => {
    const token = ouraToken.trim();
    if (token.length < 8) {
      toast.error("Paste the personal access token from your Oura account.");
      return;
    }
    connectOura.mutate(
      { data: { token, importActivity: true, importSleep: true } },
      {
        onSuccess: () => {
          setOuraToken("");
          invalidateDevices();
          invalidate();
          toast.success("Oura connected! Sleep and activity now sync automatically each morning.");
        },
        onError: (err) => {
          const e = err as ApiErr;
          toast.error(
            e.data?.error ??
              (e.status === 429
                ? "Too many attempts — try again in a bit."
                : "Couldn't connect. Double-check the token and try again."),
          );
        },
      },
    );
  };

  const handleSyncNow = () => {
    syncOura.mutate(undefined, {
      onSuccess: (r) => {
        invalidate();
        invalidateDevices();
        toast.success(`Synced ${r.activitiesImported} activity day(s) and ${r.sleepImported} night(s).`);
      },
      onError: (err) => {
        const e = err as ApiErr;
        toast.error(e.data?.error ?? "Sync failed — try again later.");
      },
    });
  };

  const handleDisconnect = () => {
    disconnectOura.mutate(
      { params: removeData ? { removeData: true } : {} },
      {
        onSuccess: () => {
          setDisconnectOpen(false);
          setRemoveData(false);
          invalidateDevices();
          invalidate();
          toast.success(removeData ? "Oura disconnected and its data removed." : "Oura disconnected.");
        },
        onError: () => toast.error("Couldn't disconnect. Please try again."),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Activity & Sleep</h1>
          <p className="text-sm text-muted-foreground">
            Move more, sleep well — your weight loss journey's best friends.
          </p>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-sm ${
                days === d ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Footprints className="h-3.5 w-3.5" /> Active minutes
            </div>
            <div className="text-2xl font-semibold mt-1">{s ? s.totalMinutes : "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Footprints className="h-3.5 w-3.5" /> Steps
            </div>
            <div className="text-2xl font-semibold mt-1">{s ? s.totalSteps.toLocaleString() : "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Moon className="h-3.5 w-3.5" /> Avg sleep
            </div>
            <div className="text-2xl font-semibold mt-1">
              {s?.avgSleepMin != null ? fmtSleep(s.avgSleepMin) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" /> Logging streak
            </div>
            <div className="text-2xl font-semibold mt-1">
              {s ? `${s.streak} day${s.streak === 1 ? "" : "s"}` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Footprints className="h-4 w-4 text-primary" /> Daily active minutes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Moon className="h-4 w-4 text-primary" /> Sleep hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} width={30} domain={[0, 12]} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="sleepHrs"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.15)"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Log a workout or walk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActType(t.key)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    actType === t.key
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={actDate} max={todayStr()} onChange={(e) => setActDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Minutes</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="30"
                  value={actMinutes}
                  onChange={(e) => setActMinutes(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Steps (optional)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  value={actSteps}
                  onChange={(e) => setActSteps(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={handleLogActivity}
              disabled={!actMinutes.trim() || createActivity.isPending}
              className="w-full"
            >
              Save activity (+10 pts, once a day)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Log last night's sleep</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={sleepDate} max={todayStr()} onChange={(e) => setSleepDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hours slept</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  placeholder="7.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">How rested did you feel? (optional)</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setSleepQuality(sleepQuality === q ? null : q)}
                    className={`h-9 rounded-lg border text-sm transition-colors ${
                      sleepQuality === q
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={handleLogSleep}
              disabled={!sleepHours.trim() || createSleep.isPending}
              className="w-full"
            >
              Save sleep (+10 pts, once a day)
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">Connect a device</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-primary" /> Oura Ring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {oura ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Connected (token ••••{oura.tokenLast4}) ·{" "}
                    {oura.lastSyncedAt
                      ? `last synced ${format(new Date(oura.lastSyncedAt), "MMM d, h:mm a")}`
                      : "not synced yet"}
                    {oura.lastSyncStatus === "error" ? " · last sync failed" : ""}
                  </p>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Import activity</Label>
                    <Switch
                      checked={oura.importActivity}
                      onCheckedChange={(v) =>
                        updateOura.mutate(
                          { data: { importActivity: v, importSleep: oura.importSleep } },
                          { onSuccess: invalidateDevices },
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Import sleep</Label>
                    <Switch
                      checked={oura.importSleep}
                      onCheckedChange={(v) =>
                        updateOura.mutate(
                          { data: { importActivity: oura.importActivity, importSleep: v } },
                          { onSuccess: invalidateDevices },
                        )
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSyncNow} disabled={syncOura.isPending} className="flex-1">
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncOura.isPending ? "animate-spin" : ""}`} />
                      Sync now
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDisconnectOpen(true)}>
                      Disconnect
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    In the Oura app or at cloud.ouraring.com, create a{" "}
                    <span className="font-medium">Personal Access Token</span> and paste it here.
                    Sleep and activity then sync automatically each morning.
                  </p>
                  <Input
                    placeholder="Paste Oura token"
                    autoComplete="off"
                    value={ouraToken}
                    onChange={(e) => setOuraToken(e.target.value)}
                  />
                  <Button
                    onClick={handleConnectOura}
                    disabled={!ouraToken.trim() || connectOura.isPending}
                    className="w-full"
                  >
                    {connectOura.isPending ? "Connecting…" : "Connect Oura"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" /> Phone steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                In the LUXE mobile app, the Track → Move tab can read the last 7 days of steps from
                your phone's motion sensor — only when you tap, and only after you approve.
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-muted-foreground" /> Apple Health & Google Fit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Full Apple Health and Google Fit pairing is coming in the App Store version of LUXE.
                For now, phone steps and Oura cover automatic tracking.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.isError ? (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">Couldn't load your activity.</p>
                <Button variant="outline" size="sm" onClick={() => void activities.refetch()}>
                  Try again
                </Button>
              </div>
            ) : recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nothing logged yet. Add a workout above.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {recentActivities.map((a) => (
                  <div key={a.id} className="flex items-center py-2.5 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {typeLabel(a.type)}
                        {a.source !== "manual" && (
                          <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">
                            {a.source === "oura"
                              ? "Oura"
                              : a.source === "workout"
                                ? "Workout"
                                : "Phone"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDay(a.date)}
                        {a.durationMin > 0 ? ` · ${a.durationMin} min` : ""}
                        {a.steps != null ? ` · ${a.steps.toLocaleString()} steps` : ""}
                        {a.calories != null ? ` · ${a.calories} cal` : ""}
                      </div>
                    </div>
                    {a.source === "manual" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() =>
                          deleteActivity.mutate(
                            { id: a.id },
                            {
                              onSuccess: invalidate,
                              onError: () => toast.error("Couldn't delete. Please try again."),
                            },
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent sleep</CardTitle>
          </CardHeader>
          <CardContent>
            {sleepEntries.isError ? (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">Couldn't load your sleep log.</p>
                <Button variant="outline" size="sm" onClick={() => void sleepEntries.refetch()}>
                  Try again
                </Button>
              </div>
            ) : recentSleep.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No sleep logged yet. Add last night above.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {recentSleep.map((e) => (
                  <div key={e.id} className="flex items-center py-2.5 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {fmtSleep(e.durationMin)}
                        {e.source === "oura" && (
                          <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">
                            Oura
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDay(e.date)}
                        {e.score != null ? ` · score ${e.score}` : ""}
                        {e.quality != null ? ` · felt ${e.quality}/5` : ""}
                      </div>
                    </div>
                    {e.source === "manual" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() =>
                          deleteSleep.mutate(
                            { id: e.id },
                            {
                              onSuccess: invalidate,
                              onError: () => toast.error("Couldn't delete. Please try again."),
                            },
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 pb-2">
        <Lock className="h-3 w-3" />
        Device numbers are estimates from your tracker. This data is private to you — the med spa never sees it.
      </p>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect Oura?</DialogTitle>
            <DialogDescription>
              Automatic syncing will stop. You can reconnect anytime with a new token.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Also remove synced data</div>
              <div className="text-xs text-muted-foreground">
                Deletes all activity and sleep entries that came from Oura.
              </div>
            </div>
            <Switch checked={removeData} onCheckedChange={setRemoveData} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={disconnectOura.isPending}>
              {disconnectOura.isPending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
