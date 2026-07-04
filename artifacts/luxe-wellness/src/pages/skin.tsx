import { useRef, useState } from "react";
import { apiErrorMessage } from "@/lib/utils";
import {
  useGetSkinScanHistory,
  getGetSkinScanHistoryQueryKey,
  useAnalyzeSkinScan,
  getGetRewardsSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScanFace, Camera, Lock, Sparkles, TrendingUp, CalendarCheck2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

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

const SCORE_LABELS: { key: "hydration" | "smoothness" | "evenness" | "clarity" | "radiance"; label: string }[] = [
  { key: "hydration", label: "Hydration" },
  { key: "smoothness", label: "Smoothness" },
  { key: "evenness", label: "Even tone" },
  { key: "clarity", label: "Clarity" },
  { key: "radiance", label: "Radiance" },
];

function scoreWord(n: number): string {
  if (n >= 85) return "Excellent";
  if (n >= 70) return "Great";
  if (n >= 55) return "Good";
  return "Needs love";
}

export default function Skin() {
  const queryClient = useQueryClient();
  const { data: history, isLoading } = useGetSkinScanHistory();
  const analyze = useAnalyzeSkinScan();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const scans = history?.scans ?? [];
  const latest = scans.length > 0 ? scans[scans.length - 1]! : null;
  const currentWeekScanned = history?.currentWeekScanned ?? false;

  async function handleFile(file: File) {
    setScanning(true);
    setScanError(null);
    try {
      const imageDataUrl = await fileToDataUrl(file);
      await analyze.mutateAsync({ data: { imageDataUrl } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetSkinScanHistoryQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetRewardsSummaryQueryKey() }),
      ]);
      toast.success("Skin scan complete! (+25 pts for this week's scan)");
    } catch (err) {
      const message = apiErrorMessage(err, "Couldn't analyze the photo. Please try again.");
      setScanError(message);
      toast.error(message);
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const chartData = scans.map((s) => ({
    week: format(new Date(`${s.weekStart}T00:00:00`), "MMM d"),
    Overall: s.overall,
  }));

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <ScanFace className="h-8 w-8" /> Skin Scan
        </h1>
        <p className="text-muted-foreground text-lg">
          A weekly AI check-in on your skin — hydration, texture, tone, and glow.
        </p>
        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> Your scans are private to you — never shared with
          LUXE staff. Cosmetic guidance only, not medical advice.
        </p>
      </div>

      <Card className={currentWeekScanned ? "" : "border-primary/50"}>
        <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {currentWeekScanned ? (
              <CalendarCheck2 className="h-8 w-8 text-primary" />
            ) : (
              <Camera className="h-8 w-8 text-primary" />
            )}
            <div>
              <div className="font-medium">
                {currentWeekScanned
                  ? "This week's scan is done"
                  : "Ready for this week's scan?"}
              </div>
              <div className="text-sm text-muted-foreground">
                {currentWeekScanned
                  ? "You can rescan anytime — it replaces this week's result."
                  : "Take a well-lit selfie facing the camera, no makeup if possible. Earn +25 pts."}
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
            {scanning ? "Analyzing..." : currentWeekScanned ? "Rescan" : "Scan my skin"}
          </Button>
        </CardContent>
      </Card>

      {scanError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {scanError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-muted-foreground">Loading your scans...</div>
      ) : latest ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1 bg-primary text-primary-foreground">
              <CardContent className="py-8 flex flex-col items-center">
                <div className="text-5xl font-serif font-semibold">{latest.overall}</div>
                <div className="text-sm mt-1 opacity-90">skin score</div>
                <div className="text-xs mt-1 opacity-75">{scoreWord(latest.overall)}</div>
                <div className="text-xs mt-3 opacity-75">
                  Scanned {format(new Date(`${latest.scannedOn}T00:00:00`), "MMM d")}
                </div>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {SCORE_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm w-28 shrink-0">{label}</span>
                    <Progress value={latest[key]} className="h-2 flex-1" />
                    <span className="text-sm font-semibold text-primary w-8 text-right">
                      {latest[key]}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" /> What the AI noticed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">{latest.summary}</p>
              <div>
                <div className="text-sm font-medium mb-2">Tips for this week</div>
                <ul className="space-y-1.5">
                  {latest.tips.map((tip, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
              {latest.suggestion && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                  <div className="text-sm">{latest.suggestion}</div>
                  <Button
                    asChild
                    size="sm"
                    variant="link"
                    className="px-0 h-auto mt-1 text-primary"
                  >
                    <a href={BOOKING_URL} target="_blank" rel="noreferrer">
                      Book a visit at LUXE →
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {scans.length >= 2 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-primary" /> Your trend
                </CardTitle>
                <CardDescription>Overall skin score by week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="Overall"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No scans yet. Take your first selfie scan — your weekly trend starts here.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
