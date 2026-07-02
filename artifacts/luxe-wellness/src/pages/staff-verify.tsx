import { useState } from "react";
import {
  lookupRedemption,
  useMarkRedemptionUsed,
  type RedemptionDetail,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, Search, CheckCircle2, XCircle, Ticket } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function StaffVerify() {
  const [codeInput, setCodeInput] = useState("");
  const [result, setResult] = useState<RedemptionDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLooking, setIsLooking] = useState(false);
  const markUsed = useMarkRedemptionUsed();

  async function handleLookup() {
    const raw = codeInput.trim();
    if (!raw) return;
    setIsLooking(true);
    setResult(null);
    setNotFound(false);
    try {
      const detail = await lookupRedemption(encodeURIComponent(raw));
      setResult(detail);
    } catch {
      setNotFound(true);
    } finally {
      setIsLooking(false);
    }
  }

  async function handleMarkUsed() {
    if (!result) return;
    try {
      const updated = await markUsed.mutateAsync({ code: encodeURIComponent(result.code) });
      setResult(updated);
      toast.success("Code marked as used");
    } catch (err) {
      const already =
        err && typeof err === "object" && "usedAt" in err ? (err as RedemptionDetail) : null;
      if (already) {
        setResult(already);
        toast.error("This code was already used");
      } else {
        toast.error("Couldn't update the code. Please try again.");
      }
    }
  }

  const isUsed = result?.usedAt != null;

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <BadgeCheck className="h-8 w-8" /> Staff Verification
        </h1>
        <p className="text-muted-foreground text-lg">
          Enter a patient's reward code to confirm it and mark it as used.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Look up a code</CardTitle>
          <CardDescription>Codes look like LUXE-K4TP-9WM2</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleLookup();
            }}
          >
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="LUXE-XXXX-XXXX"
              className="font-mono tracking-widest uppercase"
              autoFocus
            />
            <Button type="submit" disabled={isLooking || !codeInput.trim()}>
              <Search className="w-4 h-4 mr-2" />
              {isLooking ? "Checking..." : "Verify"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {notFound && (
        <Card className="border-rose-300">
          <CardContent className="py-6 flex items-center gap-3 text-rose-600">
            <XCircle className="h-6 w-6 shrink-0" />
            <div>
              <div className="font-medium">Code not found</div>
              <div className="text-sm text-muted-foreground">
                Double-check the code with the patient — it should match their Rewards history.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className={isUsed ? "border-amber-300" : "border-emerald-300"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ticket className="h-5 w-5 text-primary" />
                <span className="font-mono tracking-widest">{result.code}</span>
              </CardTitle>
              {isUsed ? (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  Already used
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                  Valid — not yet used
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border p-4 space-y-1">
              <div className="font-medium">{result.title}</div>
              <div className="text-sm text-muted-foreground">
                Redeemed for {result.points.toLocaleString()} points on{" "}
                {format(new Date(`${result.date}T00:00:00`), "MMMM d, yyyy")}
              </div>
              {isUsed && result.usedAt && (
                <div className="text-sm text-amber-700">
                  Used {format(new Date(result.usedAt), "MMMM d, yyyy 'at' h:mm a")}
                </div>
              )}
            </div>

            {!isUsed && (
              <Button
                className="w-full"
                disabled={markUsed.isPending}
                onClick={() => void handleMarkUsed()}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {markUsed.isPending ? "Updating..." : "Mark as used"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
