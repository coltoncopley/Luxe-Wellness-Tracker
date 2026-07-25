import { useMemo, useState } from "react";
import {
  useListExercises,
  getListExercisesQueryKey,
  useDeleteCustomExercise,
  type Exercise,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Search, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { MUSCLE_LABELS, muscleLabel, equipmentLabel } from "./labels";
import { HowToVideo } from "./HowToVideo";
import { AddCustomLiftDialog } from "./AddCustomLiftDialog";

export function LibraryTab({
  onAddToWorkout,
}: {
  onAddToWorkout?: (exercise: Exercise) => void;
}) {
  const queryClient = useQueryClient();
  const { data: exercises, isLoading } = useListExercises({
    query: { queryKey: getListExercisesQueryKey() },
  });
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const remove = useDeleteCustomExercise();

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
          toast.success("Custom lift removed.");
          setDeleteTarget(null);
        },
        onError: (e) => {
          const status =
            typeof e === "object" && e !== null && "status" in e
              ? (e as { status?: number }).status
              : undefined;
          toast.error(
            status === 409
              ? "This lift is used in a workout — remove it from your workouts first."
              : "Couldn't remove that lift. Please try again.",
          );
          setDeleteTarget(null);
        },
      },
    );
  };

  const filtered = useMemo(() => {
    const list = exercises ?? [];
    const q = search.trim().toLowerCase();
    return list.filter(
      (e) =>
        (!muscle || e.primaryMuscle === muscle) &&
        (q.length === 0 || e.name.toLowerCase().includes(q)),
    );
  }, [exercises, search, muscle]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Loading the exercise library...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Browse the full library, or add a private lift only you can see.
        </p>
        <Button
          size="sm"
          className="rounded-full shrink-0"
          onClick={() => setAddOpen(true)}
          data-testid="button-add-custom-lift"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add your own lift
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-exercise-search"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={muscle === null ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setMuscle(null)}
        >
          All
        </Badge>
        {Object.entries(MUSCLE_LABELS).map(([key, label]) => (
          <Badge
            key={key}
            variant={muscle === key ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setMuscle(muscle === key ? null : key)}
            data-testid={`filter-muscle-${key}`}
          >
            {label}
          </Badge>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No exercises match your search.
          </p>
        ) : (
          filtered.map((e) => (
            <Card key={e.id} data-testid={`exercise-card-${e.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{e.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {muscleLabel(e.primaryMuscle)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {equipmentLabel(e.equipment)}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {e.difficulty}
                      </Badge>
                      {e.isMine && (
                        <Badge className="text-xs" data-testid={`badge-mine-${e.id}`}>
                          Mine
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onAddToWorkout && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => onAddToWorkout(e)}
                        data-testid={`button-add-exercise-${e.id}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpenId(openId === e.id ? null : e.id)}
                      data-testid={`button-expand-exercise-${e.id}`}
                    >
                      {openId === e.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    {e.isMine && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(e)}
                        data-testid={`button-delete-exercise-${e.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {openId === e.id && (
                  <div className="mt-3 pt-3 border-t text-sm text-muted-foreground space-y-3">
                    <p>{e.instructions}</p>
                    {e.secondaryMuscles.length > 0 && (
                      <p className="text-xs">
                        Also works: {e.secondaryMuscles.map(muscleLabel).join(", ")}
                      </p>
                    )}
                    <HowToVideo
                      exerciseName={e.name}
                      videoId={e.howToVideoId}
                      variant="button"
                      testId={`button-how-to-${e.id}`}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AddCustomLiftDialog open={addOpen} onOpenChange={setAddOpen} />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this lift?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}” will be removed from your library. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={remove.isPending}
              data-testid="button-confirm-delete"
            >
              {remove.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
