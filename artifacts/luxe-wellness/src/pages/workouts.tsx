import { useState } from "react";
import {
  useListWorkouts,
  getListWorkoutsQueryKey,
  useCreateWorkout,
  useGenerateWorkout,
  getGetMuscleRecoveryQueryKey,
  type WorkoutListItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Dumbbell, Sparkles, Plus, Settings2, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { RecoveryTab } from "@/components/workouts/RecoveryTab";
import { LibraryTab } from "@/components/workouts/LibraryTab";
import { PreferencesDialog } from "@/components/workouts/PreferencesDialog";
import { WorkoutDetailView } from "@/components/workouts/WorkoutDetailView";

function fmtDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function WorkoutRow({
  workout,
  onOpen,
}: {
  workout: WorkoutListItem;
  onOpen: (id: number) => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/40 transition-colors"
      onClick={() => onOpen(workout.id)}
      data-testid={`workout-row-${workout.id}`}
    >
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium truncate">{workout.title}</p>
            {workout.source === "ai" && (
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                AI
              </Badge>
            )}
            {workout.status === "completed" && (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(workout.date)} · {workout.exerciseCount}{" "}
            {workout.exerciseCount === 1 ? "exercise" : "exercises"}
            {workout.setCount > 0 ? ` · ${workout.setCount} sets logged` : ""}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
}

export default function Workouts() {
  const queryClient = useQueryClient();
  const { data: workouts, isLoading } = useListWorkouts(undefined, {
    query: { queryKey: getListWorkoutsQueryKey() },
  });
  const createWorkout = useCreateWorkout();
  const generate = useGenerateWorkout();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const today = new Date().toLocaleDateString("en-CA");
  const todays = (workouts ?? []).filter((w) => w.date === today);
  const past = (workouts ?? []).filter((w) => w.date !== today);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetMuscleRecoveryQueryKey() });
  };

  const runGenerate = () => {
    generate.mutate(undefined, {
      onSuccess: (result) => {
        refresh();
        setSelectedId(result.workout.id);
        toast.success("Your workout is ready!");
      },
      onError: (err) => {
        const e = err as { status?: number; data?: { error?: string } };
        if (e.status === 429) {
          toast.error(e.data?.error ?? "You've used today's AI workouts — more unlock tomorrow!");
        } else {
          toast.error("Couldn't build your workout just now. Please try again in a moment.");
        }
      },
    });
  };

  const runCreate = () => {
    const title = newTitle.trim();
    if (title.length === 0) {
      toast.error("Give your workout a name.");
      return;
    }
    createWorkout.mutate(
      { data: { date: today, title } },
      {
        onSuccess: (w) => {
          refresh();
          setCreateOpen(false);
          setNewTitle("");
          setSelectedId(w.id);
        },
        onError: () => toast.error("Couldn't create the workout."),
      },
    );
  };

  if (selectedId != null) {
    return (
      <div className="space-y-6 pb-12 max-w-3xl">
        <WorkoutDetailView workoutId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
            <Dumbbell className="h-8 w-8" />
            Workouts
          </h1>
          <p className="text-muted-foreground text-lg">
            Log your training, watch your recovery, and let Luxe AI build your next session.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full shrink-0"
          onClick={() => setPrefsOpen(true)}
          data-testid="button-open-preferences"
        >
          <Settings2 className="h-4 w-4 mr-1.5" />
          Preferences
        </Button>
      </div>

      <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        Workouts here are general fitness guidance, not medical advice. Stop if anything hurts,
        and check with Dr. Copley before training around an injury or health condition.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          className="rounded-full flex-1"
          disabled={generate.isPending}
          onClick={runGenerate}
          data-testid="button-generate-workout"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {generate.isPending ? "Building your workout…" : "Build me a workout"}
        </Button>
        <Button
          variant="outline"
          className="rounded-full flex-1"
          onClick={() => setCreateOpen(true)}
          data-testid="button-create-workout"
        >
          <Plus className="mr-2 h-4 w-4" />
          Start from scratch
        </Button>
      </div>
      {generate.isPending && (
        <p className="text-xs text-muted-foreground -mt-4 text-center">
          Luxe AI is picking exercises around your recovery — this takes about 30 seconds.
        </p>
      )}

      <Tabs defaultValue="today">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today" data-testid="tab-today">
            Today
          </TabsTrigger>
          <TabsTrigger value="recovery" data-testid="tab-recovery">
            Recovery
          </TabsTrigger>
          <TabsTrigger value="library" data-testid="tab-library">
            Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-6 mt-4">
          <div className="space-y-2">
            {isLoading ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Loading your workouts...
                </CardContent>
              </Card>
            ) : todays.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center space-y-2">
                  <Dumbbell className="h-8 w-8 text-primary mx-auto" />
                  <p className="font-serif text-lg">No workout today yet</p>
                  <p className="text-sm text-muted-foreground">
                    Let Luxe AI build one for you, or start from scratch.
                  </p>
                </CardContent>
              </Card>
            ) : (
              todays.map((w) => <WorkoutRow key={w.id} workout={w} onOpen={setSelectedId} />)
            )}
          </div>

          {past.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-serif text-xl">History</h2>
              {past.map((w) => (
                <WorkoutRow key={w.id} workout={w} onOpen={setSelectedId} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recovery" className="mt-4">
          <RecoveryTab />
        </TabsContent>

        <TabsContent value="library" className="mt-4">
          <LibraryTab />
        </TabsContent>
      </Tabs>

      <PreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New workout</DialogTitle>
            <DialogDescription>Name today's session — you'll add exercises next.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="e.g. Upper body day"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={120}
            onKeyDown={(e) => {
              if (e.key === "Enter") runCreate();
            }}
            data-testid="input-workout-title"
          />
          <DialogFooter>
            <Button
              onClick={runCreate}
              disabled={createWorkout.isPending}
              className="rounded-full"
              data-testid="button-confirm-create"
            >
              {createWorkout.isPending ? "Creating..." : "Create workout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
