import {
  useGetDashboardSummary,
  useGetDailyTip,
  useGetBriefing,
  getGetBriefingQueryKey,
  useListAnnouncements,
  useGetCurrentDoctorTip,
  useListOffers,
  getListOffersQueryKey,
  useClaimOffer,
  useGetMe,
  useGetStreak,
  useGetToday,
  getGetTodayQueryKey,
  useCompleteToday,
  getGetRewardsSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Flame,
  Droplets,
  Target,
  Calendar,
  Sparkles,
  CheckCircle2,
  Circle,
  ChevronRight,
  Megaphone,
  Stethoscope,
  BadgePercent,
  Ticket,
  Gift,
} from "lucide-react";
import { Link } from "wouter";

function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  return (
    <div className="relative w-32 h-32 shrink-0" data-testid="wellness-score-ring">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-secondary" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-primary transition-all duration-700"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-serif" data-testid="text-wellness-score">
          {score}
        </span>
        <span className="text-xs text-muted-foreground">of 100</span>
      </div>
    </div>
  );
}

function daysLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  return `${days} days left`;
}

function OffersCard() {
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const { data: offersData } = useListOffers();
  const claimOffer = useClaimOffer({
    mutation: {
      onSuccess: () => {
        toast.success("Offer claimed! Show your code at the front desk.");
        void queryClient.invalidateQueries({ queryKey: getListOffersQueryKey() });
      },
      onError: () => toast.error("Couldn't claim this offer. Please try again."),
    },
  });
  const offers = offersData?.offers ?? [];
  if (offers.length === 0) return null;
  const isPatient = me?.role === "patient";

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-sans font-medium text-primary flex items-center gap-2">
          <BadgePercent className="h-4 w-4" />
          Limited-time offers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {offers.map((o) => (
          <div key={o.id} data-testid={`offer-${o.id}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-serif text-lg">{o.title}</h3>
              <span className="text-xs text-muted-foreground shrink-0">{daysLeft(o.endsAt)}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {o.description}
            </p>
            {o.claimed && o.claimCode ? (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Ticket className="h-4 w-4 text-primary" />
                <span className="font-mono tracking-widest" data-testid={`offer-code-${o.id}`}>
                  {o.claimCode}
                </span>
                <span className="text-xs text-muted-foreground">
                  — show this code at the front desk
                </span>
              </div>
            ) : isPatient ? (
              <Button
                size="sm"
                className="mt-2 rounded-full"
                disabled={claimOffer.isPending}
                onClick={() => claimOffer.mutate({ id: o.id })}
                data-testid={`button-claim-offer-${o.id}`}
              >
                Claim this offer
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TodayAtLuxeCard() {
  const queryClient = useQueryClient();
  const { data: today, isLoading } = useGetToday({ query: { queryKey: getGetTodayQueryKey() } });
  const complete = useCompleteToday();

  if (isLoading || !today) return null;

  const DESTINATIONS: Record<string, string> = {
    weigh_in: "/weight",
    log_meal: "/food",
    glow_checkin: "/glow",
    mind_checkin: "/mind",
    move: "/activity",
    skincare: "/routine",
  };

  const handleClaim = () => {
    complete.mutate(undefined, {
      onSuccess: (res) => {
        if (res.awarded) {
          toast.success(`Today complete! You earned ${res.points} points`);
          queryClient.invalidateQueries({ queryKey: getGetTodayQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBriefingQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRewardsSummaryQueryKey() });
        }
      },
      onError: () => toast.error("Could not claim points. Make sure all actions are done."),
    });
  };

  return (
    <Card className="bg-primary/5 border-primary/20 shadow-md mb-8">
      <CardContent className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
          <div>
            <h2 className="text-2xl font-serif text-primary mb-1">Today at LUXE</h2>
            <p className="font-serif text-lg text-foreground">{today.focus.title}</p>
            <p className="text-sm text-muted-foreground mt-1">{today.focus.message}</p>
          </div>
          {today.focus.actionKey && DESTINATIONS[today.focus.actionKey] && (
            <Link href={DESTINATIONS[today.focus.actionKey]}>
              <Button variant="outline" className="shrink-0 rounded-full">
                Focus Action <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Your Daily Habits</h3>
            <div className="space-y-2">
              {today.checkins.map((checkin) => (
                <Link key={checkin.key} href={DESTINATIONS[checkin.key] || "/"}>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer">
                    {checkin.done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={`text-sm font-medium flex-1 ${checkin.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {checkin.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-6 bg-card rounded-2xl p-6 border border-border">
            <div className="text-center">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-3">
                <Gift className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium text-lg mb-1">Daily Reward</h3>
              <p className="text-sm text-muted-foreground mb-4">Complete all habits to earn +{today.completePoints} pts</p>
              
              {today.completedToday ? (
                <div className="py-2 px-4 bg-emerald-500/10 text-emerald-600 rounded-full text-sm font-medium inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Claimed today!
                </div>
              ) : (
                <Button 
                  className="w-full rounded-full h-12" 
                  disabled={!today.allDone || complete.isPending}
                  onClick={handleClaim}
                >
                  {complete.isPending ? "Claiming..." : today.allDone ? "Claim Points" : "Complete habits to claim"}
                </Button>
              )}
            </div>

            {(today.nextReward || today.trend) && (
              <div className="pt-4 border-t border-border/50 space-y-2">
                {today.nextReward && (
                  <p className="text-sm text-center text-muted-foreground">
                    You are <span className="font-medium text-foreground">{today.nextReward.pointsAway} pts</span> away from <span className="font-medium text-foreground">{today.nextReward.title}</span>!
                  </p>
                )}
                {today.trend && (
                  <p className="text-xs text-center text-primary/80 font-medium">
                    {today.trend}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: briefing, isLoading: briefingLoading } = useGetBriefing();
  const { data: dailyTip } = useGetDailyTip();
  const { data: announcementsData } = useListAnnouncements();
  const { data: doctorTipData } = useGetCurrentDoctorTip();
  const { data: streak } = useGetStreak();
  const announcements = announcementsData?.announcements ?? [];
  const doctorTip = doctorTipData?.tip ?? null;

  if (summaryLoading || briefingLoading)
    return (
      <div className="h-full flex items-center justify-center">
        Preparing your morning briefing...
      </div>
    );
  if (!summary || !briefing) return <div>Failed to load your overview.</div>;

  const calProgress = summary.calorieTarget
    ? Math.min(100, (summary.caloriesToday / summary.calorieTarget) * 100)
    : 0;
  const todosDone = briefing.todos.filter((t) => t.done).length;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-4xl mb-2 text-primary" data-testid="text-greeting">
          {greetingForNow()}
          {briefing.firstName ? `, ${briefing.firstName}` : ""}
        </h1>
        <p className="text-muted-foreground text-lg mb-8">Here's your briefing for today.</p>
      </div>

      <TodayAtLuxeCard />

      {/* Morning briefing + wellness score */}
      <Card className="bg-gradient-to-br from-primary/5 via-card to-accent/5 border-border shadow-sm">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <ScoreRing score={briefing.wellnessScore} />
            <div className="flex-1 space-y-3 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                Today's Wellness Score
              </div>
              <p className="text-xs text-muted-foreground md:text-left text-center mt-0 pt-0">A consistency score — not a medical assessment.</p>
              {briefing.aiBriefing ? (
                <p className="text-lg leading-relaxed font-serif" data-testid="text-ai-briefing">
                  {briefing.aiBriefing}
                </p>
              ) : (
                <p className="text-lg leading-relaxed font-serif text-muted-foreground">
                  Log your habits, meals, and weigh-in to build today's score.
                </p>
              )}
              <div className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {briefing.components.map((c) => (
                  <span key={c.key}>
                    {c.label}: {c.points}/{c.maxPoints}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly tip from the practice */}
      {doctorTip && (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans font-medium text-primary flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              This week's tip from Dr. Copley
            </CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="font-serif text-lg mb-1" data-testid="text-doctor-tip-title">
              {doctorTip.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {doctorTip.body}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Limited-time offers */}
      <OffersCard />

      {/* Spa announcements */}
      {announcements.length > 0 && (
        <Card className="border-accent/40 bg-accent/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans font-medium text-primary flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              What's new at LUXE
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {announcements.slice(0, 3).map((a) => (
              <div key={a.id} data-testid={`announcement-${a.id}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-serif text-lg">{a.title}</h3>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {a.body}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Yesterday recap + tip */}
        <div className="space-y-4">
          <h2 className="text-2xl">Yesterday's Recap</h2>
          <Card className="shadow-sm border-border">
            <CardContent className="p-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Calories</p>
                <p className="text-2xl font-serif" data-testid="text-yesterday-calories">
                  {briefing.yesterday.calories ?? "—"}
                  {briefing.yesterday.calorieTarget != null && (
                    <span className="text-sm text-muted-foreground font-sans">
                      {" "}
                      / {briefing.yesterday.calorieTarget}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Protein</p>
                <p className="text-2xl font-serif">
                  {briefing.yesterday.proteinGrams != null
                    ? `${briefing.yesterday.proteinGrams}g`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Glow Score</p>
                <p className="text-2xl font-serif">{briefing.yesterday.glowScore ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Weight Change</p>
                <p className="text-2xl font-serif">
                  {briefing.yesterday.weightChangeLbs != null
                    ? `${briefing.yesterday.weightChangeLbs > 0 ? "+" : ""}${briefing.yesterday.weightChangeLbs} lbs`
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/50 border-none shadow-none">
            <CardContent className="p-5">
              {dailyTip ? (
                <>
                  <h3 className="font-serif text-lg mb-1">{dailyTip.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {dailyTip.content}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Drink plenty of water today!</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card shadow-sm border-border overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -z-10" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Weight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif">
              {summary.currentWeightLbs ? `${summary.currentWeightLbs} lbs` : "—"}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {summary.weightChangeLbs
                ? `${summary.weightChangeLbs > 0 ? "+" : ""}${summary.weightChangeLbs} lbs total`
                : "No change yet"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 rounded-bl-full -z-10" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans font-medium text-muted-foreground flex items-center gap-2">
              <Droplets className="h-4 w-4 text-accent" />
              Calories Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif">
              {summary.caloriesToday}{" "}
              <span className="text-lg text-muted-foreground">
                / {summary.calorieTarget || "—"}
              </span>
            </div>
            <Progress value={calProgress} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-bl-full -z-10" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans font-medium text-muted-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Wellness Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif" data-testid="text-streak-days">
              {streak ? streak.current : summary.loggingStreakDays}{" "}
              <span className="text-lg text-muted-foreground font-sans">
                {(streak ? streak.current : summary.loggingStreakDays) === 1 ? "day" : "days"}
              </span>
            </div>
            {streak?.nextMilestone ? (
              <>
                <Progress
                  value={Math.min(100, (streak.current / streak.nextMilestone.days) * 100)}
                  className="h-2 mt-3"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {streak.nextMilestone.days - streak.current} more{" "}
                  {streak.nextMilestone.days - streak.current === 1 ? "day" : "days"} to +
                  {streak.nextMilestone.points} pts
                </p>
              </>
            ) : streak ? (
              <p className="text-sm text-muted-foreground mt-1">
                All milestones earned — longest: {streak.longest} days
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Keep it up!</p>
            )}
            {streak && !streak.todayCounted && (
              <p className="text-xs text-orange-600/80 mt-1">
                Log anything today to keep your streak alive
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary text-primary-foreground shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans font-medium opacity-80 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Next Appointment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {briefing.nextAppointment ? (
              <>
                <div className="text-xl font-serif line-clamp-1">
                  {briefing.nextAppointment.serviceName}
                </div>
                <p className="text-sm opacity-80 mt-1">
                  {new Date(briefing.nextAppointment.date).toLocaleDateString()}{" "}
                  {briefing.nextAppointment.time}
                </p>
              </>
            ) : (
              <>
                <div className="text-lg font-serif">No upcoming</div>
                <Link href="/book">
                  <Button variant="secondary" size="sm" className="mt-3 w-full rounded-full">
                    Book Now
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Your briefing and wellness score are private to you — they are never shared with LUXE
        staff. This is general wellness encouragement, not medical advice.
      </p>
    </div>
  );
}
