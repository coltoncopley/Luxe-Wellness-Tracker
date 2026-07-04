import { useEffect, useState } from "react";
import {
  useGetGlowSummary,
  useUpsertGlowCheckin,
  getGetGlowSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, Flame, Droplets, Moon, Brain, Dumbbell, Beef } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-rose-500";
}

function scoreMessage(score: number): string {
  if (score >= 90) return "Radiant! You're glowing today.";
  if (score >= 75) return "Great day — keep this rhythm going.";
  if (score >= 60) return "Solid effort. A little more water or rest tomorrow?";
  if (score >= 40) return "Room to glow — small habits add up.";
  return "Be kind to yourself. Tomorrow is a fresh start.";
}

export default function Glow() {
  const queryClient = useQueryClient();
  const { data: summary, isLoading } = useGetGlowSummary();
  const upsert = useUpsertGlowCheckin();

  const [waterCups, setWaterCups] = useState(0);
  const [sleepHours, setSleepHours] = useState(7);
  const [stressLevel, setStressLevel] = useState(3);
  const [activityMinutes, setActivityMinutes] = useState(0);
  const [proteinGrams, setProteinGrams] = useState(0);
  const [skincareDone, setSkincareDone] = useState(false);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  useEffect(() => {
    const today = summary?.today;
    if (today && hydratedFor !== today.date) {
      setWaterCups(today.waterCups);
      setSleepHours(today.sleepHours);
      setStressLevel(today.stressLevel);
      setActivityMinutes(today.activityMinutes);
      setProteinGrams(today.proteinGrams);
      setSkincareDone(today.skincareDone);
      setHydratedFor(today.date);
    } else if (summary && !today && hydratedFor !== null) {
      setWaterCups(0);
      setSleepHours(7);
      setStressLevel(3);
      setActivityMinutes(0);
      setProteinGrams(0);
      setSkincareDone(false);
      setHydratedFor(null);
    }
  }, [summary, hydratedFor]);

  async function handleSave() {
    try {
      const saved = await upsert.mutateAsync({
        data: { waterCups, sleepHours, stressLevel, activityMinutes, proteinGrams, skincareDone },
      });
      await queryClient.invalidateQueries({ queryKey: getGetGlowSummaryQueryKey() });
      toast.success(`Glow Score: ${saved.score} — ${scoreMessage(saved.score)}`);
    } catch {
      toast.error("Couldn't save your check-in. Please try again.");
    }
  }

  const todayScore = summary?.today?.score ?? null;
  const streak = summary?.streakDays ?? 0;
  const chartData =
    summary?.history.map((h) => ({
      ...h,
      label: new Date(`${h.date}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    })) ?? [];

  if (isLoading) {
    return <div className="h-full flex items-center justify-center">Loading your glow...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl font-semibold flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          Daily Glow Score
        </h1>
        <p className="text-muted-foreground mt-1">
          One score for your whole day — hydration, sleep, stress, movement, protein, and skincare.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Glow
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            {todayScore != null ? (
              <>
                <div className={`text-6xl font-serif font-semibold ${scoreColor(todayScore)}`}>
                  {todayScore}
                </div>
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {scoreMessage(todayScore)}
                </p>
              </>
            ) : (
              <>
                <div className="text-6xl font-serif font-semibold text-muted-foreground">—</div>
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Check in below to get today's score
                </p>
              </>
            )}
            <div className="flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-primary/10">
              <Flame className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {streak} day{streak === 1 ? "" : "s"} streak
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last 14 days
            </CardTitle>
          </CardHeader>
          <CardContent className="h-52">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="glowGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#glowGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Your glow trend will appear after a couple of check-ins
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl">Today's Check-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <CheckinSlider
            icon={<Droplets className="h-5 w-5 text-sky-500" />}
            label="Water"
            value={waterCups}
            display={`${waterCups} cup${waterCups === 1 ? "" : "s"}`}
            hint="Aim for 8"
            min={0}
            max={16}
            step={1}
            onChange={setWaterCups}
          />
          <CheckinSlider
            icon={<Moon className="h-5 w-5 text-indigo-500" />}
            label="Sleep"
            value={sleepHours}
            display={`${sleepHours} hr${sleepHours === 1 ? "" : "s"}`}
            hint="7–9 hours is ideal"
            min={0}
            max={12}
            step={0.5}
            onChange={setSleepHours}
          />
          <CheckinSlider
            icon={<Brain className="h-5 w-5 text-rose-400" />}
            label="Stress"
            value={stressLevel}
            display={["", "Very low", "Low", "Moderate", "High", "Very high"][stressLevel]}
            hint="Lower is better"
            min={1}
            max={5}
            step={1}
            onChange={setStressLevel}
          />
          <CheckinSlider
            icon={<Dumbbell className="h-5 w-5 text-emerald-600" />}
            label="Activity"
            value={activityMinutes}
            display={`${activityMinutes} min`}
            hint="30+ minutes"
            min={0}
            max={120}
            step={5}
            onChange={setActivityMinutes}
          />
          <CheckinSlider
            icon={<Beef className="h-5 w-5 text-amber-700" />}
            label="Protein"
            value={proteinGrams}
            display={`${proteinGrams} g`}
            hint="100g+ daily"
            min={0}
            max={200}
            step={5}
            onChange={setProteinGrams}
          />

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <Label htmlFor="skincare" className="font-medium">
                  Skincare routine done
                </Label>
                <p className="text-xs text-muted-foreground">Cleanse, moisturize, SPF</p>
              </div>
            </div>
            <Switch id="skincare" checked={skincareDone} onCheckedChange={setSkincareDone} />
          </div>

          <Button
            className="w-full rounded-xl h-12 text-base"
            onClick={() => void handleSave()}
            disabled={upsert.isPending}
          >
            {upsert.isPending
              ? "Saving..."
              : summary?.today
                ? "Update today's check-in"
                : "Get my Glow Score"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CheckinSlider({
  icon,
  label,
  value,
  display,
  hint,
  min,
  max,
  step,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  display: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">({hint})</span>
        </div>
        <span className="text-sm font-semibold text-primary">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange(vals[0])}
      />
    </div>
  );
}
