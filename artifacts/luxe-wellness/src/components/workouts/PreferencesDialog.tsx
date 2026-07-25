import { useEffect, useState } from "react";
import {
  useGetWorkoutPreferences,
  getGetWorkoutPreferencesQueryKey,
  useSetWorkoutPreferences,
  type WorkoutPreferencesInput,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { GOAL_LABELS, EXPERIENCE_LABELS, EQUIPMENT_LABELS } from "./labels";

type Goal = NonNullable<WorkoutPreferencesInput["goal"]>;
type Experience = NonNullable<WorkoutPreferencesInput["experienceLevel"]>;

export function PreferencesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: prefs } = useGetWorkoutPreferences({
    query: { queryKey: getGetWorkoutPreferencesQueryKey(), enabled: open },
  });
  const save = useSetWorkoutPreferences();

  const [goal, setGoal] = useState<Goal>("build_muscle");
  const [experience, setExperience] = useState<Experience>("beginner");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [duration, setDuration] = useState(45);
  const [days, setDays] = useState(3);
  const [limitations, setLimitations] = useState("");

  useEffect(() => {
    if (!prefs) return;
    setGoal(prefs.goal as Goal);
    setExperience(prefs.experienceLevel as Experience);
    setEquipment(prefs.equipment);
    setDuration(prefs.targetDurationMins);
    setDays(prefs.daysPerWeek);
    setLimitations(prefs.limitations ?? "");
  }, [prefs]);

  const toggleEquipment = (key: string) => {
    setEquipment((prev) =>
      prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key],
    );
  };

  const onSave = () => {
    save.mutate(
      {
        data: {
          goal,
          experienceLevel: experience,
          equipment: equipment as WorkoutPreferencesInput["equipment"],
          targetDurationMins: Math.min(Math.max(duration, 10), 120),
          daysPerWeek: Math.min(Math.max(days, 1), 7),
          limitations: limitations.trim().length > 0 ? limitations.trim().slice(0, 500) : null,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getGetWorkoutPreferencesQueryKey() });
          toast.success("Workout preferences saved");
          onOpenChange(false);
        },
        onError: () => toast.error("Couldn't save your preferences. Please try again."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Workout preferences</DialogTitle>
          <DialogDescription>
            Luxe AI uses these to build workouts that fit you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Goal</Label>
              <Select value={goal} onValueChange={(v) => setGoal(v as Goal)}>
                <SelectTrigger data-testid="select-goal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Experience</Label>
              <Select value={experience} onValueChange={(v) => setExperience(v as Experience)}>
                <SelectTrigger data-testid="select-experience">
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
          </div>

          <div className="space-y-2">
            <Label>Equipment you have</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(EQUIPMENT_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={equipment.includes(key)}
                    onCheckedChange={() => toggleEquipment(key)}
                    data-testid={`checkbox-equipment-${key}`}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Leave everything unchecked to allow all equipment.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Session length (minutes)</Label>
              <Input
                type="number"
                min={10}
                max={120}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                data-testid="input-duration"
              />
            </div>
            <div className="space-y-2">
              <Label>Days per week</Label>
              <Input
                type="number"
                min={1}
                max={7}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                data-testid="input-days"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Anything to work around? (optional)</Label>
            <Textarea
              placeholder="e.g. sore knees, no overhead pressing"
              value={limitations}
              onChange={(e) => setLimitations(e.target.value)}
              maxLength={500}
              data-testid="input-limitations"
            />
            <p className="text-xs text-muted-foreground">
              For injuries or medical concerns, please check with Dr. Copley before training.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onSave}
            disabled={save.isPending}
            className="rounded-full"
            data-testid="button-save-preferences"
          >
            {save.isPending ? "Saving..." : "Save preferences"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
