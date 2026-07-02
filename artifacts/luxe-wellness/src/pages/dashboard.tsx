import { useGetDashboardSummary, useGetDailyTip, useListAppointments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, Droplets, Target, Calendar, ArrowRight, Activity, Utensils } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: dailyTip } = useGetDailyTip();

  if (isLoading) return <div className="h-full flex items-center justify-center">Loading your wellness overview...</div>;
  if (!summary) return <div>Failed to load summary.</div>;

  const calProgress = summary.calorieTarget ? Math.min(100, (summary.caloriesToday / summary.calorieTarget) * 100) : 0;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-4xl mb-2 text-primary">Welcome Back</h1>
        <p className="text-muted-foreground text-lg">Here is your wellness overview for today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card shadow-sm border-border overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -z-10" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Weight Goal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif">{summary.currentWeightLbs ? `${summary.currentWeightLbs} lbs` : "—"}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {summary.weightChangeLbs ? `${summary.weightChangeLbs > 0 ? '+' : ''}${summary.weightChangeLbs} lbs total` : "No change yet"}
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
            <div className="text-3xl font-serif">{summary.caloriesToday} <span className="text-lg text-muted-foreground">/ {summary.calorieTarget || "—"}</span></div>
            <Progress value={calProgress} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-bl-full -z-10" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-sans font-medium text-muted-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Logging Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif">{summary.loggingStreakDays} <span className="text-lg text-muted-foreground font-sans">days</span></div>
            <p className="text-sm text-muted-foreground mt-1">Keep it up!</p>
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
            {summary.nextAppointment ? (
              <>
                <div className="text-xl font-serif line-clamp-1">{summary.nextAppointment.serviceName}</div>
                <p className="text-sm opacity-80 mt-1">{new Date(summary.nextAppointment.date).toLocaleDateString()} {summary.nextAppointment.time}</p>
              </>
            ) : (
              <>
                <div className="text-lg font-serif">No upcoming</div>
                <Link href="/book">
                  <Button variant="secondary" size="sm" className="mt-3 w-full rounded-full">Book Now</Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-2xl">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/food" className="group p-6 bg-card border border-border rounded-2xl hover:border-primary/50 transition-colors shadow-sm cursor-pointer flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Utensils className="h-6 w-6 text-primary" />
              </div>
              <span className="font-medium">Log Meal</span>
            </Link>
            <Link href="/weight" className="group p-6 bg-card border border-border rounded-2xl hover:border-primary/50 transition-colors shadow-sm cursor-pointer flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <span className="font-medium">Log Weight</span>
            </Link>
          </div>
        </div>

        {/* Tip of the Day */}
        <div className="space-y-4">
          <h2 className="text-2xl">Tip of the Day</h2>
          <Card className="bg-secondary/50 border-none shadow-none">
            <CardContent className="p-6">
              {dailyTip ? (
                <>
                  <h3 className="font-serif text-xl mb-2">{dailyTip.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{dailyTip.content}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Drink plenty of water today!</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
