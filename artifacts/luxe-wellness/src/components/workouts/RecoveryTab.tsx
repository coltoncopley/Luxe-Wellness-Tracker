import { useGetMuscleRecovery, getGetMuscleRecoveryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BatteryCharging } from "lucide-react";
import { muscleLabel } from "./labels";

function recoveryTone(pct: number): string {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 50) return "text-amber-600";
  return "text-rose-600";
}

function recoveryWord(pct: number): string {
  if (pct >= 95) return "Fresh";
  if (pct >= 80) return "Nearly recovered";
  if (pct >= 50) return "Recovering";
  return "Recently trained";
}

export function RecoveryTab() {
  const { data, isLoading } = useGetMuscleRecovery({
    query: { queryKey: getGetMuscleRecoveryQueryKey() },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Checking your muscle recovery...
        </CardContent>
      </Card>
    );
  }

  const muscles = data ?? [];
  const trained = muscles.filter((m) => m.lastTrainedAt != null);
  const fresh = muscles.filter((m) => m.lastTrainedAt == null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BatteryCharging className="h-5 w-5 text-primary" />
            Muscle recovery
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Muscles need about 3 days to fully recover after training. Green means ready to train
            again.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {trained.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Complete a workout and your recovery will show up here.
            </p>
          ) : (
            trained
              .sort((a, b) => a.recoveryPct - b.recoveryPct)
              .map((m) => (
                <div key={m.muscle} data-testid={`recovery-${m.muscle}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{muscleLabel(m.muscle)}</span>
                    <span className={`text-xs font-medium ${recoveryTone(m.recoveryPct)}`}>
                      {recoveryWord(m.recoveryPct)} · {m.recoveryPct}%
                    </span>
                  </div>
                  <Progress value={m.recoveryPct} className="h-2" />
                </div>
              ))
          )}
          {fresh.length > 0 && (
            <p className="text-xs text-muted-foreground pt-2">
              Fresh and ready: {fresh.map((m) => muscleLabel(m.muscle)).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
