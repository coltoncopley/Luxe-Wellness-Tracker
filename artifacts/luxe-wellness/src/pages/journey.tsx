import { useState } from "react";
import { useGetJourney } from "@workspace/api-client-react";
import type { JourneyDay, JourneyPhoto } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Milestone, Camera, Scale, Sun, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.BASE_URL;

function photoUrl(objectPath: string): string {
  return `${API_BASE}api/storage${objectPath}`;
}

function fmtLong(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function fmtMonth(key: string): string {
  return new Date(`${key}-15T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function Journey() {
  const { data, isLoading } = useGetJourney();
  const [viewed, setViewed] = useState<JourneyPhoto | null>(null);

  if (isLoading)
    return <div className="h-full flex items-center justify-center">Loading your journey...</div>;
  if (!data) return <div>Failed to load your journey.</div>;

  const days = [...data.days].reverse();
  const change =
    data.startWeightLbs != null && data.currentWeightLbs != null
      ? Math.round((data.currentWeightLbs - data.startWeightLbs) * 10) / 10
      : null;

  const byMonth = new Map<string, JourneyDay[]>();
  for (const d of days) {
    const k = monthKey(d.date);
    const list = byMonth.get(k) ?? [];
    list.push(d);
    byMonth.set(k, list);
  }

  return (
    <div className="space-y-8 pb-12 max-w-3xl">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <Milestone className="h-8 w-8" />
          My Journey
        </h1>
        <p className="text-muted-foreground text-lg">
          Your whole story in one place — weigh-ins, glow days, and progress photos.
        </p>
      </div>

      {days.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center space-y-3">
            <p className="font-serif text-xl">Your journey starts today</p>
            <p className="text-muted-foreground text-sm">
              Log a weigh-in, a glow check-in, or a progress photo and it will appear here.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link href="/weight">
                <Button size="sm" className="rounded-full">
                  Log weight
                </Button>
              </Link>
              <Link href="/photos">
                <Button size="sm" variant="outline" className="rounded-full">
                  Add a photo
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {change != null && (
            <Card className="bg-gradient-to-br from-primary/5 via-card to-accent/5 shadow-sm">
              <CardContent className="p-6 flex flex-wrap items-center gap-x-10 gap-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Started at</p>
                  <p className="text-2xl font-serif" data-testid="text-journey-start">
                    {data.startWeightLbs} lbs
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Now</p>
                  <p className="text-2xl font-serif" data-testid="text-journey-current">
                    {data.currentWeightLbs} lbs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {change <= 0 ? (
                    <TrendingDown className="h-6 w-6 text-primary" />
                  ) : (
                    <TrendingUp className="h-6 w-6 text-accent" />
                  )}
                  <p className="text-2xl font-serif" data-testid="text-journey-change">
                    {change > 0 ? "+" : ""}
                    {change} lbs
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-10">
            {[...byMonth.entries()].map(([month, list]) => (
              <section key={month}>
                <h2 className="text-xl text-muted-foreground mb-4 font-serif">
                  {fmtMonth(month)}
                </h2>
                <div className="relative border-l-2 border-border ml-3 space-y-6">
                  {list.map((day) => (
                    <div key={day.date} className="relative pl-6" data-testid={`journey-day-${day.date}`}>
                      <span className="absolute -left-[7px] top-2 h-3 w-3 rounded-full bg-primary" />
                      <p className="text-sm font-medium">{fmtLong(day.date)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {day.weightLbs != null && (
                          <span className="inline-flex items-center gap-1.5 text-sm bg-secondary rounded-full px-3 py-1">
                            <Scale className="h-3.5 w-3.5 text-primary" />
                            {day.weightLbs} lbs
                          </span>
                        )}
                        {day.glowScore != null && (
                          <span className="inline-flex items-center gap-1.5 text-sm bg-secondary rounded-full px-3 py-1">
                            <Sun className="h-3.5 w-3.5 text-accent" />
                            Glow {day.glowScore}
                          </span>
                        )}
                        {day.photos.length > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-sm bg-secondary rounded-full px-3 py-1">
                            <Camera className="h-3.5 w-3.5 text-primary" />
                            {day.photos.length} photo{day.photos.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                      {day.photos.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {day.photos.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => setViewed(p)}
                              className="rounded-xl overflow-hidden border border-border hover:opacity-90 transition-opacity"
                              data-testid={`journey-photo-${p.id}`}
                            >
                              <img
                                src={photoUrl(p.objectPath)}
                                alt={p.note ?? `Progress photo ${p.category}`}
                                className="h-24 w-24 object-cover"
                                loading="lazy"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Your journey is private to you — it is never shared with LUXE staff.
      </p>

      <Dialog open={!!viewed} onOpenChange={(open) => !open && setViewed(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif capitalize">
              {viewed ? `${viewed.category} photo` : ""}
            </DialogTitle>
          </DialogHeader>
          {viewed && (
            <div className="space-y-2">
              <img
                src={photoUrl(viewed.objectPath)}
                alt={viewed.note ?? "Progress photo"}
                className="w-full rounded-xl"
              />
              {viewed.note && <p className="text-sm text-muted-foreground">{viewed.note}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
