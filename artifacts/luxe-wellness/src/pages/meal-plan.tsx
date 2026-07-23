import { useState } from "react";
import {
  useGetMealPlan,
  useGenerateMealPlan,
  getGetMealPlanQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarRange,
  ShoppingBasket,
  Sparkles,
  RefreshCw,
  Lightbulb,
  ChefHat,
} from "lucide-react";
import { toast } from "sonner";

const MEAL_LABELS: { key: "breakfast" | "lunch" | "dinner" | "snack"; label: string; emoji: string }[] = [
  { key: "breakfast", label: "Breakfast", emoji: "🌅" },
  { key: "lunch", label: "Lunch", emoji: "☀️" },
  { key: "dinner", label: "Dinner", emoji: "🌙" },
  { key: "snack", label: "Snack", emoji: "🍎" },
];

function fmtDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function fmtShort(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function MealPlan() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetMealPlan({
    query: { queryKey: getGetMealPlanQueryKey() },
  });
  const generate = useGenerateMealPlan();
  const [openDay, setOpenDay] = useState<string | null>(null);

  const plan = data?.plan ?? null;
  const remaining = data?.generationsRemaining ?? 0;
  const today = new Date().toLocaleDateString("en-CA");

  const runGenerate = () => {
    generate.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetMealPlanQueryKey() });
        toast.success("Your meal plan is ready!");
      },
      onError: (err) => {
        const e = err as { status?: number; data?: { error?: string } };
        if (e.status === 429) {
          toast.error(e.data?.error ?? "You've used this week's generations — a fresh plan unlocks Monday!");
        } else {
          toast.error("Couldn't create your plan just now. Please try again in a moment.");
        }
      },
    });
  };

  return (
    <div className="space-y-8 pb-12 max-w-3xl">
      <div>
        <h1 className="text-4xl mb-2 text-primary flex items-center gap-3">
          <CalendarRange className="h-8 w-8" />
          Meal Plan
        </h1>
        <p className="text-muted-foreground text-lg">
          A simple week of meals, tailored to your goals and the foods you already love.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Loading your plan...
          </CardContent>
        </Card>
      ) : !plan ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center space-y-4">
            <ChefHat className="h-10 w-10 text-primary mx-auto" />
            <p className="font-serif text-xl">No plan for this week yet</p>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Luxe AI will build a 7-day plan around your calorie target and recent food logs —
              plus a grocery list to match. It takes about a minute.
            </p>
            <Button
              className="rounded-full"
              disabled={generate.isPending || remaining <= 0}
              onClick={runGenerate}
              data-testid="button-generate-plan"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {generate.isPending ? "Building your week…" : "Create my meal plan"}
            </Button>
            {generate.isPending && (
              <p className="text-xs text-muted-foreground">
                This can take up to a minute — hang tight!
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 -mt-4">
            <p className="text-sm text-muted-foreground">
              Week of {fmtShort(plan.weekStart)} – {fmtShort(plan.weekEnd)}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={generate.isPending || remaining <= 0}
              onClick={runGenerate}
              data-testid="button-regenerate-plan"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${generate.isPending ? "animate-spin" : ""}`} />
              {generate.isPending
                ? "Rebuilding…"
                : remaining > 0
                  ? `Regenerate (${remaining} left)`
                  : "New plan Monday"}
            </Button>
          </div>

          {plan.notes && (
            <Card className="bg-secondary/50 border-none shadow-none">
              <CardContent className="p-5 flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-muted-foreground text-sm leading-relaxed">{plan.notes}</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {plan.days.map((day) => {
              const isToday = day.date === today;
              const expanded = openDay ? openDay === day.date : isToday;
              const total = MEAL_LABELS.reduce((s, m) => s + day[m.key].calories, 0);
              return (
                <Card
                  key={day.date}
                  className={isToday ? "border-primary/40 shadow-sm" : "shadow-sm border-border"}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setOpenDay(expanded ? "" : day.date)}
                  >
                    <CardHeader className="py-4">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base font-serif flex items-center gap-2">
                          {fmtDay(day.date)}
                          {isToday && (
                            <Badge className="text-[10px] uppercase tracking-wide">Today</Badge>
                          )}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">~{total} cal</span>
                      </div>
                    </CardHeader>
                  </button>
                  {expanded && (
                    <CardContent className="pt-0 space-y-3">
                      {MEAL_LABELS.map((m) => {
                        const meal = day[m.key];
                        return (
                          <div key={m.key} className="flex items-start gap-3">
                            <span aria-hidden className="text-lg leading-6">
                              {m.emoji}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-sm font-medium">{meal.name}</p>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {meal.calories} cal
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{meal.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {plan.grocery.length > 0 && (
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-sans font-medium text-primary flex items-center gap-2">
                  <ShoppingBasket className="h-4 w-4" />
                  Grocery list for the week
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {plan.grocery.map((cat) => (
                  <div key={cat.category}>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {cat.category}
                    </p>
                    <ul className="space-y-0.5">
                      {cat.items.map((item, i) => (
                        <li key={i} className="text-sm">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Your meal plan is private to you — it is never shared with LUXE staff. This is general
        wellness guidance, not medical or dietetic advice. Check with your doctor about any
        dietary needs or restrictions.
      </p>
    </div>
  );
}
