import {
  useGetDashboardSummary,
  useGetDailyTip,
  useGetBriefing,
  useListAnnouncements,
  useGetCurrentDoctorTip,
  useListOffers,
  getListOffersQueryKey,
  useClaimOffer,
  useGetMe,
  useGetStreak,
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
        <p className="text-muted-foreground text-lg">Here's your briefing for today.</p>
      </div>

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
        {/* Today's to-dos */}
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl">Today's To-Dos</h2>
            <span className="text-sm text-muted-foreground" data-testid="text-todos-progress">
              {todosDone}/{briefing.todos.length} done
            </span>
          </div>
          <Card className="shadow-sm border-border">
            <CardContent className="p-2">
              <ul className="divide-y divide-border">
                {briefing.todos.map((todo) => (
                  <li key={todo.id}>
                    <Link
                      href={todo.href}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer"
                      data-testid={`todo-${todo.id}`}
                    >
                      {todo.done ? (
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                      )}
                      <span
                        className={
                          todo.done ? "line-through text-muted-foreground flex-1" : "flex-1"
                        }
                      >
                        {todo.label}
                      </span>
                      {!todo.done && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

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
