import { useState } from "react";
import type { GenerateWorkoutInput } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import { FOCUS_AREA_OPTIONS, ENERGY_OPTIONS } from "./labels";

const DURATION_OPTIONS: { key: number; label: string }[] = [
  { key: 20, label: "Quick · ~20 min" },
  { key: 40, label: "Standard · ~40 min" },
  { key: 60, label: "Longer · ~60 min" },
];

export function GenerateWorkoutDialog({
  open,
  onOpenChange,
  onGenerate,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (input: GenerateWorkoutInput) => void;
  isPending: boolean;
}) {
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [durationMins, setDurationMins] = useState<number | null>(null);
  const [energy, setEnergy] = useState<string | null>(null);
  const [avoidToday, setAvoidToday] = useState("");

  // "Full body" clears every specific pick; picking a specific area drops full body.
  const toggleFocus = (key: string) => {
    if (key === "full_body") {
      setFocusAreas([]);
      return;
    }
    setFocusAreas((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };
  const isFocusActive = (key: string) =>
    key === "full_body" ? focusAreas.length === 0 : focusAreas.includes(key);

  const submit = () => {
    const input: GenerateWorkoutInput = {};
    if (focusAreas.length > 0) {
      input.focusAreas = focusAreas as GenerateWorkoutInput["focusAreas"];
    }
    if (durationMins != null) input.durationMins = durationMins;
    if (energy != null) input.energy = energy as GenerateWorkoutInput["energy"];
    const avoid = avoidToday.trim();
    if (avoid.length > 0) input.avoidToday = avoid.slice(0, 300);
    onGenerate(input);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Build me a workout</DialogTitle>
          <DialogDescription>
            A few quick questions so Luxe AI can tailor today's session. Everything's optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <p className="text-sm font-medium">What do you want to focus on?</p>
            <div className="flex flex-wrap gap-2">
              {FOCUS_AREA_OPTIONS.map((o) => (
                <Badge
                  key={o.key}
                  variant={isFocusActive(o.key) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleFocus(o.key)}
                  data-testid={`focus-area-${o.key}`}
                >
                  {o.label}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Pick as many areas as you like, or leave on Full body.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">How much time do you have?</p>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((o) => (
                <Badge
                  key={o.key}
                  variant={durationMins === o.key ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setDurationMins(durationMins === o.key ? null : o.key)}
                  data-testid={`duration-${o.key}`}
                >
                  {o.label}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Leave unselected to use your saved session length.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">How's your energy today?</p>
            <div className="flex flex-wrap gap-2">
              {ENERGY_OPTIONS.map((o) => (
                <Badge
                  key={o.key}
                  variant={energy === o.key ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setEnergy(energy === o.key ? null : o.key)}
                  data-testid={`energy-${o.key}`}
                >
                  {o.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Anything to work around today? (optional)</p>
            <Textarea
              placeholder="e.g. sore knees, tight on time, skip overhead pressing"
              value={avoidToday}
              onChange={(e) => setAvoidToday(e.target.value)}
              maxLength={300}
              rows={2}
              data-testid="input-avoid-today"
            />
            <p className="text-xs text-muted-foreground">
              For injuries or medical concerns, please check with Dr. Copley before training.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={submit}
            disabled={isPending}
            className="rounded-full"
            data-testid="button-confirm-generate"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {isPending ? "Building your workout…" : "Build my workout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
