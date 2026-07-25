import { useMemo, useState } from "react";
import {
  useListExercises,
  getListExercisesQueryKey,
  type Exercise,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, ChevronUp, Plus, PlayCircle } from "lucide-react";
import { MUSCLE_LABELS, muscleLabel, equipmentLabel, howToVideoUrl } from "./labels";

export function LibraryTab({
  onAddToWorkout,
}: {
  onAddToWorkout?: (exercise: Exercise) => void;
}) {
  const { data: exercises, isLoading } = useListExercises({
    query: { queryKey: getListExercisesQueryKey() },
  });
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

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
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      data-testid={`button-how-to-${e.id}`}
                    >
                      <a href={howToVideoUrl(e.name)} target="_blank" rel="noopener noreferrer">
                        <PlayCircle className="h-4 w-4 mr-1.5" />
                        Watch how-to
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
