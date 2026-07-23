import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { getBarcodeProduct, type BarcodeProduct } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, RotateCcw, ScanBarcode } from "lucide-react";
import { NutritionFactsLabel } from "@/components/nutrition-facts-label";
import { useLogMenuItem, MEAL_TYPES } from "@/hooks/use-log-menu-item";

type Status = "scanning" | "looking" | "found" | "notfound" | "unavailable";

const BARCODE_HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E],
  ],
]);

/**
 * Scan a packaged food's barcode (camera or typed) → Open Food Facts nutrition
 * → one-tap log via the shared menu-item hook.
 */
export function BarcodeScannerDialog({
  open,
  onOpenChange,
  date,
  initialMealType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  initialMealType: string;
}) {
  const { logMenuItem, isPending } = useLogMenuItem();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("scanning");
  const [cameraError, setCameraError] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [mealType, setMealType] = useState(initialMealType);

  // Reset everything each time the dialog opens.
  useEffect(() => {
    if (open) {
      setStatus("scanning");
      setCameraError(false);
      setManualCode("");
      setProduct(null);
      setMealType(initialMealType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lookup = async (code: string) => {
    setStatus("looking");
    try {
      const p = await getBarcodeProduct(code);
      setProduct(p);
      setStatus("found");
    } catch (e) {
      const httpStatus =
        typeof e === "object" && e !== null && "status" in e
          ? (e as { status?: unknown }).status
          : null;
      setStatus(httpStatus === 404 || httpStatus === 400 ? "notfound" : "unavailable");
    }
  };

  // Live camera decoding while in "scanning" state.
  useEffect(() => {
    if (!open || status !== "scanning" || cameraError) return;
    const video = videoRef.current;
    if (!video) return;

    const reader = new BrowserMultiFormatReader(BARCODE_HINTS);
    let controls: IScannerControls | null = null;
    let done = false;

    reader
      .decodeFromConstraints({ video: { facingMode: "environment" } }, video, (result) => {
        if (!result || done) return;
        const digits = result.getText().replace(/\D/g, "");
        if (digits.length < 6 || digits.length > 14) return;
        done = true;
        controls?.stop();
        void lookup(digits);
      })
      .then((c) => {
        controls = c;
        if (done) c.stop();
      })
      .catch(() => {
        if (!done) setCameraError(true);
      });

    return () => {
      done = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status, cameraError]);

  const handleManualLookup = () => {
    const digits = manualCode.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 14) {
      setStatus("notfound");
      return;
    }
    void lookup(digits);
  };

  const handleAdd = () => {
    if (!product) return;
    logMenuItem(
      {
        name: product.name,
        restaurantName: product.brand ?? undefined,
        calories: product.calories,
        proteinG: product.proteinG,
        carbsG: product.carbsG,
        fatG: product.fatG,
        satFatG: product.satFatG,
        fiberG: product.fiberG,
        sugarG: product.sugarG,
        sodiumMg: product.sodiumMg,
        servingSize: product.servingSize,
      },
      { date, mealType, onSuccess: () => onOpenChange(false) },
    );
  };

  const servingLabel = product
    ? product.perServing
      ? `Per serving${product.servingSize ? ` · ${product.servingSize}` : ""}`
      : "Per 100 g"
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <ScanBarcode className="w-5 h-5" /> Scan a Barcode
          </DialogTitle>
          <DialogDescription>
            Point your camera at a package's barcode, or type the number under it.
          </DialogDescription>
        </DialogHeader>

        {status === "scanning" && (
          <div className="space-y-3">
            {cameraError ? (
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground text-center">
                Camera unavailable — allow camera access, or type the barcode number below.
              </div>
            ) : (
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full aspect-video object-cover rounded-xl bg-black"
              />
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="barcode-manual" className="text-xs text-muted-foreground">
                  Barcode number
                </Label>
                <Input
                  id="barcode-manual"
                  inputMode="numeric"
                  placeholder="e.g. 049000006346"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleManualLookup();
                    }
                  }}
                  className="mt-1"
                />
              </div>
              <Button
                variant="secondary"
                onClick={handleManualLookup}
                disabled={manualCode.replace(/\D/g, "").length < 6}
              >
                Look up
              </Button>
            </div>
          </div>
        )}

        {status === "looking" && (
          <div className="py-10 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            Looking up product…
          </div>
        )}

        {(status === "notfound" || status === "unavailable") && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground text-center">
              {status === "notfound"
                ? "We couldn't find that barcode. You can try again or add the food manually."
                : "The barcode database is temporarily unavailable. Please try again in a moment."}
            </div>
            <Button variant="outline" className="w-full" onClick={() => setStatus("scanning")}>
              <RotateCcw className="w-4 h-4 mr-2" /> Scan again
            </Button>
          </div>
        )}

        {status === "found" && product && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-16 h-16 rounded-lg object-cover border border-border shrink-0"
                />
              )}
              <div className="min-w-0">
                <div className="font-medium leading-tight">{product.name}</div>
                {product.brand && (
                  <div className="text-sm text-muted-foreground mt-0.5">{product.brand}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  Nutrition from Open Food Facts · {product.perServing ? "per serving" : "per 100 g"}
                </div>
              </div>
            </div>

            <NutritionFactsLabel
              servingLabel={servingLabel}
              values={{
                calories: product.calories,
                proteinG: product.proteinG,
                carbsG: product.carbsG,
                fatG: product.fatG,
                satFatG: product.satFatG,
                fiberG: product.fiberG,
                sugarG: product.sugarG,
                sodiumMg: product.sodiumMg,
                cholesterolMg: null,
              }}
            />

            <div className="flex items-center gap-2">
              <Label htmlFor="barcode-meal" className="text-xs text-muted-foreground shrink-0">
                Log to
              </Label>
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger id="barcode-meal" className="h-8 text-sm capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStatus("scanning")}>
                <RotateCcw className="w-4 h-4 mr-2" /> Scan again
              </Button>
              <Button className="flex-1" onClick={handleAdd} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Add to log
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
