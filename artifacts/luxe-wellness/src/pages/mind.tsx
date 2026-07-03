import { useEffect, useState } from "react";
import {
  useGetMindSummary,
  useUpsertMindCheckin,
  getGetMindSummaryQueryKey,
  getGetRewardsSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HeartHandshake, Flame, Lock, Wind, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const MOOD_OPTIONS = ["😞", "🙁", "😐", "🙂", "😄"];
const LEVEL_LABELS = ["Very low", "Low", "Okay", "Good", "Great"];
const STRESS_LABELS = ["Very calm", "Calm", "Okay", "Stressed", "Very stressed"];

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-rose-500";
}

function scoreMessage(score: number): string {
  if (score >= 85) return "Beautifully balanced today.";
  if (score >= 65) return "You're doing well — keep tending to yourself.";
  if (score >= 45) return "A gentle day. A few deep breaths might help.";
  return "Be extra kind to yourself today. You're not alone.";
}

function ScalePicker({
  label,
  value,
  onChange,
  labels,
  emojis,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  labels: string[];
  emojis?: string[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{labels[value - 1]}</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-10 rounded-lg border text-sm transition-colors ${
              value === n
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/40"
            }`}
          >
            {emojis ? emojis[n - 1] : n}
          </button>
        ))}
      </div>
    </div>
  );
}

const BREATH_PHASES = [
  { name: "Breathe in", seconds: 4, scale: 1 },
  { name: "Hold", seconds: 4, scale: 1 },
  { name: "Breathe out", seconds: 6, scale: 0.6 },
] as const;

function BreathingExercise() {
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [cyclesDone, setCyclesDone] = useState(0);

  useEffect(() => {
    if (!running) return;
    const phase = BREATH_PHASES[phaseIdx]!;
    const t = setTimeout(() => {
      const next = (phaseIdx + 1) % BREATH_PHASES.length;
      setPhaseIdx(next);
      if (next === 0) setCyclesDone((c) => c + 1);
    }, phase.seconds * 1000);
    return () => clearTimeout(t);
  }, [running, phaseIdx]);

  const phase = BREATH_PHASES[phaseIdx]!;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Wind className="h-4 w-4 text-primary" /> One-minute breathing
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 pb-6">
        <div className="relative flex items-center justify-center h-40 w-40">
          <div
            className="absolute rounded-full bg-primary/15 border border-primary/30 transition-transform ease-in-out"
            style={{
              height: 160,
              width: 160,
              transform: `scale(${running ? phase.scale : 0.75})`,
              transitionDuration: running ? `${phase.seconds}s` : "0.5s",
            }}
          />
          <div className="relative text-center">
            <div className="font-medium text-primary">
              {running ? phase.name : "Ready?"}
            </div>
            {running && (
              <div className="text-xs text-muted-foreground mt-1">
                {cyclesDone} {cyclesDone === 1 ? "cycle" : "cycles"} done
              </div>
            )}
          </div>
        </div>
        <Button
          variant={running ? "outline" : "default"}
          className="rounded-full"
          onClick={() => {
            setRunning((r) => !r);
            setPhaseIdx(0);
            if (!running) setCyclesDone(0);
          }}
        >
          {running ? "Stop" : "Start breathing"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Follow the circle: in for 4, hold for 4, out for 6. A few cycles can calm your nervous
          system.
        </p>
      </CardContent>
    </Card>
  );
}

export default function Mind() {
  const queryClient = useQueryClient();
  const { data: summary, isLoading } = useGetMindSummary();
  const upsert = useUpsertMindCheckin();

  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [anxiety, setAnxiety] = useState(3);
  const [gratitude, setGratitude] = useState("");
  const [journal, setJournal] = useState("");
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  useEffect(() => {
    const today = summary?.today;
    if (today && hydratedFor !== today.date) {
      setMood(today.mood);
      setEnergy(today.energy);
      setStress(today.stress);
      setAnxiety(today.anxiety);
      setGratitude(today.gratitude ?? "");
      setJournal(today.journal ?? "");
      setHydratedFor(today.date);
    }
  }, [summary, hydratedFor]);

  const todayScore = summary?.today?.score ?? null;
  const streak = summary?.streakDays ?? 0;
  const chartData = (summary?.history ?? []).map((h) => ({
    ...h,
    label: format(new Date(`${h.date}T00:00:00`), "MMM d"),
  }));

  function handleSave() {
    upsert.mutate(
      {
        data: {
          mood,
          energy,
          stress,
          anxiety,
          gratitude: gratitude.trim() || null,
          journal: journal.trim() || null,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetMindSummaryQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetRewardsSummaryQueryKey() });
          toast.success("Check-in saved. Thanks for taking a moment for yourself.");
        },
        onError: () => toast.error("Couldn't save. Please try again."),
      },
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <HeartHandshake className="h-8 w-8" /> Mind
        </h1>
        <p className="text-muted-foreground text-lg">
          A quiet daily moment for your mental wellness — mood, gratitude, and a breath.
        </p>
        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> Completely private to you. This is a self-care tool, not
          medical care — if you're struggling, please reach out to your doctor or call/text 988.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className={`text-4xl font-semibold ${todayScore !== null ? scoreColor(todayScore) : "text-muted-foreground"}`}>
              {todayScore !== null ? todayScore : "—"}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Calm Score today</div>
            {todayScore !== null && (
              <div className="text-xs text-muted-foreground mt-1">{scoreMessage(todayScore)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-4xl font-semibold text-primary flex items-center justify-center gap-1.5">
              <Flame className="h-7 w-7 text-orange-500" /> {streak}
            </div>
            <div className="text-sm text-muted-foreground mt-1">day streak</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-4xl font-semibold text-primary flex items-center justify-center gap-1.5">
              <Sparkles className="h-7 w-7" /> +15
            </div>
            <div className="text-sm text-muted-foreground mt-1">points per daily check-in</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-lg">Today's check-in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ScalePicker label="Mood" value={mood} onChange={setMood} labels={LEVEL_LABELS} emojis={MOOD_OPTIONS} />
            <ScalePicker label="Energy" value={energy} onChange={setEnergy} labels={LEVEL_LABELS} />
            <ScalePicker label="Stress" value={stress} onChange={setStress} labels={STRESS_LABELS} />
            <ScalePicker label="Anxiety" value={anxiety} onChange={setAnxiety} labels={STRESS_LABELS} />
            <div className="space-y-1.5">
              <Label>One thing I'm grateful for</Label>
              <Textarea
                placeholder="Even something tiny counts..."
                value={gratitude}
                onChange={(e) => setGratitude(e.target.value)}
                maxLength={1000}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Journal (optional)</Label>
              <Textarea
                placeholder="Anything on your mind today?"
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                maxLength={4000}
                rows={3}
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="w-full rounded-full"
            >
              {upsert.isPending
                ? "Saving..."
                : summary?.today
                  ? "Update today's check-in"
                  : "Save check-in (+15 pts)"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <BreathingExercise />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">14-day Calm trend</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-muted-foreground text-sm">Loading...</div>
              ) : chartData.length < 2 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Check in a couple of days in a row and your trend will appear here.
                </p>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="calmFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="score"
                        name="Calm Score"
                        stroke="hsl(var(--primary))"
                        fill="url(#calmFill)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
