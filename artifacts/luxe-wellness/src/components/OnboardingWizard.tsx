import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  getGetMeQueryKey,
  useCompleteOnboarding,
} from "@workspace/api-client-react";
import type {
  OnboardingInputPrimaryGoal,
  OnboardingInputDailyActionsItem,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const GOALS = [
  { value: "weight_nutrition", label: "Weight & nutrition" },
  { value: "better_skin", label: "Better skin" },
  { value: "daily_wellness", label: "Daily wellness habits" },
  { value: "hormone_education", label: "Hormone health education" },
  { value: "maintain_results", label: "Maintain my results" },
];

const ACTIONS = [
  { value: "weigh_in", label: "Log your weigh-in" },
  { value: "log_meal", label: "Log a meal" },
  { value: "glow_checkin", label: "Glow check-in" },
  { value: "mind_checkin", label: "Mind check-in" },
  { value: "move", label: "Move your body" },
  { value: "skincare", label: "Skincare routine" },
];

const RECOMMENDATIONS: Record<string, string[]> = {
  weight_nutrition: ["weigh_in", "log_meal", "glow_checkin"],
  better_skin: ["skincare", "glow_checkin", "log_meal"],
  daily_wellness: ["glow_checkin", "mind_checkin", "move"],
  hormone_education: ["glow_checkin", "weigh_in", "mind_checkin"],
  maintain_results: ["weigh_in", "glow_checkin", "move"],
};

export function OnboardingWizard() {
  const queryClient = useQueryClient();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const complete = useCompleteOnboarding();

  const [step, setStep] = useState<"welcome" | "goal" | "actions">("welcome");
  const [primaryGoal, setPrimaryGoal] = useState<string>("");
  const [dailyActions, setDailyActions] = useState<string[]>([]);

  if (!me || me.role !== "patient" || !me.privacyAcknowledged || me.onboarded) {
    return null;
  }

  const handleSkip = () => {
    complete.mutate(
      {
        data: {
          primaryGoal: "daily_wellness",
          dailyActions: RECOMMENDATIONS.daily_wellness as OnboardingInputDailyActionsItem[],
        },
      },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetMeQueryKey(), data.user);
          if (data.welcomePoints > 0) {
            toast.success(`Welcome to LUXE! You earned ${data.welcomePoints} points.`);
          }
        },
      }
    );
  };

  const handleSubmit = () => {
    complete.mutate(
      {
        data: {
          primaryGoal: primaryGoal as OnboardingInputPrimaryGoal,
          dailyActions: dailyActions as OnboardingInputDailyActionsItem[],
        },
      },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetMeQueryKey(), data.user);
          if (data.welcomePoints > 0) {
            toast.success(`Welcome to LUXE! You earned ${data.welcomePoints} points.`);
          } else {
            toast.success("Welcome to LUXE!");
          }
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-xl w-full">
        {step === "welcome" && (
          <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-serif text-primary">Welcome to LUXE Wellness</h1>
            <p className="text-lg text-muted-foreground">
              Your personal companion for medical aesthetics and wellness. Let's set up your daily routine to help you achieve your goals.
            </p>
            <div className="pt-8 flex flex-col gap-3">
              <Button size="lg" className="text-lg rounded-full h-14" onClick={() => setStep("goal")}>
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="ghost" className="text-muted-foreground" onClick={handleSkip} disabled={complete.isPending}>
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {step === "goal" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-serif text-primary mb-2">What's your primary focus?</h2>
              <p className="text-muted-foreground">We'll tailor your daily recommendations based on this.</p>
            </div>
            <RadioGroup value={primaryGoal} onValueChange={setPrimaryGoal} className="gap-3">
              {GOALS.map((goal) => (
                <Label
                  key={goal.value}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    primaryGoal === goal.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                >
                  <RadioGroupItem value={goal.value} />
                  <span className="text-lg font-medium">{goal.label}</span>
                </Label>
              ))}
            </RadioGroup>
            <div className="pt-6 flex gap-3">
              <Button
                size="lg"
                className="w-full text-lg rounded-full h-14"
                disabled={!primaryGoal}
                onClick={() => {
                  setDailyActions(RECOMMENDATIONS[primaryGoal] || []);
                  setStep("actions");
                }}
              >
                Continue <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {step === "actions" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-serif text-primary mb-2">Your Daily Habits</h2>
              <p className="text-muted-foreground">We've selected these based on your goal, but you can adjust them. (Pick at least 1)</p>
            </div>
            <div className="grid gap-3">
              {ACTIONS.map((action) => (
                <Label
                  key={action.value}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    dailyActions.includes(action.value) ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                >
                  <Checkbox
                    checked={dailyActions.includes(action.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setDailyActions((prev) => [...prev, action.value]);
                      } else {
                        setDailyActions((prev) => prev.filter((a) => a !== action.value));
                      }
                    }}
                  />
                  <span className="text-lg font-medium">{action.label}</span>
                </Label>
              ))}
            </div>
            <div className="pt-6 flex gap-3">
              <Button variant="outline" size="lg" className="rounded-full h-14" onClick={() => setStep("goal")}>
                Back
              </Button>
              <Button
                size="lg"
                className="flex-1 text-lg rounded-full h-14"
                disabled={dailyActions.length === 0 || complete.isPending}
                onClick={handleSubmit}
              >
                {complete.isPending ? "Saving..." : "Complete Setup"} <Check className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
