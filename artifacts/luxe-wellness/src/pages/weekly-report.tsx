import { useGetWeeklyReport, getGetWeeklyReportQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileHeart,
  Sparkles,
  Utensils,
  Scale,
  Sun,
  Footprints,
  TrendingDown,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";
import { Link } from "wouter";

function fmtDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function WeeklyReport() {
  const { data, isLoading, isError, refetch, error } = useGetWeeklyReport({
    query: { retry: 1, queryKey: getGetWeeklyReportQueryKey() },
  });

  const report = data?.report ?? null;

  return (
    <div className="space-y-8 pb-12 max-w-3xl">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <FileHeart className="h-8 w-8" />
          Weekly Report
        </h1>
        <p className="text-muted-foreground text-lg">
          A look back at last week — written just for you.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Reviewing your week...
          </CardContent>
        </Card>
      ) : isError ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center space-y-3">
            <p className="font-serif text-xl">Your report isn't ready yet</p>
            <p className="text-muted-foreground text-sm">
              {(error as { error?: string } | null)?.error ??
                "We couldn't put your report together just now. Please try again in a moment."}
            </p>
            <Button size="sm" className="rounded-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !report ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center space-y-3">
            <p className="font-serif text-xl">Nothing to report — yet</p>
            <p className="text-muted-foreground text-sm">
              You didn't log anything last week, so there's no report this time. Start logging
              today and next Monday you'll have a full recap waiting here.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link href="/food">
                <Button size="sm" className="rounded-full">
                  Log a meal
                </Button>
              </Link>
              <Link href="/glow">
                <Button size="sm" variant="outline" className="rounded-full">
                  Glow check-in
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground -mt-4">
            Week of {fmtDay(report.weekStart)} – {fmtDay(report.weekEnd)}
          </p>

          <Card className="bg-gradient-to-br from-primary/5 via-card to-accent/5 shadow-sm">
            <CardContent className="p-6 md:p-8 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                Your week in review
              </div>
              <p className="text-lg leading-relaxed font-serif" data-testid="text-report-summary">
                {report.summary}
              </p>
            </CardContent>
          </Card>

          {report.highlights.length > 0 && (
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-sans font-medium text-primary">
                  Wins from last week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-sm border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Utensils className="h-3.5 w-3.5 text-primary" />
                  Meals logged
                </div>
                <p className="text-2xl font-serif">{report.stats.mealsLogged}</p>
                {report.stats.avgCalories != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ~{report.stats.avgCalories} cal/day
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Scale className="h-3.5 w-3.5 text-primary" />
                  Weigh-ins
                </div>
                <p className="text-2xl font-serif">{report.stats.weighIns}</p>
                {report.stats.weightChangeLbs != null && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    {report.stats.weightChangeLbs <= 0 ? (
                      <TrendingDown className="h-3 w-3 text-primary" />
                    ) : (
                      <TrendingUp className="h-3 w-3 text-accent" />
                    )}
                    {report.stats.weightChangeLbs > 0 ? "+" : ""}
                    {report.stats.weightChangeLbs} lbs
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Sun className="h-3.5 w-3.5 text-accent" />
                  Glow check-ins
                </div>
                <p className="text-2xl font-serif">{report.stats.glowCheckins}</p>
                {report.stats.avgGlowScore != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    avg score {report.stats.avgGlowScore}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Footprints className="h-3.5 w-3.5 text-primary" />
                  Activity
                </div>
                <p className="text-2xl font-serif">{report.stats.activeMinutes}m</p>
                {report.stats.steps > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {report.stats.steps.toLocaleString()} steps
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-secondary/50 border-none shadow-none">
            <CardContent className="p-5 flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-serif text-lg mb-1">Focus for this week</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{report.focus}</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Your weekly report is private to you — it is never shared with LUXE staff. This is general
        wellness encouragement, not medical advice.
      </p>
    </div>
  );
}
