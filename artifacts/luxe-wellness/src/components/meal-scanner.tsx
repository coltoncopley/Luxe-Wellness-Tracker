import { useRef, useState } from "react";
import { apiErrorMessage } from "@/lib/utils";
import { useAnalyzeMealPhoto } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { NutritionFactsLabel } from "@/components/nutrition-facts-label";

const MAX_DIMENSION = 1280;

type Analysis = {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  satFatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  cholesterolMg: number;
  confidence: string;
  notes: string;
};

async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function MealScanner({
  onLog,
  isLogging,
}: {
  onLog: (analysis: Analysis, mealType: string) => void;
  isLogging: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mealType, setMealType] = useState("lunch");
  const inputRef = useRef<HTMLInputElement>(null);
  const analyze = useAnalyzeMealPhoto();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setAnalysis(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      const result = await analyze.mutateAsync({ data: { imageDataUrl: dataUrl } });
      setAnalysis(result);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't analyze that photo. Please try again."));
      setPreview(null);
    }
  }

  function reset() {
    setPreview(null);
    setAnalysis(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" className="rounded-full shadow-md">
          <Camera className="w-4 h-4 mr-2" /> Scan a Meal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> AI Meal Scanner
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />

          {!preview && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full h-44 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Camera className="w-8 h-8" />
              <span className="text-sm font-medium">Take or upload a photo of your meal</span>
              <span className="text-xs">AI estimates calories, protein, carbs & fat</span>
            </button>
          )}

          {preview && (
            <div className="relative">
              <img
                src={preview}
                alt="Meal preview"
                className="w-full h-44 object-cover rounded-2xl"
              />
              {analyze.isPending && (
                <div className="absolute inset-0 rounded-2xl bg-background/70 flex flex-col items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                  <span className="text-sm font-medium">Analyzing your meal...</span>
                </div>
              )}
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{analysis.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {analysis.confidence} confidence estimate
                    </div>
                  </div>
                </div>
                <NutritionFactsLabel
                  values={{
                    calories: analysis.calories,
                    proteinG: analysis.proteinG,
                    carbsG: analysis.carbsG,
                    fatG: analysis.fatG,
                    satFatG: analysis.satFatG,
                    fiberG: analysis.fiberG,
                    sugarG: analysis.sugarG,
                    sodiumMg: analysis.sodiumMg,
                    cholesterolMg: analysis.cholesterolMg,
                  }}
                />
                <p className="text-xs text-muted-foreground">{analysis.notes}</p>
              </div>

              <div className="space-y-2">
                <Label>Log as</Label>
                <Select value={mealType} onValueChange={setMealType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                    <SelectItem value="snack">Snack</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    reset();
                    inputRef.current?.click();
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Retake
                </Button>
                <Button
                  className="flex-1"
                  disabled={isLogging}
                  onClick={() => {
                    onLog(analysis, mealType);
                    setOpen(false);
                    reset();
                  }}
                >
                  {isLogging ? "Logging..." : "Log this meal"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
