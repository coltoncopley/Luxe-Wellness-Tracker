import { useState } from "react";
import {
  useGetRewardsSummary,
  useRedeemReward,
  getGetRewardsSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Gift, Sparkles, Scale, Utensils, Flame, Ticket } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const EARN_RULES = [
  { icon: Sparkles, label: "Daily Glow check-in", points: "+20" },
  { icon: Scale, label: "Daily weigh-in", points: "+10" },
  { icon: Utensils, label: "Log a meal (up to 3/day)", points: "+5" },
  { icon: Flame, label: "Every 7-day Glow streak", points: "+50" },
];

export default function Rewards() {
  const queryClient = useQueryClient();
  const { data: summary, isLoading } = useGetRewardsSummary();
  const redeem = useRedeemReward();
  const [redemption, setRedemption] = useState<{ code: string; title: string } | null>(null);

  async function handleRedeem(rewardId: string, title: string) {
    try {
      const result = await redeem.mutateAsync({ data: { rewardId } });
      await queryClient.invalidateQueries({ queryKey: getGetRewardsSummaryQueryKey() });
      setRedemption({ code: result.code, title });
    } catch (err) {
      const message =
        err && typeof err === "object" && "error" in err && typeof err.error === "string"
          ? err.error
          : "Couldn't redeem right now. Please try again.";
      toast.error(message);
    }
  }

  if (isLoading) {
    return <div className="h-full flex items-center justify-center">Loading rewards...</div>;
  }

  const balance = summary?.balance ?? 0;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <Gift className="h-8 w-8" /> LUXE Rewards
        </h1>
        <p className="text-muted-foreground text-lg">
          Earn points for healthy habits. Redeem them for treatments at LUXE.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1 bg-primary text-primary-foreground">
          <CardContent className="py-8 flex flex-col items-center">
            <div className="text-5xl font-serif font-semibold">{balance}</div>
            <div className="text-sm mt-1 opacity-90">points available</div>
            <div className="text-xs mt-3 opacity-75">
              {summary?.totalEarned ?? 0} earned all-time
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              How to earn
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EARN_RULES.map((rule) => (
              <div
                key={rule.label}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <rule.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm">{rule.label}</span>
                </div>
                <span className="text-sm font-semibold text-primary">{rule.points}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-serif text-primary mb-4">Redeem</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summary?.catalog.map((reward) => {
            const affordable = balance >= reward.points;
            const progress = Math.min(100, (balance / reward.points) * 100);
            return (
              <Card key={reward.id} className={affordable ? "border-primary/50" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base leading-snug">{reward.title}</CardTitle>
                  <CardDescription className="text-xs">{reward.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm font-semibold text-primary">
                    {reward.points.toLocaleString()} pts
                  </div>
                  {!affordable && <Progress value={progress} className="h-1.5" />}
                  <Button
                    className="w-full rounded-full"
                    size="sm"
                    variant={affordable ? "default" : "outline"}
                    disabled={!affordable || redeem.isPending}
                    onClick={() => void handleRedeem(reward.id, reward.title)}
                  >
                    {affordable
                      ? "Redeem"
                      : `${(reward.points - balance).toLocaleString()} pts to go`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-serif text-primary mb-4">History</h2>
        <Card>
          <CardContent className="p-0">
            {summary && summary.history.length > 0 ? (
              <div className="divide-y divide-border">
                {summary.history.map((event) => (
                  <div key={event.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{event.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(`${event.date}T00:00:00`), "MMM d, yyyy")}
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        event.points >= 0 ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {event.points >= 0 ? `+${event.points}` : event.points}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No activity yet — do your Glow check-in, weigh in, or log a meal to start earning!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={redemption !== null} onOpenChange={(o) => !o && setRedemption(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <Ticket className="h-5 w-5 text-primary" /> Reward Redeemed!
            </DialogTitle>
            <DialogDescription>{redemption?.title}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="text-3xl font-mono font-bold tracking-widest text-primary">
              {redemption?.code}
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Mention this code at the front desk or when booking your next appointment at LUXE.
            </p>
          </div>
          <Button onClick={() => setRedemption(null)}>Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
