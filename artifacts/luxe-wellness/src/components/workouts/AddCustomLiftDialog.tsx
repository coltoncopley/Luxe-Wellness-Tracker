import { useState } from "react";
import {
  useCreateCustomExercise,
  getListExercisesQueryKey,
  type CustomExerciseInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MUSCLE_LABELS, EQUIPMENT_LABELS, EXPERIENCE_LABELS } from "./labels";

type Muscle = NonNullable<CustomExerciseInput["primaryMuscle"]>;
type Equipment = NonNullable<CustomExerciseInput["equipment"]>;
type Difficulty = NonNullable<CustomExerciseInput["difficulty"]>;

const errStatus = (e: unknown): number | undefined =>
  typeof e === "object" && e !== null && "status" in e
    ? (e as { status?: number }).status
    : undefined;

export function AddCustomLiftDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const create = useCreateCustomExercise();

  const [name, setName] = useState("");
  const [primaryMuscle, setPrimaryMuscle] = useState<Muscle>("chest");
  const [equipment, setEquipment] = useState<Equipment>("dumbbell");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [secondary, setSecondary] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");

  const reset = () => {
    setName("");
    setPrimaryMuscle("chest");
    setEquipment("dumbbell");
    setDifficulty("beginner");
    setSecondary([]);
    setInstructions("");
  };

  const toggleSecondary = (key: string) => {
    setSecondary((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    );
  };

  const onSubmit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Please enter an exercise name (at least 2 characters).");
      return;
    }
    create.mutate(
      {
        data: {
          name: trimmed,
          primaryMuscle,
          equipment,
          difficulty,
          secondaryMuscles: secondary.filter(
            (m) => m !== primaryMuscle,
          ) as CustomExerciseInput["secondaryMuscles"],
          instructions:
            instructions.trim().length > 0 ? instructions.trim().slice(0, 500) : undefined,
        },
      },
      {
        onSuccess: (created) => {
          void queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
          toast.success(
            created.howToVideoId
              ? `"${created.name}" added — with a how-to video ready to watch.`
              : `"${created.name}" added to your library.`,
          );
          reset();
          onOpenChange(false);
        },
        onError: (e) => {
          const status = errStatus(e);
          if (status === 409) {
            toast.error("You already have a lift with this name.");
          } else if (status === 429) {
            toast.error("You've hit today's limit for adding lifts — try again tomorrow.");
          } else {
            toast.error("Couldn't add your lift. Please try again.");
          }
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Add your own lift</DialogTitle>
          <DialogDescription>
            Create a private exercise only you can see. We'll try to find a how-to video for it
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Exercise name</Label>
            <Input
              placeholder="e.g. Bulgarian Split Squat"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              data-testid="input-custom-lift-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Main muscle</Label>
              <Select value={primaryMuscle} onValueChange={(v) => setPrimaryMuscle(v as Muscle)}>
                <SelectTrigger data-testid="select-custom-lift-muscle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MUSCLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Equipment</Label>
              <Select value={equipment} onValueChange={(v) => setEquipment(v as Equipment)}>
                <SelectTrigger data-testid="select-custom-lift-equipment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUIPMENT_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger data-testid="select-custom-lift-difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPERIENCE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Also works (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(MUSCLE_LABELS)
                .filter(([key]) => key !== primaryMuscle)
                .map(([key, label]) => (
                  <Badge
                    key={key}
                    variant={secondary.includes(key) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleSecondary(key)}
                    data-testid={`toggle-secondary-${key}`}
                  >
                    {label}
                  </Badge>
                ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>How to do it (optional)</Label>
            <Textarea
              placeholder="A short note to remind yourself of the setup or form cues."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={500}
              data-testid="input-custom-lift-instructions"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onSubmit}
            disabled={create.isPending}
            className="rounded-full"
            data-testid="button-save-custom-lift"
          >
            {create.isPending ? "Adding..." : "Add lift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
