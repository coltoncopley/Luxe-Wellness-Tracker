import { useState } from "react";
import {
  useGetWorkout,
  getGetWorkoutQueryKey,
  getListWorkoutsQueryKey,
  getGetMuscleRecoveryQueryKey,
  useCompleteWorkout,
  useDeleteWorkout,
  useRemoveWorkoutExercise,
  useLogWorkoutSet,
  useDeleteWorkoutSet,
  useAddWorkoutExercise,
  useGetExerciseSuggestion,
  getGetExerciseSuggestionQueryKey,
  type WorkoutExercise,
  type Exercise,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle2,
  Trash2,
  Plus,
  Sparkles,
  Lightbulb,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { muscleLabel, equipmentLabel } from "./labels";
import { LibraryTab } from "./LibraryTab";

function SuggestionHint({ exerciseId }: { exerciseId: number }) {
  const { data } = useGetExerciseSuggestion(exerciseId, {
    query: { queryKey: getGetExerciseSuggestionQueryKey(exerciseId) },
  });
  if (!data) return null;
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
      <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      {data.basis}
    </p>
  );
}

function ExerciseBlock({
  we,
  workoutId,
  completed,
}: {
  we: WorkoutExercise;
  workoutId: number;
  completed: boolean;
}) {
  const queryClient = useQueryClient();
  const logSet = useLogWorkoutSet();
  const deleteSet = useDeleteWorkoutSet();
  const removeExercise = useRemoveWorkoutExercise();
  const [reps, setReps] = useState(we.targetReps != null ? String(we.targetReps) : "10");
  const [weight, setWeight] = useState(
    we.targetWeightLbs != null ? String(we.targetWeightLbs) : "",
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getGetWorkoutQueryKey(workoutId) });
    void queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
  };

  const onLogSet = () => {
    const repsN = Number(reps);
    if (!Number.isFinite(repsN) || repsN < 1) {
      toast.error("Enter how many reps you did.");
      return;
    }
    const weightN = weight.trim() === "" ? null : Number(weight);
    if (weightN != null && (!Number.isFinite(weightN) || weightN < 0)) {
      toast.error("Weight must be a positive number.");
      return;
    }
    logSet.mutate(
      { id: we.id, data: { reps: Math.round(repsN), weightLbs: weightN } },
      {
        onSuccess: refresh,
        onError: () => toast.error("Couldn't log that set. Please try again."),
      },
    );
  };

  const target =
    we.targetSets != null && we.targetReps != null
      ? `Target: ${we.targetSets} sets × ${we.targetReps} reps${we.targetWeightLbs != null ? ` @ ${we.targetWeightLbs} lbs` : ""}`
      : null;

  return (
    <Card data-testid={`workout-exercise-${we.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">{we.exercise.name}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <Badge variant="secondary" className="text-xs">
                {muscleLabel(we.exercise.primaryMuscle)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {equipmentLabel(we.exercise.equipment)}
              </Badge>
            </div>
            {target && <p className="text-xs text-muted-foreground mt-1">{target}</p>}
            {!completed && <SuggestionHint exerciseId={we.exerciseId} />}
          </div>
          {!completed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                removeExercise.mutate(
                  { id: we.id },
                  {
                    onSuccess: refresh,
                    onError: () => toast.error("Couldn't remove that exercise."),
                  },
                )
              }
              data-testid={`button-remove-exercise-${we.id}`}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>

        {we.sets.length > 0 && (
          <div className="space-y-1.5">
            {we.sets.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-1.5"
                data-testid={`workout-set-${s.id}`}
              >
                <span>
                  Set {s.setNumber}: {s.reps} reps
                  {s.weightLbs != null ? ` @ ${s.weightLbs} lbs` : ""}
                </span>
                {!completed && (
                  <button
                    onClick={() =>
                      deleteSet.mutate(
                        { id: s.id },
                        {
                          onSuccess: refresh,
                          onError: () => toast.error("Couldn't delete that set."),
                        },
                      )
                    }
                    className="text-muted-foreground hover:text-foreground"
                    data-testid={`button-delete-set-${s.id}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!completed && (
          <div className="flex items-end gap-2">
            <div className="w-24">
              <label className="text-xs text-muted-foreground">Reps</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                data-testid={`input-reps-${we.id}`}
              />
            </div>
            <div className="w-28">
              <label className="text-xs text-muted-foreground">Weight (lbs)</label>
              <Input
                type="number"
                min={0}
                max={1500}
                placeholder="—"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                data-testid={`input-weight-${we.id}`}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={logSet.isPending}
              onClick={onLogSet}
              data-testid={`button-log-set-${we.id}`}
            >
              <Plus className="h-4 w-4 mr-1" />
              Log set
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WorkoutDetailView({
  workoutId,
  onBack,
}: {
  workoutId: number;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: workout, isLoading } = useGetWorkout(workoutId, {
    query: { queryKey: getGetWorkoutQueryKey(workoutId) },
  });
  const complete = useCompleteWorkout();
  const deleteWorkout = useDeleteWorkout();
  const addExercise = useAddWorkoutExercise();
  const [addOpen, setAddOpen] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getGetWorkoutQueryKey(workoutId) });
    void queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetMuscleRecoveryQueryKey() });
  };

  if (isLoading || !workout) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          {isLoading ? "Loading workout..." : "Workout not found."}
        </CardContent>
      </Card>
    );
  }

  const completed = workout.status === "completed";
  const loggedSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);

  const onAddFromLibrary = (exercise: Exercise) => {
    addExercise.mutate(
      { id: workoutId, data: { exerciseId: exercise.id } },
      {
        onSuccess: () => {
          refresh();
          setAddOpen(false);
          toast.success(`${exercise.name} added`);
        },
        onError: () => toast.error("Couldn't add that exercise."),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-workouts">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {!completed && (
            <Button
              size="sm"
              className="rounded-full"
              disabled={complete.isPending || loggedSets === 0}
              onClick={() =>
                complete.mutate(
                  { id: workoutId },
                  {
                    onSuccess: () => {
                      refresh();
                      toast.success("Workout complete — nice work! +25 LUXE points");
                    },
                    onError: () => toast.error("Couldn't complete the workout."),
                  },
                )
              }
              data-testid="button-complete-workout"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Finish workout
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              deleteWorkout.mutate(
                { id: workoutId },
                {
                  onSuccess: () => {
                    void queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
                    void queryClient.invalidateQueries({
                      queryKey: getGetMuscleRecoveryQueryKey(),
                    });
                    toast.success("Workout deleted");
                    onBack();
                  },
                  onError: () => toast.error("Couldn't delete the workout."),
                },
              )
            }
            data-testid="button-delete-workout"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-serif text-2xl">{workout.title}</h2>
          {workout.source === "ai" && (
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Luxe AI
            </Badge>
          )}
          {completed && (
            <Badge className="text-xs bg-emerald-600 hover:bg-emerald-600">Completed</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date(`${workout.date}T12:00:00`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        {workout.aiRationale && (
          <p className="text-sm text-muted-foreground mt-2 bg-muted/50 rounded-lg p-3">
            {workout.aiRationale}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {workout.exercises.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No exercises yet — add some from the library below.
            </CardContent>
          </Card>
        ) : (
          workout.exercises.map((we) => (
            <ExerciseBlock key={we.id} we={we} workoutId={workoutId} completed={completed} />
          ))
        )}
      </div>

      {!completed && (
        <Button
          variant="outline"
          className="rounded-full w-full"
          onClick={() => setAddOpen(true)}
          data-testid="button-open-add-exercise"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add exercise
        </Button>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add an exercise</DialogTitle>
          </DialogHeader>
          <LibraryTab onAddToWorkout={onAddFromLibrary} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
