import { useState } from "react";
import {
  useGetRewardsSummary,
  useRedeemReward,
  getGetRewardsSummaryQueryKey,
  useGetReferralSummary,
  useListMissions,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
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
import {
  Gift,
  Sparkles,
  Scale,
  Utensils,
  Flame,
  Ticket,
  Share2,
  Copy,
  QrCode,
  Users,
  Trophy,
  Target,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const EARN_RULES = [
  { icon: Sparkles, label: "Daily Glow check-in", points: "+20" },
  { icon: Scale, label: "Daily weigh-in", points: "+10" },
  { icon: Utensils, label: "Log a meal (up to 3/day)", points: "+5" },
  { icon: Flame, label: "Every 7-day Glow streak", points: "+50" },
  { icon: Users, label: "Invite a friend who joins", points: "+100" },
];

const TIER_STYLES: Record<string, string> = {
  Bronze: "bg-amber-100 text-amber-900",
  Silver: "bg-slate-200 text-slate-800",
  Gold: "bg-yellow-100 text-yellow-800",
  Platinum: "bg-violet-100 text-violet-900",
};

function MissionsCard() {
  const { data } = useListMissions();
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" /> This week&apos;s missions
        </CardTitle>
        <CardDescription>
          {format(new Date(`${data.weekStart}T00:00:00`), "MMM d")} –{" "}
          {format(new Date(`${data.weekEnd}T00:00:00`), "MMM d")} ·{" "}
          {data.completedCount}/{data.missions.length} complete — finish them all for bonus
          points
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.missions.map((m) => (
          <div
            key={m.key}
            className={`rounded-xl border px-4 py-3 space-y-2 ${
              m.completed ? "border-primary/50 bg-primary/5" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {m.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Target className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">{m.title}</span>
              </div>
              <span className="text-sm font-semibold text-primary">+{m.rewardPoints}</span>
            </div>
            <p className="text-xs text-muted-foreground">{m.description}</p>
            <div className="flex items-center gap-2">
              <Progress value={(m.progress / m.target) * 100} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {m.progress}/{m.target}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function InviteFriendsCard() {
  const { data: referral } = useGetReferralSummary();
  const [qrOpen, setQrOpen] = useState(false);

  if (!referral) return null;

  const base = import.meta.env.BASE_URL;
  const shareUrl = `${window.location.origin}${base}?ref=${referral.code}`;
  const shareMessage = `Join me on the LUXE Wellness app! Track your health journey, earn rewards, and get ${referral.friendPoints} bonus points when you sign up with my link: ${shareUrl}`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "LUXE Wellness & Aesthetics",
          text: shareMessage,
        });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    await copyLink();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Invite link copied!");
    } catch {
      toast.error("Couldn't copy the link — your code is " + referral!.code);
    }
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" /> Invite friends, earn points
        </CardTitle>
        <CardDescription>
          You get <span className="font-semibold text-primary">+{referral.referrerPoints}</span>{" "}
          points for every friend who joins — they get{" "}
          <span className="font-semibold text-primary">+{referral.friendPoints}</span> too.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-mono truncate">
            {shareUrl}
          </div>
          <div className="flex gap-2">
            <Button className="rounded-full" onClick={() => void handleShare()}>
              <Share2 className="h-4 w-4 mr-1.5" /> Share
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => void copyLink()}>
              <Copy className="h-4 w-4 mr-1.5" /> Copy
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => setQrOpen(true)}>
              <QrCode className="h-4 w-4 mr-1.5" /> QR
            </Button>
          </div>
        </div>
        {referral.invitedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {referral.invitedCount} friend{referral.invitedCount === 1 ? "" : "s"} joined with your
            invite · {referral.pointsEarned} points earned from referrals
          </p>
        )}
      </CardContent>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-primary" /> Your invite QR code
            </DialogTitle>
            <DialogDescription>
              Have a friend scan this with their phone camera to join LUXE with your invite.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center gap-4">
            <div className="rounded-2xl border border-border bg-white p-4">
              <QRCodeSVG value={shareUrl} size={208} level="M" />
            </div>
            <div className="text-sm text-muted-foreground">
              Invite code: <span className="font-mono font-semibold text-primary">{referral.code}</span>
            </div>
          </div>
          <Button onClick={() => setQrOpen(false)}>Done</Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

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
            {summary?.tier && (
              <div className="mt-4 flex flex-col items-center gap-2 w-full">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                    TIER_STYLES[summary.tier.name] ?? "bg-white/20"
                  }`}
                >
                  <Trophy className="h-3 w-3" /> {summary.tier.name} member
                </span>
                {summary.tier.nextName && summary.tier.nextMinPoints !== null && (
                  <div className="w-full px-2">
                    <Progress
                      value={Math.min(
                        100,
                        ((summary.totalEarned - summary.tier.minPoints) /
                          (summary.tier.nextMinPoints - summary.tier.minPoints)) *
                          100,
                      )}
                      className="h-1.5 bg-white/20"
                    />
                    <div className="text-[11px] mt-1 text-center opacity-75">
                      {summary.tier.nextMinPoints - summary.totalEarned} pts to{" "}
                      {summary.tier.nextName}
                    </div>
                  </div>
                )}
              </div>
            )}
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

      <MissionsCard />

      <InviteFriendsCard />

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
        <p className="text-xs text-muted-foreground mt-4">
          Limit one reward redemption per visit — rewards cannot be combined or used together.
          Points have no monetary value and cannot be transferred, sold, or exchanged for cash.
        </p>
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
            <p className="text-xs text-muted-foreground mt-2">
              Limit one reward per visit — rewards can't be combined. Points have no monetary
              value and can't be transferred.
            </p>
          </div>
          <Button onClick={() => setRedemption(null)}>Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
