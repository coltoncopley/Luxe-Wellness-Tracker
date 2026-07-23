import { useRef, useState } from "react";
import { apiErrorMessage } from "@/lib/utils";
import {
  useListIngredientScans,
  getListIngredientScansQueryKey,
  useAnalyzeIngredients,
  useDeleteIngredientScan,
  getGetRewardsSummaryQueryKey,
} from "@workspace/api-client-react";
import type { IngredientScanResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FlaskConical, Camera, Lock, Check, AlertTriangle, Baby, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const MAX_DIMENSION = 1280;
const BOOKING_URL = "https://hklqy.myaestheticrecord.com/online-booking";

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

const VERDICT_STYLES: Record<string, { label: string; className: string }> = {
  great: { label: "Great pick", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  good: { label: "Good", className: "bg-sky-100 text-sky-800 border-sky-200" },
  mixed: { label: "Mixed bag", className: "bg-amber-100 text-amber-800 border-amber-200" },
  caution: { label: "Use caution", className: "bg-red-100 text-red-800 border-red-200" },
};

const PREGNANCY_LABELS: Record<string, string> = {
  generally_ok: "Generally considered OK in pregnancy",
  use_caution: "Use caution in pregnancy",
  avoid: "Often avoided in pregnancy",
  unknown: "Pregnancy safety unclear",
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const style = VERDICT_STYLES[verdict] ?? VERDICT_STYLES.mixed!;
  return (
    <Badge variant="outline" className={style.className}>
      {style.label}
    </Badge>
  );
}

function ScanDetails({ scan }: { scan: IngredientScanResult }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed">{scan.summary}</p>
      {scan.goodIngredients.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
            <Check className="h-4 w-4 text-emerald-600" /> The good stuff
          </div>
          <ul className="space-y-1">
            {scan.goodIngredients.map((g, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}
      {scan.concerns.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Worth knowing
          </div>
          <ul className="space-y-1">
            {scan.concerns.map((c, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-lg bg-muted px-3 py-2.5">
        <div className="text-sm font-medium flex items-center gap-1.5">
          <Baby className="h-4 w-4 text-primary" />
          {PREGNANCY_LABELS[scan.pregnancySafety] ?? PREGNANCY_LABELS.unknown}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{scan.pregnancyNote}</p>
      </div>
      {scan.suggestion && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="text-sm flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            {scan.suggestion}
          </div>
          <Button asChild size="sm" variant="link" className="px-0 h-auto mt-1 text-primary">
            <a href={BOOKING_URL} target="_blank" rel="noreferrer">
              Book a visit at LUXE →
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Ingredients() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListIngredientScans();
  const analyze = useAnalyzeIngredients();
  const deleteScan = useDeleteIngredientScan();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [latest, setLatest] = useState<IngredientScanResult | null>(null);

  const scans = data?.scans ?? [];
  const history = latest ? scans.filter((s) => s.id !== latest.id) : scans;

  async function handleFile(file: File) {
    setScanning(true);
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const result = await analyze.mutateAsync({ data: { imageDataUrl } });
      setLatest(result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListIngredientScansQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetRewardsSummaryQueryKey() }),
      ]);
      toast.success("Ingredient check complete!");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't analyze the photo. Please try again."));
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDelete(id: number) {
    deleteScan.mutate(
      { id },
      {
        onSuccess: () => {
          if (latest?.id === id) setLatest(null);
          void queryClient.invalidateQueries({ queryKey: getListIngredientScansQueryKey() });
          toast.success("Scan deleted");
        },
      },
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <FlaskConical className="h-8 w-8" /> Product Scan
        </h1>
        <p className="text-muted-foreground text-lg">
          Snap a product's ingredient label — the AI tells you what's great, what to watch, and
          whether it's worth it.
        </p>
        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> Your scans are private to you. Educational info only —
          not medical advice; check with your own doctor about pregnancy and sensitivities.
        </p>
      </div>

      <Card className="border-primary/50">
        <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Camera className="h-8 w-8 text-primary" />
            <div>
              <div className="font-medium">Check a product</div>
              <div className="text-sm text-muted-foreground">
                Take a clear, close-up photo of the ingredient list. Earn +5 pts (up to 2/day).
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button
            className="rounded-full"
            disabled={scanning}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-4 w-4 mr-2" />
            {scanning ? "Analyzing..." : "Scan a label"}
          </Button>
        </CardContent>
      </Card>

      {latest && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-lg">
              <span>{latest.productName}</span>
              <VerdictBadge verdict={latest.verdict} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScanDetails scan={latest} />
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-xl font-serif text-primary mb-3">Past scans</h2>
        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {latest
                ? "Your earlier scans will show up here."
                : "No scans yet. Grab a product from your bathroom shelf and check it!"}
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {history.map((scan) => (
              <AccordionItem
                key={scan.id}
                value={String(scan.id)}
                className="border rounded-xl px-4 bg-card"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center justify-between gap-3 flex-1 pr-2">
                    <div className="text-left">
                      <div className="font-medium text-sm">{scan.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(`${scan.scannedOn}T00:00:00`), "MMM d, yyyy")}
                      </div>
                    </div>
                    <VerdictBadge verdict={scan.verdict} />
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <ScanDetails scan={scan} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(scan.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                  </Button>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}
